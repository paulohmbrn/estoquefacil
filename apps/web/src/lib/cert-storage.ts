// Filesystem storage do certificado .pfx
// Path: /secrets/cert-{lojaZmartbiId}.pfx (volume Docker mounted no container)

import { mkdir, readFile, writeFile, stat, unlink, chmod } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.env.CERT_DIR ?? '/secrets';

export function certPath(lojaZmartbiId: string): string {
  if (!/^\d{4}$/.test(lojaZmartbiId)) {
    throw new Error('lojaZmartbiId inválido (esperado 4 dígitos)');
  }
  return path.join(ROOT, `cert-${lojaZmartbiId}.pfx`);
}

export async function saveCert(lojaZmartbiId: string, pfxBuffer: Buffer): Promise<string> {
  const p = certPath(lojaZmartbiId);
  await mkdir(ROOT, { recursive: true });
  await writeFile(p, pfxBuffer);
  await chmod(p, 0o600).catch(() => undefined);
  return p;
}

export async function readCert(lojaZmartbiId: string): Promise<Buffer> {
  return readFile(certPath(lojaZmartbiId));
}

export async function certExists(lojaZmartbiId: string): Promise<boolean> {
  try {
    const s = await stat(certPath(lojaZmartbiId));
    return s.isFile();
  } catch {
    return false;
  }
}

export async function deleteCert(lojaZmartbiId: string): Promise<void> {
  await unlink(certPath(lojaZmartbiId)).catch(() => undefined);
}
