import { Pool } from "pg";
import bcrypt from "bcryptjs";

// ==============================
// Conexión a Postgres
// ==============================
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://appuser:app_password@localhost:5432/registro_horas";

export const pool = new Pool({
  connectionString: DATABASE_URL,
});

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
// Helpers de debug (los que usábamos antes)
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
