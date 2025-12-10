// db.ts
import { Pool } from "pg";

type DbConfig = {
  host: string;
  database: string;
  user: string;
  password: string;
  port: number;
};

function configFromEnv(): DbConfig {
  const {
    DB_HOST,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
    DB_PORT,
  } = process.env;

  if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASSWORD) {
    throw new Error(
      "Missing database env vars. Required: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
    );
  }

  const port = DB_PORT ? Number(DB_PORT) : 5432;
  if (Number.isNaN(port)) {
    throw new Error("DB_PORT must be a number");
  }

  return {
    host: DB_HOST,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD,
    port,
  };
}

function configFromSecretIfPresent(): DbConfig | null {
  const secret = process.env.DB_SECRET_JSON;
  if (!secret) return null;

  try {
    const parsed: any = JSON.parse(secret);

    const host =
      parsed.host ?? parsed.DB_HOST ?? parsed.endpoint ?? parsed.address;
    const database =
      parsed.dbname ?? parsed.DB_NAME ?? parsed.database;
    const user =
      parsed.username ?? parsed.DB_USER ?? parsed.user;
    const password =
      parsed.password ?? parsed.DB_PASSWORD ?? parsed.pass;
    const portValue = parsed.port ?? parsed.DB_PORT ?? 5432;
    const port = Number(portValue);

    if (!host || !database || !user || !password || Number.isNaN(port)) {
      console.warn(
        "DB_SECRET_JSON set but missing fields; falling back to individual DB_* env vars"
      );
      return null;
    }

    return { host, database, user, password, port };
  } catch (err) {
    console.warn(
      "DB_SECRET_JSON is set but is not valid JSON; falling back to individual DB_* env vars"
    );
    return null;
  }
}

const config = configFromSecretIfPresent() ?? configFromEnv();

const isProdEnv =
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "producction";

export const pool = new Pool({
  host: config.host,
  database: config.database,
  user: config.user,
  password: config.password,
  port: config.port,
  ssl: isProdEnv
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

// Helper por si en otros archivos haces: db.query(...)
export const query = (text: string, params?: any[]) =>
  pool.query(text, params);

export default pool;
