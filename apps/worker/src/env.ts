import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ZMARTBI_BASE_URL: z.string().url().default('https://api-zmartbi.teknisa.com'),
  ZMARTBI_TOKEN: z.string().min(1),
  // cron expression para agendamento — default: 06:15 diariamente
  ZMARTBI_SYNC_CRON: z.string().default('15 6 * * *'),
  // Diretório temporário para o dump (precisa ter espaço suficiente — 200MB+)
  ZMARTBI_TEMP_DIR: z.string().default('/tmp'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('[worker/env] erro:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
