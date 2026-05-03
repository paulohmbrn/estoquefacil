import QRCode from 'qrcode';

/** PNG dataURL — usado em <img> para previews ou no browser. */
export async function qrDataUrl(payload: string, size = 256): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: size,
    color: { dark: '#0a1a10', light: '#ffffff' },
  });
}

/** PNG buffer — usado para embutir no PDF via pdf-lib. */
export async function qrPngBuffer(payload: string, size = 512): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: size,
    color: { dark: '#0a1a10', light: '#ffffff' },
    type: 'png',
  });
}

/** URL canônica que o QR de uma lista deve apontar (resolvido por GET /l/[token]). */
export function listaQrUrl(qrToken: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.AUTH_URL ?? 'https://estoque.reismagos.com.br';
  return `${base.replace(/\/$/, '')}/l/${qrToken}`;
}
