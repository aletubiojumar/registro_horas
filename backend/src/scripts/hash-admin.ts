// scripts/hash-admin.ts
import bcrypt from "bcryptjs";

(async () => {
  const email = "admin@jumaringenieria.es";
  const password = "Admin1234!";
  
  const hash = await bcrypt.hash(password, 10);
  
  console.log("=".repeat(50));
  console.log("CREDENCIALES PARA USUARIO ADMIN");
  console.log("=".repeat(50));
  console.log(`Email: ${email}`);
  console.log(`Contraseña: ${password}`);
  console.log(`Hash: ${hash}`);
  console.log("=".repeat(50));
  console.log("\nEjecuta este SQL para crear el usuario:");
  console.log(`
INSERT INTO users (
  email,
  password_hash,
  full_name,
  role,
  is_active,
  vacation_days_per_year
) VALUES (
  '${email}',
  '${hash}',
  'Administrador',
  'admin',
  true,
  23
) ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  updated_at = now();
  `);
})();