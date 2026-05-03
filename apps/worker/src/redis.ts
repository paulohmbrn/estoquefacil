import IORedis from 'ioredis';
import { env } from './env.js';

// Conexão única reaproveitada por BullMQ + locks.
// maxRetriesPerRequest=null é exigência do BullMQ.
export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on('error', (err) => {
  // Logado por quem instancia o worker; aqui evita unhandled.
  // eslint-disable-next-line no-console
  console.error('[redis] erro de conexão:', err.message);
});
