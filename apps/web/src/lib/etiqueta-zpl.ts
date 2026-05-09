// Geração de etiquetas em ZPL (Zebra Programming Language) pra impressoras
// térmicas que aceitam ZPL — Argox OS-214 Plus em modo de emulação ZPL II,
// Zebra ZD220/ZT230 etc.
//
// Tamanho fixo: 100×60mm @ 203 dpi = 800×480 dots.
// 1mm = 8 dots; cada coordenada/dimensão abaixo é em dots.

import type { EtiquetaItem } from './etiqueta-pdf';

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

/** Sanitiza pra ZPL: ZPL usa ^ e ~ como tokens; substitui por equivalente seguro. */
function s(text: string): string {
  return text.replace(/[\^~]/g, '-');
}

function shortStr(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

/** Gera o ZPL de UMA etiqueta (^XA ... ^XZ). */
export function generateEtiquetaZpl(item: EtiquetaItem): string {
  const { manip, validade } = fmtDates(item);
  const nome = shortStr(item.produtoNome.toUpperCase(), 60);
  const lote = `${item.cdarvprod}${item.loteSufixo ? '-' + item.loteSufixo : ''}`;
  const resp = shortStr(item.responsavel, 18);
  const lojaNome = shortStr(item.loja.nome, 36);

  // QR ZPL: ^BQN,2,M onde M=mag (1-10). Pra QR de URL ~70 chars, M=5 dá ~30mm² impressos.
  const qr = `LA,${item.qrPayload}`;

  return [
    '^XA',
    '^CI28',                     // UTF-8 (suporta acentos)
    '^PW800',                    // print width 100mm
    '^LL480',                    // label length 60mm
    '^LH0,0',                    // home

    // ===== Header (faixa preta com método) =====
    '^FO0,0^GB800,72,72,B,0^FS',
    `^FO20,16^A0N,46,46^FR^FD${s(item.metodo)}^FS`,
    `^FO580,26^A0N,28,28^FR^FD#${s(item.etiquetaId)}^FS`,

    // ===== Nome do produto =====
    `^FO20,90^A0N,52,52^FB760,2,4,L,0^FD${s(nome)}^FS`,

    // ===== Separador =====
    '^FO20,210^GB760,2,2^FS',

    // ===== Datas =====
    '^FO20,222^A0N,18,18^FDMANIP.^FS',
    `^FO20,246^A0N,30,30^FD${s(manip)}^FS`,
    '^FO400,222^A0N,18,18^FDVALIDADE^FS',
    `^FO400,246^A0N,30,30^FD${s(validade)}^FS`,

    // ===== Lote =====
    '^FO20,300^A0N,18,18^FDLOTE^FS',
    `^FO20,324^A0N,28,28^FD${s(lote)}^FS`,

    // ===== Un + Resp =====
    '^FO20,372^A0N,18,18^FDUN^FS',
    `^FO20,396^A0N,28,28^FD${s(item.unidade)}^FS`,
    '^FO180,372^A0N,18,18^FDRESP.^FS',
    `^FO180,396^A0N,28,28^FD${s(resp)}^FS`,

    // ===== QR Code (canto inferior direito) =====
    `^FO580,260^BQN,2,5^FD${s(qr)}^FS`,

    // ===== Loja rodapé =====
    `^FO20,450^A0N,20,20^FD${s(lojaNome)}^FS`,

    '^XZ',
  ].join('\n');
}

/** Gera o ZPL de N etiquetas em sequência (cada uma é um ^XA ... ^XZ separado). */
export function generateEtiquetasZpl(items: EtiquetaItem[]): string {
  return items.map(generateEtiquetaZpl).join('\n');
}

// =====================================================================
// FORMATO DUPLA 48×40mm (Microline 48×40×02) — usado na FFB ALIMENTOS
//
// Rolo com 2 etiquetas POR LINHA, separadas por 2mm de gap, 4mm de
// margem lateral. Total de papel: 106×40mm = 848×320 dots @ 203dpi.
//
// Estratégia: aproveita o rolo PAREANDO etiquetas. Cada "label" lógico
// (linha de 106×40mm) leva 2 etiquetas DIFERENTES — uma na metade
// esquerda, outra na direita. Quando a quantidade de etiquetas é ímpar,
// a última linha tem só a metade esquerda preenchida.
//
// Layout dentro de CADA metade (48×40mm = 384×320 dots, área útil
// ~360×290 dots após padding):
//   [faixa preta com método + #ID]            ← 34 dots de altura
//   [nome do produto, 2 linhas]   [QR no canto direito]
//   MANIP: dd/mm/aaaa | VAL: dd/mm/aaaa
//   LOTE | RESP/UN
// =====================================================================

const DUPLA_LABEL_WIDTH = 848;       // 106mm
const DUPLA_LABEL_HEIGHT = 320;      // 40mm
const DUPLA_LEFT_X = 32;             // 4mm margem esquerda
const DUPLA_RIGHT_X = 432;           // 4mm + 48mm + 2mm = 54mm

function dupla48HalfBlock(item: EtiquetaItem, offsetX: number): string {
  const { manip, validade } = fmtDates(item);
  const nome = shortStr(item.produtoNome.toUpperCase(), 36);
  const lote = `${item.cdarvprod}${item.loteSufixo ? '-' + item.loteSufixo : ''}`;
  const resp = shortStr(item.responsavel, 9);
  const W = 360;
  // QR fica no canto inferior direito; mag=4 ≈ 10mm de lado.
  const qr = `LA,${item.qrPayload}`;
  return [
    // Faixa preta com o método e ID
    `^FO${offsetX},6^GB${W},34,34,B,0^FS`,
    `^FO${offsetX + 8},12^A0N,24,24^FR^FD${s(item.metodo)}^FS`,
    `^FO${offsetX + W - 70},14^A0N,18,18^FR^FD#${s(item.etiquetaId)}^FS`,

    // Nome do produto — 2 linhas, largura reduzida pra deixar QR à direita
    `^FO${offsetX},50^A0N,24,24^FB${W},2,3,L,0^FD${s(nome)}^FS`,

    // Datas
    `^FO${offsetX},140^A0N,16,16^FDMANIP^FS`,
    `^FO${offsetX},158^A0N,22,22^FD${s(manip)}^FS`,
    `^FO${offsetX + 150},140^A0N,16,16^FDVAL.^FS`,
    `^FO${offsetX + 150},158^A0N,22,22^FD${s(validade)}^FS`,

    // Lote (linha inferior, esquerda)
    `^FO${offsetX},210^A0N,14,14^FDLOTE^FS`,
    `^FO${offsetX},226^A0N,18,18^FD${s(lote)}^FS`,

    // Responsável + UN
    `^FO${offsetX},258^A0N,14,14^FDRESP/UN^FS`,
    `^FO${offsetX},274^A0N,18,18^FD${s(resp)} · ${s(item.unidade)}^FS`,

    // QR no canto inferior direito (mag=4 → ~84-100 dots ≈ 10-12mm)
    `^FO${offsetX + W - 110},185^BQN,2,4^FD${s(qr)}^FS`,
  ].join('\n');
}

/**
 * Gera o ZPL de UMA linha do rolo dupla 48×40mm com 2 etiquetas
 * potencialmente diferentes (esquerda + direita). `right` opcional —
 * se ausente, só preenche a metade esquerda.
 */
export function generateEtiquetaZplDuplaPair(left: EtiquetaItem, right?: EtiquetaItem): string {
  const blocks = [dupla48HalfBlock(left, DUPLA_LEFT_X)];
  if (right) blocks.push(dupla48HalfBlock(right, DUPLA_RIGHT_X));
  return [
    '^XA',
    '^CI28',
    `^PW${DUPLA_LABEL_WIDTH}`,
    `^LL${DUPLA_LABEL_HEIGHT}`,
    '^LH0,0',
    ...blocks,
    '^XZ',
  ].join('\n');
}

/**
 * Gera ZPL de todas as etiquetas pro rolo dupla 48×40mm — pareadas 2 a 2.
 * Aproveita 100% do rolo; se a quantidade for ímpar, a última linha
 * tem só a metade esquerda usada (a direita sai em branco).
 */
export function generateEtiquetasZplDuplaSmall(items: EtiquetaItem[]): string {
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    lines.push(generateEtiquetaZplDuplaPair(items[i]!, items[i + 1]));
  }
  return lines.join('\n');
}

// =====================================================================
// ETIQUETA DE CONTAGEM REALIZADA — 48×40mm dupla (Microline 48×40×02)
//
// Layout dentro de cada metade (~360×290 dots úteis):
//   [Nome do produto, 2 linhas, fonte grande]
//   [QUANTIDADE em destaque + UN]
//   DATA      | VAL.
//   RESP.     | LOJA
// =====================================================================

export interface EtiquetaContagemItem {
  produtoNome: string;
  quantidade: number;
  unidade: string;
  responsavel: string;
  dataContagem: Date;
  validadeAte: Date | null;
  lojaApelido: string;
}

function fmtQty(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('pt-BR');
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function contagemHalfBlock(item: EtiquetaContagemItem, offsetX: number): string {
  const dataStr = PT_BR_DATE.format(item.dataContagem);
  const validadeStr = item.validadeAte ? PT_BR_DATE.format(item.validadeAte) : '—';
  const nome = shortStr(item.produtoNome.toUpperCase(), 40);
  const qty = `${fmtQty(item.quantidade)} ${item.unidade}`;
  const resp = shortStr(item.responsavel, 14);
  const loja = shortStr(item.lojaApelido, 18);
  const W = 360;
  return [
    // Nome do produto (2 linhas, topo)
    `^FO${offsetX},6^A0N,24,24^FB${W},2,2,L,0^FD${s(nome)}^FS`,

    // Quantidade em destaque
    `^FO${offsetX},80^A0N,18,18^FDQUANTIDADE^FS`,
    `^FO${offsetX},100^A0N,40,40^FD${s(qty)}^FS`,

    // Datas — DATA + VAL lado a lado
    `^FO${offsetX},164^A0N,16,16^FDDATA^FS`,
    `^FO${offsetX},182^A0N,22,22^FD${s(dataStr)}^FS`,
    `^FO${offsetX + 180},164^A0N,16,16^FDVAL.^FS`,
    `^FO${offsetX + 180},182^A0N,22,22^FD${s(validadeStr)}^FS`,

    // Responsável (linha inferior)
    `^FO${offsetX},226^A0N,14,14^FDRESP.^FS`,
    `^FO${offsetX},242^A0N,18,18^FD${s(resp)}^FS`,

    // Loja (rodapé pequeno)
    `^FO${offsetX},278^A0N,14,14^FD${s(loja)}^FS`,
  ].join('\n');
}

export function generateEtiquetaContagemZplPair(
  left: EtiquetaContagemItem,
  right?: EtiquetaContagemItem,
): string {
  const blocks = [contagemHalfBlock(left, DUPLA_LEFT_X)];
  if (right) blocks.push(contagemHalfBlock(right, DUPLA_RIGHT_X));
  return [
    '^XA',
    '^CI28',
    `^PW${DUPLA_LABEL_WIDTH}`,
    `^LL${DUPLA_LABEL_HEIGHT}`,
    '^LH0,0',
    ...blocks,
    '^XZ',
  ].join('\n');
}

/**
 * Gera ZPL de N etiquetas de contagem no rolo dupla 48×40mm.
 * Cada item da contagem vira 1 etiqueta — pareadas 2 a 2 pra aproveitar
 * o rolo. Quantidade ímpar → última linha com metade esquerda só.
 */
export function generateEtiquetasContagemZpl(items: EtiquetaContagemItem[]): string {
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    lines.push(generateEtiquetaContagemZplPair(items[i]!, items[i + 1]));
  }
  return lines.join('\n');
}

// =====================================================================
// FORMATO RÓTULO INDUSTRIALIZADO 100×100mm — RDC 429/2020 + IN 75/2020
//
// Rótulo regulamentado pra produtos da FFB e Madre Pane. Inclui:
//   - Identificação do produto (nome em destaque)
//   - Lote, data de fabricação, conteúdo líquido
//   - Código de barras EAN-13
//   - Modo de Preparo
//   - Modo de Conservação
//   - Ingredientes
//   - Alergênicos (caixa em destaque)
//   - Tabela Nutricional completa (10 linhas × 3 colunas + %VD)
//   - Selos frontais "ALTO EM…" condicionais
//   - Identificação do fabricante (nome + CNPJ + endereço)
//
// 100mm × 100mm @ 203dpi = 800×800 dots.
// =====================================================================

import {
  montarTabelaNutricional,
  calcularSelosFrontais,
  formatNum,
  formatPct,
  type ValoresPor100,
  type CategoriaRDC429,
} from './rotulo-anvisa';

export interface RotuloDadosLote {
  /** Número do lote impresso. Ex: "01", "L240505". */
  lote: string;
  /** Data de fabricação (formatada dd/mm/aaaa). */
  fabricacao: string;
  /** Conteúdo líquido (texto livre). Ex: "6 UNI", "500g", "1 LITRO". */
  conteudoLiquido: string;
}

export interface RotuloFabricante {
  nome: string;
  cnpj: string | null;
  endereco: string | null;
}

export interface RotuloItem {
  produtoNome: string;
  /** EAN-13 (pode ser null — nesse caso esconde o código de barras). */
  ean13: string | null;
  ingredientes: string | null;
  alergicos: string | null;
  modoPreparo: string | null;
  modoConservacao: string | null;
  /** Texto da porção formatado, ex: "Porção 40g (2 fatias)". */
  porcaoTexto: string;
  porcaoColunaTexto: string; // ex: "40 g" — vai no header da tabela
  porcoesEmbalagemTexto: string; // ex: "5 porções" — opcional acima
  valoresPor100: ValoresPor100;
  fabricante: RotuloFabricante;
  lote: RotuloDadosLote;
}

const W = 800;
const H = 800;
const PAD = 16;          // ~2mm
const COL_RIGHT = W - PAD;

/** ZPL field block escape para texto: troca chars do ZPL por equivalentes. */
function z(text: string | null | undefined): string {
  if (!text) return '';
  // ^ e ~ são tokens do ZPL. \ não é especial em ^FD mas evitamos.
  return text.replace(/[\^~]/g, '-').replace(/\\/g, '/');
}

function shortenLine(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

/** Mede aproximação grosseira de quantas linhas o texto ocupa em ZPL ^FB. */
function buildBlock(text: string, width: number, maxLines: number, fontH: number): string {
  // ^FB: width,maxLines,lineSpacing,justify,hangingIndent
  return `^FB${width},${maxLines},2,L,0^FD${z(text)}^FS`;
}

interface NutricionalCol {
  x: number;
  w: number;
  align: 'L' | 'R' | 'C';
}

/**
 * Renderiza a tabela nutricional dentro de uma caixa.
 * Retorna lista de strings ZPL.
 */
function renderTabelaNutricional(
  oxX: number,
  oyY: number,
  width: number,
  item: RotuloItem,
): string[] {
  const out: string[] = [];
  const linhas = montarTabelaNutricional(item.valoresPor100);
  const ROW_H = 17;
  const HEADER_H = 24;

  // Bordas externas
  out.push(`^FO${oxX},${oyY}^GB${width},${HEADER_H + ROW_H * linhas.length + 32},1,B,0^FS`);

  // Título "INFORMAÇÃO NUTRICIONAL" em barra preta
  out.push(`^FO${oxX},${oyY}^GB${width},22,22,B,0^FS`);
  out.push(`^FO${oxX + 6},${oyY + 4}^A0N,16,16^FR^FDINFORMAÇÃO NUTRICIONAL^FS`);

  // Linha do "Porção…"
  out.push(`^FO${oxX + 6},${oyY + 26}^A0N,14,14^FD${z(item.porcaoTexto)}^FS`);

  // Cabeçalho das colunas
  const headerY = oyY + 46;
  const cols: NutricionalCol[] = [
    { x: oxX + 6, w: width - 6 - 80 - 80 - 60 - 12, align: 'L' }, // rótulo
    { x: oxX + width - 80 - 80 - 60 - 6, w: 80, align: 'R' },      // 100g
    { x: oxX + width - 80 - 60 - 6, w: 80, align: 'R' },           // porção
    { x: oxX + width - 60 - 6, w: 60, align: 'R' },                // %VD
  ];

  // Linha do header
  out.push(`^FO${oxX + 4},${headerY + 13}^GB${width - 8},1,1^FS`);

  out.push(`^FO${cols[1]!.x - 30},${headerY}^A0N,14,14^FB${cols[1]!.w + 30},1,0,R,0^FD100 ${item.valoresPor100.unidadeBase}^FS`);
  out.push(`^FO${cols[2]!.x - 30},${headerY}^A0N,14,14^FB${cols[2]!.w + 30},1,0,R,0^FD${z(item.porcaoColunaTexto)}^FS`);
  out.push(`^FO${cols[3]!.x - 10},${headerY}^A0N,14,14^FB${cols[3]!.w + 10},1,0,R,0^FD%VD*^FS`);

  // Linhas
  let y = headerY + 18;
  for (const l of linhas) {
    out.push(`^FO${cols[0]!.x},${y}^A0N,14,14^FD${z(l.rotulo)}^FS`);
    out.push(`^FO${cols[1]!.x - 30},${y}^A0N,14,14^FB${cols[1]!.w + 30},1,0,R,0^FD${z(formatNum(l.por100))} ${l.unidade}^FS`);
    out.push(`^FO${cols[2]!.x - 30},${y}^A0N,14,14^FB${cols[2]!.w + 30},1,0,R,0^FD${z(formatNum(l.porPorcao))} ${l.unidade}^FS`);
    out.push(`^FO${cols[3]!.x - 10},${y}^A0N,14,14^FB${cols[3]!.w + 10},1,0,R,0^FD${z(formatPct(l.vdPorcao))}^FS`);
    // separador
    out.push(`^FO${oxX + 4},${y + ROW_H - 1}^GB${width - 8},1,1,A,0^FS`);
    y += ROW_H;
  }

  // Rodapé legal
  out.push(`^FO${oxX + 4},${y + 2}^A0N,12,12^FD*Percentual de valores diários fornecidos pela porção.^FS`);

  return out;
}

function renderSelos(
  ox: number,
  oy: number,
  width: number,
  item: RotuloItem,
): { zpl: string[]; height: number } {
  const selos = calcularSelosFrontais(item.valoresPor100);
  const ativos: string[] = [];
  if (selos.acucarAdicionado) ativos.push('AÇÚCAR\nADICIONADO');
  if (selos.gorduraSaturada) ativos.push('GORDURA\nSATURADA');
  if (selos.sodio) ativos.push('SÓDIO');
  if (ativos.length === 0) return { zpl: [], height: 0 };

  // "ALTO EM" + N selos
  const out: string[] = [];
  const SELO_H = 44;
  const labelWidth = 100;
  // Caixa "ALTO EM"
  out.push(`^FO${ox},${oy}^GB${labelWidth},${SELO_H},1,B,4^FS`);
  out.push(`^FO${ox + 8},${oy + 8}^A0N,16,16^FR^FDALTO EM^FS`);
  out.push(`^FO${ox + 8},${oy + 24}^A0N,12,12^FR^FD(LUPA)^FS`);

  let cx = ox + labelWidth + 6;
  const remaining = width - labelWidth - 6;
  const each = Math.floor((remaining - 6 * (ativos.length - 1)) / ativos.length);
  for (const s of ativos) {
    out.push(`^FO${cx},${oy}^GB${each},${SELO_H},1,B,4^FS`);
    const lines = s.split('\n');
    const fontH = lines.length === 1 ? 18 : 14;
    let ty = oy + (SELO_H - fontH * lines.length) / 2;
    for (const ln of lines) {
      out.push(`^FO${cx},${ty}^A0N,${fontH},${fontH}^FR^FB${each},1,0,C,0^FD${z(ln)}^FS`);
      ty += fontH + 2;
    }
    cx += each + 6;
  }
  return { zpl: out, height: SELO_H };
}

export function generateEtiquetaZplRotulo(item: RotuloItem): string {
  const out: string[] = [];
  out.push('^XA');
  out.push('^CI28');
  out.push(`^PW${W}`);
  out.push(`^LL${H}`);
  out.push('^LH0,0');

  // ===== 1. Nome do produto (header em fonte grande, até 2 linhas) =====
  const nome = item.produtoNome.toUpperCase();
  out.push(`^FO${PAD},10^A0N,38,38^FB${W - 2 * PAD},2,4,L,0^FD${z(nome)}^FS`);

  // ===== 2. Faixa fab/lote/conteúdo =====
  const faixaY = 100;
  out.push(`^FO${PAD},${faixaY}^GB${W - 2 * PAD},28,1,B,0^FS`);
  out.push(`^FO${PAD + 6},${faixaY + 6}^A0N,16,16^FR^FDFAB.: ${z(item.lote.fabricacao)}^FS`);
  out.push(`^FO${PAD + 280},${faixaY + 6}^A0N,16,16^FR^FDLOTE: ${z(item.lote.lote)}^FS`);
  out.push(`^FO${PAD + 460},${faixaY + 6}^A0N,16,16^FR^FDCONT.: ${z(item.lote.conteudoLiquido)}^FS`);

  // ===== 3. Código de barras EAN-13 (centralizado) =====
  let cursorY = faixaY + 38;
  if (item.ean13 && /^\d{12,13}$/.test(item.ean13)) {
    // ^BEN,height,interpretationLine,linesAbove
    // O EAN-13 ocupa ~~110 dots de largura com module 2. Pra centralizar:
    const barW = 270; // estimativa
    const barX = Math.round((W - barW) / 2);
    out.push(`^FO${barX},${cursorY}^BY2,2.0,60`);
    out.push(`^BEN,60,Y,N^FD${item.ean13}^FS`);
    cursorY += 88;
  } else {
    cursorY += 6;
  }

  // ===== 4. Modo de Preparo =====
  if (item.modoPreparo) {
    out.push(`^FO${PAD},${cursorY}^A0N,14,14^FDMODO DE PREPARO^FS`);
    out.push(`^FO${PAD},${cursorY + 16}^A0N,16,16^FB${W - 2 * PAD},3,2,L,0^FD${z(item.modoPreparo)}^FS`);
    cursorY += 16 + 16 * 3 + 4;
  }

  // ===== 5. Modo de Conservação =====
  if (item.modoConservacao) {
    out.push(`^FO${PAD},${cursorY}^A0N,14,14^FDMODO DE CONSERVAÇÃO^FS`);
    out.push(`^FO${PAD},${cursorY + 16}^A0N,16,16^FB${W - 2 * PAD},2,2,L,0^FD${z(item.modoConservacao)}^FS`);
    cursorY += 16 + 16 * 2 + 4;
  }

  // ===== 6. Ingredientes =====
  if (item.ingredientes) {
    out.push(`^FO${PAD},${cursorY}^A0N,14,14^FDINGREDIENTES^FS`);
    out.push(`^FO${PAD},${cursorY + 16}^A0N,15,15^FB${W - 2 * PAD},4,2,L,0^FD${z(item.ingredientes)}^FS`);
    cursorY += 16 + 15 * 4 + 4;
  }

  // ===== 7. Alergênicos (caixa em destaque) =====
  if (item.alergicos) {
    const alergH = 38;
    out.push(`^FO${PAD},${cursorY}^GB${W - 2 * PAD},${alergH},${alergH},B,0^FS`);
    out.push(`^FO${PAD + 8},${cursorY + 8}^A0N,18,18^FR^FB${W - 2 * PAD - 16},2,2,L,0^FD${z(item.alergicos)}^FS`);
    cursorY += alergH + 6;
  }

  // ===== 8. Tabela Nutricional =====
  // Calcula altura aproximada pra ver se sobra espaço pros selos depois.
  const nutriHeight = 22 /*titulo*/ + 22 /*porcao*/ + 18 /*header*/ + 17 * 10 /*linhas*/ + 18 /*footer*/;
  const tabelaY = cursorY;
  for (const ln of renderTabelaNutricional(PAD, tabelaY, W - 2 * PAD, item)) {
    out.push(ln);
  }
  cursorY = tabelaY + nutriHeight + 6;

  // ===== 9. Selos frontais =====
  const selosOut = renderSelos(PAD, cursorY, W - 2 * PAD, item);
  for (const ln of selosOut.zpl) out.push(ln);
  if (selosOut.height > 0) cursorY += selosOut.height + 6;

  // ===== 10. Fabricante (rodapé, sempre na base) =====
  const footerY = Math.max(cursorY, H - 38);
  const fabLinha1 = `${item.fabricante.nome}${item.fabricante.cnpj ? ` · CNPJ ${item.fabricante.cnpj}` : ''}`;
  out.push(`^FO${PAD},${footerY}^A0N,14,14^FB${W - 2 * PAD},1,0,L,0^FD${z(shortenLine(fabLinha1, 90))}^FS`);
  if (item.fabricante.endereco) {
    out.push(`^FO${PAD},${footerY + 16}^A0N,14,14^FB${W - 2 * PAD},1,0,L,0^FD${z(shortenLine(item.fabricante.endereco, 90))}^FS`);
  }

  out.push('^XZ');
  return out.join('\n');
}

export function generateEtiquetasZplRotulo(items: RotuloItem[]): string {
  return items.map(generateEtiquetaZplRotulo).join('\n');
}
