import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt, { JwtPayload } from "jsonwebtoken";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import multer from "multer";
import {
  pool,
  dbListUsers,
  dbCreateDemoUser,
  DbUser,
  getUserById,
  getUserByUsername,
  listUsers,
  createUser as dbCreateUser,
  updateUser as dbUpdateUser,
  setUserActive,
  deleteUser as dbDeleteUser,
  countActiveAdmins,
  comparePassword,
} from "./db";

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

const hoursStore: MonthHours[] = [];

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

interface Payroll {
  id: string;
  ownerId: string;
  month: string;
  year: string;
  fileName: string;
}

interface Citation {
  id: string;
  ownerId: string;
  title: string;
  issuedAt: string;
  fileName: string;
}

interface ContractDoc {
  ownerId: string;
  fileName: string;
}

const payrollsDb: Payroll[] = [];
const citationsDb: Citation[] = [];
const contractDb: ContractDoc[] = [];

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-demo";

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

// Healthcheck para AWS / load balancer
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// -------------------------
// Auth
// -------------------------

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "username y password son obligatorios" });
    return;
  }

  try {
    const user = await getUserByUsername(username);

    if (!user) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ error: "Usuario desactivado" });
      return;
    }

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: "Usuario o contraseña incorrectos" });
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
        fullName: user.full_name,
        role: user.role,
        vacationDaysPerYear: user.vacation_days_per_year,
      },
    });
  } catch (err) {
    console.error("Error en login:", err);
    res.status(500).json({ error: "Error interno de servidor" });
  }
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
    const absence: AbsenceType = (d.absenceType as AbsenceType) ?? "none";

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
  user: DbUser
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 40;
  let y = height - margin;
  const safe = (value?: string | null) => value ?? "";

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
  drawText(`Centro de Trabajo: ${safe(user.work_center)}`, margin, y, false, 9);
  y -= 14;
  drawText(`CIF: ${safe(user.company_cif)}`, margin, y, false, 9);
  y -= 14;
  drawText(
    `Código de Cuenta de Cotización: ${safe(user.company_ccc)}`,
    margin,
    y,
    false,
    9
  );
  y -= 20;

  // Trabajador
  drawText(
    `Trabajador: ${safe(user.worker_last_name)} ${safe(
      user.worker_first_name
    )}`,
    margin,
    y,
    false,
    9
  );
  y -= 14;
  drawText(`NIF: ${safe(user.worker_nif)}`, margin, y, false, 9);
  y -= 14;
  drawText(
    `Número de afiliación a la Seguridad Social: ${safe(
      user.worker_ss_number
    )}`,
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
  drawText(`Mes y Año: ${monthName} ${monthData.year}`, margin, y, true, 10);
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
      res
        .status(400)
        .json({ error: "Parámetros year y month son obligatorios" });
      return;
    }

    const monthData = findMonthHours(userId, year, month);
    if (!monthData) {
      res.status(404).json({ error: "No hay datos de horas para ese mes." });
      return;
    }

    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

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

    const targetUser = await getUserById(userId);
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
app.get(
  "/api/profile",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const u = await getUserById(req.user!.userId);
      if (!u)
        return res.status(404).json({ error: "Usuario no encontrado" });

      res.json({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        vacationDaysPerYear: u.vacation_days_per_year,
        workCenter: u.work_center,
        companyCif: u.company_cif,
        companyCcc: u.company_ccc,
        workerLastName: u.worker_last_name,
        workerFirstName: u.worker_first_name,
        workerNif: u.worker_nif,
        workerSsNumber: u.worker_ss_number,
        avatarDataUrl: u.avatar_data_url,
      });
    } catch (err) {
      console.error("Error en /api/profile:", err);
      res.status(500).json({ error: "Error interno de servidor" });
    }
  }
);

// PUT /api/profile/avatar  (guarda o cambia avatar en base64)
app.put(
  "/api/profile/avatar",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { avatarDataUrl } = req.body;
    try {
      await pool.query(
        `UPDATE users SET avatar_data_url = $1, updated_at = NOW() WHERE id = $2`,
        [avatarDataUrl || null, req.user!.userId]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error("Error al actualizar avatar:", err);
      res.status(500).json({ error: "Error interno de servidor" });
    }
  }
);


// GET usuarios para selector
app.get("/api/calendar/users", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const all = await listUsers();
    const list = all.map((u: DbUser) => ({
      id: u.id,
      fullName: u.full_name,
      role: u.role,
    }));
    res.json({ users: list });
  } catch (err) {
    console.error("Error en /api/calendar/users:", err);
    res.status(500).json({ error: "Error interno de servidor" });
  }
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
  const {
    type,
    date,
    visibility,
    viewers,
    status,
    medicalJustificationDataUrl,
  } = req.body;
  if (!type || !date)
    return res.status(400).json({ error: "Faltan campos" });

  // ❗ Regla: no permitir más de unas vacaciones por día y usuario
  if (type === "vacaciones") {
    const existsSameDayVacation = calendarEvents.some(
      (e) =>
        e.ownerId === req.user!.userId &&
        e.type === "vacaciones" &&
        e.date === date
    );
    if (existsSameDayVacation) {
      return res
        .status(400)
        .json({ error: "Ya tienes unas vacaciones ese día." });
    }
  }

  const newEvent: CalendarEvent = {
    id: String(Date.now()),
    ownerId: req.user!.userId,
    type,
    date,
    visibility: visibility || "only-me",
    viewers: viewers || undefined,
    status: status || undefined,
    medicalJustificationFileName: medicalJustificationDataUrl
      ? "justificante.png"
      : undefined,
  };

  calendarEvents.push(newEvent);
  res.json(newEvent);
});

// PATCH evento (cambio de tipo, status, visibilidad, viewers)
app.patch(
  "/api/calendar/events/:id",
  authMiddleware,
  (req: AuthRequest, res: Response) => {
    const ev = calendarEvents.find((e) => e.id === req.params.id);
    if (!ev) return res.status(404).json({ error: "Evento no encontrado" });

    // Solo el dueño o un admin pueden modificar
    if (ev.ownerId !== req.user!.userId && req.user!.role !== "admin") {
      return res.status(403).json({ error: "No autorizado" });
    }

    const { type, status, visibility, viewers } = req.body as Partial<
      CalendarEvent
    >;

    if (type && type !== ev.type) {
      if (type === "vacaciones") {
        const existsSameDayVacation = calendarEvents.some(
          (e) =>
            e.id !== ev.id &&
            e.ownerId === ev.ownerId &&
            e.type === "vacaciones" &&
            e.date === ev.date
        );
        if (existsSameDayVacation) {
          return res.status(400).json({
            error: "Ya existe un evento de vacaciones para ese día.",
          });
        }
      }
      ev.type = type;
    }

    if (status !== undefined) {
      ev.status = status;
    }

    if (visibility !== undefined) {
      ev.visibility = visibility;
    }

    if (Array.isArray(viewers)) {
      ev.viewers = viewers;
    }

    res.json(ev);
  }
);

// DELETE evento
app.delete(
  "/api/calendar/events/:id",
  authMiddleware,
  (req: AuthRequest, res: Response) => {
    const idx = calendarEvents.findIndex((e) => e.id === req.params.id);
    if (idx === -1)
      return res.status(404).json({ error: "Evento no encontrado" });

    const ev = calendarEvents[idx];

    if (ev.ownerId !== req.user!.userId && req.user!.role !== "admin") {
      return res.status(403).json({ error: "No autorizado" });
    }

    calendarEvents.splice(idx, 1);
    // Los días de vacaciones se recalculan automáticamente en /vacation-days-left
    res.json({ ok: true });
  }
);

// GET días de vacaciones restantes
app.get(
  "/api/calendar/vacation-days-left",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const u = await getUserById(req.user!.userId);
      if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

      // De momento contamos solo las aprobadas
      const approved = calendarEvents.filter(
        (e) =>
          e.ownerId === req.user!.userId &&
          e.type === "vacaciones" &&
          e.status === "approved"
      ).length;
      const left = (u.vacation_days_per_year ?? 23) - approved;
      res.json({ daysLeft: left });
    } catch (err) {
      console.error("Error en /api/calendar/vacation-days-left:", err);
      res.status(500).json({ error: "Error interno de servidor" });
    }
  }
);

// ====== MIS DOCUMENTOS ======

/* 1. Listado de nóminas del usuario */
app.get(
  "/api/documents/payrolls",
  authMiddleware,
  (req: AuthRequest, res) => {
    const list = payrollsDb.filter((p) => p.ownerId === req.user!.userId);
    res.json({ payrolls: list });
  }
);

/* 2. Descarga de una nómina */
app.get(
  "/api/documents/payrolls/:id/download",
  authMiddleware,
  (req: AuthRequest, res) => {
    const pay = payrollsDb.find(
      (p) => p.id === req.params.id && p.ownerId === req.user!.userId
    );
    if (!pay) return res.status(404).json({ error: "Nómina no encontrada" });

    // Fichero simulado
    const fakeBuffer = Buffer.from(
      `CONTENIDO DE LA NÓMINA ${pay.fileName}\n`
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pay.fileName}"`
    );
    res.send(fakeBuffer);
  }
);

/* 3. Contrato del usuario */
app.get(
  "/api/documents/contract",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const user = await getUserById(req.user!.userId);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      const fileName = `contrato_${user.username}.pdf`;
      res.json({ contract: { fileName } });
    } catch (err) {
      console.error("Error en /api/documents/contract:", err);
      res.status(500).json({ error: "Error interno de servidor" });
    }
  }
);

/* 4. Descarga del contrato */
app.get(
  "/api/documents/contract/download",
  authMiddleware,
  async (req: AuthRequest, res) => {
    try {
      const user = await getUserById(req.user!.userId);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      const fileName = `contrato_${user.username}.pdf`;
      const fakeBuffer = Buffer.from(
        `CONTRATO DE TRABAJO DE ${user.full_name}\n`
      );
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      res.send(fakeBuffer);
    } catch (err) {
      console.error("Error en /api/documents/contract/download:", err);
      res.status(500).json({ error: "Error interno de servidor" });
    }
  }
);

/* 5. Listado de citaciones */
app.get(
  "/api/documents/citations",
  authMiddleware,
  (req: AuthRequest, res) => {
    const list = citationsDb.filter((c) => c.ownerId === req.user!.userId);
    res.json({ citations: list });
  }
);

/* 6. Descarga de una citación */
app.get(
  "/api/documents/citations/:id/download",
  authMiddleware,
  (req: AuthRequest, res) => {
    const cit = citationsDb.find(
      (c) => c.id === req.params.id && c.ownerId === req.user!.userId
    );
    if (!cit) return res.status(404).json({ error: "Citación no encontrada" });

    const fakeBuffer = Buffer.from(
      `CITACIÓN: ${cit.title}\nFecha: ${cit.issuedAt}\n`
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${cit.fileName}"`
    );
    res.send(fakeBuffer);
  }
);

// ====== ADMIN: CALENDARIO ======
// LISTADO
app.get(
  "/api/admin/users",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const all = await listUsers();
      res.json({
        users: all.map((u: DbUser) => ({
          id: u.id,
          username: u.username,
          fullName: u.full_name,
          role: u.role,
          isActive: u.is_active,
          vacationDaysPerYear: u.vacation_days_per_year,
          workCenter: u.work_center,
          companyCif: u.company_cif,
          companyCcc: u.company_ccc,
          workerLastName: u.worker_last_name,
          workerFirstName: u.worker_first_name,
          workerNif: u.worker_nif,
          workerSsNumber: u.worker_ss_number,
        })),
      });
    } catch (err) {
      console.error("Error listando usuarios:", err);
      res.status(500).json({ error: "Error interno de servidor" });
    }
  }
);

// ALTA
app.post(
  "/api/admin/users",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
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
    } = req.body as any;

    if (!username || !fullName || !password) {
      res.status(400).json({
        error: "username, fullName y password son obligatorios",
      });
      return;
    }

    try {
      const existing = await getUserByUsername(username);
      if (existing) {
        res
          .status(400)
          .json({ error: "Ya existe un usuario con ese username" });
        return;
      }

      const newUser = await dbCreateUser({
        username,
        full_name: fullName,
        password,
        role,
        vacation_days_per_year: vacationDaysPerYear,
        work_center: workCenter,
        company_cif: companyCif,
        company_ccc: companyCcc,
        worker_last_name: workerLastName,
        worker_first_name: workerFirstName,
        worker_nif: workerNif,
        worker_ss_number: workerSsNumber,
      } as any);

      res.json({
        user: {
          id: newUser.id,
          username: newUser.username,
          fullName: newUser.full_name,
          role: newUser.role,
          isActive: newUser.is_active,
          vacationDaysPerYear: newUser.vacation_days_per_year,
          workCenter: newUser.work_center,
          companyCif: newUser.company_cif,
          companyCcc: newUser.company_ccc,
          workerLastName: newUser.worker_last_name,
          workerFirstName: newUser.worker_first_name,
          workerNif: newUser.worker_nif,
          workerSsNumber: newUser.worker_ss_number,
        },
      });
    } catch (err) {
      console.error("Error creando usuario:", err);
      res.status(500).json({ error: "Error interno de servidor" });
    }
  }
);

// EDICIÓN
app.patch(
  "/api/admin/users/:id",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      const targetUser = await getUserById(id);
      if (!targetUser) {
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }

      const {
        username,
        password,
        fullName,
        vacationDaysPerYear,
        workCenter,
        companyCif,
        companyCcc,
        workerLastName,
        workerFirstName,
        workerNif,
        workerSsNumber,
      } = req.body as any;

      if (username !== undefined && username !== targetUser.username) {
        const existingUser = await getUserByUsername(username);
        if (existingUser && existingUser.id !== id) {
          res
            .status(400)
            .json({ error: "Ya existe un usuario con ese username" });
          return;
        }
      }

      const updated = await dbUpdateUser(id, {
        username,
        password,
        full_name: fullName,
        vacation_days_per_year: vacationDaysPerYear,
        work_center: workCenter,
        company_cif: companyCif,
        company_ccc: companyCcc,
        worker_last_name: workerLastName,
        worker_first_name: workerFirstName,
        worker_nif: workerNif,
        worker_ss_number: workerSsNumber,
      } as any);

      if (!updated) {
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }

      res.json({
        ok: true,
        user: {
          id: updated.id,
          username: updated.username,
          fullName: updated.full_name,
          role: updated.role,
          isActive: updated.is_active,
          vacationDaysPerYear: updated.vacation_days_per_year,
          workCenter: updated.work_center,
          companyCif: updated.company_cif,
          companyCcc: updated.company_ccc,
          workerLastName: updated.worker_last_name,
          workerFirstName: updated.worker_first_name,
          workerNif: updated.worker_nif,
          workerSsNumber: updated.worker_ss_number,
        },
      });
    } catch (err) {
      console.error("Error actualizando usuario:", err);
      res.status(500).json({ error: "Error interno de servidor" });
    }
  }
);

// DESACTIVAR
app.patch(
  "/api/admin/users/:id/deactivate",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const targetUser = await getUserById(id);
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
        const activeAdmins = await countActiveAdmins(id);
        if (activeAdmins < 1) {
          res.status(400).json({
            error: "Debe existir al menos un administrador activo en el sistema.",
          });
          return;
        }
      }

      await setUserActive(id, false);
      res.json({ ok: true });
    } catch (err) {
      console.error("Error desactivando usuario:", err);
      res.status(500).json({ error: "Error interno de servidor" });
    }
  }
);

// ACTIVAR
app.patch(
  "/api/admin/users/:id/activate",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const targetUser = await getUserById(id);
      if (!targetUser) {
        res.status(404).json({ error: "Usuario no encontrado" });
        return;
      }

      await setUserActive(id, true);
      res.json({ ok: true });
    } catch (err) {
      console.error("Error activando usuario:", err);
      res.status(500).json({ error: "Error interno de servidor" });
    }
  }
);

// BORRAR
app.delete(
  "/api/admin/users/:id",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    try {
      const targetUser = await getUserById(id);
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
        const activeAdmins = await countActiveAdmins(id);
        if (activeAdmins < 1) {
          res.status(400).json({
            error:
              "No se puede eliminar este administrador porque es el único administrador activo.",
          });
          return;
        }
      }

      await dbDeleteUser(id);

      // Mientras horas estén en memoria, mantenemos esto:
      for (let i = hoursStore.length - 1; i >= 0; i--) {
        if (hoursStore[i].userId === id) {
          hoursStore.splice(i, 1);
        }
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("Error borrando usuario:", err);
      res.status(500).json({ error: "Error interno de servidor" });
    }
  }
);

// Comprobar que la API está viva
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// Comprobar que la BD responde y listar usuarios (solo pruebas)
app.get("/api/debug/db-users", async (req, res) => {
  try {
    const users = await dbListUsers();
    res.json({
      count: users.length,
      users: users.map((u: DbUser) => ({
        id: u.id,
        username: u.username,
        fullName: u.full_name,
        role: u.role,
        isActive: u.is_active,
      })),
    });
  } catch (err) {
    console.error("Error en /api/debug/db-users:", err);
    res.status(500).json({ error: "Error consultando la BD" });
  }
});

app.post("/api/debug/db-users/demo", async (req, res) => {
  try {
    const newUser = await dbCreateDemoUser();
    res.json({
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.full_name,
    });
  } catch (err) {
    console.error("Error en /api/debug/db-users/demo:", err);
    res.status(500).json({ error: "Error insertando demo en la BD" });
  }
});

// -------------------------
// Arranque del servidor
// -------------------------

app.listen(PORT, () => {
  console.log(
    `API de registro de horas escuchando en http://localhost:${PORT}`
  );
});

export default app;
