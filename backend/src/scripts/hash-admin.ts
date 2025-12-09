// scripts/hash-admin.ts
import bcrypt from "bcryptjs";

(async () => {
  const hash = await bcrypt.hash("admin123", 10);
  console.log(hash);
})();
