// Lock global Redis para garantir que só um sync ZmartBI roda por vez.
// Defende contra: agendamento + manual simultâneos, retries, restart de worker.
// O ZmartBI tem lock próprio no servidor (API_REQUEST_DUPLICATE) — este é a 1ª camada local.

import type IORedis from 'ioredis';

const KEY = 'estoque:sync:zmartbi:lock';
const TTL_SECONDS = 30 * 60; // 30 min — janela larga porque o ZmartBI demora pra montar dump

export async function acquireLock(redis: IORedis, holderId: string): Promise<boolean> {
  const ok = await redis.set(KEY, holderId, 'EX', TTL_SECONDS, 'NX');
  return ok === 'OK';
}

export async function releaseLock(redis: IORedis, holderId: string): Promise<void> {
  // Lua script: só apaga se for o dono atual (evita liberar lock de outro holder).
  const lua = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      return redis.call('DEL', KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(lua, 1, KEY, holderId);
}

export async function getLockHolder(redis: IORedis): Promise<string | null> {
  return redis.get(KEY);
}
