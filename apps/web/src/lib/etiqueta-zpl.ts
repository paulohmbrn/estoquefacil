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
  // QR fica no canto inferior direito; mag=3 ≈ 8mm de lado.
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

    // QR no canto inferior direito (mag=3 → ~63 dots ≈ 8mm)
    `^FO${offsetX + W - 80},200^BQN,2,3^FD${s(qr)}^FS`,
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
