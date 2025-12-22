import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt, { JwtPayload } from "jsonwebtoken";
import multer from "multer";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import OpenAI from "openai";
import path from "path";

import {
  initDb,
  getPool,

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

  getMonthHoursForUser,
  upsertMonthHoursForUser,

  updateEventStatus,
  getVisibleEventsForUser,
  countApprovedVacationsForUser,
  doesUserHaveVacationOnDate,
  createCalendarEvent,
  listEventsForUser,
  getCalendarEventById,
  deleteCalendarEventById,

  listPayrollsForUser,
  createPayrollRecord,
  getPayrollById,
  deletePayrollRecord,

  getContractForOwner,
  upsertContractRecord,
  deleteContractRecord,

  listCitationsForUser,
  createCitationRecord,
  getCitationById,
  deleteCitationRecord,
  setPayrollSignedPdf
} from "./db";

// -------------------------
// IA Schema
// -------------------------

async function ensureIaSchema() {
  const pool = getPool();

  // IMPORTANTE: pgcrypto antes de usar gen_random_uuid()
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ia_chats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      title TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS ia_chats_user_id_idx ON ia_chats(user_id);`
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ia_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      chat_id UUID NOT NULL REFERENCES ia_chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await pool.query(
    `CREATE INDEX IF NOT EXISTS ia_messages_chat_id_idx ON ia_messages(chat_id);`
  );

  console.log("✅ IA schema listo (ia_chats / ia_messages)");
}

async function ensureDocsSchema() {
  const pool = getPool();

  // UUIDs con pgcrypto (gen_random_uuid)
  // await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS payrolls_owner_year_month_uq
    ON payrolls (owner_id, year, month);
  `);


  // payrolls
  await pool.query(`
    CREATE TABLE IF NOT EXISTS payrolls (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      year int NOT NULL,
      month varchar(2) NOT NULL,
      file_name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_payrolls_owner ON payrolls(owner_id);`);

  // citations
  await pool.query(`
    CREATE TABLE IF NOT EXISTS citations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL,
      issued_at text NOT NULL,
      file_name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_citations_owner ON citations(owner_id);`);

  // contracts (1 por usuario)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contracts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      file_name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
}

// -------------------------
// Calendar Schema (calendar_events)
// -------------------------
async function ensureCalendarSchema() {
  const pool = getPool();

  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

      type text NOT NULL,
      date date NOT NULL,

      status text NULL, -- 'pending' | 'approved' (para vacaciones)
      visibility text NOT NULL DEFAULT 'only-me', -- 'only-me' | 'all' | 'some'
      viewers text[] NULL, -- lista de IDs (uuid en texto) si visibility='some'

      medical_file text NULL,

      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_calendar_owner ON calendar_events(owner_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(date);`);
}


// -------------------------
// OpenAI
// -------------------------

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
});

const OPENAI_PROMPT_ID = process.env.OPENAI_PROMPT_ID;
const OPENAI_PROMPT_VERSION = process.env.OPENAI_PROMPT_VERSION;

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

// ✅ UN SOLO almacén en memoria (solo usado en PATCH legacy)
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

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-demo";
const upload = multer({ storage: multer.memoryStorage() });

// -------------------------
// Extender Request con user
// -------------------------

interface AuthRequest extends Request {
  user?: CustomJwtPayload;
}

// Ahora findMonthHours consulta la BD
const findMonthHours = async (
  userId: string,
  year: number,
  month: number
): Promise<MonthHours | undefined> => {
  const dbData = await getMonthHoursForUser(userId, year, month);
  if (!dbData) return undefined;

  return {
    userId: dbData.userId,
    year: dbData.year,
    month: dbData.month,
    signatureDataUrl: dbData.signatureDataUrl,
    days: dbData.days.map((d) => ({
      day: d.day,
      morningIn: d.morningIn,
      morningOut: d.morningOut,
      afternoonIn: d.afternoonIn,
      afternoonOut: d.afternoonOut,
      totalMinutes: d.totalMinutes,
      absenceType: d.absenceType as AbsenceType,
      hasSignature: d.hasSignature,
    })),
  };
};

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

app.use(
  cors({
    origin: [
      "https://dukmh3dsas6ny.cloudfront.net",
      "http://registro-horas-frontend.s3-website.eu-south-2.amazonaws.com",
      "https://registro-horas-frontend.s3-website.eu-south-2.amazonaws.com",
      "http://localhost:5173",
      "https://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


app.use(express.json({ limit: "10mb" }));

// -------------------------
// Auth
// -------------------------

// En tu archivo index.ts, reemplaza la sección de login:

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ error: "Usuario y contraseña son obligatorios" });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      console.error(`Login fallido: usuario ${username} no encontrado`);
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    if (!user.is_active) {
      console.warn(`Login fallido: usuario ${username} desactivado`);
      return res.status(403).json({
        error: "Usuario desactivado. Contacta con un administrador.",
      });
    }

    const passwordOk = await comparePassword(password, user.password_hash);
    if (!passwordOk) {
      console.warn(`Login fallido: contraseña incorrecta para ${username}`);
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const payload: CustomJwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    // ✅ CAMBIO: Extender a 7 días para evitar expiraciones diarias
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
    const refreshToken = jwt.sign(
      { ...payload, type: "refresh" },
      process.env.JWT_REFRESH_SECRET || JWT_SECRET + "_refresh",
      { expiresIn: "30d" }
    );

    res.json({
      accessToken,
      refreshToken,
      expiresIn: "7d", // ✅ Actualizar este valor también
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Error catastrófico en login:", err);
    res.status(500).json({
      error: "Error interno del servidor",
      detail: err instanceof Error ? err.message : "unknown error",
    });
  }
});

// ✅ También actualizar el refresh para que devuelva tokens de 7 días
app.post("/api/auth/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(401).json({ error: "Refresh token required" });

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || JWT_SECRET + "_refresh"
    ) as any;

    const dbUser = await getUserById(decoded.userId);
    if (!dbUser?.is_active) {
      return res.status(403).json({ error: "User not found or inactive" });
    }

    const newAccessToken = jwt.sign(
      { userId: dbUser.id, username: dbUser.username, role: dbUser.role },
      JWT_SECRET,
      { expiresIn: "7d" } // ✅ Cambiar de 15m a 7d
    );

    res.json({ accessToken: newAccessToken, expiresIn: "7d" });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(403).json({ error: "Invalid refresh token" });
  }
});

// POST /api/auth/refresh - Refrescar access token
app.post("/api/auth/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(401).json({ error: "Refresh token required" });

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || JWT_SECRET + "_refresh"
    ) as any;

    const dbUser = await getUserById(decoded.userId);
    if (!dbUser?.is_active) {
      return res.status(403).json({ error: "User not found or inactive" });
    }

    const newAccessToken = jwt.sign(
      { userId: dbUser.id, username: dbUser.username, role: dbUser.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ accessToken: newAccessToken, expiresIn: "7d" });
  } catch (err) {
    console.error("Refresh error:", err);
    res.status(403).json({ error: "Invalid refresh token" });
  }
});

// -------------------------
// Endpoints worker: horas
// -------------------------

app.get("/api/hours", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!year || !month) {
    res.status(400).json({ error: "Parámetros year y month son obligatorios" });
    return;
  }

  try {
    const data = await findMonthHours(userId, year, month);
    if (!data) {
      res.json({ exists: false, data: null });
      return;
    }

    res.json({ exists: true, data });
  } catch (err) {
    console.error("Error en GET /api/hours:", err);
    res.status(500).json({ error: "Error interno de servidor" });
  }
});

app.put("/api/hours", authMiddleware, async (req: AuthRequest, res: Response) => {
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

  const processed = days.map((d: StoredDay) => {
    const absence: AbsenceType = d.absenceType ?? "none";

    const morningMinutes = computeMinutes(d.morningIn, d.morningOut);
    const afternoonMinutes = computeMinutes(d.afternoonIn, d.afternoonOut);

    const totalMinutes = absence !== "none" ? 0 : morningMinutes + afternoonMinutes;

    return {
      ...d,
      absenceType: absence,
      totalMinutes,
      hasSignature: !!signatureDataUrl,
    };
  });

  try {
    await upsertMonthHoursForUser(
      userId,
      year,
      month,
      signatureDataUrl ?? null,
      processed.map((d) => ({
        day: d.day,
        morningIn: d.morningIn,
        morningOut: d.morningOut,
        afternoonIn: d.afternoonIn,
        afternoonOut: d.afternoonOut,
        totalMinutes: d.totalMinutes ?? 0,
        absenceType: d.absenceType ?? "none",
        hasSignature: d.hasSignature ?? false,
      }))
    );

    res.json({ ok: true });
  } catch (err) {
    console.error("Error en PUT /api/hours:", err);
    res.status(500).json({ error: "Error interno de servidor" });
  }
});

// -------------------------
// Generación de PDF
// -------------------------

async function createPdfForMonth(monthData: MonthHours, user: DbUser): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
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

  drawText("REGISTRO DIARIO DE JORNADA", margin, y, true, 14);
  y -= 25;

  drawText(`Empresa: JUMAR INGEN. Y PERITAC. S.L.`, margin, y, false, 9);
  y -= 14;
  drawText(`Centro de Trabajo: ${safe(user.work_center)}`, margin, y, false, 9);
  y -= 14;
  drawText(`CIF: ${safe(user.company_cif)}`, margin, y, false, 9);
  y -= 14;
  drawText(`Código de Cuenta de Cotización: ${safe(user.company_ccc)}`, margin, y, false, 9);
  y -= 20;

  drawText(
    `Trabajador: ${safe(user.worker_last_name)} ${safe(user.worker_first_name)}`,
    margin,
    y,
    false,
    9
  );
  y -= 14;
  drawText(`NIF: ${safe(user.worker_nif)}`, margin, y, false, 9);
  y -= 14;
  drawText(
    `Número de afiliación a la Seguridad Social: ${safe(user.worker_ss_number)}`,
    margin,
    y,
    false,
    9
  );
  y -= 20;

  const monthName = new Intl.DateTimeFormat("es-ES", { month: "long" }).format(
    new Date(monthData.year, monthData.month - 1, 1)
  );
  drawText(`Mes y Año: ${monthName} ${monthData.year}`, margin, y, true, 10);
  y -= 25;

  const colDia = margin;
  const colManana = margin + 40;
  const colTarde = margin + 200;
  const colTotal = margin + 360;

  drawText("Día", colDia, y, true, 9);
  drawText("Mañana", colManana, y, true, 9);
  drawText("Tarde", colTarde, y, true, 9);
  drawText("Total (h)", colTotal, y, true, 9);
  y -= 14;

  const rowHeight = 12;

  monthData.days.forEach((d) => {
    if (y < margin + 60) return;

    const totalMinutes = d.totalMinutes ?? 0;
    const totalHours = (totalMinutes / 60).toFixed(2);

    drawText(String(d.day), colDia, y, false, 9);
    drawText(`${d.morningIn ?? "--:--"} - ${d.morningOut ?? "--:--"}`, colManana, y, false, 9);
    drawText(`${d.afternoonIn ?? "--:--"} - ${d.afternoonOut ?? "--:--"}`, colTarde, y, false, 9);
    drawText(totalHours, colTotal, y, false, 9);

    y -= rowHeight;
  });

  y -= 30;
  if (y < margin + 60) y = margin + 60;

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

  return pdfDoc.save();
}

app.get("/api/hours/pdf", authMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId;
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!year || !month) {
    return res.status(400).json({ error: "Parámetros year y month son obligatorios" });
  }

  try {
    const monthData = await findMonthHours(userId, year, month);
    if (!monthData) {
      return res.status(404).json({ error: "No hay datos de horas para ese mes." });
    }

    const dbUser = await getUserById(userId);
    if (!dbUser) return res.status(404).json({ error: "Usuario no encontrado" });

    const pdfBytes = await createPdfForMonth(monthData, dbUser);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="registro_horas_${year}_${String(month).padStart(2, "0")}_${dbUser.username}.pdf"`
    );
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("Error en GET /api/hours/pdf:", err);
    res.status(500).json({ error: "Error interno de servidor" });
  }
});

// -------------------------
// Administración: horas
// -------------------------

app.get("/api/admin/hours", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = String(req.query.userId);
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!userId || !year || !month) {
    res.status(400).json({ error: "Parámetros userId, year y month son obligatorios" });
    return;
  }

  try {
    const monthData = await findMonthHours(userId, year, month);
    if (!monthData) {
      res.json({ exists: false, data: null });
      return;
    }
    res.json({ exists: true, data: monthData });
  } catch (err) {
    console.error("Error en GET /api/admin/hours:", err);
    res.status(500).json({ error: "Error interno de servidor" });
  }
});

app.get("/api/admin/hours/pdf", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  const userId = String(req.query.userId);
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!userId || !year || !month) {
    return res.status(400).json({ error: "Parámetros userId, year y month son obligatorios" });
  }

  try {
    const monthData = await findMonthHours(userId, year, month);
    if (!monthData) {
      return res.status(404).json({ error: "No hay datos de horas para ese mes." });
    }

    const dbUser = await getUserById(userId);
    if (!dbUser) return res.status(404).json({ error: "Usuario no encontrado" });

    const pdfBytes = await createPdfForMonth(monthData, dbUser);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="registro_horas_${year}_${String(month).padStart(2, "0")}_${dbUser.username}.pdf"`
    );
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("Error en GET /api/admin/hours/pdf:", err);
    res.status(500).json({ error: "Error interno de servidor" });
  }
});

// -------------------------
// Profile
// -------------------------

app.get("/api/profile", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const u = await getUserById(req.user!.userId);
    if (!u) return res.status(404).json({ error: "Usuario no encontrado" });

    res.json({
      id: u.id,
      username: u.username,
      fullName: u.full_name,
      role: u.role,
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
});

app.put("/api/profile/avatar", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { avatarDataUrl } = req.body as { avatarDataUrl?: string | null };

  try {
    const updated = await dbUpdateUser(req.user!.userId, {
      avatar_data_url: avatarDataUrl ?? null,
    });

    if (!updated) return res.status(404).json({ error: "Usuario no encontrado" });

    res.json({ ok: true });
  } catch (err) {
    console.error("Error al actualizar avatar:", err);
    res.status(500).json({ error: "Error interno de servidor" });
  }
});

// -------------------------
// Calendar: users & events
// -------------------------

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
    res.status(500).json({ error: "Error interno" });
  }
});

app.get("/api/calendar/events", authMiddleware, async (req: AuthRequest, res) => {
  try {
    console.log("📅 GET /api/calendar/events - Usuario:", req.user!.userId);
    
    const dbEvents = await getVisibleEventsForUser(req.user!.userId);
    
    console.log("✅ Eventos obtenidos:", dbEvents.length);

    const events = dbEvents.map((e) => ({
      id: e.id,
      ownerId: e.owner_id,
      type: e.type as EventType,
      date: e.date,
      status: (e.status as "pending" | "approved" | null) ?? undefined,
      visibility: e.visibility as Visibility,
      viewers: e.viewers ?? undefined,
      medicalJustificationFileName: e.medical_file ?? undefined,
    }));

    res.json({ events });
  } catch (err) {
    console.error("❌ Error GET /api/calendar/events:", err);
    console.error("❌ Stack:", err instanceof Error ? err.stack : "No stack");
    res.status(500).json({ 
      error: "Error interno al cargar eventos",
      detail: err instanceof Error ? err.message : String(err)
    });
  }
});

app.post("/api/calendar/events", authMiddleware, async (req: AuthRequest, res: Response) => {
  const { type, date, visibility, viewers, medicalJustificationDataUrl } = req.body;
  const userId = req.user!.userId;

  if (!type || !date) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }

  const isoDate = String(date).slice(0, 10);

  try {
    if (type === "vacaciones") {
      const already = await doesUserHaveVacationOnDate(userId, isoDate);
      if (already) {
        return res.status(400).json({ error: "Ya tienes vacaciones en ese día" });
      }

      const user = await getUserById(userId);
      if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

      const approved = await countApprovedVacationsForUser(userId);
      const allowed = user.vacation_days_per_year ?? 23;

      if (approved >= allowed) {
        return res.status(400).json({ error: "No te quedan días de vacaciones disponibles" });
      }
    }

    const safeVisibility: Visibility =
      visibility === "all" || visibility === "some" || visibility === "only-me"
        ? visibility
        : "only-me";

    const dbEvent = await createCalendarEvent({
      ownerId: userId,
      type,
      date: isoDate,
      visibility: safeVisibility,
      viewers: safeVisibility === "some" ? viewers ?? [] : null,
      status: type === "vacaciones" ? "pending" : null,
      medicalFile: medicalJustificationDataUrl ? "justificante.png" : null,
    });

    const event = {
      id: dbEvent.id,
      ownerId: dbEvent.owner_id,
      type: dbEvent.type as EventType,
      date: dbEvent.date,
      status: (dbEvent.status as "pending" | "approved" | null) ?? undefined,
      visibility: dbEvent.visibility as Visibility,
      viewers: dbEvent.viewers ?? undefined,
      medicalJustificationFileName: dbEvent.medical_file ?? undefined,
    };

    res.json(event);
  } catch (err: any) {
    console.error("❌ Error POST /api/calendar/events:", err);
    res.status(500).json({
      error: "Error interno creando evento",
      detail: String(err?.message || err),
    });
  }
});

// PATCH legacy (en memoria, no BD)
app.patch("/api/calendar/events/:id", authMiddleware, (req: AuthRequest, res: Response) => {
  const ev = calendarEvents.find((e) => e.id === req.params.id);
  if (!ev) return res.status(404).json({ error: "Evento no encontrado" });

  if (ev.ownerId !== req.user!.userId && req.user!.role !== "admin") {
    return res.status(403).json({ error: "No autorizado" });
  }

  const { type, status, visibility, viewers } = req.body as Partial<CalendarEvent>;

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

  if (status !== undefined) ev.status = status;
  if (visibility !== undefined) ev.visibility = visibility;
  if (Array.isArray(viewers)) ev.viewers = viewers;

  res.json(ev);
});

app.delete("/api/calendar/events/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  const eventId = req.params.id;
  const userId = req.user!.userId;

  try {
    const dbEvent = await getCalendarEventById(eventId);
    if (!dbEvent) return res.status(404).json({ error: "Evento no encontrado" });

    if (req.user!.role !== "admin" && dbEvent.owner_id !== userId) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const wasVacation = dbEvent.type === "vacaciones";
    await deleteCalendarEventById(eventId);

    res.json({ ok: true, wasVacation, eventType: dbEvent.type });
  } catch (err) {
    console.error("Error DELETE /api/calendar/events/:id:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

app.get("/api/calendar/vacation-days-left", authMiddleware, async (req: AuthRequest, res) => {
  const userId = req.user!.userId;

  try {
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const usedDays = await countApprovedVacationsForUser(userId);
    const allowed = user.vacation_days_per_year ?? 23;
    const daysLeft = allowed - usedDays;

    return res.json({ daysLeft });
  } catch (err) {
    console.error("Error /api/calendar/vacation-days-left:", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

// -------------------------
// Documents (worker)
// -------------------------

app.get("/api/documents/payrolls", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const list = await listPayrollsForUser(req.user!.userId);
    res.json({
      payrolls: list.map((p) => ({
        id: p.id,
        ownerId: p.owner_id,
        year: String(p.year),
        month: p.month,
        fileName: p.file_name,
      })),
    });
  } catch (err) {
    console.error("Error /documents/payrolls:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

app.get("/api/documents/payrolls/:id/download", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const pay = await getPayrollById(req.params.id);
    if (!pay || pay.owner_id !== req.user!.userId) {
      return res.status(404).json({ error: "Nómina no encontrada" });
    }

    // ✅ Si está firmada, devolver la firmada; si no, la original
    const pdf = pay.signed_pdf_data ?? pay.pdf_data;
    if (!pdf) return res.status(404).json({ error: "PDF no disponible" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pay.file_name}"`);
    res.send(pdf);
  } catch (err) {
    console.error("Error /documents/payrolls/:id/download:", err);
    res.status(500).json({ error: "Error interno" });
  }
});


// Contract worker
app.post("/api/documents/contract", authMiddleware, upload.single("file"), async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user!.userId;
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Falta archivo" });

    const newDoc = await upsertContractRecord({
      ownerId,
      fileName: file.originalname,
      pdfData: file.buffer
    });

    res.json({ ok: true, ownerId: newDoc.owner_id, fileName: newDoc.file_name });
  } catch (err) {
    console.error("❌ Error trabajador upload contract:", err);
    res.status(500).json({ error: "Error interno al subir contrato" });
  }
});

app.delete("/api/documents/contract", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await deleteContractRecord(req.user!.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting contract:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

app.get("/api/documents/contract", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const contract = await getContractForOwner(req.user!.userId);
    res.json({ contract });
  } catch (err) {
    console.error("Error getting contract:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

app.get("/api/documents/contract/download", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const c = await getContractForOwner(req.user!.userId);
    if (!c) return res.status(404).json({ error: "Contrato no encontrado" });

    const pdf = c.pdf_data;
    if (!pdf) return res.status(404).json({ error: "PDF no disponible" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${c.file_name}"`);
    res.send(pdf);
  } catch (err) {
    console.error("Error downloading contract:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Citations worker
app.get("/api/documents/citations", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const list = await listCitationsForUser(req.user!.userId);
    res.json({
      citations: list.map((c) => ({
        id: c.id,
        ownerId: c.owner_id,
        title: c.title,
        issuedAt: c.issued_at,
        fileName: c.file_name,
      })),
    });
  } catch (err) {
    console.error("Error /documents/citations:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

app.get("/api/documents/citations/:id/download", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const cit = await getCitationById(req.params.id);
    if (!cit || cit.owner_id !== req.user!.userId) {
      return res.status(404).json({ error: "Citación no encontrada" });
    }

    const pdf = cit.pdf_data;
    if (!pdf) return res.status(404).json({ error: "PDF no disponible" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${cit.file_name}"`);
    res.send(pdf);
  } catch (err) {
    console.error("Error /documents/citations/:id/download:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// -------------------------
// Documents (admin)
// -------------------------

// Upload payroll for a specific user
app.post(
  "/api/admin/documents/payroll",
  authMiddleware,
  adminOnlyMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const { ownerId, year, month } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: "Falta archivo" });
      if (!ownerId || !year || !month)
        return res.status(400).json({ error: "Faltan campos (ownerId, year, month)" });

      await createPayrollRecord({
        ownerId: String(ownerId),
        year: Number(year),
        month: String(month).padStart(2, "0"),
        fileName: file.originalname,
        pdfData: file.buffer, // ✅ NUEVO
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Error POST /api/admin/documents/payroll:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// UPLOAD payroll (admin)
app.post(
  "/api/admin/documents/payroll",
  authMiddleware,
  adminOnlyMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ownerId, year, month } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: "Falta archivo" });
      if (!ownerId || !year || !month) {
        return res.status(400).json({ error: "Faltan campos (ownerId, year, month)" });
      }

      await createPayrollRecord({
        ownerId: String(ownerId),
        year: Number(year),
        month: String(month).padStart(2, "0"),
        fileName: file.originalname,
        pdfData: file.buffer
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Error /admin/documents/payroll:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// DOWNLOAD payroll (admin) by id
app.get(
  "/api/admin/documents/payrolls/:id/download",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const pay = await getPayrollById(req.params.id);
      if (!pay) return res.status(404).json({ error: "Nómina no encontrada" });

      // Placeholder (igual que worker)
      const fakeBuffer = Buffer.from(
        `CONTENIDO DE LA NÓMINA ${pay.file_name}\nAÑO: ${pay.year} MES: ${pay.month}\n`
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${pay.file_name}"`);
      res.send(fakeBuffer);
    } catch (err) {
      console.error("Error /admin/documents/payrolls/:id/download:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// DELETE payroll (admin) by id
app.delete(
  "/api/admin/documents/payrolls/:id",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      await deletePayrollRecord(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      console.error("Error /admin/documents/payrolls/:id:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);


// Upload citation for a specific user
app.post(
  "/api/admin/documents/citation",
  authMiddleware,
  adminOnlyMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const { ownerId, title, issuedAt } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: "Falta archivo" });
      if (!ownerId || !title || !issuedAt)
        return res.status(400).json({ error: "Faltan campos (ownerId, title, issuedAt)" });

      await createCitationRecord({
        ownerId: String(ownerId),
        title: String(title),
        issuedAt: String(issuedAt),
        fileName: file.originalname,
        pdfData: file.buffer, // ✅ NUEVO
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Error POST /api/admin/documents/citation:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// UPLOAD citation (admin)
app.post(
  "/api/admin/documents/citation",
  authMiddleware,
  adminOnlyMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ownerId, title, issuedAt } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: "Falta archivo" });
      if (!ownerId || !title || !issuedAt) {
        return res.status(400).json({ error: "Faltan campos (ownerId, title, issuedAt)" });
      }

      await createCitationRecord({
        ownerId: String(ownerId),
        title: String(title),
        issuedAt: String(issuedAt),
        fileName: file.originalname,
        pdfData: file.buffer
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Error /admin/documents/citation:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// DOWNLOAD citation (admin) by id
app.get(
  "/api/admin/documents/citations/:id/download",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const cit = await getCitationById(req.params.id);
      if (!cit) return res.status(404).json({ error: "Citación no encontrada" });

      // Placeholder (igual que worker)
      const fakeBuffer = Buffer.from(
        `CITACIÓN: ${cit.title}\nFecha: ${cit.issued_at}\nFichero: ${cit.file_name}\n`
      );

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${cit.file_name}"`);
      res.send(fakeBuffer);
    } catch (err) {
      console.error("Error /admin/documents/citations/:id/download:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// DELETE citation (admin) by id
app.delete(
  "/api/admin/documents/citations/:id",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      await deleteCitationRecord(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      console.error("Error /admin/documents/citations/:id:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);


// Upload/replace contract for a specific user (admin)
app.post(
  "/api/admin/documents/contract",
  authMiddleware,
  adminOnlyMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const { ownerId } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: "Falta archivo" });
      if (!ownerId) return res.status(400).json({ error: "Falta ownerId" });

      await upsertContractRecord({
        ownerId: String(ownerId),
        fileName: file.originalname,
        pdfData: file.buffer, // ✅ NUEVO
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Error POST /api/admin/documents/contract:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// UPLOAD/REPLACE contract (admin)
app.post(
  "/api/admin/documents/contract",
  authMiddleware,
  adminOnlyMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ownerId } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: "Falta archivo" });
      if (!ownerId) return res.status(400).json({ error: "Falta ownerId" });

      await upsertContractRecord({
        ownerId: String(ownerId),
        fileName: file.originalname,
        pdfData: file.buffer
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Error /admin/documents/contract (POST):", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// DOWNLOAD contract (admin) by userId
app.get(
  "/api/admin/documents/contract/download",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = String(req.query.userId || "");
      if (!userId) return res.status(400).json({ error: "Falta userId" });

      const contract = await getContractForOwner(userId);
      if (!contract) return res.status(404).json({ error: "Contrato no encontrado" });

      // Placeholder (igual que worker)
      const fakeBuffer = Buffer.from(`CONTENIDO DEL CONTRATO ${contract.file_name}\n`);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${contract.file_name}"`);
      res.send(fakeBuffer);
    } catch (err) {
      console.error("Error /admin/documents/contract/download:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// DELETE contract (admin) by userId
app.delete(
  "/api/admin/documents/contract",
  authMiddleware,
  adminOnlyMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = String(req.query.userId || "");
      if (!userId) return res.status(400).json({ error: "Falta userId" });

      await deleteContractRecord(userId);
      res.json({ ok: true });
    } catch (err) {
      console.error("Error /admin/documents/contract (DELETE):", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);

// -------------------------
// Admin: users
// -------------------------

app.get("/api/admin/users", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
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
});

app.post("/api/admin/users", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
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
    res.status(400).json({ error: "username, fullName y password son obligatorios" });
    return;
  }

  try {
    const existing = await getUserByUsername(username);
    if (existing) {
      res.status(400).json({ error: "Ya existe un usuario con ese username" });
      return;
    }

    const newUser = await dbCreateUser({
      username,
      full_name: fullName,
      password,
      role: role ?? "worker",
      vacation_days_per_year: vacationDaysPerYear,
      work_center: workCenter ?? null,
      company_cif: companyCif ?? null,
      company_ccc: companyCcc ?? null,
      worker_last_name: workerLastName ?? null,
      worker_first_name: workerFirstName ?? null,
      worker_nif: workerNif ?? null,
      worker_ss_number: workerSsNumber ?? null,
    });

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
});

app.patch("/api/admin/users/:id", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
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
        res.status(400).json({ error: "Ya existe un usuario con ese username" });
        return;
      }
    }

    const updated = await dbUpdateUser(id, {
      username,
      password,
      full_name: fullName,
      vacation_days_per_year: vacationDaysPerYear,
      work_center: workCenter ?? null,
      company_cif: companyCif ?? null,
      company_ccc: companyCcc ?? null,
      worker_last_name: workerLastName ?? null,
      worker_first_name: workerFirstName ?? null,
      worker_nif: workerNif ?? null,
      worker_ss_number: workerSsNumber ?? null,
    });

    if (!updated) {
      res.status(404).json({ error: "Usuario no encontrado tras actualizar" });
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
});

app.patch("/api/admin/users/:id/deactivate", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const targetUser = await getUserById(id);
    if (!targetUser) return res.status(404).json({ error: "Usuario no encontrado" });

    if (req.user?.userId === id && targetUser.role === "admin") {
      return res.status(400).json({ error: "No puedes desactivar tu propio usuario de administración." });
    }

    if (targetUser.role === "admin") {
      const activeAdmins = await countActiveAdmins(id);
      if (activeAdmins < 1) {
        return res.status(400).json({ error: "Debe existir al menos un administrador activo en el sistema." });
      }
    }

    await setUserActive(id, false);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error desactivando usuario:", err);
    res.status(500).json({ error: "Error interno de servidor" });
  }
});

app.patch("/api/admin/users/:id/activate", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const targetUser = await getUserById(id);
    if (!targetUser) return res.status(404).json({ error: "Usuario no encontrado" });

    await setUserActive(id, true);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error activando usuario:", err);
    res.status(500).json({ error: "Error interno de servidor" });
  }
});

app.delete("/api/admin/users/:id", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const targetUser = await getUserById(id);
    if (!targetUser) return res.status(404).json({ error: "Usuario no encontrado" });

    if (req.user?.userId === id && targetUser.role === "admin") {
      return res.status(400).json({ error: "No puedes borrar tu propio usuario de administración." });
    }

    if (targetUser.role === "admin") {
      const activeAdmins = await countActiveAdmins(id);
      if (activeAdmins < 1) {
        return res.status(400).json({
          error: "No se puede eliminar este administrador porque es el único administrador activo.",
        });
      }
    }

    await dbDeleteUser(id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error borrando usuario:", err);
    res.status(500).json({ error: "Error interno de servidor" });
  }
});

// -------------------------
// Admin: calendar events
// -------------------------

app.get("/api/admin/calendar/events/:userId", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res) => {
  const targetId = req.params.userId;

  try {
    const dbEvents = await listEventsForUser(targetId);

    const events = dbEvents.map((e) => ({
      id: e.id,
      ownerId: e.owner_id,
      type: e.type as EventType,
      date: e.date,
      status: (e.status as "pending" | "approved" | null) ?? undefined,
      visibility: e.visibility as Visibility,
      viewers: e.viewers ?? undefined,
      medicalJustificationFileName: e.medical_file ?? undefined,
    }));

    res.json({ events });
  } catch (err) {
    console.error("Error admin list events:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

app.patch("/api/admin/calendar/events/:id/vacation", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res) => {
  const id = req.params.id;
  const { status } = req.body;

  try {
    if (status !== "approved" && status !== "pending" && status !== null) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    await updateEventStatus(id, status);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error update vacation:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// -------------------------
// Debug
// -------------------------

app.get("/api/debug/db-users", async (_req, res) => {
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

app.post("/api/debug/db-users/demo", async (_req, res) => {
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
// Perito IA - Chat con GPT
// -------------------------

app.get("/api/perito-ia/chats", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await getPool().query(
      `SELECT id, title, created_at, updated_at
       FROM ia_chats
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [req.user!.userId]
    );
    res.json({ chats: rows });
  } catch (err) {
    console.error("Error listando chats IA:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

app.get("/api/perito-ia/chats/:chatId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { chatId } = req.params;

    const { rows: chatRows } = await getPool().query(
      `SELECT id FROM ia_chats WHERE id = $1 AND user_id = $2`,
      [chatId, req.user!.userId]
    );

    if (chatRows.length === 0) {
      return res.status(404).json({ error: "Chat no encontrado" });
    }

    const { rows } = await getPool().query(
      `SELECT id, role, content, created_at as timestamp
       FROM ia_messages
       WHERE chat_id = $1
       ORDER BY created_at ASC`,
      [chatId]
    );

    res.json({ messages: rows });
  } catch (err) {
    console.error("Error obteniendo mensajes:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

app.post("/api/perito-ia/chat", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { chatId, message } = req.body ?? {};
    const userId = req.user!.userId;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "message es obligatorio" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY no está configurada en el servidor",
      });
    }

    let currentChatId = chatId;

    if (!currentChatId) {
      const title = message.substring(0, 50) + (message.length > 50 ? "..." : "");
      const { rows } = await getPool().query(
        `INSERT INTO ia_chats (user_id, title) VALUES ($1, $2) RETURNING id`,
        [userId, title]
      );
      currentChatId = rows[0].id;
    }

    await getPool().query(
      `INSERT INTO ia_messages (chat_id, role, content) VALUES ($1, 'user', $2)`,
      [currentChatId, message]
    );

    const { rows: historyRows } = await getPool().query(
      `SELECT role, content FROM ia_messages WHERE chat_id = $1 ORDER BY created_at ASC`,
      [currentChatId]
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Eres un asistente especializado en peritaje judicial." },
        ...historyRows.map((row: any) => ({ role: row.role, content: row.content })),
      ],
    });

    const assistantMessage =
      response.choices[0]?.message?.content || "No pude generar una respuesta";

    await getPool().query(
      `INSERT INTO ia_messages (chat_id, role, content) VALUES ($1, 'assistant', $2)`,
      [currentChatId, assistantMessage]
    );

    await getPool().query(`UPDATE ia_chats SET updated_at = NOW() WHERE id = $1`, [
      currentChatId,
    ]);

    return res.json({ chatId: currentChatId, response: assistantMessage });
  } catch (err: any) {
    console.error("Error en chat IA:", err?.message || err);
    return res.status(500).json({
      error: "Error interno del servidor",
      detail: String(err?.message || err),
    });
  }
});

app.delete("/api/perito-ia/chats/:chatId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { chatId } = req.params;

    const { rows } = await getPool().query(
      `SELECT id FROM ia_chats WHERE id = $1 AND user_id = $2`,
      [chatId, req.user!.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Chat no encontrado" });
    }

    await getPool().query(`DELETE FROM ia_messages WHERE chat_id = $1`, [chatId]);
    await getPool().query(`DELETE FROM ia_chats WHERE id = $1`, [chatId]);

    res.json({ ok: true });
  } catch (err) {
    console.error("Error eliminando chat:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// -------------------------
// Admin: documents
// -------------------------

// List payrolls for a specific user
app.get("/api/admin/documents/payrolls", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "Falta userId" });

    const list = await listPayrollsForUser(userId);
    res.json({
      payrolls: list.map((p) => ({
        id: p.id,
        ownerId: p.owner_id,
        year: String(p.year),
        month: p.month,
        fileName: p.file_name,
      })),
    });
  } catch (err) {
    console.error("Error GET /api/admin/documents/payrolls:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Upload payroll for a specific user
app.post("/api/admin/documents/payroll", authMiddleware, adminOnlyMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const { ownerId, year, month } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Falta archivo" });
    if (!ownerId || !year || !month) return res.status(400).json({ error: "Faltan campos (ownerId, year, month)" });

    await createPayrollRecord({
      ownerId: String(ownerId),
      year: Number(year),
      month: String(month).padStart(2, "0"),
      fileName: file.originalname,
      pdfData: file.buffer
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Error POST /api/admin/documents/payroll:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Download payroll by id (admin)
app.get("/api/admin/documents/payrolls/:id/download", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res) => {
  try {
    const pay = await getPayrollById(req.params.id);
    if (!pay) return res.status(404).json({ error: "Nómina no encontrada" });

    // Igual que en worker: placeholder
    const fakeBuffer = Buffer.from(
      `CONTENIDO DE LA NÓMINA ${pay.file_name}\nAÑO: ${pay.year} MES: ${pay.month}\n`
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pay.file_name}"`);
    res.send(fakeBuffer);
  } catch (err) {
    console.error("Error GET /api/admin/documents/payrolls/:id/download:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Delete payroll by id (admin) - opcional pero útil
app.delete("/api/admin/documents/payrolls/:id", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res) => {
  try {
    await deletePayrollRecord(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error DELETE /api/admin/documents/payrolls/:id:", err);
    res.status(500).json({ error: "Error interno" });
  }
});


// List citations for a specific user
app.get("/api/admin/documents/citations", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "Falta userId" });

    const list = await listCitationsForUser(userId);
    res.json({
      citations: list.map((c) => ({
        id: c.id,
        ownerId: c.owner_id,
        title: c.title,
        issuedAt: c.issued_at,
        fileName: c.file_name,
      })),
    });
  } catch (err) {
    console.error("Error GET /api/admin/documents/citations:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Upload citation for a specific user
app.post("/api/admin/documents/citation", authMiddleware, adminOnlyMiddleware, upload.single("file"), async (req: AuthRequest, res) => {
  try {
    const { ownerId, title, issuedAt } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ error: "Falta archivo" });
    if (!ownerId || !title || !issuedAt) return res.status(400).json({ error: "Faltan campos (ownerId, title, issuedAt)" });

    await createCitationRecord({
      ownerId: String(ownerId),
      title: String(title),
      issuedAt: String(issuedAt),
      fileName: file.originalname,
      pdfData: file.buffer
    });

    res.json({ ok: true });
  } catch (err) {
    console.error("Error POST /api/admin/documents/citation:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Download citation by id (admin)
app.get("/api/admin/documents/citations/:id/download", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res) => {
  try {
    const cit = await getCitationById(req.params.id);
    if (!cit) return res.status(404).json({ error: "Citación no encontrada" });

    // Igual que en worker: placeholder
    const fakeBuffer = Buffer.from(
      `CONTENIDO DE LA CITACIÓN ${cit.file_name}\nTÍTULO: ${cit.title}\nFECHA: ${cit.issued_at}\n`
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${cit.file_name}"`);
    res.send(fakeBuffer);
  } catch (err) {
    console.error("Error GET /api/admin/documents/citations/:id/download:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Delete citation by id (admin) - opcional pero útil
app.delete("/api/admin/documents/citations/:id", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res) => {
  try {
    await deleteCitationRecord(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error DELETE /api/admin/documents/citations/:id:", err);
    res.status(500).json({ error: "Error interno" });
  }
});


// Get contract for a specific user (admin)
app.get("/api/admin/documents/contract", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "Falta userId" });

    const contract = await getContractForOwner(userId);
    res.json({ contract });
  } catch (err) {
    console.error("Error GET /api/admin/documents/contract:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Upload/replace contract for a specific user (admin)
app.post(
  "/api/admin/documents/contract",
  authMiddleware,
  adminOnlyMiddleware,
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const { ownerId } = req.body;
      const file = req.file;

      if (!file) return res.status(400).json({ error: "Falta archivo" });
      if (!ownerId) return res.status(400).json({ error: "Falta ownerId" });

      await upsertContractRecord({
        ownerId: String(ownerId),
        fileName: file.originalname,
        pdfData: file.buffer, // ✅ AÑADIR ESTO
      });

      res.json({ ok: true });
    } catch (err) {
      console.error("Error POST /api/admin/documents/contract:", err);
      res.status(500).json({ error: "Error interno" });
    }
  }
);


// Download contract for a specific user (admin)
app.get("/api/admin/documents/contract/download", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "Falta userId" });

    const contract = await getContractForOwner(userId);
    if (!contract) return res.status(404).json({ error: "Contrato no encontrado" });

    // Igual que en worker: placeholder
    const fakeBuffer = Buffer.from(`CONTENIDO DEL CONTRATO ${contract.file_name}\n`);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${contract.file_name}"`);
    res.send(fakeBuffer);
  } catch (err) {
    console.error("Error GET /api/admin/documents/contract/download:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// Delete contract for a specific user (admin) - opcional
app.delete("/api/admin/documents/contract", authMiddleware, adminOnlyMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "Falta userId" });

    await deleteContractRecord(userId);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error DELETE /api/admin/documents/contract:", err);
    res.status(500).json({ error: "Error interno" });
  }
});

// helper
function dataUrlToUint8Array(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!m) throw new Error("Firma inválida (dataUrl)");
  return Uint8Array.from(Buffer.from(m[2], "base64"));
}

// Coordenadas A4 en puntos (origen abajo-izquierda)
// AJUSTABLES si quieres mover la firma
const SIGN_X = 60;
const SIGN_Y = 55;
const SIGN_W = 170;
const SIGN_H = 85;

app.post("/api/documents/payrolls/:id/sign", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const payrollId = req.params.id;

    // ✅ CORRECCIÓN: en tu JWT es userId, no id
    const userId = req.user!.userId;

    const { signatureDataUrl } = req.body as { signatureDataUrl?: string };
    if (!signatureDataUrl) return res.status(400).json({ error: "Falta signatureDataUrl" });

    const p = await getPayrollById(payrollId);
    if (!p) return res.status(404).json({ error: "Nómina no encontrada" });
    if (p.owner_id !== userId) return res.status(403).json({ error: "No autorizado" });
    if (!p.pdf_data) return res.status(400).json({ error: "La nómina no tiene PDF almacenado" });

    const pdfDoc = await PDFDocument.load(p.pdf_data);
    const page = pdfDoc.getPages()[0];

    const pngBytes = dataUrlToUint8Array(signatureDataUrl);
    const pngImage = await pdfDoc.embedPng(pngBytes);

    page.drawImage(pngImage, {
      x: SIGN_X,
      y: SIGN_Y,
      width: SIGN_W,
      height: SIGN_H,
    });

    const signedBytes = await pdfDoc.save();

    await setPayrollSignedPdf({
      payrollId,
      signedPdfData: Buffer.from(signedBytes),
      signatureDataUrl,
    });

    res.json({ ok: true });
  } catch (e) {
    console.error("Error firmando nómina:", e);
    res.status(500).json({ error: "Error interno" });
  }
});

// -------------------------
// Healthchecks
// -------------------------

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "registro-horas-backend",
    environment: process.env.NODE_ENV || "development",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// -------------------------
// Root + fallbacks
// -------------------------

app.get("/", (_req, res) => {
  res.json({
    message: "API Registro de Horas",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      api: "/api/*",
    },
  });
});

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});

app.all("*", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// -------------------------
// Arranque del servidor
// -------------------------

const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";

if (require.main === module) {
  (async () => {
    try {
      await initDb();          // ⬅️ IMPORTANTÍSIMO: inicializa pool con Secrets Manager
      await ensureIaSchema();  // ⬅️ crea tablas IA
      await ensureDocsSchema();
      await ensureCalendarSchema();

      const server = app.listen(PORT, HOST, () => {
        console.log("========================================");
        console.log(`✅ Servidor corriendo en ${HOST}:${PORT}`);
        console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
        console.log(
          `🗄️  DB Secret: ${process.env.DB_SECRET_ARN ? "✓ Configurado" : "✗ No configurado"}`
        );
        console.log(`🌐 Health check: http://localhost:${PORT}/health`);
        console.log("========================================");
      });

      server.on("error", (err: any) => {
        if (err?.code === "EADDRINUSE") {
          console.error(`❌ Puerto ${PORT} ya está en uso`);
        } else {
          console.error("❌ Error al levantar el servidor:", err);
        }
        process.exit(1);
      });
    } catch (e) {
      console.error("❌ Error arrancando servidor:", e);
      process.exit(1);
    }
  })();
}

export default app;
