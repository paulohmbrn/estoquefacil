// Relatório consolidado humano de N contagens FINALIZADAS/EXPORTADAS da mesma loja.
// As contagens podem ser de datas diferentes — a data de lançamento do consolidado
// é a MENOR delas. Uso: gestor seleciona contagens em /relatorios/contagens, escolhe
// PDF ou XLSX. NÃO substitui o export ZmartBI (formato fechado): este é pra leitura/impressão.

import ExcelJS from 'exceljs';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import { prisma } from '@/lib/db';

const MM = 72 / 25.4;
const A4_W = 210 * MM;
const A4_H = 297 * MM;
const MARGIN = 15 * MM;
const CONTENT_W = A4_W - 2 * MARGIN;

const dt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
});
const dtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });

export interface ConsolidadoItem {
  cdarvprod: string;
  nome: string;
  grupo: string | null;
  unidade: string;
  quantidadeTotal: number;
  numContagens: number; // em quantas das contagens selecionadas o item apareceu
}

export interface ConsolidadoData {
  loja: { nome: string; apelido: string | null; zmartbiId: string };
  /** Data de lançamento do consolidado: a MENOR `dataContagem` entre as contagens selecionadas. */
  dataContagem: Date;
  contagens: Array<{
    id: string;
    dataContagem: Date;
    responsavelNome: string;
    listaNome: string | null;
    iniciadaEm: Date;
    finalizadaEm: Date | null;
  }>;
  exportadoPor: string;
  exportadoEm: Date;
  itens: ConsolidadoItem[];
}

export interface ConsolidadoResult {
  buffer: Buffer;
  filename: string;
  rowCount: number;
}

// =====================================================================
// Carga de dados
// =====================================================================

/**
 * Carrega N contagens, valida loja + status (FINALIZADA/EXPORTADA), agrega por
 * produto. As contagens podem ser de datas diferentes — nesse caso a data de
 * lançamento do consolidado é a MENOR delas. Retorna `{ error }` se a validação falhar.
 */
export async function fetchConsolidado(args: {
  contagensIds: string[];
  lojaId: string;
  exportadoPor: string;
}): Promise<{ data: ConsolidadoData } | { error: string }> {
  if (args.contagensIds.length === 0) return { error: 'Nenhuma contagem selecionada' };

  const contagens = await prisma.contagem.findMany({
    where: { id: { in: args.contagensIds }, lojaId: args.lojaId },
    include: {
      loja: { select: { nome: true, apelido: true, zmartbiId: true } },
      lista: { select: { nome: true } },
      responsavel: { select: { nome: true } },
      lancamentos: {
        select: {
          quantidade: true,
          produto: {
            select: {
              cdarvprod: true,
              nome: true,
              unidade: true,
              grupo: { select: { nome: true } },
            },
          },
        },
      },
    },
    orderBy: { iniciadaEm: 'asc' },
  });

  if (contagens.length === 0) return { error: 'Contagens não encontradas' };
  if (contagens.length !== args.contagensIds.length) {
    return { error: 'Algumas contagens não pertencem a esta loja' };
  }

  // Validação: status FINALIZADA ou EXPORTADA. As datas podem variar entre as
  // contagens — a data de lançamento do consolidado será a menor delas (abaixo).
  for (const c of contagens) {
    if (c.status !== 'FINALIZADA' && c.status !== 'EXPORTADA') {
      return { error: 'Apenas contagens Finalizadas ou Exportadas podem ser consolidadas' };
    }
  }

  // Agregação por cdarvprod
  const agg = new Map<string, ConsolidadoItem & { _seenInContagens: Set<string> }>();
  for (const c of contagens) {
    for (const l of c.lancamentos) {
      const key = l.produto.cdarvprod;
      const qtd = Number(l.quantidade);
      const existing = agg.get(key);
      if (existing) {
        existing.quantidadeTotal += qtd;
        existing._seenInContagens.add(c.id);
      } else {
        agg.set(key, {
          cdarvprod: l.produto.cdarvprod,
          nome: l.produto.nome,
          grupo: l.produto.grupo?.nome ?? null,
          unidade: l.produto.unidade,
          quantidadeTotal: qtd,
          numContagens: 0,
          _seenInContagens: new Set([c.id]),
        });
      }
    }
  }
  const itens: ConsolidadoItem[] = [...agg.values()]
    .map((i) => ({ ...i, numContagens: i._seenInContagens.size }))
    .sort((a, b) => (a.grupo ?? '').localeCompare(b.grupo ?? '') || a.nome.localeCompare(b.nome));

  const ref = contagens[0]!;
  // Data de lançamento = a MENOR dataContagem entre as contagens selecionadas.
  const dataLancamento = contagens.reduce(
    (min, c) => (c.dataContagem < min ? c.dataContagem : min),
    ref.dataContagem,
  );
  return {
    data: {
      loja: ref.loja,
      dataContagem: dataLancamento,
      contagens: contagens.map((c) => ({
        id: c.id,
        dataContagem: c.dataContagem,
        responsavelNome: c.responsavel.nome,
        listaNome: c.lista?.nome ?? null,
        iniciadaEm: c.iniciadaEm,
        finalizadaEm: c.finalizadaEm,
      })),
      exportadoPor: args.exportadoPor,
      exportadoEm: new Date(),
      itens,
    },
  };
}

// =====================================================================
// XLSX humano
// =====================================================================

export async function buildConsolidadoXlsx(data: ConsolidadoData): Promise<ConsolidadoResult> {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.exportadoPor;
  wb.created = data.exportadoEm;
  const ws = wb.addWorksheet('Consolidado');

  // Cabeçalho com metadata (linhas 1-4 fora da tabela)
  ws.mergeCells('A1:G1');
  ws.getCell('A1').value = `Consolidado · ${data.loja.apelido ?? data.loja.nome} · #${data.loja.zmartbiId}`;
  ws.getCell('A1').font = { bold: true, size: 14 };

  const datasDistintas = [...new Set(data.contagens.map((c) => c.dataContagem.toISOString().slice(0, 10)))].sort();
  ws.mergeCells('A2:G2');
  ws.getCell('A2').value =
    datasDistintas.length > 1
      ? `Data de lançamento: ${dtData.format(data.dataContagem)} (a menor de ${datasDistintas.length} datas) · ${data.contagens.length} contagens consolidadas`
      : `Data: ${dtData.format(data.dataContagem)} · ${data.contagens.length} contagem${data.contagens.length > 1 ? 's' : ''} consolidada${data.contagens.length > 1 ? 's' : ''}`;
  ws.getCell('A2').font = { size: 10, color: { argb: 'FF555555' } };

  ws.mergeCells('A3:G3');
  ws.getCell('A3').value = `Exportado por ${data.exportadoPor} em ${dt.format(data.exportadoEm)}`;
  ws.getCell('A3').font = { size: 9, color: { argb: 'FF777777' }, italic: true };

  // Linha 5 = header da tabela
  ws.getRow(5).values = ['Nº', 'CDARVPROD', 'Produto', 'Grupo', 'Unidade', 'Qtd Consolidada', 'Nº de contagens'];
  ws.columns = [
    { key: 'num', width: 6 },
    { key: 'cdarvprod', width: 15 },
    { key: 'nome', width: 50 },
    { key: 'grupo', width: 22 },
    { key: 'unidade', width: 10 },
    { key: 'quantidade', width: 18 },
    { key: 'numContagens', width: 14 },
  ];
  const headerRow = ws.getRow(5);
  headerRow.font = { bold: true };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F1' } };
  headerRow.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };

  // Linhas
  data.itens.forEach((it, i) => {
    ws.addRow({
      num: i + 1,
      cdarvprod: it.cdarvprod,
      nome: it.nome,
      grupo: it.grupo ?? '—',
      unidade: it.unidade,
      quantidade: it.quantidadeTotal,
      numContagens: it.numContagens,
    });
  });

  // Total na última linha
  const totalRow = ws.addRow({
    num: '',
    cdarvprod: '',
    nome: 'TOTAL',
    grupo: '',
    unidade: '',
    quantidade: data.itens.reduce((acc, it) => acc + it.quantidadeTotal, 0),
    numContagens: '',
  });
  totalRow.font = { bold: true };
  totalRow.border = { top: { style: 'thin', color: { argb: 'FF999999' } } };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer,
    filename: filenameBase(data) + '.xlsx',
    rowCount: data.itens.length,
  };
}

// =====================================================================
// PDF humano (A4 retrato)
// =====================================================================

export async function generateConsolidadoPdf(data: ConsolidadoData): Promise<ConsolidadoResult> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Consolidado ${data.loja.apelido ?? data.loja.nome} ${dtData.format(data.dataContagem)}`);
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const colWs = {
    num: 28,
    cdarvprod: 80,
    nome: 200,
    grupo: 90,
    unidade: 30,
    quantidade: 50,
    numContagens: CONTENT_W - 28 - 80 - 200 - 90 - 30 - 50,
  };

  let page = pdf.addPage([A4_W, A4_H]);
  let pageIndex = 1;
  let cursorY = A4_H - MARGIN;

  // Header (só na 1ª página)
  page.drawText('ESTOQUE FÁCIL · CONSOLIDADO DE CONTAGEM', {
    x: MARGIN, y: cursorY - 10,
    size: 8, font: fontBold, color: rgb(0, 0.25, 0.14),
  });
  cursorY -= 22;

  page.drawText(`${data.loja.apelido ?? data.loja.nome} · #${data.loja.zmartbiId}`, {
    x: MARGIN, y: cursorY - 18,
    size: 16, font: fontBold, color: rgb(0.04, 0.1, 0.06),
  });
  cursorY -= 28;

  const datasDistintas = [...new Set(data.contagens.map((c) => c.dataContagem.toISOString().slice(0, 10)))].sort();
  page.drawText(
    datasDistintas.length > 1
      ? `Data de lançamento: ${dtData.format(data.dataContagem)}  ·  a menor de ${datasDistintas.length} datas`
      : `Data: ${dtData.format(data.dataContagem)}`,
    {
      x: MARGIN, y: cursorY - 12,
      size: 11, font: fontRegular, color: rgb(0.2, 0.2, 0.2),
    },
  );
  cursorY -= 18;

  page.drawText(`${data.contagens.length} contagem${data.contagens.length > 1 ? 's' : ''} consolidada${data.contagens.length > 1 ? 's' : ''} · ${data.itens.length} produtos distintos`, {
    x: MARGIN, y: cursorY - 10,
    size: 9, font: fontRegular, color: rgb(0.35, 0.4, 0.36),
  });
  cursorY -= 16;

  // Lista de contagens incluídas (com responsável + lista)
  for (const c of data.contagens) {
    if (cursorY < MARGIN + 50) break; // se não couber, corta — fica só o resumo
    page.drawText(
      `· ${dtData.format(c.dataContagem)} — ${c.listaNome ?? 'Contagem livre'} — ${c.responsavelNome} — iniciada ${dt.format(c.iniciadaEm)}`,
      {
        x: MARGIN, y: cursorY - 8,
        size: 8, font: fontRegular, color: rgb(0.4, 0.45, 0.4),
      },
    );
    cursorY -= 11;
  }
  cursorY -= 8;

  // Linha separadora
  page.drawLine({
    start: { x: MARGIN, y: cursorY },
    end: { x: A4_W - MARGIN, y: cursorY },
    color: rgb(0.04, 0.1, 0.06), thickness: 0.8,
  });
  cursorY -= 16;

  // Header da tabela
  const drawTableHeader = (yy: number): number => {
    page.drawRectangle({
      x: MARGIN, y: yy - 14, width: CONTENT_W, height: 14,
      color: rgb(0.96, 0.96, 0.94),
    });
    let x = MARGIN + 4;
    const headers: Array<[string, number, 'left' | 'right']> = [
      ['Nº', colWs.num, 'left'],
      ['CDARVPROD', colWs.cdarvprod, 'left'],
      ['PRODUTO', colWs.nome, 'left'],
      ['GRUPO', colWs.grupo, 'left'],
      ['UN', colWs.unidade, 'left'],
      ['QTD', colWs.quantidade, 'right'],
      ['# CONTS.', colWs.numContagens, 'right'],
    ];
    for (const [label, w, align] of headers) {
      const text = label;
      const tw = fontBold.widthOfTextAtSize(text, 7);
      page.drawText(text, {
        x: align === 'right' ? x + w - 6 - tw : x,
        y: yy - 10,
        size: 7, font: fontBold, color: rgb(0.4, 0.45, 0.4),
      });
      x += w;
    }
    return yy - 18;
  };
  cursorY = drawTableHeader(cursorY);

  // Rows
  let totalQty = 0;
  data.itens.forEach((it, i) => {
    if (cursorY < MARGIN + 24) {
      // Rodapé na página atual + nova página
      drawFooter(page, fontRegular, data, pageIndex);
      pageIndex += 1;
      page = pdf.addPage([A4_W, A4_H]);
      cursorY = A4_H - MARGIN;
      cursorY = drawTableHeader(cursorY);
    }
    let x = MARGIN + 4;
    const cells: Array<[string, number, 'left' | 'right']> = [
      [String(i + 1), colWs.num, 'left'],
      [it.cdarvprod, colWs.cdarvprod, 'left'],
      [truncateToWidth(it.nome, colWs.nome - 6, fontRegular, 9), colWs.nome, 'left'],
      [truncateToWidth(it.grupo ?? '—', colWs.grupo - 6, fontRegular, 8), colWs.grupo, 'left'],
      [it.unidade, colWs.unidade, 'left'],
      [formatQty(it.quantidadeTotal), colWs.quantidade, 'right'],
      [String(it.numContagens), colWs.numContagens, 'right'],
    ];
    for (const [text, w, align] of cells) {
      const tw = fontRegular.widthOfTextAtSize(text, 8.5);
      page.drawText(text, {
        x: align === 'right' ? x + w - 4 - tw : x,
        y: cursorY - 9,
        size: 8.5, font: fontRegular, color: rgb(0.04, 0.1, 0.06),
      });
      x += w;
    }
    // linha de baixo
    page.drawLine({
      start: { x: MARGIN, y: cursorY - 14 },
      end: { x: A4_W - MARGIN, y: cursorY - 14 },
      color: rgb(0.92, 0.92, 0.9), thickness: 0.3,
    });
    cursorY -= 14;
    totalQty += it.quantidadeTotal;
  });

  // Linha de TOTAL (na última página)
  if (cursorY < MARGIN + 30) {
    drawFooter(page, fontRegular, data, pageIndex);
    pageIndex += 1;
    page = pdf.addPage([A4_W, A4_H]);
    cursorY = A4_H - MARGIN;
  }
  cursorY -= 6;
  page.drawLine({
    start: { x: MARGIN, y: cursorY },
    end: { x: A4_W - MARGIN, y: cursorY },
    color: rgb(0.04, 0.1, 0.06), thickness: 0.8,
  });
  cursorY -= 14;
  page.drawText('TOTAL', {
    x: MARGIN + 4, y: cursorY,
    size: 9, font: fontBold, color: rgb(0.04, 0.1, 0.06),
  });
  const totalText = formatQty(totalQty);
  page.drawText(totalText, {
    x: MARGIN + CONTENT_W - 4 - colWs.numContagens - fontBold.widthOfTextAtSize(totalText, 9),
    y: cursorY,
    size: 9, font: fontBold, color: rgb(0.04, 0.1, 0.06),
  });

  // Rodapé na última página
  drawFooter(page, fontRegular, data, pageIndex);

  const buffer = Buffer.from(await pdf.save());
  return {
    buffer,
    filename: filenameBase(data) + '.pdf',
    rowCount: data.itens.length,
  };
}

// =====================================================================
// Helpers
// =====================================================================

function filenameBase(data: ConsolidadoData): string {
  const dataIso = data.dataContagem.toISOString().slice(0, 10).replace(/-/g, '');
  const apelido = (data.loja.apelido ?? data.loja.nome).replace(/[^\w]+/g, '_');
  return `Consolidado_${apelido}_${dataIso}`;
}

function drawFooter(
  page: ReturnType<PDFDocument['addPage']>,
  font: PDFFont,
  data: ConsolidadoData,
  pageIndex: number,
): void {
  const footer = `Estoque Fácil · ${data.loja.apelido ?? data.loja.nome} · ${dtData.format(data.dataContagem)} · Exportado por ${data.exportadoPor} em ${dt.format(data.exportadoEm)} · pág. ${pageIndex}`;
  page.drawText(footer, {
    x: MARGIN,
    y: 8 * MM,
    size: 7,
    font,
    color: rgb(0.5, 0.55, 0.5),
  });
}

function truncateToWidth(text: string, maxWidth: number, font: PDFFont, size: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && font.widthOfTextAtSize(s + '…', size) > maxWidth) {
    s = s.slice(0, -1);
  }
  return s + '…';
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('pt-BR');
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}
