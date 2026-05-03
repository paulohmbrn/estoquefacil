// AES-256-GCM utility para senhas de certificado A1.
// Formato armazenado: "<iv-hex>:<authTag-hex>:<cipherText-hex>"
// Chave: variável ENCRYPTION_KEY do env (32 bytes em hex = 64 chars).

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY não configurada (precisa 32 bytes hex/base64).');
  }
  // Aceita hex (64 chars) ou base64; senão deriva via SHA-256
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  if (/^[A-Za-z0-9+/=]{40,}$/.test(raw)) {
    const buf = Buffer.from(raw, 'base64');
    if (buf.length === 32) return buf;
  }
  // Fallback: deriva 32 bytes via SHA-256 (idempotente, seguro o suficiente)
  return createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptString(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

export function decryptString(blob: string): string {
  const key = getKey();
  const [ivHex, tagHex, dataHex] = blob.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Formato cifrado inválido (esperado iv:tag:cipher).');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}
