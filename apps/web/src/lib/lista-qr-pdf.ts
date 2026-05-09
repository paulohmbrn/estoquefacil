// PDF do QR de uma Lista de Contagem.
// Página A4 portrait, mas o conteúdo gráfico ocupa apenas uma "área A5"
// (148×210mm) centralizada horizontalmente no topo da página — fica
// proporcional ao tamanho do papel impresso e cabe num quadro pequeno.

import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { qrPngBuffer, listaQrUrl } from './qr';

const MM = 72 / 25.4;
const A4_W = 210 * MM;
const A4_H = 297 * MM;

// Cartão A5 portrait dentro da página A4
const CARD_W = 148 * MM;
const CARD_H = 210 * MM;
const CARD_X = (A4_W - CARD_W) / 2;       // centralizado horizontalmente
const CARD_Y_TOP_MARGIN = 20 * MM;        // 20mm do topo da página
const CARD_Y = A4_H - CARD_Y_TOP_MARGIN - CARD_H;

const PT_BR_DATETIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
});

export interface ListaQrPdfData {
  listaNome: string;
  lojaNome: string;        // nome ou apelido amigável
  qrToken: string;
  responsavelImpressao: string;
  totalProdutos: number;
  tags: string[];
}

export async function generateListaQrPdf(data: ListaQrPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`QR Lista — ${data.listaNome}`);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const page = pdf.addPage([A4_W, A4_H]);

  // Borda do "cartão A5"
  page.drawRectangle({
    x: CARD_X, y: CARD_Y, width: CARD_W, height: CARD_H,
    borderColor: rgb(0, 0.25, 0.14),
    borderWidth: 0.6,
  });

  // Faixa decorativa fina no topo do cartão
  const stripeH = 6 * MM;
  page.drawRectangle({
    x: CARD_X, y: CARD_Y + CARD_H - stripeH, width: CARD_W, height: stripeH,
    color: rgb(0, 0.25, 0.14),
  });

  // Eyebrow (nome da loja, branco sobre faixa verde)
  const eyebrowText = `ESTOQUE FÁCIL · ${data.lojaNome.toUpperCase()}`;
  drawCenteredText(page, eyebrowText, {
    x: CARD_X + CARD_W / 2,
    y: CARD_Y + CARD_H - stripeH + (stripeH - 8) / 2,
    size: 8, font: fontBold, color: rgb(1, 1, 1),
  });

  // Eyebrow secundária (só "Lista de contagem")
  const insideTopY = CARD_Y + CARD_H - stripeH - 14 * MM;
  drawCenteredText(page, 'LISTA DE CONTAGEM', {
    x: CARD_X + CARD_W / 2,
    y: insideTopY,
    size: 9, font: fontBold, color: rgb(0.4, 0.45, 0.4),
  });

  // Nome da lista (título grande, com wrap)
  const tituloLines = wrapText(data.listaNome, fontBold, 22, CARD_W - 20 * MM, 2);
  let cursorY = insideTopY - 10 * MM;
  for (const line of tituloLines) {
    drawCenteredText(page, line, {
      x: CARD_X + CARD_W / 2,
      y: cursorY,
      size: 22, font: fontBold, color: rgb(0.04, 0.1, 0.06),
    });
    cursorY -= 10 * MM;
  }

  // Quantidade de produtos
  const qtdText = `${data.totalProdutos} ${data.totalProdutos === 1 ? 'produto' : 'produtos'}`;
  cursorY -= 1 * MM;
  drawCenteredText(page, qtdText, {
    x: CARD_X + CARD_W / 2,
    y: cursorY,
    size: 11, font: fontRegular, color: rgb(0.35, 0.4, 0.36),
  });
  cursorY -= 6 * MM;

  // Tags como badges em linha (até 5)
  if (data.tags.length > 0) {
    const tags = data.tags.slice(0, 5);
    const tagFontSize = 8;
    const padX = 2.5 * MM;
    const padY = 1 * MM;
    const gap = 2 * MM;
    const tagH = tagFontSize + 2 * padY;
    const tagWidths = tags.map((t) => fontBold.widthOfTextAtSize(t.toUpperCase(), tagFontSize) + 2 * padX);
    const totalW = tagWidths.reduce((a, w) => a + w, 0) + gap * (tags.length - 1);
    let tx = CARD_X + (CARD_W - totalW) / 2;
    const ty = cursorY - tagH;
    tags.forEach((t, i) => {
      const w = tagWidths[i]!;
      page.drawRectangle({
        x: tx, y: ty, width: w, height: tagH,
        color: rgb(0.93, 0.95, 0.92),
        borderColor: rgb(0.7, 0.78, 0.72),
        borderWidth: 0.4,
      });
      page.drawText(t.toUpperCase(), {
        x: tx + padX,
        y: ty + padY + 1,
        size: tagFontSize,
        font: fontBold,
        color: rgb(0, 0.25, 0.14),
      });
      tx += w + gap;
    });
    cursorY = ty - 2 * MM;
  }

  // QR Code centralizado (lado ~80mm) — posição vertical depende do
  // espaço restante após nome + qtd + tags
  const qrSize = 80 * MM;
  const qrX = CARD_X + (CARD_W - qrSize) / 2;
  const qrY = Math.min(
    cursorY - qrSize - 2 * MM,
    CARD_Y + (CARD_H - qrSize) / 2 - 10 * MM,
  );
  const qrPayload = listaQrUrl(data.qrToken);
  const qrPng = await qrPngBuffer(qrPayload, 600);
  const qrImage = await pdf.embedPng(qrPng);
  page.drawImage(qrImage, {
    x: qrX, y: qrY, width: qrSize, height: qrSize,
  });

  // Frase explicativa abaixo do QR
  const fraseY = qrY - 10 * MM;
  drawCenteredText(
    page,
    'Use esse QR Code para iniciar a contagem desta lista',
    {
      x: CARD_X + CARD_W / 2,
      y: fraseY,
      size: 11, font: fontRegular, color: rgb(0.2, 0.25, 0.2),
    },
  );

  // Rodapé: responsável + data
  const rodapeText = `Impresso por ${data.responsavelImpressao} · ${PT_BR_DATETIME.format(new Date())}`;
  drawCenteredText(page, rodapeText, {
    x: CARD_X + CARD_W / 2,
    y: CARD_Y + 10 * MM,
    size: 8, font: fontRegular, color: rgb(0.45, 0.5, 0.45),
  });

  // URL bem pequena no rodapé do cartão (pra fallback de digitação)
  drawCenteredText(page, qrPayload, {
    x: CARD_X + CARD_W / 2,
    y: CARD_Y + 5 * MM,
    size: 6, font: fontRegular, color: rgb(0.6, 0.62, 0.6),
  });

  return pdf.save();
}

// ===== Helpers =====

interface DrawOpts {
  x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb>;
}

function drawCenteredText(
  page: ReturnType<PDFDocument['addPage']>,
  text: string,
  o: DrawOpts,
): void {
  const w = o.font.widthOfTextAtSize(text, o.size);
  page.drawText(text, {
    x: o.x - w / 2,
    y: o.y,
    size: o.size,
    font: o.font,
    color: o.color,
  });
}

function wrapText(text: string, font: PDFFont, size: number, maxW: number, maxLines: number): string[] {
  if (font.widthOfTextAtSize(text, size) <= maxW) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (font.widthOfTextAtSize(test, size) <= maxW) cur = test;
    else {
      if (cur) lines.push(cur);
      cur = w;
    }
    if (lines.length >= maxLines) break;
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    // Se sobrou texto, adiciona "…" na última linha
    const remaining = words.slice(lines.join(' ').split(/\s+/).length).join(' ');
    if (remaining) {
      let last = lines[lines.length - 1]!;
      while (last.length > 1 && font.widthOfTextAtSize(last + '…', size) > maxW) {
        last = last.slice(0, -1);
      }
      lines[lines.length - 1] = last + '…';
    }
  }
  return lines;
}
