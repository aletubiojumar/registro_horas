import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const REGION = "eu-south-2";
const SECRET_ID = "registro-horas/rds";

const client = new SecretsManagerClient({ region: REGION });

export async function getDbSecret() {
  const command = new GetSecretValueCommand({
    SecretId: SECRET_ID,
  });

  const response = await client.send(command);

  if (!response.SecretString) {
    throw new Error("SecretString vacío en Secrets Manager");
  }

  return JSON.parse(response.SecretString) as {
    host: string;
    port: number;
    username: string;
    password: string;
    dbname: string;
  };
}
