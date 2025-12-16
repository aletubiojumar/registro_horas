import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const REGION =
  process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-south-2";

const SECRET_ID =
  process.env.DB_SECRET_ID || "rds!db-9e92c02a-3e21-4f91-8759-7d067e92d161";

const client = new SecretsManagerClient({ region: REGION });

export async function getDbSecret(): Promise<{
  host: string;
  port: number;
  username: string;
  password: string;
  dbname: string;
}> {
  const command = new GetSecretValueCommand({ SecretId: SECRET_ID });
  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error("SecretString vacío en Secrets Manager");
  }

  const raw = JSON.parse(response.SecretString) as Record<string, any>;

  console.log("🔐 DB_SECRET_ID usado:", SECRET_ID, "REGION:", REGION);
  console.log("🔎 Secret keys:", Object.keys(raw));
  console.log("🔎 Secret preview:", { ...raw, password: "****" });

  const host = raw.host;
  const port = Number(raw.port ?? 5432);
  const username = raw.username ?? raw.user;
  const password = raw.password;
  const dbname = raw.dbname ?? raw.database ?? raw.dbName;

  if (!host || !username || !password || !dbname) {
    throw new Error(
      `Secret incompleto. host=${host} username=${username} dbname=${dbname} port=${port}`
    );
  }

  return { host, port, username, password, dbname };
}
