import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),
  REDIS_URL: z.string().min(1, 'REDIS_URL é obrigatório'),
  ZMARTBI_BASE_URL: z.string().url().default('https://api-zmartbi.teknisa.com'),
  ZMARTBI_TOKEN: z.string().min(1, 'ZMARTBI_TOKEN é obrigatório'),
  ALLOWED_EMAIL_DOMAIN: z.string().optional(), // legado (string única)
  ALLOWED_EMAIL_DOMAINS: z.string().optional(), // novo (lista CSV)
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[env] erro de validação:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
