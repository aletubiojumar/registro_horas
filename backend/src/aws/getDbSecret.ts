import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-south-2";

// Pon esto en Elastic Beanstalk (Environment properties):
// DB_SECRET_ID = rds!db-9e92c02a-3e21-4f91-8759-7d067e92d161
// (o el ARN completo con sufijo -Sb6kSV)
const SECRET_ID =
  process.env.DB_SECRET_ID ||
  "rds!db-9e92c02a-3e21-4f91-8759-7d067e92d161";

const client = new SecretsManagerClient({ region: REGION });

export async function getDbSecret() {
  console.log("🔐 DB_SECRET_ID usado:", SECRET_ID, "REGION:", REGION);

  const command = new GetSecretValueCommand({ SecretId: SECRET_ID });
  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error("SecretString vacío en Secrets Manager");
  }

  const raw = JSON.parse(response.SecretString) as {
    host?: string;
    port?: number | string;
    username?: string;
    password?: string;
    dbname?: string;
    database?: string; // por si viene así
  };

  return {
    host: raw.host!,
    port: typeof raw.port === "string" ? parseInt(raw.port, 10) : (raw.port ?? 5432),
    username: raw.username!,
    password: raw.password!,
    dbname: raw.dbname ?? raw.database!,
  };
}
