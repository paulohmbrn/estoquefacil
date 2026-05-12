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
const DUPLA_RIGHT_X = 448;           // 4mm + 48mm + 4mm = 56mm (gap 4mm — etiqueta direita "respira")

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
// Mesmo conteúdo lógico da 100×60mm (modelo ModeloEtiqueta.png), porém
// adensado pra caber em metade do rolo dupla (~360×290 dots úteis).
//
// Layout (1 metade):
//   [faixa preta com método + #ID] (28 dots)
//   [Nome do produto, 2 linhas, 22pt]
//   DATA CONT. | VALIDADE
//   LOTE
//   UN | RESP.
//   QUANTIDADE (destaque)
//   Loja                                        [QR]
// =====================================================================

function contagemHalfBlock(item: EtiquetaContagem100Item, offsetX: number): string {
  const dataStr = item.horaContagem
    ? `${PT_BR_DATE.format(item.dataContagem)} ${item.horaContagem}`
    : PT_BR_DATE.format(item.dataContagem);
  const validadeStr = item.validadeAte ? PT_BR_DATE.format(item.validadeAte) : '—';
  const nome = shortStr(item.produtoNome.toUpperCase(), 40);
  const lote = `${item.cdarvprod}${item.loteSufixo ? '-' + item.loteSufixo : ''}`;
  const resp = shortStr(item.responsavel, 9);
  const loja = shortStr(item.lojaApelido, 22);
  const qty = `${fmtQtyContagem(item.quantidade)} ${item.unidade}`;
  const qr = `LA,${item.qrPayload}`;
  const W = 360;
  // QR mag=6 com payload curto (cdarvprod 13 chars) → Version 1 (21x21
  // módulos) = ~126 dots ≈ 16mm. Fica no canto inferior direito.
  // Conteúdo da parte de baixo (UN/RESP/QUANT/Loja) usa só Wleft pra não invadir o QR.
  const Wleft = 210;

  return [
    // Header: faixa preta com método + #ID (W inteiro)
    `^FO${offsetX},4^GB${W},28,28,B,0^FS`,
    `^FO${offsetX + 6},10^A0N,20,20^FR^FD${s(item.metodo)}^FS`,
    `^FO${offsetX + W - 70},12^A0N,16,16^FR^FD#${s(item.etiquetaId)}^FS`,

    // Nome do produto — 2 linhas (W inteiro, antes do QR começar)
    `^FO${offsetX},42^A0N,22,22^FB${W},2,2,L,0^FD${s(nome)}^FS`,

    // DATA CONT. (data + hora) | VALIDADE — lado a lado (W inteiro)
    // Fonte 14pt nos valores pra caber "DD/MM/AAAA HH:MM" (16 chars).
    `^FO${offsetX},96^A0N,12,12^FDDATA CONT.^FS`,
    `^FO${offsetX},112^A0N,16,16^FD${s(dataStr)}^FS`,
    `^FO${offsetX + 200},96^A0N,12,12^FDVALIDADE^FS`,
    `^FO${offsetX + 200},112^A0N,16,16^FD${s(validadeStr)}^FS`,

    // LOTE (W inteiro, ainda antes do QR)
    `^FO${offsetX},138^A0N,12,12^FDLOTE^FS`,
    `^FO${offsetX},152^A0N,16,16^FD${s(lote)}^FS`,

    // ↓ QR (~126 dots, y=170..296) ocupa a faixa direita ↓ — daqui pra baixo conteúdo limita a Wleft
    // UN | RESP.
    `^FO${offsetX},178^A0N,12,12^FDUN^FS`,
    `^FO${offsetX},192^A0N,16,16^FD${s(item.unidade)}^FS`,
    `^FO${offsetX + 110},178^A0N,12,12^FDRESP.^FS`,
    `^FO${offsetX + 110},192^A0N,16,16^FB${Wleft - 110},1,0,L,0^FD${s(resp)}^FS`,

    // QUANTIDADE (destaque)
    `^FO${offsetX},218^A0N,12,12^FDQUANTIDADE^FS`,
    `^FO${offsetX},232^A0N,30,30^FB${Wleft},1,0,L,0^FD${s(qty)}^FS`,

    // Loja (rodapé)
    `^FO${offsetX},272^A0N,14,14^FB${Wleft},1,0,L,0^FD${s(loja)}^FS`,

    // QR mag=6 (~126 dots ≈ 16mm com cdarvprod de 13 chars) — canto
    // inferior direito; borda direita igual à do mag=5 (offsetX+W-15),
    // só cresce pra esquerda/baixo.
    `^FO${offsetX + W - 141},170^BQN,2,6^FD${s(qr)}^FS`,
  ].join('\n');
}

export function generateEtiquetaContagemZplPair(
  left: EtiquetaContagem100Item,
  right?: EtiquetaContagem100Item,
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
 * Cada lançamento vira 1 etiqueta — pareadas 2 a 2 pra aproveitar
 * o rolo. Quantidade ímpar → última linha com metade esquerda só.
 */
export function generateEtiquetasContagemZpl(items: EtiquetaContagem100Item[]): string {
  const lines: string[] = [];
  for (let i = 0; i < items.length; i += 2) {
    lines.push(generateEtiquetaContagemZplPair(items[i]!, items[i + 1]));
  }
  return lines.join('\n');
}

// =====================================================================
// ETIQUETA DE CONTAGEM REALIZADA — 100×60mm (Argox/Zebra padrão)
//
// Layout (espelha o modelo da imagem ModeloEtiqueta.png):
//   [faixa preta com método + #ID]
//   [Nome do produto, 2 linhas, fonte 52pt]
//   ──────────────────────────────────────
//   DATA CONTAGEM   |  VALIDADE       [QR]
//   dd/mm/aaaa      |  dd/mm/aaaa     [QR]
//   LOTE                              [QR]
//   cdarvprod-XX                      [QR]
//   UN          | RESP.
//   KG          | Paulo
//   QUANTIDADE
//   10 KG
//   Loja
// =====================================================================

export interface EtiquetaContagem100Item {
  produtoNome: string;
  cdarvprod: string;
  quantidade: number;
  unidade: string;
  responsavel: string;
  dataContagem: Date;
  /** Hora da contagem já formatada (HH:MM, fuso BRT). Se omitido, etiqueta
   *  mostra só a data. */
  horaContagem?: string;
  validadeAte: Date | null;
  lojaApelido: string;
  metodo: string;          // RESFRIADO | CONGELADO | AMBIENTE
  etiquetaId: string;      // 6 chars hex pra rastreio visual
  qrPayload: string;       // payload pra QR (URL curta de rastreio)
  loteSufixo?: string;     // sequencial dentro do lote (ex "01")
}

function fmtQtyContagem(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString('pt-BR');
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

export function generateEtiquetaContagemZpl100x60(item: EtiquetaContagem100Item): string {
  const dataStr = PT_BR_DATE.format(item.dataContagem);
  const validadeStr = item.validadeAte ? PT_BR_DATE.format(item.validadeAte) : '—';
  const nome = shortStr(item.produtoNome.toUpperCase(), 60);
  const lote = `${item.cdarvprod}${item.loteSufixo ? '-' + item.loteSufixo : ''}`;
  const resp = shortStr(item.responsavel, 14);
  const lojaNome = shortStr(item.lojaApelido, 36);
  const qty = `${fmtQtyContagem(item.quantidade)} ${item.unidade}`;
  const qr = `LA,${item.qrPayload}`;

  return [
    '^XA',
    '^CI28',
    '^PW800',
    '^LL480',
    '^LH0,0',

    // Header (faixa preta com método + #ID)
    '^FO0,0^GB800,72,72,B,0^FS',
    `^FO20,16^A0N,46,46^FR^FD${s(item.metodo)}^FS`,
    `^FO580,26^A0N,28,28^FR^FD#${s(item.etiquetaId)}^FS`,

    // Nome do produto
    `^FO20,90^A0N,52,52^FB560,2,4,L,0^FD${s(nome)}^FS`,

    // Separador
    '^FO20,200^GB760,2,2^FS',

    // DATA CONTAGEM | VALIDADE
    '^FO20,210^A0N,18,18^FDDATA CONTAGEM^FS',
    `^FO20,232^A0N,28,28^FD${s(dataStr)}^FS`,
    '^FO320,210^A0N,18,18^FDVALIDADE^FS',
    `^FO320,232^A0N,28,28^FD${s(validadeStr)}^FS`,

    // LOTE
    '^FO20,278^A0N,18,18^FDLOTE^FS',
    `^FO20,300^A0N,26,26^FD${s(lote)}^FS`,

    // UN | RESP
    '^FO20,344^A0N,18,18^FDUN^FS',
    `^FO20,366^A0N,26,26^FD${s(item.unidade)}^FS`,
    '^FO180,344^A0N,18,18^FDRESP.^FS',
    `^FO180,366^A0N,26,26^FD${s(resp)}^FS`,

    // QUANTIDADE em destaque (canto inferior esquerdo)
    '^FO20,402^A0N,16,16^FDQUANTIDADE^FS',
    `^FO20,420^A0N,38,38^FD${s(qty)}^FS`,

    // QR Code (canto direito, abaixo do nome)
    `^FO600,200^BQN,2,5^FD${s(qr)}^FS`,

    // Loja rodapé
    `^FO20,462^A0N,16,16^FD${s(lojaNome)}^FS`,

    '^XZ',
  ].join('\n');
}

export function generateEtiquetasContagemZpl100x60(items: EtiquetaContagem100Item[]): string {
  return items.map(generateEtiquetaContagemZpl100x60).join('\n');
}

// =====================================================================
// FORMATO RÓTULO INDUSTRIALIZADO 100×100mm — RDC 429/2020 + IN 75/2020
//
// Rótulo regulamentado pra produtos da FFB (filial 0013) e Madre Pane (0023).
// Área de impressão: 800×800 dots @ 203dpi.
//
// Layout (de cima pra baixo):
//   ┌─ CABEÇALHO ── logo da loja (canto esq.) + razão social ───────────┐
//   ├─ NOME DO PRODUTO (destaque, até 2 linhas) ────────────────────────┤
//   ├─ FAB.: dd/mm/aaaa │ LOTE: x │ CONT.: y   (faixa preta) ───────────┤
//   ├─ [EAN-13] · MODO DE PREPARO · CONSERVAÇÃO · INGREDIENTES ─────────┤  (condicionais)
//   ├─ [ALÉRGICOS] · INFORMAÇÃO NUTRICIONAL (tabela com linha elástica) ─┤
//   ├─ [ALTO EM …] selos frontais ─────────────────────────────────────┤  (condicional)
//   └─ RODAPÉ ── CNPJ · IE / endereço completo / SAC   (ancorado na base)┘
//
// A tabela nutricional tem ALTURA DE LINHA ELÁSTICA — cresce pra preencher o
// espaço que sobra quando o produto tem poucos campos cadastrados (nada de
// faixa em branco no meio da etiqueta).
//
// >>> CALIBRAÇÃO MARGEM_ESQ <<<
// A impressora térmica imprime tudo deslocado pra esquerda. `MARGEM_ESQ`
// empurra o conteúdo de volta. Ajuste com teste de impressão: se ainda corta
// texto na esquerda → AUMENTE; se sobra faixa branca grande na direita →
// DIMINUA. 1mm ≈ 8 dots.
// =====================================================================

import {
  montarTabelaNutricional,
  calcularSelosFrontais,
  formatNum,
  formatPct,
  type ValoresPor100,
} from './rotulo-anvisa';
import { logoGfa, type LogoZpl } from './etiqueta-logos';

export interface RotuloDadosLote {
  /** Número do lote impresso. Ex: "01", "L240505". */
  lote: string;
  /** Data de fabricação (formatada dd/mm/aaaa). */
  fabricacao: string;
  /** Conteúdo líquido (texto livre). Ex: "6 UNI", "500g", "1 LITRO". */
  conteudoLiquido: string;
}

export interface RotuloFabricante {
  /** Razão social — vai em destaque no cabeçalho (fallback: nome da filial). */
  razaoSocial: string;
  cnpj: string | null;
  inscricaoEstadual: string | null;
  /** Endereço resumido legado — usado só se os campos estruturados estiverem vazios. */
  endereco: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  /** Telefone / SAC. */
  telefone: string | null;
}

export interface RotuloItem {
  produtoNome: string;
  /** EAN-13 (pode ser null — nesse caso esconde o código de barras). */
  ean13: string | null;
  ingredientes: string | null;
  alergicos: string | null;
  modoPreparo: string | null;
  modoConservacao: string | null;
  /** Texto da porção, ex: "Porções por embalagem: 8 · Porção: 230 g (1 fatia)". */
  porcaoTexto: string;
  /** Texto da coluna de porção no header da tabela, ex: "230 g". */
  porcaoColunaTexto: string;
  valoresPor100: ValoresPor100;
  fabricante: RotuloFabricante;
  lote: RotuloDadosLote;
  /** Logo da loja (canto esquerdo do cabeçalho). null = sem logo. */
  logo: LogoZpl | null;
}

// ---- Geometria (dots @ 203dpi) ----
const RW = 800; // largura física (100mm)
const RH = 800; // altura física (100mm)

/**
 * Margem esquerda do conteúdo, em dots. COMPENSA o deslocamento horizontal da
 * impressora. Calibrar com teste de impressão (ver bloco de comentário acima).
 * 1mm ≈ 8 dots.
 */
// Argox da Madre Pane (0023): mede-se ~7mm de deslocamento pra esquerda no teste de
// 2026-05-12 → 96 dots (12mm) deixa ~5mm de margem efetiva na esquerda (folga segura).
const MARGEM_ESQ = 96;
const MARGEM_DIR = 16;
const TOPO = 14;
const RODAPE_ALTURA = 82; // bloco do fabricante, ancorado na base

const RX = MARGEM_ESQ; // x de origem do conteúdo
const RCW = RW - MARGEM_ESQ - MARGEM_DIR; // largura útil do conteúdo
const RODAPE_Y = RH - RODAPE_ALTURA;

/** Escapa caracteres especiais do ZPL (^ ~ \) em campos de texto. */
function rz(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/[\^~]/g, '-').replace(/\\/g, '/');
}

function rzUpper(text: string | null | undefined): string {
  return rz(text).toUpperCase();
}

/** Quantos chars (aprox.) cabem por linha numa fonte A0N de altura `h`, largura `w`. */
function charsPorLinha(w: number, h: number): number {
  return Math.max(4, Math.floor(w / (h * 0.58)));
}

/** Estima quantas linhas o texto ocupa num ^FB de largura `w`, fonte `h`, máx `maxL`. */
function estimaLinhas(text: string | null | undefined, w: number, h: number, maxL: number): number {
  if (!text) return 0;
  return Math.min(maxL, Math.max(1, Math.ceil(text.length / charsPorLinha(w, h))));
}

function rclamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Monta o endereço completo a partir dos campos estruturados (fallback: `endereco`). */
function montarEnderecoLinhas(f: RotuloFabricante): string[] {
  const linha1Partes: string[] = [];
  if (f.logradouro) {
    linha1Partes.push(f.numero ? `${f.logradouro}, ${f.numero}` : f.logradouro);
    if (f.complemento) linha1Partes.push(f.complemento);
    if (f.bairro) linha1Partes.push(f.bairro);
  } else if (f.endereco) {
    linha1Partes.push(f.endereco);
  }
  const linha2Partes: string[] = [];
  if (f.municipio) linha2Partes.push(f.uf ? `${f.municipio}/${f.uf}` : f.municipio);
  else if (f.uf) linha2Partes.push(f.uf);
  if (f.cep) linha2Partes.push(`CEP ${f.cep}`);
  const out: string[] = [];
  if (linha1Partes.length) out.push(linha1Partes.join(' · '));
  if (linha2Partes.length) out.push(linha2Partes.join(' · '));
  return out;
}

/**
 * Renderiza a tabela "INFORMAÇÃO NUTRICIONAL" numa caixa (x,y) de tamanho
 * (largura × altura). A altura de linha é elástica — divide o espaço útil
 * pelas 10 linhas, com fonte proporcional.
 */
function renderTabelaNutricional(
  x: number,
  y: number,
  largura: number,
  altura: number,
  item: RotuloItem,
): string[] {
  const out: string[] = [];
  const linhas = montarTabelaNutricional(item.valoresPor100);
  const TITULO_H = 22;
  const PORCAO_H = 18;
  const HEADER_H = 20;
  const FOOT_H = 16;
  const espacoLinhas = altura - TITULO_H - PORCAO_H - HEADER_H - FOOT_H;
  const ROW_H = rclamp(Math.floor(espacoLinhas / linhas.length), 14, 40);
  const fL = ROW_H >= 32 ? 20 : ROW_H >= 26 ? 18 : ROW_H >= 21 ? 16 : 14;
  const fOff = Math.max(1, Math.floor((ROW_H - fL) / 2));

  // colunas: rótulo | 100g/ml | porção | %VD
  const colVD = 56;
  const colPorcao = 96;
  const col100 = 96;
  const xVD = x + largura - colVD;
  const xPorcao = xVD - colPorcao;
  const x100 = xPorcao - col100;
  const xRot = x + 8;

  // borda externa + barra-título preta
  out.push(`^FO${x},${y}^GB${largura},${altura},2,B,0^FS`);
  out.push(`^FO${x},${y}^GB${largura},${TITULO_H},${TITULO_H},B,0^FS`);
  out.push(`^FO${x + 8},${y + 3}^A0N,16,16^FR^FDINFORMAÇÃO NUTRICIONAL^FS`);

  // linha da porção
  out.push(`^FO${xRot},${y + TITULO_H + 3}^A0N,13,13^FD${rz(item.porcaoTexto)}^FS`);

  // header das colunas
  const hY = y + TITULO_H + PORCAO_H;
  out.push(`^FO${x100 - 4},${hY + 2}^A0N,14,14^FB${col100 + 8},1,0,R,0^FD100 ${item.valoresPor100.unidadeBase}^FS`);
  out.push(`^FO${xPorcao - 4},${hY + 2}^A0N,14,14^FB${colPorcao + 8},1,0,R,0^FD${rz(item.porcaoColunaTexto)}^FS`);
  out.push(`^FO${xVD - 4},${hY + 2}^A0N,14,14^FB${colVD + 4},1,0,R,0^FD%VD*^FS`);
  out.push(`^FO${x + 4},${hY + HEADER_H - 1}^GB${largura - 8},2,2^FS`);

  // linhas
  let ry = hY + HEADER_H;
  linhas.forEach((l, i) => {
    const ty = ry + fOff;
    const xLab = xRot + (l.indent ? 16 : 0);
    out.push(`^FO${xLab},${ty}^A0N,${fL},${fL}^FD${rz(l.rotulo.trim())}^FS`);
    out.push(`^FO${x100 - 4},${ty}^A0N,${fL},${fL}^FB${col100 + 8},1,0,R,0^FD${rz(formatNum(l.por100))}${l.unidade ? ' ' + l.unidade : ''}^FS`);
    out.push(`^FO${xPorcao - 4},${ty}^A0N,${fL},${fL}^FB${colPorcao + 8},1,0,R,0^FD${rz(formatNum(l.porPorcao))}${l.unidade ? ' ' + l.unidade : ''}^FS`);
    out.push(`^FO${xVD - 4},${ty}^A0N,${fL},${fL}^FB${colVD + 4},1,0,R,0^FD${rz(formatPct(l.vdPorcao))}^FS`);
    ry += ROW_H;
    if (i < linhas.length - 1) out.push(`^FO${x + 4},${ry}^GB${largura - 8},1,1^FS`);
  });

  // rodapé legal
  out.push(`^FO${xRot},${y + altura - FOOT_H + 2}^A0N,12,12^FD*Percentual de valores diários fornecidos pela porção.^FS`);
  return out;
}

/** Renderiza os selos frontais "ALTO EM …". Retorna [] se nenhum ativo. */
function renderSelos(x: number, y: number, largura: number, altura: number, item: RotuloItem): string[] {
  const selos = calcularSelosFrontais(item.valoresPor100);
  const ativos: { l1: string; l2: string }[] = [];
  if (selos.acucarAdicionado) ativos.push({ l1: 'AÇÚCAR', l2: 'ADICIONADO' });
  if (selos.gorduraSaturada) ativos.push({ l1: 'GORDURA', l2: 'SATURADA' });
  if (selos.sodio) ativos.push({ l1: 'SÓDIO', l2: '' });
  if (ativos.length === 0) return [];

  const out: string[] = [];
  const h = Math.min(altura, 48);
  const wAlto = 100;
  // caixa "ALTO EM" (preenchida)
  out.push(`^FO${x},${y}^GB${wAlto},${h},${h},B,3^FS`);
  out.push(`^FO${x + 4},${y + Math.round(h / 2) - 10}^A0N,17,17^FR^FB${wAlto - 8},1,0,C,0^FDALTO EM^FS`);
  // caixas dos nutrientes
  let cx = x + wAlto + 8;
  const rest = largura - wAlto - 8;
  const each = Math.floor((rest - 6 * (ativos.length - 1)) / ativos.length);
  for (const s of ativos) {
    out.push(`^FO${cx},${y}^GB${each},${h},${h},B,3^FS`);
    if (s.l2) {
      out.push(`^FO${cx},${y + Math.round(h / 2) - 17}^A0N,15,15^FR^FB${each},1,0,C,0^FD${rz(s.l1)}^FS`);
      out.push(`^FO${cx},${y + Math.round(h / 2) + 1}^A0N,15,15^FR^FB${each},1,0,C,0^FD${rz(s.l2)}^FS`);
    } else {
      out.push(`^FO${cx},${y + Math.round(h / 2) - 10}^A0N,18,18^FR^FB${each},1,0,C,0^FD${rz(s.l1)}^FS`);
    }
    cx += each + 6;
  }
  return out;
}

// Altura fixa (não-linhas) da tabela nutricional: TITULO 22 + PORCAO 18 + HEADER 20 + FOOT 16.
const TABELA_FIXO_H = 76;
// Altura mínima decente da tabela (fixo + 10 linhas a 14 dots).
const TABELA_MIN_H = TABELA_FIXO_H + 14 * 10;

/** Altura da seção de texto "Título: conteúdo" (título inline pra economizar espaço). */
function alturaSecaoTexto(titulo: string, texto: string | null | undefined, fonte: number, maxL: number): number {
  if (!texto) return 0;
  return estimaLinhas(`${titulo}: ${texto}`, RCW, fonte, maxL) * (fonte + 2) + 8;
}

export function generateEtiquetaZplRotulo(item: RotuloItem): string {
  const out: string[] = [];
  out.push('^XA', '^CI28', `^PW${RW}`, `^LL${RH}`, '^LH0,0');
  const f = item.fabricante;

  // ===== Pré-cálculo das alturas pra distribuir o espaço vertical =====
  const headerH = item.logo ? Math.max(item.logo.height, 86) + 6 : 74;
  const nomeFonte = 36;
  const nomeLinhas = estimaLinhas(item.produtoNome, RCW, nomeFonte, 2);
  const nomeH = nomeLinhas * (nomeFonte + 4);
  const faixaH = 30;
  const temBarcode = !!(item.ean13 && /^\d{12,13}$/.test(item.ean13));
  const barcodeH = temBarcode ? 56 + 28 : 0;
  const preparoH = alturaSecaoTexto('MODO DE PREPARO', item.modoPreparo, 14, 2);
  const conservH = alturaSecaoTexto('CONSERVAÇÃO', item.modoConservacao, 14, 2);
  const ingredH = alturaSecaoTexto('INGREDIENTES', item.ingredientes, 13, 4);
  const alergLinhas = item.alergicos ? estimaLinhas(item.alergicos, RCW - 16, 16, 2) : 0;
  const alergH = item.alergicos ? (alergLinhas <= 1 ? 32 : 44) : 0;
  const alergBloco = alergH ? alergH + 10 : 0;

  const selosCalc = calcularSelosFrontais(item.valoresPor100);
  const temSelos = selosCalc.acucarAdicionado || selosCalc.gorduraSaturada || selosCalc.sodio;
  const selosBloco = temSelos ? 46 + 10 : 0; // caixa + gap acima

  // rodapé do fabricante (linhas)
  const rodapeLinhas: string[] = [];
  if (!item.logo) rodapeLinhas.push(rzUpper(f.razaoSocial));
  const ident: string[] = [];
  if (f.cnpj) ident.push(`CNPJ ${f.cnpj}`);
  if (f.inscricaoEstadual) ident.push(`IE ${f.inscricaoEstadual}`);
  if (ident.length) rodapeLinhas.push(ident.join(' · '));
  for (const ln of montarEnderecoLinhas(f)) rodapeLinhas.push(ln);
  if (f.telefone) rodapeLinhas.push(`SAC: ${f.telefone}`);
  const rodapeLinhasShow = rodapeLinhas.slice(0, 5);
  const rodapeFonte = rodapeLinhasShow.length > 4 ? 12 : 14;
  const rodapeH = 6 /*rule+pad*/ + rodapeLinhasShow.length * (rodapeFonte + 3) + 4;

  // espaço pra tabela = o que sobra entre o fim do bloco superior e o rodapé/selos
  const topoAteTabela =
    TOPO + headerH + 12 /*rule+gap*/ + nomeH + 10 + faixaH + 12 + barcodeH + preparoH + conservH + ingredH + alergBloco;
  const espacoRestante = RH - 4 /*margem base*/ - rodapeH - selosBloco - topoAteTabela;
  // teto: 10 linhas a 40 dots + fixo — acima disso só sobra "ar" dentro da tabela.
  const tabelaAltura = rclamp(espacoRestante, TABELA_MIN_H, TABELA_FIXO_H + 40 * 10);

  // ===== 1. CABEÇALHO — logo (canto esq.) + razão social =====
  if (item.logo) {
    out.push(`^FO${RX},${TOPO}${logoGfa(item.logo)}^FS`);
    const rsX = RX + item.logo.width + 20;
    const rsW = RCW - item.logo.width - 20;
    if (rsW > 90) {
      out.push(`^FO${rsX},${TOPO + 6}^A0N,22,22^FB${rsW},3,3,L,0^FD${rzUpper(f.razaoSocial)}^FS`);
    }
  } else {
    out.push(`^FO${RX},${TOPO}^A0N,30,30^FB${RCW},2,4,C,0^FD${rzUpper(f.razaoSocial)}^FS`);
  }
  let y = TOPO + headerH;
  out.push(`^FO${RX},${y}^GB${RCW},2,2^FS`);
  y += 12;

  // ===== 2. NOME DO PRODUTO =====
  out.push(`^FO${RX},${y}^A0N,${nomeFonte},${nomeFonte}^FB${RCW},2,4,L,0^FD${rzUpper(item.produtoNome)}^FS`);
  y += nomeH + 10;

  // ===== 3. FAIXA FAB / LOTE / CONT =====
  out.push(`^FO${RX},${y}^GB${RCW},${faixaH},${faixaH},B,0^FS`);
  out.push(`^FO${RX + 10},${y + 7}^A0N,17,17^FR^FDFAB.: ${rz(item.lote.fabricacao)}^FS`);
  out.push(`^FO${RX + Math.round(RCW * 0.40)},${y + 7}^A0N,17,17^FR^FDLOTE: ${rz(item.lote.lote)}^FS`);
  out.push(`^FO${RX + Math.round(RCW * 0.66)},${y + 7}^A0N,17,17^FR^FDCONT.: ${rz(item.lote.conteudoLiquido)}^FS`);
  y += faixaH + 12;

  // ===== 3b. EAN-13 (centralizado na área útil) =====
  if (temBarcode) {
    const barH = 56;
    const barW = 240;
    const barX = RX + Math.round((RCW - barW) / 2);
    out.push(`^FO${barX},${y}^BY2,2.5,${barH}^BEN,${barH},Y,N^FD${item.ean13}^FS`);
    y += barcodeH;
  }

  // ===== 4/5/6. Modo de preparo · conservação · ingredientes (condicionais) =====
  // Título inline ("MODO DE PREPARO: ...") pra economizar espaço vertical.
  const secaoTexto = (titulo: string, texto: string, fonte: number, maxL: number): void => {
    const full = `${titulo}: ${texto}`;
    const nl = estimaLinhas(full, RCW, fonte, maxL);
    out.push(`^FO${RX},${y}^A0N,${fonte},${fonte}^FB${RCW},${maxL},2,L,0^FD${rz(full)}^FS`);
    y += nl * (fonte + 2) + 8;
  };
  if (item.modoPreparo) secaoTexto('MODO DE PREPARO', item.modoPreparo, 14, 2);
  if (item.modoConservacao) secaoTexto('CONSERVAÇÃO', item.modoConservacao, 14, 2);
  if (item.ingredientes) secaoTexto('INGREDIENTES', item.ingredientes, 13, 4);

  // ===== 7. Alérgicos (caixa em destaque) =====
  if (item.alergicos) {
    out.push(`^FO${RX},${y}^GB${RCW},${alergH},${alergH},B,0^FS`);
    out.push(`^FO${RX + 8},${y + 5}^A0N,16,16^FR^FB${RCW - 16},2,2,L,0^FD${rz(item.alergicos)}^FS`);
    y += alergH + 10;
  }

  // ===== 8. Tabela nutricional (elástica — preenche o que sobra) =====
  for (const ln of renderTabelaNutricional(RX, y, RCW, tabelaAltura, item)) out.push(ln);
  y += tabelaAltura;

  // ===== 9. Selos frontais "ALTO EM…" =====
  if (temSelos) {
    y += 10;
    for (const ln of renderSelos(RX, y, RCW, 46, item)) out.push(ln);
    y += 46;
  }

  // ===== 10. RODAPÉ — identificação do fabricante =====
  // Ancorado na base se sobrou espaço; senão flui logo abaixo dos selos.
  // Renderiza só as linhas que cabem (sem corte no meio de uma linha) — quando
  // o produto tem texto demais, sobra menos espaço; CNPJ/endereço têm prioridade.
  const rodapeY = Math.max(y + 4, RH - rodapeH);
  out.push(`^FO${RX},${rodapeY}^GB${RCW},2,2^FS`);
  const cabeRodape = Math.max(1, Math.floor((RH - 2 - (rodapeY + 6)) / (rodapeFonte + 3)));
  let ry = rodapeY + 6;
  for (const ln of rodapeLinhasShow.slice(0, cabeRodape)) {
    out.push(`^FO${RX},${ry}^A0N,${rodapeFonte},${rodapeFonte}^FB${RCW},1,0,L,0^FD${rz(ln)}^FS`);
    ry += rodapeFonte + 3;
  }

  out.push('^XZ');
  return out.join('\n');
}

export function generateEtiquetasZplRotulo(items: RotuloItem[]): string {
  return items.map(generateEtiquetaZplRotulo).join('\n');
}
