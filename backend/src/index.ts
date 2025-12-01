import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt, { JwtPayload } from "jsonwebtoken";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// -------------------------
// Tipos y datos en memoria
// -------------------------

type Role = "worker" | "admin";

interface User {
  id: string;
  username: string;
  fullName: string;
  password: string; // en claro, para demo; en producción -> hashed
  role: Role;
  isActive: boolean;
  email?: string;
  vacationDaysPerYear?: number;
}

interface StoredDay {
  day: number;
  morningIn?: string;
  morningOut?: string;
  afternoonIn?: string;
  afternoonOut?: string;
  totalMinutes?: number;
  absenceType?: "none" | "vacation" | "nonWorkingDay" | "medical";
  hasSignature?: boolean;
}

interface MonthHours {
  userId: string;
  year: number;
  month: number; // 1-12
  days: StoredDay[];
  signatureDataUrl?: string | null;
}

interface CustomJwtPayload {
  userId: string;
  username: string;
  role: Role;
}

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-demo";

// usuarios en memoria
const users: User[] = [
  {
    id: "1",
    username: "admin",
    fullName: "Usuario Administración",
    password: "admin123",
    role: "admin",
    isActive: true,
    email: "admin@example.com",
    vacationDaysPerYear: 23,
  },
  {
    id: "2",
    username: "trabajador1",
    fullName: "Trabajador Uno",
    password: "password1",
    role: "worker",
    isActive: true,
    email: "t1@example.com",
    vacationDaysPerYear: 23,
  },
];

// horas por usuario / mes (en memoria)
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
app.use(express.json({ limit: "10mb" })); // para firmas en base64

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
      email: user.email,
      vacationDaysPerYear: user.vacationDaysPerYear,
    },
  });
});

// -------------------------
// Endpoints worker: horas
// -------------------------

// GET horas del mes del usuario logueado
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

// PUT guardar horas del mes del usuario logueado
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

  let entry = findMonthHours(userId, year, month);
  if (!entry) {
    entry = { userId, year, month, days: [], signatureDataUrl: null };
    hoursStore.push(entry);
  }

  entry.days = days;
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
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
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
    size = 12
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font: bold ? fontBold : font,
      color: rgb(0, 0, 0),
    });
  };

  drawText("Registro de jornada", margin, y, true, 18);
  y -= 30;
  drawText(`Trabajador: ${user.fullName}`, margin, y);
  y -= 16;
  drawText(`Usuario: ${user.username}`, margin, y);
  y -= 16;
  drawText(
    `Mes: ${String(monthData.month).padStart(2, "0")} / ${monthData.year}`,
    margin,
    y
  );

  y -= 28;
  drawText("Día", margin, y, true, 11);
  drawText("Mañana", margin + 40, y, true, 11);
  drawText("Tarde", margin + 200, y, true, 11);
  drawText("Total (h)", margin + 360, y, true, 11);
  y -= 14;

  const rowHeight = 12;

  monthData.days.forEach((d) => {
    if (y < margin + 40) {
      page.drawText("...", { x: margin, y, size: 10, font });
      return;
    }

    const totalMinutes = d.totalMinutes ?? 0;
    const totalHours = (totalMinutes / 60).toFixed(2);

    drawText(String(d.day), margin, y);
    drawText(
      `${d.morningIn ?? "--:--"} - ${d.morningOut ?? "--:--"}`,
      margin + 40,
      y
    );
    drawText(
      `${d.afternoonIn ?? "--:--"} - ${d.afternoonOut ?? "--:--"}`,
      margin + 200,
      y
    );
    drawText(totalHours, margin + 360, y);

    y -= rowHeight;
  });

  y -= 24;
  drawText("Firma trabajador:", margin, y);
  if (monthData.signatureDataUrl) {
    drawText("[firma adjunta en sistema]", margin + 120, y);
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

// PDF del propio usuario
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

// Listar usuarios
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
        email: u.email,
        vacationDaysPerYear: u.vacationDaysPerYear,
      })),
    });
  }
);

// Crear usuario
app.post(
  "/api/admin/users",
  authMiddleware,
  adminOnlyMiddleware,
  (req: AuthRequest, res: Response) => {
    const {
      username,
      fullName,
      password,
      email,
      role,
      vacationDaysPerYear,
    } = req.body as {
      username: string;
      fullName: string;
      password: string;
      email?: string;
      role?: Role;
      vacationDaysPerYear?: number;
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
      password,
      role: role || "worker",
      isActive: true,
      email,
      vacationDaysPerYear: vacationDaysPerYear ?? 23,
    };

    users.push(newUser);

    res.json({
      user: {
        id: newUser.id,
        username: newUser.username,
        fullName: newUser.fullName,
        role: newUser.role,
        isActive: newUser.isActive,
        email: newUser.email,
        vacationDaysPerYear: newUser.vacationDaysPerYear,
      },
    });
  }
);

// Desactivar usuario (con protección de admins)
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

    // No permitir desactivarse a sí mismo si es admin
    if (req.user?.userId === id && targetUser.role === "admin") {
      res.status(400).json({
        error: "No puedes desactivar tu propio usuario de administración.",
      });
      return;
    }

    // Si el objetivo es admin, comprobar que seguirá habiendo al menos un admin activo
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

// Activar usuario
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

// Borrar usuario (con protección de admins)
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

    // No permitir borrarse a sí mismo si es admin
    if (req.user?.userId === id && targetUser.role === "admin") {
      res.status(400).json({
        error: "No puedes borrar tu propio usuario de administración.",
      });
      return;
    }

    // Si es admin, comprobar que seguirá habiendo al menos un admin activo
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

    // Eliminar sus horas
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

// Ver horas de cualquier usuario
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

// PDF de cualquier usuario (admin)
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

// -------------------------
// Arranque del servidor
// -------------------------

app.listen(PORT, () => {
  console.log(`API de registro de horas escuchando en http://localhost:${PORT}`);
});
