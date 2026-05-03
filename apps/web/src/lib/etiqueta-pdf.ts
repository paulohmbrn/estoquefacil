// Gera PDF de etiquetas em múltiplos formatos:
//   - 'TERMICA_60'  → 60×60mm, 1 etiqueta por página (Elgin L42 Pro)
//   - 'TERMICA_40'  → 40×40mm, 1 etiqueta por página (Elgin L42 Pro)
//   - 'A4_PIMACO'   → 12 etiquetas/folha, 63,5×38,1mm cada (PIMACO A4360)

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { qrPngBuffer, listaQrUrl } from './qr';

const MM = 72 / 25.4;

export type EtiquetaFormato = 'TERMICA_60' | 'TERMICA_40' | 'A4_PIMACO';

export type EtiquetaItem = {
  produtoId: string;
  produtoNome: string;
  cdarvprod: string;
  unidade: string;
  metodo: 'CONGELADO' | 'RESFRIADO' | 'AMBIENTE';
  loteSufixo?: string;
  validadeDias?: number | null;
  responsavel: string;
  loja: { nome: string; endereco: string | null };
  etiquetaId: string;
  qrPayload: string;
};

const PT_BR_DATE = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
});

function fmtDates(item: EtiquetaItem): { manip: string; validade: string } {
  const now = new Date();
  const manip = PT_BR_DATE.format(now);
  let validade = '—';
  if (item.validadeDias && item.validadeDias > 0) {
    const v = new Date(now);
    v.setUTCDate(v.getUTCDate() + item.validadeDias);
    validade = PT_BR_DATE.format(v);
  }
  return { manip, validade };
}

function breakLines(text: string, maxW: number, font: PDFFont, size: number): string[] {
  if (font.widthOfTextAtSize(text, size) <= maxW) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (font.widthOfTextAtSize(test, size) <= maxW) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function short(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function drawLabelValue(
  page: PDFPage,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  label: string,
  value: string,
  x: number,
  y: number,
  scale = 1,
): void {
  page.drawText(label, {
    x, y: y + 6 * scale,
    size: 5.2 * scale,
    font: fontRegular,
    color: rgb(0.4, 0.45, 0.4),
  });
  page.drawText(value, {
    x, y,
    size: 7 * scale,
    font: fontBold,
    color: rgb(0, 0.1, 0.06),
  });
}

/** Renderiza UMA etiqueta numa região retangular do PDF (qualquer formato).
 *  origin: canto inferior esquerdo da etiqueta no PDF. */
async function drawEtiqueta(
  pdf: PDFDocument,
  page: PDFPage,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  item: EtiquetaItem,
  ox: number,
  oy: number,
  w: number,
  h: number,
): Promise<void> {
  // Escala baseada na largura referência (60mm = 100%)
  const scale = w / (60 * MM);
  const PAD = Math.max(2, 3 * MM * scale);

  // Borda
  page.drawRectangle({
    x: ox + 0.5, y: oy + 0.5, width: w - 1, height: h - 1,
    borderColor: rgb(0, 0.25, 0.14),
    borderWidth: 0.5,
  });

  // Header com método
  const badgeH = 4.5 * MM * scale;
  page.drawRectangle({
    x: ox, y: oy + h - badgeH, width: w, height: badgeH,
    color: rgb(0, 0.25, 0.14),
  });
  page.drawText(item.metodo, {
    x: ox + PAD,
    y: oy + h - badgeH + 1.4 * MM * scale,
    size: 8 * scale, font: fontBold, color: rgb(1, 1, 1),
  });
  const idText = `#${item.etiquetaId}`;
  page.drawText(idText, {
    x: ox + w - PAD - fontRegular.widthOfTextAtSize(idText, 7 * scale),
    y: oy + h - badgeH + 1.4 * MM * scale,
    size: 7 * scale, font: fontRegular, color: rgb(1, 1, 1),
  });

  let cursorY = oy + h - badgeH - 2 * MM * scale;

  // Nome
  const nomeMaxW = w - 2 * PAD;
  const nome = item.produtoNome.toUpperCase();
  let fs = 11 * scale;
  while (fontBold.widthOfTextAtSize(nome, fs) > nomeMaxW && fs > 5) fs -= 0.5;
  const lines = breakLines(nome, nomeMaxW, fontBold, fs);
  for (const line of lines.slice(0, 2)) {
    cursorY -= fs + 0.5 * MM * scale;
    page.drawText(line, {
      x: ox + PAD, y: cursorY, size: fs, font: fontBold, color: rgb(0, 0.1, 0.06),
    });
  }
  cursorY -= 1.5 * MM * scale;

  // Linha separadora
  page.drawLine({
    start: { x: ox + PAD, y: cursorY },
    end:   { x: ox + w - PAD, y: cursorY },
    color: rgb(0.6, 0.6, 0.6),
    thickness: 0.4,
  });
  cursorY -= 1.5 * MM * scale;

  // Datas — cada bloco label+value ocupa ~10pt de altura (label 6pt acima do value),
  // então o avanço vertical mínimo entre linhas é ~12pt pra não sobrepor.
  const ROW_GAP = 12 * scale;
  const { manip, validade } = fmtDates(item);
  const colW = (w - 2 * PAD) / 2;
  const colsY = cursorY - 7 * scale;
  drawLabelValue(page, fontRegular, fontBold, 'MANIP.', manip, ox + PAD, colsY, scale);
  drawLabelValue(page, fontRegular, fontBold, 'VALIDADE', validade, ox + PAD + colW, colsY, scale);
  cursorY = colsY - ROW_GAP;

  drawLabelValue(
    page, fontRegular, fontBold,
    'LOTE',
    `${item.cdarvprod}${item.loteSufixo ? '-' + item.loteSufixo : ''}`,
    ox + PAD, cursorY, scale,
  );
  cursorY -= ROW_GAP;
  drawLabelValue(page, fontRegular, fontBold, 'UN', item.unidade, ox + PAD, cursorY, scale);
  drawLabelValue(page, fontRegular, fontBold, 'RESP.', short(item.responsavel, 14), ox + PAD + colW, cursorY, scale);

  // QR canto inferior direito
  const qrSize = Math.min(22 * MM * scale, h * 0.42);
  const qrPng = await qrPngBuffer(item.qrPayload, 256);
  const qrImage = await pdf.embedPng(qrPng);
  page.drawImage(qrImage, {
    x: ox + w - PAD - qrSize,
    y: oy + PAD * 0.5,
    width: qrSize,
    height: qrSize,
  });

  // Loja rodapé
  page.drawText(short(item.loja.nome, 18), {
    x: ox + PAD, y: oy + PAD * 0.5 + 2,
    size: 6 * scale, font: fontBold, color: rgb(0.35, 0.4, 0.36),
  });
}

// ===== Geradores por formato =====

export async function generateEtiquetasPdf(
  items: EtiquetaItem[],
  formato: EtiquetaFormato = 'TERMICA_60',
): Promise<Uint8Array> {
  if (items.length === 0) {
    throw new Error('Nada pra imprimir — passe ao menos 1 etiqueta.');
  }
  const pdf = await PDFDocument.create();
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  if (formato === 'TERMICA_60' || formato === 'TERMICA_40') {
    const sizeMm = formato === 'TERMICA_60' ? 60 : 40;
    const W = sizeMm * MM;
    const H = sizeMm * MM;
    for (const item of items) {
      const page = pdf.addPage([W, H]);
      await drawEtiqueta(pdf, page, fontRegular, fontBold, item, 0, 0, W, H);
    }
  } else if (formato === 'A4_PIMACO') {
    // PIMACO A4360 — 21 etiquetas por folha (3 colunas × 7 linhas)
    // 63,5 × 38,1mm cada, A4 = 210 × 297mm
    //   linhas grudadas (gap vertical = 0): 7 × 38,1 = 266,7mm + ~15mm de margens top/bottom
    //   colunas com gap horizontal de 2,5mm: 3×63,5 + 2×2,5 = 195,5mm; lateral = (210-195,5)/2 = 7,25mm
    const A4_W = 210 * MM;
    const A4_H = 297 * MM;
    const COL = 3;
    const ROW = 7;
    const ETIQ_W = 63.5 * MM;
    const ETIQ_H = 38.1 * MM;
    const GAP_X = 2.5 * MM;
    const MARGIN_X = (A4_W - COL * ETIQ_W - (COL - 1) * GAP_X) / 2;
    const MARGIN_TOP = (A4_H - ROW * ETIQ_H) / 2; // ~15,15mm top + bottom iguais
    const perPage = COL * ROW;

    for (let i = 0; i < items.length; i += perPage) {
      const page = pdf.addPage([A4_W, A4_H]);
      const slice = items.slice(i, i + perPage);
      for (let idx = 0; idx < slice.length; idx += 1) {
        const col = idx % COL;
        const row = Math.floor(idx / COL);
        const ox = MARGIN_X + col * (ETIQ_W + GAP_X);
        // origem y do PDF é canto inferior esquerdo
        const oy = A4_H - MARGIN_TOP - (row + 1) * ETIQ_H;
        const item = slice[idx];
        if (item) {
          await drawEtiqueta(pdf, page, fontRegular, fontBold, item, ox, oy, ETIQ_W, ETIQ_H);
        }
      }
    }
  }

  return pdf.save();
}

export function etiquetaQrPayload(args: {
  lojaId: string;
  cdarvprod: string;
  etiquetaId: string;
  loteSufixo?: string;
}): string {
  return listaQrUrl(`e/${args.etiquetaId}`);
}
