// Worker BullMQ — processa filas de jobs do estoque-facil.
// Filas:
//  - "zmartbi-sync"  → catálogo do ZmartBI (cron 06:15 diário + manual)
//  - "sefaz-sync"    → DistribuicaoDFe SEFAZ (cron 8x/dia + manual)

import { Worker, Queue } from 'bullmq';
import { redis } from './redis.js';
import { logger } from './logger.js';
import { env } from './env.js';
import { runZmartbiSync, type SyncTrigger } from './zmartbi/sync.js';
import { runSefazSyncAll } from './sefaz/sync.js';

const QUEUE_NAME = 'zmartbi-sync';
const SEFAZ_QUEUE = 'sefaz-sync';

export const zmartbiQueue = new Queue<SyncTrigger>(QUEUE_NAME, { connection: redis });
export const sefazQueue = new Queue<{ kind: 'cron' | 'manual'; userId?: string }>(SEFAZ_QUEUE, {
  connection: redis,
});

const worker = new Worker<SyncTrigger>(
  QUEUE_NAME,
  async (job) => {
    logger.info({ id: job.id, data: job.data }, '[zmartbi-worker] processando');
    return await runZmartbiSync(job.data);
  },
  {
    connection: redis,
    concurrency: 1,
    lockDuration: 35 * 60 * 1000,
  },
);
worker.on('completed', (job, result) => logger.info({ id: job.id, result }, '[zmartbi] ok'));
worker.on('failed', (job, err) => logger.error({ id: job?.id, err: err.message }, '[zmartbi] fail'));

const sefazWorker = new Worker(
  SEFAZ_QUEUE,
  async (job) => {
    const trigger = job.data;
    const triggeredBy = trigger.kind === 'cron' ? 'cron' : trigger.userId ?? 'manual';
    logger.info({ id: job.id, trigger }, '[sefaz-worker] iniciando sync de todas lojas');
    const out = await runSefazSyncAll(triggeredBy);
    return { runs: out.length, summary: out.map((o) => `${o.status}: ${o.message}`) };
  },
  {
    connection: redis,
    concurrency: 1,
    lockDuration: 25 * 60 * 1000,
  },
);
sefazWorker.on('completed', (job, result) => logger.info({ id: job.id, result }, '[sefaz] ok'));
sefazWorker.on('failed', (job, err) => logger.error({ id: job?.id, err: err.message }, '[sefaz] fail'));

async function ensureSchedule(): Promise<void> {
  // ZmartBI — diário 06:15 SP
  await zmartbiQueue.upsertJobScheduler(
    'zmartbi-sync-daily',
    { pattern: env.ZMARTBI_SYNC_CRON, tz: 'America/Sao_Paulo' },
    {
      name: 'zmartbi-sync-cron',
      data: { kind: 'cron' as const },
      opts: { removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } },
    },
  );
  logger.info({ cron: env.ZMARTBI_SYNC_CRON, tz: 'America/Sao_Paulo' }, '[worker] cron zmartbi agendado');

  // SEFAZ — a cada 60 min (alinhado com rate limit oficial ~1/h por CNPJ).
  // Remove agendamentos antigos (sefaz-sync-3h e sefaz-sync-30m) pra evitar duplicidade.
  for (const id of ['sefaz-sync-3h', 'sefaz-sync-30m']) {
    try { await sefazQueue.removeJobScheduler(id); } catch { /* não existia */ }
  }
  const SEFAZ_CRON = '0 * * * *';
  await sefazQueue.upsertJobScheduler(
    'sefaz-sync-1h',
    { pattern: SEFAZ_CRON, tz: 'America/Sao_Paulo' },
    {
      name: 'sefaz-sync-cron',
      data: { kind: 'cron' as const },
      opts: { removeOnComplete: { count: 200 }, removeOnFail: { count: 200 } },
    },
  );
  logger.info({ cron: SEFAZ_CRON, tz: 'America/Sao_Paulo' }, '[worker] cron sefaz agendado (a cada 60 min)');
}

await ensureSchedule();
logger.info({ env: env.NODE_ENV }, '[worker] iniciado — aguardando jobs');

const shutdown = async (sig: string): Promise<void> => {
  logger.info({ sig }, '[worker] desligando');
  await Promise.all([
    worker.close(),
    sefazWorker.close(),
    zmartbiQueue.close(),
    sefazQueue.close(),
  ]);
  await redis.quit();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
