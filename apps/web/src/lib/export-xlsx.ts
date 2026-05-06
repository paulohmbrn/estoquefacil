// Export .xlsx no formato exato consumido pelo ZmartBI:
//   header: CDARVPROD | DTLANCESTQ | QTTOTLANCTO
//   1 row por (CDARVPROD, DTLANCESTQ); QTTOTLANCTO é a soma agregada
// Filename: CONTAGEMFILIAL{CDFILIAL:4}{DDMMAAAA}.xlsx
// Validado contra docs/CONTAGEMFILIAL000330042026.xlsx (formato real do ERP).

import ExcelJS from 'exceljs';
import { roundQuantidade, toDtlancestq, exportFilename } from '@estoque/shared';

export type LancamentoExport = {
  cdarvprod: string;        // 13 chars
  quantidade: number;       // já como Number (Decimal -> Number na camada acima)
  dataContagem: Date;       // será convertida via toDtlancestq
};

export type ExportResult = {
  buffer: Buffer;
  filename: string;
  rowCount: number;
};

/**
 * Agrega lançamentos por (CDARVPROD, DTLANCESTQ) e gera xlsx.
 * `cdFilial` = CDFILIAL ZmartBI da loja (ex: "0003").
 */
export async function buildContagemXlsx(
  cdFilial: string,
  lancamentos: LancamentoExport[],
  options?: { dataPreferida?: Date },
): Promise<ExportResult> {
  // Agregação
  const agg = new Map<string, { cdarvprod: string; dtlancestq: number; quantidade: number }>();
  for (const l of lancamentos) {
    if (l.quantidade <= 0) continue;
    const dtlancestq = toDtlancestq(l.dataContagem);
    const key = `${l.cdarvprod}::${dtlancestq}`;
    const prev = agg.get(key);
    if (prev) {
      prev.quantidade += l.quantidade;
    } else {
      agg.set(key, { cdarvprod: l.cdarvprod, dtlancestq, quantidade: l.quantidade });
    }
  }

  // Ordena por cdarvprod ASC (espelha o exemplo real)
  const rows = [...agg.values()].sort((a, b) => a.cdarvprod.localeCompare(b.cdarvprod));

  // Escolhe data principal pro filename: a primeira que aparece nas linhas, ou a opção, ou hoje.
  const dataPrincipal =
    options?.dataPreferida ??
    (lancamentos.length > 0 ? lancamentos[0]!.dataContagem : new Date());

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Estoque Fácil';
  wb.created = new Date();
  const ws = wb.addWorksheet('Sheet1');

  // Larguras alinhadas com o exemplo real
  ws.columns = [
    { header: 'CDARVPROD',   key: 'cdarvprod',  width: 15 },
    { header: 'DTLANCESTQ',  key: 'dtlancestq', width: 15.85 },
    { header: 'QTTOTLANCTO', key: 'qttotlancto', width: 17.28 },
  ];
  // Header em bold (mimetiza style do exemplo)
  ws.getRow(1).font = { bold: true };

  // DTLANCESTQ precisa preservar zero à esquerda em datas com dia 1-9
  // (ex: 04/05/2026 → "04052026"). Como número o Excel descarta o zero
  // e vai 4052026 — o ERP ZmartBI rejeita. Forçamos a coluna como texto.
  ws.getColumn('dtlancestq').numFmt = '@';

  for (const r of rows) {
    ws.addRow({
      cdarvprod: Number(r.cdarvprod),                          // numérico, igual ao ERP
      dtlancestq: String(r.dtlancestq).padStart(8, '0'),       // string DDMMAAAA com 8 dígitos
      qttotlancto: roundQuantidade(r.quantidade),
    });
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return {
    buffer,
    filename: exportFilename(cdFilial, dataPrincipal),
    rowCount: rows.length,
  };
}
