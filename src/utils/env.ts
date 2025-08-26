import { z } from "zod";
import dotenv from "dotenv";
dotenv.config();

const transformString = (val: string | number | undefined) => {
  if (!val) return 4000;
  const numberVal = typeof val === "string" ? Number(val) : val;
  return isNaN(numberVal) ? 4000 : numberVal;
};

const ENVs = ["development", "production"] as const;

const EnvSchema = z.object({
  NODE_ENV: z.enum(ENVs).optional().default("development"),
  PORT: z.union([z.string(), z.number()]).optional().transform(transformString).default(4000),
  REDIS_URL: z.string().optional().default("redis://127.0.0.1:6379"),
  POSTGRES_PRISMA_URL: z.string(),
  COINGECKO_API_KEY: z.string()
});

export const env = EnvSchema.parse(process.env);
