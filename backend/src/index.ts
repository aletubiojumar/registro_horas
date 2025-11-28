import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ======================
// Config básica
// ======================

const PORT = 4000;
const JWT_SECRET = "cambia-esto-por-un-secreto-mas-largo";

// Ruta a la plantilla PDF
const TEMPLATE_PATH = path.join(__dirname, "..", "assets", "plantilla_horas.pdf");

// ======================
// Tipos
// ======================

interface User {
  id: number;
  username: string;
  password: string;
  fullName: string;
}

interface CustomJwtPayload {
  sub: number;
  username: string;
  iat?: number;
  exp?: number;
}

interface DayPayload {
  day: number;
  morningIn?: string;
  morningOut?: string;
  afternoonIn?: string;
  afternoonOut?: string;
}

interface MonthPayload {
  year: number; // ej. 2025
  month: number; // 1-12
  days: DayPayload[];
  signatureDataUrl?: string | null;
}

interface AuthedRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
}

// ======================
// "Base de datos" en memoria
// ======================

const users: User[] = [
  {
    id: 1,
    username: "demo",
    password: "demo123",
    fullName: "Usuario Demo",
  },
  {
    id: 2,
    username: "alejandro",
    password: "1234",
    fullName: "Alejandro Tubío",
  },
];

// key => "userId:year-month"
const hoursStore = new Map<string, MonthPayload>();

// ======================
// Helpers
// ======================

function findUserByUsername(username: string): User | undefined {
  return users.find((u) => u.username === username);
}

function makeMonthKey(userId: number, year: number, month: number): string {
  return `${userId}:${year}-${month}`;
}

function getCurrentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function getUserById(id: number): User | undefined {
  return users.find((u) => u.id === id);
}

function getSpanishMonthName(month: number): string {
  const date = new Date(2024, month - 1, 1);
  return new Intl.DateTimeFormat("es-ES", { month: "long" }).format(date);
}

// ======================
// Middleware de auth
// ======================

function authMiddleware(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ message: "Falta cabecera Authorization" });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res
      .status(401)
      .json({ message: "Formato Authorization inválido (usa Bearer <token>)" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as CustomJwtPayload;

    req.user = {
      id: decoded.sub,
      username: decoded.username,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}

// ======================
// Generación de PDF
// ======================

async function generateMonthPdf(
  user: User,
  monthData: MonthPayload
): Promise<Uint8Array> {
  // Cargar plantilla
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(
      `No se encuentra la plantilla en ${TEMPLATE_PATH}. Asegúrate de que existe.`
    );
  }

  const templateBytes = fs.readFileSync(TEMPLATE_PATH);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 9;

  // Coordenadas aproximadas para la tabla.
  // Seguramente tendrás que ajustar estos valores probando el PDF generado.
  const TABLE_TOP_Y = 700;
  const ROW_HEIGHT = 18;

  const DATE_X = 40;
  const MORNING_IN_X = 110;
  const SIGN1_X = 170;
  const MORNING_OUT_X = 220;
  const SIGN2_X = 280;
  const AFTERNOON_IN_X = 330;
  const SIGN3_X = 390;
  const AFTERNOON_OUT_X = 440;
  const SIGN4_X = 500;

  // Coordenadas aproximadas para el nombre del trabajador y mes
  const EMPLOYEE_NAME_X = 140;
  const EMPLOYEE_NAME_Y = 780;
  const PERIOD_X = 140;
  const PERIOD_Y = 765;

  // 1) Escribimos nombre del trabajador
  page.drawText(user.fullName, {
    x: EMPLOYEE_NAME_X,
    y: EMPLOYEE_NAME_Y,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });

  // 2) Escribimos periodo (mes y año)
  const monthName = getSpanishMonthName(monthData.month);
  const periodText = `${monthName.toUpperCase()} ${monthData.year}`;
  page.drawText(periodText, {
    x: PERIOD_X,
    y: PERIOD_Y,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
  });

  // 3) Preparamos la firma
  let signatureImage = null;
  let signatureDims = { width: 0, height: 0 };

  if (monthData.signatureDataUrl) {
    try {
      const [meta, base64Data] = monthData.signatureDataUrl.split(",");
      const isPng = meta.includes("image/png");
      const isJpeg =
        meta.includes("image/jpeg") || meta.includes("image/jpg");

      const imageBytes = Buffer.from(base64Data, "base64");

      if (isPng) {
        signatureImage = await pdfDoc.embedPng(imageBytes);
      } else if (isJpeg) {
        signatureImage = await pdfDoc.embedJpg(imageBytes);
      } else {
        // si no sabemos el tipo, intentamos como PNG
        signatureImage = await pdfDoc.embedPng(imageBytes);
      }

      const scale = 0.25; // ajusta según lo necesites
      signatureDims = {
        width: signatureImage.width * scale,
        height: signatureImage.height * scale,
      };
    } catch (err) {
      console.warn("No se ha podido procesar la firma, se omite en el PDF:", err);
      signatureImage = null;
    }
  }

  // 4) Rellenar filas por día
  for (const dayEntry of monthData.days) {
    const dayIndex = dayEntry.day - 1;
    if (dayIndex < 0 || dayIndex > 30) continue; // solo 31 días máx.

    const rowY = TABLE_TOP_Y - dayIndex * ROW_HEIGHT;

    const textOptions = {
      y: rowY,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    };

    // Fecha (dd/mm/yyyy)
    const dayStr = String(dayEntry.day).padStart(2, "0");
    const monthStr = String(monthData.month).padStart(2, "0");
    const dateText = `${dayStr}/${monthStr}/${monthData.year}`;

    page.drawText(dateText, {
      x: DATE_X,
      ...textOptions,
    });

    // Mañana entrada
    if (dayEntry.morningIn) {
      page.drawText(dayEntry.morningIn, {
        x: MORNING_IN_X,
        ...textOptions,
      });
    }
    // Mañana salida
    if (dayEntry.morningOut) {
      page.drawText(dayEntry.morningOut, {
        x: MORNING_OUT_X,
        ...textOptions,
      });
    }
    // Tarde entrada
    if (dayEntry.afternoonIn) {
      page.drawText(dayEntry.afternoonIn, {
        x: AFTERNOON_IN_X,
        ...textOptions,
      });
    }
    // Tarde salida
    if (dayEntry.afternoonOut) {
      page.drawText(dayEntry.afternoonOut, {
        x: AFTERNOON_OUT_X,
        ...textOptions,
      });
    }

    // Firmas: dibujamos la imagen si existe y el día tiene algún tramo
    const hasAnyTime =
      dayEntry.morningIn ||
      dayEntry.morningOut ||
      dayEntry.afternoonIn ||
      dayEntry.afternoonOut;

    if (signatureImage && hasAnyTime) {
      const sigY = rowY - signatureDims.height * 0.3;

      // Firma junto a cada tramo (ajusta si quieres menos repeticiones)
      page.drawImage(signatureImage, {
        x: SIGN1_X,
        y: sigY,
        width: signatureDims.width,
        height: signatureDims.height,
      });

      page.drawImage(signatureImage, {
        x: SIGN2_X,
        y: sigY,
        width: signatureDims.width,
        height: signatureDims.height,
      });

      page.drawImage(signatureImage, {
        x: SIGN3_X,
        y: sigY,
        width: signatureDims.width,
        height: signatureDims.height,
      });

      page.drawImage(signatureImage, {
        x: SIGN4_X,
        y: sigY,
        width: signatureDims.width,
        height: signatureDims.height,
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
}

// ======================
// App Express
// ======================

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: "15mb" })); // soportar firma base64 grande

// ======================
// Rutas
// ======================

// Healthcheck
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ---------- AUTH ----------

// Login
app.post("/api/auth/login", (req: Request, res: Response) => {
  const { username, password } = req.body as {
    username?: string;
    password?: string;
  };

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "Debes enviar username y password." });
  }

  const user = findUserByUsername(username);
  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  const payload: CustomJwtPayload = {
    sub: user.id,
    username: user.username,
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: "12h",
  });

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
    },
  });
});

// Usuario actual
app.get("/api/auth/me", authMiddleware, (req: AuthedRequest, res: Response) => {
  const user = getUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ message: "Usuario no encontrado" });
  }

  return res.json({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
  });
});

// ---------- HORAS ----------

// Obtener horas de un mes
app.get("/api/hours", authMiddleware, (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;

  let year = req.query.year ? Number(req.query.year) : undefined;
  let month = req.query.month ? Number(req.query.month) : undefined;

  if (!year || !month) {
    const current = getCurrentYearMonth();
    year = current.year;
    month = current.month;
  }

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return res.status(400).json({
      message: "Parámetros year y month inválidos (month debe ser 1-12)",
    });
  }

  const key = makeMonthKey(userId, year, month);
  const data = hoursStore.get(key);

  if (!data) {
    return res.json({
      exists: false,
      data: null,
    });
  }

  return res.json({
    exists: true,
    data,
  });
});

// Guardar horas de un mes
app.put("/api/hours", authMiddleware, (req: AuthedRequest, res: Response) => {
  const userId = req.user!.id;
  const body = req.body as MonthPayload;

  if (
    !body.year ||
    !body.month ||
    !Array.isArray(body.days) ||
    body.month < 1 ||
    body.month > 12
  ) {
    return res.status(400).json({
      message:
        "Debes enviar year, month (1-12) y days (array con los días del mes).",
    });
  }

  for (const d of body.days) {
    if (typeof d.day !== "number" || d.day < 1 || d.day > 31) {
      return res.status(400).json({
        message: `Día inválido en el payload: ${JSON.stringify(d)}`,
      });
    }
  }

  const key = makeMonthKey(userId, body.year, body.month);

  const payloadToStore: MonthPayload = {
    year: body.year,
    month: body.month,
    days: body.days,
    signatureDataUrl: body.signatureDataUrl ?? null,
  };

  hoursStore.set(key, payloadToStore);

  return res.json({
    message: "Horas del mes guardadas correctamente.",
  });
});

// ---------- PDF ----------

// Generar y devolver el PDF del mes
app.get(
  "/api/hours/pdf",
  authMiddleware,
  async (req: AuthedRequest, res: Response) => {
    const userId = req.user!.id;
    const user = getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    let year = req.query.year ? Number(req.query.year) : undefined;
    let month = req.query.month ? Number(req.query.month) : undefined;

    if (!year || !month) {
      const current = getCurrentYearMonth();
      year = current.year;
      month = current.month;
    }

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12
    ) {
      return res.status(400).json({
        message: "Parámetros year y month inválidos (month debe ser 1-12)",
      });
    }

    const key = makeMonthKey(userId, year, month);
    const data = hoursStore.get(key);

    if (!data) {
      return res.status(404).json({
        message: "No hay horas guardadas para ese mes.",
      });
    }

    try {
      const pdfBytes = await generateMonthPdf(user, data);
      const monthPadded = String(month).padStart(2, "0");
      const filename = `registro_horas_${year}_${monthPadded}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(Buffer.from(pdfBytes));
    } catch (error) {
      console.error("Error generando PDF:", error);
      return res
        .status(500)
        .json({ message: "Error al generar el PDF en el servidor." });
    }
  }
);

// ======================
// Arranque servidor
// ======================

app.listen(PORT, () => {
  console.log(`Backend escuchando en http://localhost:${PORT}`);
});
