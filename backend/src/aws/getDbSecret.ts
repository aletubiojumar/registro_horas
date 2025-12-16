import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "eu-south-2";
const SECRET_ID = process.env.DB_SECRET_ID || "rds!db-9e92c02a-3e21-4f91-8759-7d067e92d161";

const client = new SecretsManagerClient({ region: REGION });

export async function getDbSecret() {
  const command = new GetSecretValueCommand({ SecretId: SECRET_ID });
  const response = await client.send(command);

  if (!response.SecretString) throw new Error("SecretString vacío en Secrets Manager");

  const raw = JSON.parse(response.SecretString) as {
    username?: string;
    password?: string;
  };

  const host = process.env.DB_HOST;
  const dbname = process.env.DB_NAME;
  const port = Number(process.env.DB_PORT ?? 5432);

  if (!host || !dbname || !raw.username || !raw.password) {
    throw new Error(
      `Secret/ENV incompleto. host=${host} username=${raw.username} dbname=${dbname} port=${port}`
    );
  }

  return {
    host,
    port,
    username: raw.username,
    password: raw.password,
    dbname,
  };
}
