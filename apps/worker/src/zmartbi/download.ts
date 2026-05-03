// Download streaming do dump completo do ZmartBI para um arquivo temporário.
// IMPORTANTE: nunca cancelar no meio (ZmartBI mantém o lock até timeout interno deles).

import { createWriteStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { env } from '../env.js';
import { logger } from '../logger.js';

export type DownloadResult = {
  filePath: string;
  bytes: number;
  durationMs: number;
};

export class ZmartbiDuplicateError extends Error {
  constructor() {
    super('ZmartBI retornou API_REQUEST_DUPLICATE — outro sync ainda em andamento no servidor.');
    this.name = 'ZmartbiDuplicateError';
  }
}

export async function downloadDump(): Promise<DownloadResult> {
  const startedAt = Date.now();
  const filePath = path.join(env.ZMARTBI_TEMP_DIR, `zmartbi-${startedAt}.json`);
  await mkdir(env.ZMARTBI_TEMP_DIR, { recursive: true });

  logger.info({ filePath, baseUrl: env.ZMARTBI_BASE_URL }, '[sync] iniciando download');

  const res = await fetch(env.ZMARTBI_BASE_URL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Webtoken: env.ZMARTBI_TOKEN,
    },
    // sem AbortController — não cancelar no meio
  });

  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status} do ZmartBI`);
  }

  // Pre-flight: pequena resposta de 43 bytes com Erro=API_REQUEST_DUPLICATE indica lock no servidor.
  const cl = Number(res.headers.get('content-length') ?? 0);
  if (cl > 0 && cl < 1024) {
    const text = await res.text();
    if (text.includes('API_REQUEST_DUPLICATE')) {
      logger.warn({ body: text }, '[sync] ZmartBI retornou lock duplicado');
      throw new ZmartbiDuplicateError();
    }
    throw new Error(`Resposta suspeita do ZmartBI (${cl}B): ${text.slice(0, 200)}`);
  }

  const writeStream = createWriteStream(filePath);
  await pipeline(Readable.fromWeb(res.body as never), writeStream);

  const st = await stat(filePath);
  const durationMs = Date.now() - startedAt;
  logger.info(
    { filePath, bytes: st.size, durationMs, mbps: (st.size / 1024 / 1024 / (durationMs / 1000)).toFixed(2) },
    '[sync] download concluído',
  );
  return { filePath, bytes: st.size, durationMs };
}

export async function cleanupDump(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch {
    /* ok se já foi */
  }
}
