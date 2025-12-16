import { Pool } from "pg";
import bcrypt from "bcryptjs";

// ==============================
// Conexión a Postgres usando Secrets Manager
// ==============================
// Reemplaza la función createPoolFromSecret en db.ts

import { getDbSecret } from "./aws/getDbSecret";

let pool: Pool;

export async function initDb() {
  const secret = await getDbSecret();

  console.log("✅ Conectando a RDS vía Secrets Manager", {
    host: secret.host,
    user: secret.username,
    database: secret.dbname,
  });

  pool = new Pool({
    host: secret.host,
    port: secret.port ?? 5432,
    user: secret.username,
    password: secret.password,
    database: secret.dbname,
    ssl: { rejectUnauthorized: false },
  });
}

export function getPool(): Pool {
  if (!pool) {
    throw new Error("Pool no inicializado. Llama antes a initDb()");
  }
  return pool;
}


// export const pool = createPoolFromSecret();

// // ==============================
// // Conexión a Postgres
// // ==============================

//const isProduction = process.env.NODE_ENV === 'production';

// En db.ts, dentro de la conexión del Pool

// import { Pool } from "pg";
// import bcrypt from "bcryptjs";

// const DATABASE_URL =
//   process.env.DATABASE_URL ||
//   "postgres://appuser:app_password@localhost:5432/registro_horas";

// export const pool = new Pool({
//   connectionString: DATABASE_URL,
// });

// ==============================
// Tipos
// ==============================
export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  full_name: string;
  role: "worker" | "admin";
  is_active: boolean;
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

// ---- Tipos para horas ----
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

// ✅ FUNCIÓN CORREGIDA - getVisibleEventsForUser
export async function getVisibleEventsForUser(userId: string): Promise<DbCalendarEvent[]> {
  const { rows } = await pool.query(
    `
    SELECT 
      id,
      owner_id,
      type,
      date::text as date,  -- ⬅️ Asegura que date sea string YYYY-MM-DD
      status,
      visibility,
      viewers,
      medical_file
    FROM calendar_events
    WHERE
        visibility = 'all'
        OR (visibility = 'only-me' AND owner_id = $1)
        OR (visibility = 'some' AND $1 = ANY(viewers))
    ORDER BY date ASC
    `,
    [userId]
  );
  return rows; // ⬅️ NO OLVIDES EL RETURN
}

// ✅ FUNCIÓN CORREGIDA - listEventsForUser
export async function listEventsForUser(userId: string): Promise<DbCalendarEvent[]> {
  const { rows } = await pool.query(
    `
    SELECT 
      id,
      owner_id,
      type,
      date::text as date,  -- ⬅️ Asegura que date sea string YYYY-MM-DD
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
  return rows; // ⬅️ NO OLVIDES EL RETURN
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
  const { rows } = await pool.query(
    `
    INSERT INTO calendar_events (
        owner_id, type, date, visibility, viewers, status, medical_file
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING id, owner_id, type, date::text as date, status, visibility, viewers, medical_file
    `,
    //                            ^^^^^^^^^^^^^^^^^^^ IMPORTANTE: debe tener ::text
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

export async function updateEventStatus(id: string, status: 'approved' | 'pending' | null) {
  await pool.query(
    `
    UPDATE calendar_events
    SET status = $1, updated_at = NOW()
    WHERE id = $2
    `,
    [status, id]
  );
}

export async function doesUserHaveVacationOnDate(
  userId: string,
  date: string
): Promise<boolean> {
  const { rows } = await pool.query(
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
  await pool.query(`DELETE FROM calendar_events WHERE id = $1`, [id]);
}

export async function countApprovedVacationsForUser(userId: string): Promise<number> {
  const { rows } = await pool.query(
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

export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ==============================
// Consultas de usuario
// ==============================

// 1) Buscar por username (login)
export async function getUserByUsername(
  username: string
): Promise<DbUser | null> {
  const { rows } = await pool.query<DbUser>(
    `
    SELECT *
    FROM users
    WHERE username = $1
    LIMIT 1
    `,
    [username]
  );
  return rows[0] || null;
}

// 2) Buscar por id
export async function getUserById(id: string): Promise<DbUser | null> {
  const { rows } = await pool.query<DbUser>(
    `
    SELECT *
    FROM users
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

// 3) Listar usuarios (admin)
export async function listUsers(): Promise<DbUser[]> {
  const { rows } = await pool.query<DbUser>(
    `
    SELECT *
    FROM users
    ORDER BY created_at ASC
    `
  );
  return rows;
}

// 4) Crear usuario (admin)
export async function createUser(input: {
  username: string;
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

  const { rows } = await pool.query<DbUser>(
    `
    INSERT INTO users (
      username,
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
    VALUES (
      $1, $2, $3,
      COALESCE($4, 'worker'),
      TRUE,
      COALESCE($5, 23),
      $6, $7, $8,
      $9, $10, $11, $12
    )
    RETURNING *
    `,
    [
      input.username,
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

// 5) Actualizar usuario (admin)
export async function updateUser(
  id: string,
  fields: Partial<{
    username: string;
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

  if (fields.username !== undefined) push("username", fields.username);
  if (fields.full_name !== undefined) push("full_name", fields.full_name);
  if (fields.vacation_days_per_year !== undefined)
    push("vacation_days_per_year", fields.vacation_days_per_year);
  if (fields.work_center !== undefined) push("work_center", fields.work_center);
  if (fields.company_cif !== undefined) push("company_cif", fields.company_cif);
  if (fields.company_ccc !== undefined) push("company_ccc", fields.company_ccc);
  if (fields.worker_last_name !== undefined)
    push("worker_last_name", fields.worker_last_name);
  if (fields.worker_first_name !== undefined)
    push("worker_first_name", fields.worker_first_name);
  if (fields.worker_nif !== undefined) push("worker_nif", fields.worker_nif);
  if (fields.worker_ss_number !== undefined)
    push("worker_ss_number", fields.worker_ss_number);
  if (fields.is_active !== undefined) push("is_active", fields.is_active);
  if (fields.avatar_data_url !== undefined)
    push("avatar_data_url", fields.avatar_data_url);

  if (fields.password !== undefined && fields.password.trim() !== "") {
    const newHash = await hashPassword(fields.password);
    push("password_hash", newHash);
  }

  if (setParts.length === 0) {
    const u = await getUserById(id);
    return u;
  }

  setParts.push(`updated_at = NOW()`);

  const query = `
    UPDATE users
    SET ${setParts.join(", ")}
    WHERE id = $${idx}
    RETURNING *
  `;
  values.push(id);

  const { rows } = await pool.query<DbUser>(query, values);
  return rows[0] || null;
}

// 6) Activar/desactivar usuario
export async function setUserActive(id: string, active: boolean): Promise<void> {
  await pool.query(
    `
    UPDATE users
    SET is_active = $1, updated_at = NOW()
    WHERE id = $2
    `,
    [active, id]
  );
}

// 7) Borrar usuario
export async function deleteUser(id: string): Promise<void> {
  await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
}

// 8) Contar admins activos (para reglas de negocio)
export async function countActiveAdmins(excludeId?: string): Promise<number> {
  let query = `
    SELECT COUNT(*)::int AS count
    FROM users
    WHERE role = 'admin' AND is_active = TRUE
  `;
  const params: any[] = [];

  if (excludeId) {
    query += ` AND id <> $1`;
    params.push(excludeId);
  }

  const { rows } = await pool.query<{ count: number }>(query, params);
  return rows[0]?.count ?? 0;
}

// ==============================
// DEBUG helpers (opcional)
// ==============================
export async function dbListUsers(): Promise<DbUser[]> {
  return listUsers();
}

export async function dbCreateDemoUser(): Promise<DbUser> {
  return createUser({
    username: "demo",
    full_name: "Usuario Demo BD",
    password: "demo123",
    role: "worker",
    vacation_days_per_year: 23,
  });
}

// ==============================
// HORAS: lectura/escritura en BD
// ==============================

function mapTimeToHHMM(value: string | null): string | undefined {
  if (!value) return undefined;
  // pg suele devolver "HH:MM:SS" → nos quedamos con "HH:MM"
  return value.slice(0, 5);
}

// Leer horas de un usuario para un mes
export async function getMonthHoursForUser(
  userId: string,
  year: number,
  month: number
): Promise<DbMonthHoursForApi | null> {
  const { rows: monthRows } = await pool.query(
    `
    SELECT id, signature_data_url
    FROM hours_months
    WHERE user_id = $1 AND year = $2 AND month = $3
    LIMIT 1
    `,
    [userId, year, month]
  );

  if (!monthRows[0]) return null;

  const monthId: string = monthRows[0].id;
  const signatureDataUrl: string | null = monthRows[0].signature_data_url;

  const { rows: dayRows } = await pool.query(
    `
    SELECT
      day,
      morning_in,
      morning_out,
      afternoon_in,
      afternoon_out,
      total_minutes,
      absence_type,
      has_signature
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

  return {
    userId,
    year,
    month,
    signatureDataUrl,
    days,
  };
}

// Datos que esperamos recibir ya calculados desde el endpoint
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

// Guardar/actualizar horas de un usuario para un mes
export async function upsertMonthHoursForUser(
  userId: string,
  year: number,
  month: number,
  signatureDataUrl: string | null,
  days: UpsertDayInput[]
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Buscar si ya existe el mes
    const { rows: monthRows } = await client.query(
      `
      SELECT id
      FROM hours_months
      WHERE user_id = $1 AND year = $2 AND month = $3
      LIMIT 1
      `,
      [userId, year, month]
    );

    let monthId: string;

    if (monthRows[0]) {
      monthId = monthRows[0].id;
      await client.query(
        `
        UPDATE hours_months
        SET signature_data_url = $1, updated_at = NOW()
        WHERE id = $2
        `,
        [signatureDataUrl, monthId]
      );

      // Borramos los días anteriores y los volvemos a insertar
      await client.query(`DELETE FROM hours_days WHERE month_id = $1`, [
        monthId,
      ]);
    } else {
      const { rows: inserted } = await client.query(
        `
        INSERT INTO hours_months (user_id, year, month, signature_data_url)
        VALUES ($1, $2, $3, $4)
        RETURNING id
        `,
        [userId, year, month, signatureDataUrl]
      );
      monthId = inserted[0].id;
    }

    // Insertar días
    for (const d of days) {
      await client.query(
        `
        INSERT INTO hours_days (
          month_id,
          day,
          morning_in,
          morning_out,
          afternoon_in,
          afternoon_out,
          total_minutes,
          absence_type,
          has_signature
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          monthId,
          d.day,
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
// DOCUMENTOS EN BD
// ==============================

export interface DbPayroll {
  id: string;
  owner_id: string;
  year: number;
  month: string;
  file_name: string;
  created_at: Date;
}

export interface DbContract {
  id: string;
  owner_id: string;
  file_name: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbCitation {
  id: string;
  owner_id: string;
  title: string;
  issued_at: string;
  file_name: string;
  created_at: Date;
}

// ---- NÓMINAS ----

export async function listPayrollsForUser(ownerId: string): Promise<DbPayroll[]> {
  const { rows } = await pool.query<DbPayroll>(
    `
    SELECT *
    FROM payrolls
    WHERE owner_id = $1
    ORDER BY year DESC, month DESC, created_at DESC
    `,
    [ownerId]
  );
  return rows;
}

export async function createPayrollRecord(params: {
  ownerId: string;
  year: number;
  month: string; // "01".."12"
  fileName: string;
}): Promise<DbPayroll> {
  const { rows } = await pool.query<DbPayroll>(
    `
    INSERT INTO payrolls (owner_id, year, month, file_name)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [params.ownerId, params.year, params.month, params.fileName]
  );
  return rows[0];
}

export async function getPayrollById(id: string): Promise<DbPayroll | null> {
  const { rows } = await pool.query<DbPayroll>(
    `
    SELECT *
    FROM payrolls
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

export async function deletePayrollRecord(id: string): Promise<void> {
  await pool.query(`DELETE FROM payrolls WHERE id = $1`, [id]);
}

// ---- CONTRATOS ----

export async function getContractForOwner(ownerId: string): Promise<DbContract | null> {
  const { rows } = await pool.query<DbContract>(
    `
    SELECT *
    FROM contracts
    WHERE owner_id = $1
    LIMIT 1
    `,
    [ownerId]
  );
  return rows[0] || null;
}

export async function upsertContractRecord(params: {
  ownerId: string;
  fileName: string;
}): Promise<DbContract> {
  const { rows } = await pool.query<DbContract>(
    `
    INSERT INTO contracts (owner_id, file_name)
    VALUES ($1, $2)
    ON CONFLICT (owner_id)
    DO UPDATE SET
      file_name = EXCLUDED.file_name,
      updated_at = NOW()
    RETURNING *
    `,
    [params.ownerId, params.fileName]
  );
  return rows[0];
}

export async function deleteContractRecord(ownerId: string): Promise<void> {
  await pool.query(`DELETE FROM contracts WHERE owner_id = $1`, [ownerId]);
}

// ---- CITACIONES ----

export async function listCitationsForUser(ownerId: string): Promise<DbCitation[]> {
  const { rows } = await pool.query<DbCitation>(
    `
    SELECT *
    FROM citations
    WHERE owner_id = $1
    ORDER BY issued_at DESC, created_at DESC
    `,
    [ownerId]
  );
  return rows;
}

export async function createCitationRecord(params: {
  ownerId: string;
  title: string;
  issuedAt: string; // "YYYY-MM-DD"
  fileName: string;
}): Promise<DbCitation> {
  const { rows } = await pool.query<DbCitation>(
    `
    INSERT INTO citations (owner_id, title, issued_at, file_name)
    VALUES ($1, $2, $3, $4)
    RETURNING *
    `,
    [params.ownerId, params.title, params.issuedAt, params.fileName]
  );
  return rows[0];
}

export async function getCitationById(id: string): Promise<DbCitation | null> {
  const { rows } = await pool.query<DbCitation>(
    `
    SELECT *
    FROM citations
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

export async function deleteCitationRecord(id: string): Promise<void> {
  await pool.query(`DELETE FROM citations WHERE id = $1`, [id]);
}

export async function getCalendarEventById(id: string): Promise<DbCalendarEvent | null> {
  const { rows } = await pool.query<DbCalendarEvent>(
    `
    SELECT *
    FROM calendar_events
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

export async function deleteCalendarEventById(id: string): Promise<void> {
  await pool.query(
    `
    DELETE FROM calendar_events
    WHERE id = $1
    `,
    [id]
  );
}

export async function countAllVacationsForUser(userId: string): Promise<number> {
  const { rows } = await pool.query(
    `
    SELECT COUNT(*)::int AS total
    FROM calendar_events
    WHERE owner_id = $1 AND type = 'vacaciones'
    `,
    [userId]
  );
  return rows[0]?.total ?? 0;
}


