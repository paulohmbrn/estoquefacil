// PDF A4 humano-legível de uma contagem finalizada.
// Cabeçalho com loja/responsável/data/status + tabela de produtos contados.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { toDtlancestq } from '@estoque/shared';

const MM = 72 / 25.4;
const A4_W = 210 * MM;
const A4_H = 297 * MM;
const MARGIN = 15 * MM;
const CONTENT_W = A4_W - 2 * MARGIN;

export type ContagemPdfData = {
  contagemId: string;
  loja: { nome: string; apelido: string | null; zmartbiId: string };
  responsavelNome: string;
  criadaPor?: string | null;
  listaNome: string | null;
  status: string;
  dataContagem: Date;
  iniciadaEm: Date;
  finalizadaEm: Date | null;
  itens: Array<{
    cdarvprod: string;
    nome: string;
    grupo: string | null;
    unidade: string;
    quantidade: number;
  }>;
};

const dt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
});
const dtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });

export async function generateContagemPdf(data: ContagemPdfData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Contagem ${data.loja.apelido ?? data.loja.nome} ${dtData.format(data.dataContagem)}`);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([A4_W, A4_H]);
  let cursorY = A4_H - MARGIN;

  // Header
  page.drawText('ESTOQUE FÁCIL · CONTAGEM', {
    x: MARGIN, y: cursorY - 10,
    size: 8, font: fontBold, color: rgb(0, 0.25, 0.14),
  });
  cursorY -= 20;

  const titulo = data.listaNome ?? 'Contagem livre';
  page.drawText(titulo, {
    x: MARGIN, y: cursorY - 18,
    size: 18, font: fontBold, color: rgb(0.04, 0.1, 0.06),
  });
  cursorY -= 28;

  page.drawText(`${data.loja.apelido ?? data.loja.nome} · #${data.loja.zmartbiId}`, {
    x: MARGIN, y: cursorY - 12,
    size: 10, font: fontRegular, color: rgb(0.35, 0.4, 0.36),
  });
  cursorY -= 22;

  // Linha separadora
  page.drawLine({
    start: { x: MARGIN, y: cursorY },
    end: { x: A4_W - MARGIN, y: cursorY },
    color: rgb(0.04, 0.1, 0.06), thickness: 1,
  });
  cursorY -= 14;

  // Box de metadados (3 colunas)
  const colW = CONTENT_W / 4;
  const meta: Array<[string, string]> = [
    ['Data', dtData.format(data.dataContagem)],
    ['DTLANCESTQ', String(toDtlancestq(data.dataContagem))],
    ['Responsável', data.responsavelNome],
    ['Status', data.status],
  ];
  meta.forEach(([label, value], i) => {
    page.drawText(label, {
      x: MARGIN + i * colW, y: cursorY - 8,
      size: 7, font: fontRegular, color: rgb(0.4, 0.45, 0.4),
    });
    page.drawText(value, {
      x: MARGIN + i * colW, y: cursorY - 22,
      size: 11, font: fontBold, color: rgb(0.04, 0.1, 0.06),
    });
  });
  cursorY -= 38;

  page.drawText(
    `Iniciada em ${dt.format(data.iniciadaEm)}${data.finalizadaEm ? ` · Finalizada em ${dt.format(data.finalizadaEm)}` : ''}`,
    {
      x: MARGIN, y: cursorY - 8,
      size: 8, font: fontRegular, color: rgb(0.4, 0.45, 0.4),
    },
  );
  cursorY -= 18;

  page.drawLine({
    start: { x: MARGIN, y: cursorY },
    end: { x: A4_W - MARGIN, y: cursorY },
    color: rgb(0.7, 0.72, 0.7), thickness: 0.5,
  });
  cursorY -= 16;

  // Header da tabela
  const colWs = {
    cdarvprod: 95,
    nome: 235,
    grupo: 110,
    un: 30,
    qty: CONTENT_W - 95 - 235 - 110 - 30,
  };
  const drawTableHeader = (yy: number): void => {
    page.drawRectangle({
      x: MARGIN, y: yy - 14, width: CONTENT_W, height: 14,
      color: rgb(0.96, 0.96, 0.94),
    });
    let x = MARGIN + 4;
    [
      ['CDARVPROD', colWs.cdarvprod],
      ['PRODUTO', colWs.nome],
      ['GRUPO', colWs.grupo],
      ['UN', colWs.un],
    ].forEach(([label, w]) => {
      page.drawText(label as string, {
        x, y: yy - 10,
        size: 7, font: fontBold, color: rgb(0.4, 0.45, 0.4),
      });
      x += w as number;
    });
    page.drawText('QUANTIDADE', {
      x: MARGIN + CONTENT_W - 4 - fontBold.widthOfTextAtSize('QUANTIDADE', 7),
      y: yy - 10, size: 7, font: fontBold, color: rgb(0.4, 0.45, 0.4),
    });
  };
  drawTableHeader(cursorY);
  cursorY -= 18;

  // Rows
  let totalQty = 0;
  for (const it of data.itens) {
    if (cursorY < MARGIN + 30) {
      // nova página
      drawFooter(page, fontRegular, data, pdf.getPageCount());
      page = pdf.addPage([A4_W, A4_H]);
      cursorY = A4_H - MARGIN;
      drawTableHeader(cursorY);
      cursorY -= 18;
    }
    let x = MARGIN + 4;
    const cells: Array<[string, number, PDFFont]> = [
      [it.cdarvprod, colWs.cdarvprod, fontRegular],
      [truncateToWidth(it.nome, colWs.nome - 6, fontRegular, 9), colWs.nome, fontRegular],
      [truncateToWidth(it.grupo ?? '—', colWs.grupo - 6, fontRegular, 9), colWs.grupo, fontRegular],
      [it.unidade, colWs.un, fontRegular],
    ];
    for (const [text, w, font] of cells) {
      page.drawText(text, {
        x, y: cursorY,
        size: 9, font, color: rgb(0.04, 0.1, 0.06),
      });
      x += w;
    }
    const qtyStr = it.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
    page.drawText(qtyStr, {
      x: MARGIN + CONTENT_W - 4 - fontBold.widthOfTextAtSize(qtyStr, 9),
      y: cursorY, size: 9, font: fontBold, color: rgb(0.04, 0.1, 0.06),
    });
    totalQty += it.quantidade;
    cursorY -= 14;
  }

  // Total
  cursorY -= 4;
  page.drawLine({
    start: { x: MARGIN, y: cursorY }, end: { x: A4_W - MARGIN, y: cursorY },
    color: rgb(0.04, 0.1, 0.06), thickness: 1,
  });
  cursorY -= 14;
  page.drawText(`TOTAL · ${data.itens.length} produtos contados`, {
    x: MARGIN, y: cursorY,
    size: 9, font: fontBold, color: rgb(0.04, 0.1, 0.06),
  });
  const totalStr = totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  page.drawText(totalStr, {
    x: MARGIN + CONTENT_W - 4 - fontBold.widthOfTextAtSize(totalStr, 11),
    y: cursorY, size: 11, font: fontBold, color: rgb(0, 0.25, 0.14),
  });

  drawFooter(page, fontRegular, data, pdf.getPageCount());

  return pdf.save();
}

function drawFooter(page: PDFPage, font: PDFFont, data: ContagemPdfData, pageNum: number): void {
  page.drawText(
    `Estoque Fácil · ${data.loja.apelido ?? data.loja.nome} · ${dtData.format(data.dataContagem)} · página ${pageNum}`,
    {
      x: MARGIN, y: MARGIN - 8,
      size: 7, font, color: rgb(0.55, 0.6, 0.56),
    },
  );
  const idStr = `id ${data.contagemId.slice(0, 8)}`;
  page.drawText(idStr, {
    x: A4_W - MARGIN - font.widthOfTextAtSize(idStr, 7),
    y: MARGIN - 8, size: 7, font, color: rgb(0.55, 0.6, 0.56),
  });
}

function truncateToWidth(s: string, maxW: number, font: PDFFont, size: number): string {
  if (font.widthOfTextAtSize(s, size) <= maxW) return s;
  let cut = s.length;
  while (cut > 0 && font.widthOfTextAtSize(s.slice(0, cut) + '…', size) > maxW) cut -= 1;
  return s.slice(0, cut) + '…';
}
