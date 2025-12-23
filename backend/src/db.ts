import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { getDbSecret } from "./aws/getDbSecret";

let pool: Pool;

export async function initDb() {
  if (process.env.DATABASE_URL) {
    console.log("🟢 Usando DATABASE_URL (modo local)");

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

  } else {
    console.log("🟡 Usando AWS Secrets Manager (producción)");

    const secret = await getDbSecret();

    pool = new Pool({
      host: secret.host,
      user: secret.username,
      password: secret.password,
      database: secret.dbname,
      port: secret.port,
      ssl: { rejectUnauthorized: false },
    });
  }

  await pool.query("SELECT 1");
  console.log("✅ Conexión a BD OK");
}

export function getPool() {
  if (!pool) {
    throw new Error("DB no inicializada");
  }
  return pool;
}

// ==============================
// Tipos
// ==============================
export interface DbUser {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: "worker" | "admin";
  is_active: boolean;
  active: boolean;
  vacation_days_per_year: number | null;
  work_center: string | null;
  company_cif: string | null;
  company_ccc: string | null;
  worker_last_name: string | null;
  worker_first_name: string | null;
  worker_nif: string | null;
  worker_ss_number: string | null;
  avatar_data_url: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbDayForHours {
  day: number;
  morningIn?: string;
  morningOut?: string;
  afternoonIn?: string;
  afternoonOut?: string;
  totalMinutes: number;
  absenceType: string;
  hasSignature: boolean;
}

export interface DbMonthHoursForApi {
  userId: string;
  year: number;
  month: number;
  signatureDataUrl: string | null;
  days: DbDayForHours[];
}

// ==============================
// CALENDARIO EN BD
// ==============================
export interface DbCalendarEvent {
  id: string;
  owner_id: string;
  type: string;
  date: string;
  status: string | null;
  visibility: string;
  viewers: string[] | null;
  medical_file: string | null;
}

export async function getVisibleEventsForUser(userId: string): Promise<DbCalendarEvent[]> {
  const { rows } = await getPool().query(
    `
    SELECT 
      id,
      owner_id,
      type,
      date::text as date,
      status,
      visibility,
      viewers,
      medical_file
    FROM calendar_events
    WHERE
        visibility = 'all'
        OR (visibility = 'only-me' AND owner_id = $1)
        OR (visibility = 'some' AND $1::text = ANY(viewers))
    ORDER BY date ASC
    `,
    [userId]
  );
  return rows;
}

export async function listEventsForUser(userId: string): Promise<DbCalendarEvent[]> {
  const { rows } = await getPool().query(
    `
    SELECT 
      id,
      owner_id,
      type,
      date::text as date,
      status,
      visibility,
      viewers,
      medical_file
    FROM calendar_events
    WHERE owner_id = $1
    ORDER BY date ASC
    `,
    [userId]
  );
  return rows;
}

export async function createCalendarEvent(input: {
  ownerId: string;
  type: string;
  date: string;
  visibility: string;
  viewers?: string[];
  status?: string | null;
  medicalFile?: string | null;
}): Promise<DbCalendarEvent> {
  const { rows } = await getPool().query(
    `
    INSERT INTO calendar_events (
        owner_id, type, date, visibility, viewers, status, medical_file
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING id, owner_id, type, date::text as date, status, visibility, viewers, medical_file
    `,
    [
      input.ownerId,
      input.type,
      input.date,
      input.visibility,
      input.viewers ?? null,
      input.status ?? null,
      input.medicalFile ?? null,
    ]
  );

  return rows[0];
}

export async function updateEventStatus(id: string, status: "approved" | "pending" | null) {
  await getPool().query(
    `
    UPDATE calendar_events
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    `,
    [status, id]
  );
}

export async function doesUserHaveVacationOnDate(userId: string, date: string): Promise<boolean> {
  const { rows } = await getPool().query(
    `
    SELECT 1
    FROM calendar_events
    WHERE owner_id = $1 AND date = $2 AND type = 'vacaciones'
    LIMIT 1
    `,
    [userId, date]
  );
  return rows.length > 0;
}

export async function deleteVacationById(id: string) {
  await getPool().query(`DELETE FROM calendar_events WHERE id = $1`, [id]);
}

export async function countApprovedVacationsForUser(userId: string): Promise<number> {
  const { rows } = await getPool().query(
    `
    SELECT COUNT(*)::int AS total
    FROM calendar_events
    WHERE owner_id = $1 AND type = 'vacaciones' AND status = 'approved'
    `,
    [userId]
  );
  return rows[0]?.total ?? 0;
}

// ==============================
// Helpers de contraseña
// ==============================
const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ==============================
// Consultas de usuario
// ==============================
export async function getUserByEmail(email: string): Promise<DbUser | null> {
  const { rows } = await getPool().query<DbUser>(
    `SELECT * FROM users WHERE email = $1 LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

export async function getUserById(id: string): Promise<DbUser | null> {
  const { rows } = await getPool().query<DbUser>(
    `SELECT * FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function listUsers(): Promise<DbUser[]> {
  const { rows } = await getPool().query<DbUser>(
    `SELECT * FROM users ORDER BY created_at ASC`
  );
  return rows;
}

export async function createUser(input: {
  email: string;
  full_name: string;
  password: string;
  role?: "worker" | "admin";
  vacation_days_per_year?: number;
  work_center?: string | null;
  company_cif?: string | null;
  company_ccc?: string | null;
  worker_last_name?: string | null;
  worker_first_name?: string | null;
  worker_nif?: string | null;
  worker_ss_number?: string | null;
}): Promise<DbUser> {
  const password_hash = await hashPassword(input.password);

  const { rows } = await getPool().query<DbUser>(
    `
    INSERT INTO users (
      email,
      password_hash,
      full_name,
      role,
      is_active,
      vacation_days_per_year,
      work_center,
      company_cif,
      company_ccc,
      worker_last_name,
      worker_first_name,
      worker_nif,
      worker_ss_number
    )
    VALUES ($1, $2, $3, $4, TRUE, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
    `,
    [
      input.email,
      password_hash,
      input.full_name,
      input.role ?? "worker",
      input.vacation_days_per_year ?? 23,
      input.work_center ?? null,
      input.company_cif ?? null,
      input.company_ccc ?? null,
      input.worker_last_name ?? null,
      input.worker_first_name ?? null,
      input.worker_nif ?? null,
      input.worker_ss_number ?? null,
    ]
  );

  return rows[0];
}

export async function updateUser(
  id: string,
  fields: Partial<{
    email: string;
    password: string;
    full_name: string;
    vacation_days_per_year: number;
    work_center: string | null;
    company_cif: string | null;
    company_ccc: string | null;
    worker_last_name: string | null;
    worker_first_name: string | null;
    worker_nif: string | null;
    worker_ss_number: string | null;
    is_active: boolean;
    avatar_data_url: string | null;
  }>
): Promise<DbUser | null> {
  const setParts: string[] = [];
  const values: any[] = [];
  let idx = 1;

  const push = (column: string, value: any) => {
    setParts.push(`${column} = $${idx}`);
    values.push(value);
    idx++;
  };

  if (fields.email !== undefined) push("email", fields.email);
  if (fields.full_name !== undefined) push("full_name", fields.full_name);
  if (fields.vacation_days_per_year !== undefined) push("vacation_days_per_year", fields.vacation_days_per_year);
  if (fields.work_center !== undefined) push("work_center", fields.work_center);
  if (fields.company_cif !== undefined) push("company_cif", fields.company_cif);
  if (fields.company_ccc !== undefined) push("company_ccc", fields.company_ccc);
  if (fields.worker_last_name !== undefined) push("worker_last_name", fields.worker_last_name);
  if (fields.worker_first_name !== undefined) push("worker_first_name", fields.worker_first_name);
  if (fields.worker_nif !== undefined) push("worker_nif", fields.worker_nif);
  if (fields.worker_ss_number !== undefined) push("worker_ss_number", fields.worker_ss_number);
  if (fields.is_active !== undefined) push("is_active", fields.is_active);
  if (fields.avatar_data_url !== undefined) push("avatar_data_url", fields.avatar_data_url);

  if (fields.password !== undefined && fields.password.trim() !== "") {
    const newHash = await hashPassword(fields.password);
    push("password_hash", newHash);
  }

  if (setParts.length === 0) return getUserById(id);

  setParts.push(`updated_at = NOW()`);

  const query = `UPDATE users SET ${setParts.join(", ")} WHERE id = $${idx} RETURNING *`;
  values.push(id);

  const { rows } = await getPool().query<DbUser>(query, values);
  return rows[0] || null;
}

export async function setUserActive(id: string, active: boolean): Promise<void> {
  await getPool().query(
    `UPDATE users SET is_active = $1, updated_at = NOW() WHERE id = $2`,
    [active, id]
  );
}

export async function deleteUser(id: string): Promise<void> {
  await getPool().query(`DELETE FROM users WHERE id = $1`, [id]);
}

export async function countActiveAdmins(excludeId?: string): Promise<number> {
  let query = `SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin' AND is_active = TRUE`;
  const params: any[] = [];

  if (excludeId) {
    query += ` AND id <> $1`;
    params.push(excludeId);
  }

  const { rows } = await getPool().query<{ count: number }>(query, params);
  return rows[0]?.count ?? 0;
}

export async function dbListUsers(): Promise<DbUser[]> {
  return listUsers();
}

export async function dbCreateDemoUser(): Promise<DbUser> {
  return createUser({
    email: "demo@jumaringenieria.es",
    full_name: "Usuario Demo BD",
    password: "demo123",
    role: "worker",
    vacation_days_per_year: 23,
  });
}

// ==============================
// HORAS
// ==============================
function mapTimeToHHMM(value: string | null): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 5);
}

export async function getMonthHoursForUser(userId: string, year: number, month: number): Promise<DbMonthHoursForApi | null> {
  const { rows: monthRows } = await getPool().query(
    `SELECT id, signature_data_url FROM hours_months WHERE user_id = $1 AND year = $2 AND month = $3 LIMIT 1`,
    [userId, year, month]
  );

  if (!monthRows[0]) return null;

  const monthId: string = monthRows[0].id;
  const signatureDataUrl: string | null = monthRows[0].signature_data_url;

  const { rows: dayRows } = await getPool().query(
    `
    SELECT
      day, morning_in, morning_out, afternoon_in, afternoon_out,
      total_minutes, absence_type, has_signature
    FROM hours_days
    WHERE month_id = $1
    ORDER BY day ASC
    `,
    [monthId]
  );

  const days: DbDayForHours[] = dayRows.map((r: any) => ({
    day: Number(r.day),
    morningIn: mapTimeToHHMM(r.morning_in),
    morningOut: mapTimeToHHMM(r.morning_out),
    afternoonIn: mapTimeToHHMM(r.afternoon_in),
    afternoonOut: mapTimeToHHMM(r.afternoon_out),
    totalMinutes: Number(r.total_minutes ?? 0),
    absenceType: String(r.absence_type ?? "none"),
    hasSignature: Boolean(r.has_signature),
  }));

  return { userId, year, month, signatureDataUrl, days };
}

export interface UpsertDayInput {
  day: number;
  morningIn?: string;
  morningOut?: string;
  afternoonIn?: string;
  afternoonOut?: string;
  totalMinutes: number;
  absenceType: string;
  hasSignature: boolean;
}

export async function upsertMonthHoursForUser(
  userId: string,
  year: number,
  month: number,
  signatureDataUrl: string | null,
  days: UpsertDayInput[]
): Promise<void> {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const { rows: monthRows } = await client.query(
      `SELECT id FROM hours_months WHERE user_id = $1 AND year = $2 AND month = $3 LIMIT 1`,
      [userId, year, month]
    );

    let monthId: string;

    if (monthRows[0]) {
      monthId = monthRows[0].id;
      await client.query(
        `UPDATE hours_months SET signature_data_url = $1, updated_at = NOW() WHERE id = $2`,
        [signatureDataUrl, monthId]
      );

      await client.query(`DELETE FROM hours_days WHERE month_id = $1`, [monthId]);
    } else {
      const { rows: inserted } = await client.query(
        `INSERT INTO hours_months (user_id, year, month, signature_data_url) VALUES ($1, $2, $3, $4) RETURNING id`,
        [userId, year, month, signatureDataUrl]
      );
      monthId = inserted[0].id;
    }

    for (const d of days) {
      await client.query(
        `
        INSERT INTO hours_days (
          month_id, day, morning_in, morning_out, afternoon_in, afternoon_out,
          total_minutes, absence_type, has_signature
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          monthId, d.day,
          d.morningIn ?? null,
          d.morningOut ?? null,
          d.afternoonIn ?? null,
          d.afternoonOut ?? null,
          d.totalMinutes,
          d.absenceType,
          d.hasSignature,
        ]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ==============================
// DOCUMENTOS
// ==============================
export interface DbPayroll {
  id: string;
  owner_id: string;
  year: number;
  month: string;
  file_name: string;
  created_at: Date;
  pdf_data?: Buffer | null;
  signed_pdf_data?: Buffer | null;
  signed_at?: Date | null;
  signature_data_url?: string | null;
}

export interface DbContract {
  id: string;
  owner_id: string;
  file_name: string;
  created_at: Date;
  updated_at: Date;
  pdf_data?: Buffer | null;
}

export interface DbCitation {
  id: string;
  owner_id: string;
  title: string;
  issued_at: string;
  file_name: string;
  created_at: Date;
  pdf_data?: Buffer | null;
}

export async function listPayrollsForUser(ownerId: string): Promise<DbPayroll[]> {
  const { rows } = await getPool().query<DbPayroll>(
    `SELECT * FROM payrolls WHERE owner_id = $1 ORDER BY year DESC, month DESC, created_at DESC`,
    [ownerId]
  );
  return rows;
}

export async function createPayrollRecord(params: {
  ownerId: string;
  year: number;
  month: string;
  fileName: string;
  pdfData: Buffer;
}) {
  const { ownerId, year, month, fileName, pdfData } = params;

  const { rows } = await getPool().query(
    `
    INSERT INTO payrolls (owner_id, year, month, file_name, pdf_data)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (owner_id, year, month)
    DO UPDATE SET
      file_name = EXCLUDED.file_name,
      pdf_data = EXCLUDED.pdf_data,
      signed_pdf_data = NULL,
      signed_at = NULL,
      signature_data_url = NULL
    RETURNING *
    `,
    [ownerId, year, month, fileName, pdfData]
  );

  return rows[0];
}

export async function getPayrollById(id: string): Promise<DbPayroll | null> {
  const { rows } = await getPool().query<DbPayroll>(
    `SELECT * FROM payrolls WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function deletePayrollRecord(id: string): Promise<void> {
  await getPool().query(`DELETE FROM payrolls WHERE id = $1`, [id]);
}

export async function getContractForOwner(ownerId: string): Promise<DbContract | null> {
  const { rows } = await getPool().query<DbContract>(
    `SELECT * FROM contracts WHERE owner_id = $1 LIMIT 1`,
    [ownerId]
  );
  return rows[0] || null;
}

export async function upsertContractRecord(params: {
  ownerId: string;
  fileName: string;
  pdfData: Buffer;
}): Promise<DbContract> {
  const { rows } = await getPool().query<DbContract>(
    `
    INSERT INTO contracts (owner_id, file_name, pdf_data)
    VALUES ($1, $2, $3)
    ON CONFLICT (owner_id)
    DO UPDATE SET file_name = EXCLUDED.file_name, pdf_data = EXCLUDED.pdf_data, updated_at = NOW()
    RETURNING *
    `,
    [params.ownerId, params.fileName, params.pdfData]
  );
  return rows[0];
}

export async function deleteContractRecord(ownerId: string): Promise<void> {
  await getPool().query(`DELETE FROM contracts WHERE owner_id = $1`, [ownerId]);
}

export async function listCitationsForUser(ownerId: string): Promise<DbCitation[]> {
  const { rows } = await getPool().query<DbCitation>(
    `SELECT * FROM citations WHERE owner_id = $1 ORDER BY issued_at DESC, created_at DESC`,
    [ownerId]
  );
  return rows;
}

export async function createCitationRecord(params: {
  ownerId: string;
  title: string;
  issuedAt: string;
  fileName: string;
  pdfData: Buffer;
}): Promise<DbCitation> {
  const { rows } = await getPool().query<DbCitation>(
    `INSERT INTO citations (owner_id, title, issued_at, file_name, pdf_data) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [params.ownerId, params.title, params.issuedAt, params.fileName, params.pdfData]
  );
  return rows[0];
}

export async function getCitationById(id: string): Promise<DbCitation | null> {
  const { rows } = await getPool().query<DbCitation>(
    `SELECT * FROM citations WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function deleteCitationRecord(id: string): Promise<void> {
  await getPool().query(`DELETE FROM citations WHERE id = $1`, [id]);
}

export async function getCalendarEventById(id: string): Promise<DbCalendarEvent | null> {
  const { rows } = await getPool().query<DbCalendarEvent>(
    `SELECT * FROM calendar_events WHERE id = $1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function deleteCalendarEventById(id: string): Promise<void> {
  await getPool().query(`DELETE FROM calendar_events WHERE id = $1`, [id]);
}

export async function countAllVacationsForUser(userId: string): Promise<number> {
  const { rows } = await getPool().query(
    `SELECT COUNT(*)::int AS total FROM calendar_events WHERE owner_id = $1 AND type = 'vacaciones'`,
    [userId]
  );
  return rows[0]?.total ?? 0;
}

export async function ensureSecuritySchema() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      attempted_username text NOT NULL,
      user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
      success boolean NOT NULL,
      reason text NULL,
      ip text NULL,
      user_agent text NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at DESC);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON login_attempts(user_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(attempted_username);`);
}

// -------- login attempts --------
export async function logLoginAttempt(params: {
  attemptedUsername: string | null;
  success: boolean;
  reason: string;
  ip: string | null;
  userAgent: string | null;
}) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO login_attempts (attempted_username, success, reason, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`,
    [params.attemptedUsername, params.success, params.reason, params.ip, params.userAgent]
  );
}

export async function countRecentFailedLoginAttempts(params: {
  ip: string | null;
  attemptedUsername: string | null;
  windowMinutes: number;
}): Promise<number> {
  const pool = getPool();

  const where: string[] = [`success = false`, `created_at > now() - ($1 || ' minutes')::interval`];
  const values: any[] = [String(params.windowMinutes)];

  if (params.ip) {
    values.push(params.ip);
    where.push(`ip = $${values.length}`);
  }

  if (params.attemptedUsername) {
    values.push(params.attemptedUsername);
    where.push(`attempted_username = $${values.length}`);
  }

  const q = `SELECT COUNT(*)::int AS n FROM login_attempts WHERE ${where.join(" AND ")}`;
  const r = await pool.query(q, values);
  return r.rows[0]?.n ?? 0;
}

export async function listLoginAttempts(params: {
  limit: number;
  offset: number;
  username: string | null;
  ip: string | null;
  onlyFailed: boolean;
}): Promise<
  Array<{
    created_at: string;
    attempted_username: string | null;
    success: boolean;
    reason: string;
    ip: string | null;
    user_agent: string | null;
  }>
> {
  const pool = getPool();

  const where: string[] = [];
  const values: any[] = [];

  if (params.onlyFailed) where.push(`success = false`);
  if (params.username) {
    values.push(params.username);
    where.push(`attempted_username = $${values.length}`);
  }
  if (params.ip) {
    values.push(params.ip);
    where.push(`ip = $${values.length}`);
  }

  values.push(params.limit);
  const limitIdx = values.length;

  values.push(params.offset);
  const offsetIdx = values.length;

  const q = `
    SELECT created_at, attempted_username, success, reason, ip, user_agent
    FROM login_attempts
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
  const r = await pool.query(q, values);
  return r.rows;
}

// -------- blocked ips --------

export async function isIpBlocked(ip: string): Promise<boolean> {
  if (!ip) return false;
  const pool = getPool();
  const r = await pool.query(`SELECT 1 FROM blocked_ips WHERE ip = $1`, [ip]);
  return (r.rowCount ?? 0) > 0;
}

export async function listBlockedIps(): Promise<Array<{ ip: string; reason: string | null; created_at: string }>> {
  const pool = getPool();
  const r = await pool.query(`SELECT ip, reason, created_at FROM blocked_ips ORDER BY created_at DESC`);
  return r.rows;
}

export async function blockIp(params: { ip: string; reason: string | null }) {
  const pool = getPool();
  await pool.query(
    `INSERT INTO blocked_ips (ip, reason) VALUES ($1, $2) ON CONFLICT (ip) DO UPDATE SET reason = EXCLUDED.reason`,
    [params.ip, params.reason]
  );
}

export async function unblockIp(ip: string) {
  const pool = getPool();
  await pool.query(`DELETE FROM blocked_ips WHERE ip = $1`, [ip]);
}

export async function setPayrollSignedPdf(opts: {
  payrollId: string;
  signedPdfData: Buffer;
  signatureDataUrl: string;
}) {
  const pool = getPool();
  await pool.query(
    `UPDATE payrolls SET signed_pdf_data = $2, signed_at = now(), signature_data_url = $3 WHERE id = $1`,
    [opts.payrollId, opts.signedPdfData, opts.signatureDataUrl]
  );
}