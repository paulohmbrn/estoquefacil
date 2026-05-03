// Parser de NFe — usado pelo Server Action sefaz.ts ao criar recebimento.
// Versão standalone (sem deps do worker) — duplica a lógica do worker pra
// evitar import cross-app.

import { XMLParser } from 'fast-xml-parser';

export interface NfeItem {
  cProd: string;
  cEAN?: string;
  xProd: string;
  uCom: string;
  qCom: number;
  vProd: number;
}

export function parseNfeXml(xml: string): { itens: NfeItem[] } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: false,
  });
  const obj = parser.parse(xml) as Record<string, unknown>;
  const infNFe = findKey(obj, 'infNFe') as Record<string, unknown> | null;
  if (!infNFe) return { itens: [] };
  const det = infNFe.det as unknown;
  const detArr: Array<Record<string, unknown>> = Array.isArray(det)
    ? (det as Array<Record<string, unknown>>)
    : det
    ? [det as Record<string, unknown>]
    : [];
  const itens: NfeItem[] = detArr.map((d) => {
    const prod = (d.prod ?? {}) as Record<string, unknown>;
    return {
      cProd: String(prod.cProd ?? ''),
      cEAN: String(prod.cEAN ?? '') || undefined,
      xProd: String(prod.xProd ?? ''),
      uCom: String(prod.uCom ?? ''),
      qCom: Number(String(prod.qCom ?? '0').replace(',', '.')) || 0,
      vProd: Number(String(prod.vProd ?? '0').replace(',', '.')) || 0,
    };
  });
  return { itens };
}

function findKey(obj: unknown, target: string): unknown {
  if (obj === null || typeof obj !== 'object') return null;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (k === target) return v;
    const sub = findKey(v, target);
    if (sub) return sub;
  }
  return null;
}
