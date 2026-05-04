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
// Estratégia: cada "label" lógico é a linha inteira (106×40mm), com
// CONTEÚDO IDÊNTICO repetido nas 2 metades (esquerda e direita) pra
// aproveitar as duas etiquetas físicas que avançam juntas no rolo.
//
// Layout dentro de CADA metade (48×40mm = 384×320 dots, área útil
// ~36×32mm = ~288×256 dots após padding):
//   [faixa preta com método]        ← 30 dots de altura
//   [nome do produto, 2 linhas]
//   MANIP: dd/mm/aaaa | VAL: dd/mm/aaaa
//   LOTE: ...                       (sem QR — não cabe em 48mm)
// =====================================================================

const DUPLA_LABEL_WIDTH = 848;       // 106mm
const DUPLA_LABEL_HEIGHT = 320;      // 40mm
const DUPLA_LEFT_X = 32;             // 4mm margem esquerda
const DUPLA_RIGHT_X = 432;           // 4mm + 48mm + 2mm = 54mm

function dupla48HalfBlock(item: EtiquetaItem, offsetX: number, manip: string, validade: string): string {
  const nome = shortStr(item.produtoNome.toUpperCase(), 38);
  const lote = `${item.cdarvprod}${item.loteSufixo ? '-' + item.loteSufixo : ''}`;
  // Área útil dentro de uma etiqueta = ~360 dots de largura (48mm - 2*1.5mm padding)
  const W = 360;
  return [
    // Faixa preta com o método
    `^FO${offsetX},6^GB${W},34,34,B,0^FS`,
    `^FO${offsetX + 8},12^A0N,24,24^FR^FD${s(item.metodo)}^FS`,
    `^FO${offsetX + W - 60},14^A0N,18,18^FR^FD#${s(item.etiquetaId)}^FS`,

    // Nome do produto (2 linhas)
    `^FO${offsetX},50^A0N,26,26^FB${W},2,3,L,0^FD${s(nome)}^FS`,

    // Datas (manip à esquerda, validade à direita do bloco)
    `^FO${offsetX},140^A0N,16,16^FDMANIP^FS`,
    `^FO${offsetX},160^A0N,24,24^FD${s(manip)}^FS`,
    `^FO${offsetX + 180},140^A0N,16,16^FDVAL.^FS`,
    `^FO${offsetX + 180},160^A0N,24,24^FD${s(validade)}^FS`,

    // Lote (linha inferior)
    `^FO${offsetX},230^A0N,16,16^FDLOTE^FS`,
    `^FO${offsetX},250^A0N,20,20^FD${s(lote)}^FS`,

    // Responsável + UN à direita do lote
    `^FO${offsetX + 180},230^A0N,16,16^FDRESP/UN^FS`,
    `^FO${offsetX + 180},250^A0N,20,20^FD${s(shortStr(item.responsavel, 10))} · ${s(item.unidade)}^FS`,
  ].join('\n');
}

/** Gera o ZPL de UMA linha do rolo dupla 48×40mm — imprime conteúdo idêntico nas 2 metades. */
export function generateEtiquetaZplDuplaSmall(item: EtiquetaItem): string {
  const { manip, validade } = fmtDates(item);
  return [
    '^XA',
    '^CI28',
    `^PW${DUPLA_LABEL_WIDTH}`,
    `^LL${DUPLA_LABEL_HEIGHT}`,
    '^LH0,0',
    dupla48HalfBlock(item, DUPLA_LEFT_X, manip, validade),
    dupla48HalfBlock(item, DUPLA_RIGHT_X, manip, validade),
    '^XZ',
  ].join('\n');
}

/** Gera ZPL de N linhas do rolo dupla 48×40mm. */
export function generateEtiquetasZplDuplaSmall(items: EtiquetaItem[]): string {
  return items.map(generateEtiquetaZplDuplaSmall).join('\n');
}
