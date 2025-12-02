import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt, { JwtPayload } from "jsonwebtoken";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// -------------------------
// Tipos y datos en memoria
// -------------------------

type Role = "worker" | "admin";
type EventType = "visita" | "juicio" | "vacaciones" | "cita médica" | "otros";
type Visibility = "only-me" | "all" | "some";

interface CalendarEvent {
  id: string;
  ownerId: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  status?: "pending" | "approved"; // solo vacaciones
  visibility: Visibility;
  viewers?: string[]; // userIds si visibility === "some"
  medicalJustificationFileName?: string;
}

// ✅ UN SOLO almacén en memoria
const calendarEvents: CalendarEvent[] = [];

interface User {
  id: string;
  username: string;
  fullName: string;
  password: string; // ¡ADVERTENCIA: Debería ser un hash cifrado!
  role: Role;
  isActive: boolean;
  vacationDaysPerYear?: number;
  // Datos para la cabecera del PDF
  workCenter?: string;
  companyCif?: string;
  companyCcc?: string;
  workerLastName?: string;
  workerFirstName?: string;
  workerNif?: string;
  workerSsNumber?: string;
  avatarDataUrl?: string | null;
}

type AbsenceType = "none" | "vacation" | "nonWorkingDay" | "medical";

interface StoredDay {
  day: number;
  morningIn?: string;
  morningOut?: string;
  afternoonIn?: string;
  afternoonOut?: string;
  totalMinutes?: number;
  absenceType?: AbsenceType;
  hasSignature?: boolean;
}

interface MonthHours {
  userId: string;
  year: number;
  month: number;
  days: StoredDay[];
  signatureDataUrl?: string | null;
}

interface CustomJwtPayload {
  userId: string;
  username: string;
  role: Role;
}

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-demo";

const users: User[] = [
  {
    id: "1",
    username: "admin",
    fullName: "Usuario Administración",
    password: "admin123",
    role: "admin",
    isActive: true,
    vacationDaysPerYear: 23,
    workCenter: "Centro principal",
    companyCif: "B23653157",
    companyCcc: "14/10631457/33",
    workerLastName: "Administración",
    workerFirstName: "Usuario",
    workerNif: "",
    workerSsNumber: "",
  },
  {
    id: "2",
    username: "trabajador1",
    fullName: "Trabajador Uno",
    password: "password1",
    role: "worker",
    isActive: true,
    vacationDaysPerYear: 23,
    workCenter: "Centro principal",
    companyCif: "B23653157",
    companyCcc: "14/10631457/33",
    workerLastName: "Uno",
    workerFirstName: "Trabajador",
    workerNif: "",
    workerSsNumber: "",
  },
];

const hoursStore: MonthHours[] = [];

// -------------------------
// Helpers
// -------------------------

const findUserById = (id: string): User | undefined =>
  users.find((u) => u.id === id);

const findUserByUsername = (username: string): User | undefined =>
  users.find((u) => u.username === username);

const findMonthHours = (
  userId: string,
  year: number,
  month: number
): MonthHours | undefined =>
  hoursStore.find(
    (h) => h.userId === userId && h.year === year && h.month === month
  );

// -------------------------
// Extender Request con user
// -------------------------

interface AuthRequest extends Request {
  user?: CustomJwtPayload;
}

// -------------------------
// Middlewares
// -------------------------

function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({ error: "Invalid Authorization format" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload | string;

    if (typeof decoded === "string") {
      res.status(401).json({ error: "Invalid token payload" });
      return;
    }

    const payload: CustomJwtPayload = {
      userId: decoded.userId as string,
      username: decoded.username as string,
      role: decoded.role as Role,
    };

    req.user = payload;
    next();
  } catch (err) {
    console.error("JWT error:", err);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function adminOnlyMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: admin only" });
    return;
  }
  next();
}

// -------------------------
// App y config básica
// -------------------------

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// -------------------------
// Auth
// -------------------------

app.post("/api/auth/login", (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "username y password son obligatorios" });
    return;
  }

  const user = findUserByUsername(username);

  // NOTA DE SEGURIDAD: Aquí es donde se debería usar 'comparePassword(password, user.password)'
  if (!user || user.password !== password) { 
    res.status(401).json({ error: "Usuario o contraseña incorrectos" });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({ error: "Usuario desactivado" });
    return;
  }

  const payload: CustomJwtPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      vacationDaysPerYear: user.vacationDaysPerYear,
    },
  });
});

// -------------------------
// Endpoints worker: horas
// -------------------------

app.get("/api/hours", authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!year || !month) {
    res.status(400).json({ error: "Parámetros year y month son obligatorios" });
    return;
  }

  const data = findMonthHours(userId, year, month);
  if (!data) {
    res.json({ exists: false, data: null });
    return;
  }

  res.json({ exists: true, data });
});

app.put("/api/hours", authMiddleware, (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const { year, month, days, signatureDataUrl } = req.body as {
    year: number;
    month: number;
    days: StoredDay[];
    signatureDataUrl?: string | null;
  };

  if (!year || !month || !Array.isArray(days)) {
    res.status(400).json({ error: "year, month y days son obligatorios" });
    return;
  }

  const computeMinutes = (start?: string, end?: string): number => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    return Math.max(endMin - startMin, 0);
  };

  let entry = findMonthHours(userId, year, month);
  if (!entry) {
    entry = { userId, year, month, days: [], signatureDataUrl: null };
    hoursStore.push(entry);
  }

  entry.days = days.map((d) => {
    const absence: AbsenceType = d.absenceType ?? "none";

    const morningMinutes = computeMinutes(d.morningIn, d.morningOut);
    const afternoonMinutes = computeMinutes(d.afternoonIn, d.afternoonOut);

    const totalMinutes =
      absence !== "none" ? 0 : morningMinutes + afternoonMinutes;

    return {
      ...d,
      absenceType: absence,
      totalMinutes,
      hasSignature: !!signatureDataUrl,
    };
  });

  entry.signatureDataUrl = signatureDataUrl ?? null;

  res.json({ ok: true });
});

// -------------------------
// Generación de PDF
// -------------------------

async function createPdfForMonth(
  monthData: MonthHours,
  user: User
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    bold = false,
    size = 10
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
  };

  // CABECERA
  drawText("REGISTRO DIARIO DE JORNADA", margin, y, true, 14);
  y -= 25;

  // Empresa y Centro
  drawText(`Empresa: JUMAR INGEN. Y PERITAC. S.L.`, margin, y, false, 9);
  y -= 14;
  drawText(
    `Centro de Trabajo: ${user.workCenter || ""}`,
    margin,
    y,
    false,
    9
  );
  y -= 14;
  drawText(`CIF: ${user.companyCif || ""}`, margin, y, false, 9);
  y -= 14;
  drawText(
    `Código de Cuenta de Cotización: ${user.companyCcc || ""}`,
    margin,
    y,
    false,
    9
  );
  y -= 20;

  // Trabajador
  drawText(
    `Trabajador: ${user.workerLastName || ""} ${user.workerFirstName || ""}`,
    margin,
    y,
    false,
    9
  );
  y -= 14;
  drawText(`NIF: ${user.workerNif || ""}`, margin, y, false, 9);
  y -= 14;
  drawText(
    `Número de afiliación a la Seguridad Social: ${user.workerSsNumber || ""}`,
    margin,
    y,
    false,
    9
  );
  y -= 20;

  // Mes y año
  const monthName = new Intl.DateTimeFormat("es-ES", {
    month: "long",
  }).format(new Date(monthData.year, monthData.month - 1, 1));
  drawText(
    `Mes y Año: ${monthName} ${monthData.year}`,
    margin,
    y,
    true,
    10
  );
  y -= 25;

  // TABLA DE HORAS
  const colDia = margin;
  const colMañana = margin + 40;
  const colTarde = margin + 200;
  const colTotal = margin + 360;

  drawText("Día", colDia, y, true, 9);
  drawText("Mañana", colMañana, y, true, 9);
  drawText("Tarde", colTarde, y, true, 9);
  drawText("Total (h)", colTotal, y, true, 9);
  y -= 14;

  const rowHeight = 12;

  monthData.days.forEach((d) => {
    if (y < margin + 60) {
      return;
    }

    const totalMinutes = d.totalMinutes ?? 0;
    const totalHours = (totalMinutes / 60).toFixed(2);

    drawText(String(d.day), colDia, y, false, 9);
    drawText(
      `${d.morningIn ?? "--:--"} - ${d.morningOut ?? "--:--"}`,
      colMañana,
      y,
      false,
      9
    );
    drawText(
      `${d.afternoonIn ?? "--:--"} - ${d.afternoonOut ?? "--:--"}`,
      colTarde,
      y,
      false,
      9
    );
    drawText(totalHours, colTotal, y, false, 9);

    y -= rowHeight;
  });

  // FIRMA
  y -= 30;
  if (y < margin + 60) {
    y = margin + 60;
  }
  drawText("Firma trabajador:", margin, y, false, 9);

  if (monthData.signatureDataUrl) {
    try {
      const base64 = monthData.signatureDataUrl.split(",")[1];
      const pngBytes = Buffer.from(base64, "base64");
      const pngImage = await pdfDoc.embedPng(pngBytes);

      const scale = 0.3;
      const pngDims = pngImage.scale(scale);

      const sigX = margin + 100;
      const sigY = y - pngDims.height + 4;

      page.drawImage(pngImage, {
        x: sigX,
        y: sigY,
        width: pngDims.width,
        height: pngDims.height,
      });
    } catch (e) {
      console.error("Error incrustando firma en PDF:", e);
      drawText("[firma adjunta en sistema]", margin + 100, y, false, 8);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

app.get(
  "/api/hours/pdf",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = req.user!.userId;
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!year || !month) {
      res.status(400).json({ error: "Parámetros year y month son obligatorios" });
      return;
    }

    const monthData = findMonthHours(userId, year, month);
    if (!monthData) {
      res.status(404).json({ error: "No hay datos de horas para ese mes." });
      return;
    }

    const user = findUserById(userId)!;
    const pdfBytes = await createPdfForMonth(monthData, user);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="registro_horas_${year}_${String(month).padStart(
        2,
        "0"
      )}_${user.username}.pdf"`
    );
    res.send(Buffer.from(pdfBytes));
  }
);

// -------------------------
// Administración: usuarios
// -------------------------

app.get(
  "/api/admin/users",
  authMiddleware,
  adminOnlyMiddleware,
  (req: AuthRequest, res: Response) => {
    res.json({
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        isActive: u.isActive,
        vacationDaysPerYear: u.vacationDaysPerYear,
        workCenter: u.workCenter,
        companyCif: u.companyCif,
        companyCcc: u.companyCcc,
        workerLastName: u.workerLastName,
        workerFirstName: u.workerFirstName,
        workerNif: u.workerNif,
        workerSsNumber: u.workerSsNumber,
      })),
    });
  }
);

app.post(
  "/api/admin/users",
  authMiddleware,
  adminOnlyMiddleware,
  (req: AuthRequest, res: Response) => {
    const {
      username,
      fullName,
      password,
      role,
      vacationDaysPerYear,
      workCenter,
      companyCif,
      companyCcc,
      workerLastName,
      workerFirstName,
      workerNif,
      workerSsNumber,
    } = req.body as Partial<User> & {
      username: string;
      fullName: string;
      password: string;
    };

    if (!username || !fullName || !password) {
      res.status(400).json({
        error: "username, fullName y password son obligatorios",
      });
      return;
    }

    if (findUserByUsername(username)) {
      res.status(400).json({ error: "Ya existe un usuario con ese username" });
      return;
    }

    const id = String(Date.now());

    const newUser: User = {
      id,
      username,
      fullName,
      password, // Debería ser cifrada antes de guardar
      role: role || "worker",
      isActive: true,
      vacationDaysPerYear: vacationDaysPerYear ?? 23,
      workCenter: workCenter || "",
      companyCif: companyCif || "",
      companyCcc: companyCcc || "",
      workerLastName: workerLastName || "",
      workerFirstName: workerFirstName || "",
      workerNif: workerNif || "",
      workerSsNumber: workerSsNumber || "",
    };

    users.push(newUser);

    res.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        role: newUser.role,
        isActive: newUser.isActive,
        vacationDaysPerYear: newUser.vacationDaysPerYear,
        workCenter: newUser.workCenter,
        companyCif: newUser.companyCif,
        companyCcc: newUser.companyCcc,
        workerLastName: newUser.workerLastName,
        workerFirstName: newUser.workerFirstName,
        workerNif: newUser.workerNif,
        workerSsNumber: newUser.workerSsNumber,
      },
    });
  }
);

// CORRECCIÓN APLICADA AQUÍ:
app.patch(
  "/api/admin/users/:id",
  authMiddleware,
  adminOnlyMiddleware,
  (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const targetUser = findUserById(id);

    if (!targetUser) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    const {
      username,
      password, // Campo que queremos actualizar
      fullName,
      vacationDaysPerYear,
      workCenter,
      companyCif,
      companyCcc,
      workerLastName,
      workerFirstName,
      workerNif,
      workerSsNumber,
    } = req.body as Partial<User>;

    // Si se intenta cambiar el username, verificar que no exista otro usuario con ese username
    if (username !== undefined && username !== targetUser.username) {
      const existingUser = findUserByUsername(username);
      if (existingUser && existingUser.id !== id) {
        res.status(400).json({ error: "Ya existe un usuario con ese username" });
        return;
      }
      targetUser.username = username;
    }

    // Lógica de corrección: Actualizar la contraseña si se proporciona y no está vacía.
    if (password !== undefined && password.trim() !== "") {
      // En un entorno seguro, aquí iría: targetUser.password = await hashPassword(password);
      targetUser.password = password; 
    }

    if (fullName !== undefined) targetUser.fullName = fullName;
    if (vacationDaysPerYear !== undefined)
      targetUser.vacationDaysPerYear = vacationDaysPerYear;
    if (workCenter !== undefined) targetUser.workCenter = workCenter;
    if (companyCif !== undefined) targetUser.companyCif = companyCif;
    if (companyCcc !== undefined) targetUser.companyCcc = companyCcc;
    if (workerLastName !== undefined) targetUser.workerLastName = workerLastName;
    if (workerFirstName !== undefined)
      targetUser.workerFirstName = workerFirstName;
    if (workerNif !== undefined) targetUser.workerNif = workerNif;
    if (workerSsNumber !== undefined) targetUser.workerSsNumber = workerSsNumber;

    // Aseguramos que el objeto devuelto no contenga el password
    const { password: userPassword, ...userResponse } = targetUser;

    res.json({ ok: true, user: userResponse });
  }
);

app.patch(
  "/api/admin/users/:id/deactivate",
  authMiddleware,
  adminOnlyMiddleware,
  (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const targetUser = findUserById(id);

    if (!targetUser) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (req.user?.userId === id && targetUser.role === "admin") {
      res.status(400).json({
        error: "No puedes desactivar tu propio usuario de administración.",
      });
      return;
    }

    if (targetUser.role === "admin") {
      const activeAdmins = users.filter(
        (u) => u.role === "admin" && u.isActive
      ).length;

      if (activeAdmins <= 1) {
        res.status(400).json({
          error: "Debe existir al menos un administrador activo en el sistema.",
        });
        return;
      }
    }

    targetUser.isActive = false;
    res.json({ ok: true });
  }
);

app.patch(
  "/api/admin/users/:id/activate",
  authMiddleware,
  adminOnlyMiddleware,
  (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const targetUser = findUserById(id);

    if (!targetUser) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    targetUser.isActive = true;
    res.json({ ok: true });
  }
);

app.delete(
  "/api/admin/users/:id",
  authMiddleware,
  adminOnlyMiddleware,
  (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const targetUser = findUserById(id);

    if (!targetUser) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (req.user?.userId === id && targetUser.role === "admin") {
      res.status(400).json({
        error: "No puedes borrar tu propio usuario de administración.",
      });
      return;
    }

    if (targetUser.role === "admin") {
      const activeAdmins = users.filter(
        (u) => u.role === "admin" && u.isActive && u.id !== id
      ).length;

      if (activeAdmins < 1) {
        res.status(400).json({
          error:
            "No se puede eliminar este administrador porque es el único administrador activo.",
        });
        return;
      }
    }

    const index = users.findIndex((u) => u.id === id);
    if (index !== -1) {
      users.splice(index, 1);
    }

    for (let i = hoursStore.length - 1; i >= 0; i--) {
      if (hoursStore[i].userId === id) {
        hoursStore.splice(i, 1);
      }
    }

    res.json({ ok: true });
  }
);

// -------------------------
// Administración: horas
// -------------------------

app.get(
  "/api/admin/hours",
  authMiddleware,
  adminOnlyMiddleware,
  (req: AuthRequest, res: Response) => {
    const userId = String(req.query.userId);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!userId || !year || !month) {
      res.status(400).json({
        error: "Parámetros userId, year y month son obligatorios",
      });
      return;
    }

    const monthData = findMonthHours(userId, year, month);
    if (!monthData) {
      res.json({ exists: false, data: null });
      return;
    }

    res.json({ exists: true, data: monthData });
  }
);

app.get(
  "/api/admin/hours/pdf",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    const userId = String(req.query.userId);
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!userId || !year || !month) {
      res.status(400).json({
        error: "Parámetros userId, year y month son obligatorios",
      });
      return;
    }

    const monthData = findMonthHours(userId, year, month);
    if (!monthData) {
      res.status(404).json({ error: "No hay datos de horas para ese mes." });
      return;
    }

    const targetUser = findUserById(userId);
    if (!targetUser) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    const pdfBytes = await createPdfForMonth(monthData, targetUser);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="registro_horas_${year}_${String(month).padStart(
        2,
        "0"
      )}_${targetUser.username}.pdf"`
    );
    res.send(Buffer.from(pdfBytes));
  }
);

// GET /api/profile  (devuelve datos propios + avatar)
app.get("/api/profile", authMiddleware, (req: AuthRequest, res: Response) => {
  const u = findUserById(req.user!.userId);
  if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
  const { password, ...rest } = u;
  res.json(rest);
});

// PUT /api/profile/avatar  (guarda o cambia avatar en base64)
app.put("/api/profile/avatar", authMiddleware, (req: AuthRequest, res: Response) => {
  const { avatarDataUrl } = req.body;
  const u = findUserById(req.user!.userId);
  if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
  u.avatarDataUrl = avatarDataUrl || null;
  res.json({ ok: true });
});

// GET usuarios para selector
app.get("/api/calendar/users", authMiddleware, (req: AuthRequest, res) => {
  const list = users.map((u) => ({ id: u.id, fullName: u.fullName }));
  res.json({ users: list });
});

// GET eventos visibles para el que consulta
app.get("/api/calendar/events", authMiddleware, (req: AuthRequest, res) => {
  const me = req.user!.userId;
  const visible = calendarEvents.filter((ev) => {
    if (ev.visibility === "only-me") return ev.ownerId === me;
    if (ev.visibility === "all") return true;
    if (ev.visibility === "some") return ev.viewers?.includes(me);
    return false;
  });
  res.json({ events: visible });
});

// POST nuevo evento
app.post("/api/calendar/events", authMiddleware, (req: AuthRequest, res) => {
  const { type, date, visibility, viewers, status, medicalJustificationDataUrl } = req.body;
  if (!type || !date) return res.status(400).json({ error: "Faltan campos" });

  const newEvent: CalendarEvent = {
    id: String(Date.now()),
    ownerId: req.user!.userId,
    type,
    date,
    visibility: visibility || "only-me",
    viewers: viewers || undefined,
    status: status || undefined,
    medicalJustificationFileName: medicalJustificationDataUrl ? "justificante.png" : undefined,
  };

  calendarEvents.push(newEvent);
  res.json(newEvent);
});

// GET días de vacaciones restantes
app.get("/api/calendar/vacation-days-left", authMiddleware, (req: AuthRequest, res) => {
  const u = findUserById(req.user!.userId);
  if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
  const approved = calendarEvents.filter(
    (e) => e.ownerId === req.user!.userId && e.type === "vacaciones" && e.status === "approved"
  ).length;
  const left = (u.vacationDaysPerYear || 23) - approved;
  res.json({ daysLeft: left });
});

// -------------------------
// Arranque del servidor
// -------------------------

app.listen(PORT, () => {
  console.log(`API de registro de horas escuchando en http://localhost:${PORT}`);
});