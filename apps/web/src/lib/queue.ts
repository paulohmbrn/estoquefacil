// BullMQ queue producer — usado por Server Actions para enfileirar jobs no worker.
// O worker (apps/worker) consome as mesmas queues.

import IORedis from 'ioredis';
import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL!;
if (!REDIS_URL) {
  throw new Error('REDIS_URL não configurado');
}

declare global {
  // eslint-disable-next-line no-var
  var __estoqueRedis: IORedis | undefined;
  // eslint-disable-next-line no-var
  var __estoqueQueueZmartbi: Queue | undefined;
  // eslint-disable-next-line no-var
  var __estoqueQueueSefaz: Queue | undefined;
}

export const queueRedis: IORedis =
  globalThis.__estoqueRedis ??
  new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

export type ZmartbiSyncTrigger = { kind: 'cron' } | { kind: 'manual'; userId: string };
export type SefazSyncTrigger = { kind: 'cron' | 'manual'; userId?: string };

export const zmartbiQueue: Queue<ZmartbiSyncTrigger> =
  globalThis.__estoqueQueueZmartbi ??
  new Queue<ZmartbiSyncTrigger>('zmartbi-sync', { connection: queueRedis });

export const sefazQueue: Queue<SefazSyncTrigger> =
  globalThis.__estoqueQueueSefaz ??
  new Queue<SefazSyncTrigger>('sefaz-sync', { connection: queueRedis });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__estoqueRedis = queueRedis;
  globalThis.__estoqueQueueZmartbi = zmartbiQueue;
  globalThis.__estoqueQueueSefaz = sefazQueue;
}
