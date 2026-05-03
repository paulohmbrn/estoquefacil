// Formatação alinhada ao formato exato do export ZmartBI.
// CONTAGEMFILIAL{CDFILIAL:4}{DDMMAAAA}.xlsx

const pad2 = (n: number) => n.toString().padStart(2, '0');

/**
 * Converte uma Date (ou string ISO) em número inteiro DDMMAAAA.
 * Ex: 2026-04-30 -> 30042026
 */
export function toDtlancestq(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Data inválida: ${String(date)}`);
  }
  const day = pad2(d.getUTCDate());
  const month = pad2(d.getUTCMonth() + 1);
  const year = d.getUTCFullYear().toString();
  return Number(`${day}${month}${year}`);
}

/**
 * Inverso: 30042026 -> Date(2026-04-30, UTC)
 */
export function fromDtlancestq(n: number | string): Date {
  const s = String(n).padStart(8, '0');
  const day = Number(s.slice(0, 2));
  const month = Number(s.slice(2, 4));
  const year = Number(s.slice(4, 8));
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Formata "DD/MM/AAAA" (formato do ZmartBI nos campos DT_CADASTRO/DT_ALTERACAO/DATA) para Date UTC.
 */
export function parseZmartbiDate(s: string): Date {
  const [d, m, y] = s.split('/').map(Number);
  if (!d || !m || !y) throw new Error(`Data ZmartBI inválida: ${s}`);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Nome do arquivo de export consolidado: CONTAGEMFILIAL{CDFILIAL:4}{DDMMAAAA}.xlsx
 */
export function exportFilename(cdFilial: string, dataContagem: Date | string): string {
  if (!/^\d{4}$/.test(cdFilial)) {
    throw new Error(`CDFILIAL inválido: ${cdFilial}`);
  }
  const dd = String(toDtlancestq(dataContagem)).padStart(8, '0');
  return `CONTAGEMFILIAL${cdFilial}${dd}.xlsx`;
}

/**
 * Arredonda quantidade para 3 casas decimais — alinhado com a precisão do export.
 */
export function roundQuantidade(q: number): number {
  return Math.round(q * 1000) / 1000;
}
