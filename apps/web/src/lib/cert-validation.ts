// Helpers pra validar certificado A1 contra o CNPJ cadastrado da loja.
// Compartilhado entre Server Action (loja-fiscal.ts) e route REST (/api/cert/upload).

import * as forge from 'node-forge';

/** Extrai o CNPJ (14 dígitos) do certificado A1 ICP-Brasil.
 *  Tenta nessa ordem:
 *   1. SAN extension OID 2.16.76.1.3.4 (CPF/CNPJ do PJ titular)
 *   2. Regex no CN — formato "RAZAO SOCIAL:CNPJ"
 *   3. Qualquer string de 14 dígitos no CN como fallback */
export function extractCnpjFromCert(cert: forge.pki.Certificate, cn: string): string | null {
  try {
    const ext = (cert.extensions ?? []).find((e: { id?: string }) => e.id === '2.5.29.17');
    if (ext) {
      const raw = JSON.stringify(ext);
      const m = raw.match(/2\.16\.76\.1\.3\.4[^\d]+\d{8}(\d{14})/);
      if (m) return m[1]!;
    }
  } catch { /* ignore */ }

  const cnMatch = cn.match(/:(\d{14})$/);
  if (cnMatch) return cnMatch[1]!;

  const anyDigits = cn.match(/(\d{14})/);
  if (anyDigits) return anyDigits[1]!;

  return null;
}

export function formatCnpj(c: string): string {
  if (c.length !== 14) return c;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export type CnpjValidation =
  | { kind: 'exact' }
  | { kind: 'mesma-base'; baseRaiz: string; aviso: string }
  | { kind: 'base-diferente'; baseLoja: string; baseCert: string };

/** Compara o CNPJ do certificado contra o cadastrado na loja.
 *  - exact: idênticos
 *  - mesma-base: 8 primeiros dígitos iguais (matriz/filial do mesmo grupo) — SEFAZ aceita
 *  - base-diferente: completamente diferente — SEFAZ vai rejeitar
 */
export function compareCnpjs(cnpjLoja: string, cnpjCert: string, lojaNome: string): CnpjValidation {
  if (cnpjLoja === cnpjCert) return { kind: 'exact' };
  const baseLoja = cnpjLoja.slice(0, 8);
  const baseCert = cnpjCert.slice(0, 8);
  if (baseLoja === baseCert) {
    return {
      kind: 'mesma-base',
      baseRaiz: baseLoja,
      aviso: `Certificado é de outra filial do mesmo grupo (${formatCnpj(cnpjCert)}). A loja "${lojaNome}" usa ${formatCnpj(cnpjLoja)}. SEFAZ aceita pq compartilham a base ${baseLoja}.`,
    };
  }
  return { kind: 'base-diferente', baseLoja, baseCert };
}
