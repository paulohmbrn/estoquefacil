// /estoque-controlado/movimentacao — histórico de entradas (impressão de
// etiquetas) e baixas (retiradas) do estoque controlado da loja.

import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { FILIAIS_ESTOQUE_CONTROLADO_SET } from '@estoque/shared';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const dtBR = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(d);
const diaBR = (d: Date) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(d);

export default async function MovimentacaoPage() {
  const { lojaId } = await requireLojaAtiva();
  const loja = await prisma.loja.findUnique({
    where: { id: lojaId },
    select: { zmartbiId: true, apelido: true, nome: true },
  });
  if (!loja || !FILIAIS_ESTOQUE_CONTROLADO_SET.has(loja.zmartbiId)) {
    return (
      <div className="max-w-[1000px] mx-auto">
        <PageHead
          eyebrow="Estoque Controlado · Movimentação"
          title={<>Movimentação do <em>estoque</em></>}
          sub="Recurso não habilitado para esta loja."
        />
        <Card className="p-6 text-rm-mid text-[14px]">Indisponível nesta loja.</Card>
      </div>
    );
  }

  const desde = new Date();
  desde.setDate(desde.getDate() - 30);

  const [entradasRaw, baixas] = await Promise.all([
    prisma.etiqueta.findMany({
      where: { lojaId, cdarvprodEstoqueSnap: { not: null }, impressaEm: { gte: desde } },
      select: { produto: { select: { nome: true } }, origem: true, impressaEm: true },
      orderBy: { impressaEm: 'desc' },
      take: 2000,
    }),
    prisma.etiqueta.findMany({
      where: { lojaId, estado: 'BAIXADA', cdarvprodEstoqueSnap: { not: null } },
      select: {
        serial: true,
        setorSolicitante: true,
        baixadaEm: true,
        produto: { select: { nome: true, unidade: true } },
        baixadaPor: { select: { name: true, email: true } },
      },
      orderBy: { baixadaEm: 'desc' },
      take: 150,
    }),
  ]);

  // Entradas agregadas por (produto, dia, origem) pra não virar 1 linha/unidade.
  const aggMap = new Map<string, { nome: string; dia: string; origem: string; qtd: number; ts: number }>();
  for (const e of entradasRaw) {
    const dia = diaBR(e.impressaEm);
    const key = `${e.produto.nome}|${dia}|${e.origem}`;
    const prev = aggMap.get(key);
    if (prev) prev.qtd += 1;
    else aggMap.set(key, { nome: e.produto.nome, dia, origem: e.origem, qtd: 1, ts: e.impressaEm.getTime() });
  }
  const entradas = [...aggMap.values()].sort((a, b) => b.ts - a.ts);

  return (
    <div className="max-w-[1000px] mx-auto">
      <PageHead
        eyebrow="Estoque Controlado · Movimentação"
        title={<>Movimentação do <em>estoque</em></>}
        sub={`${loja.apelido ?? loja.nome} — entradas (impressão) dos últimos 30 dias e últimas 150 baixas.`}
      />

      <section className="mb-10">
        <h2 className="rm-eyebrow text-rm-gold mb-3">Baixas (retiradas)</h2>
        {baixas.length === 0 ? (
          <Card className="p-6 text-rm-mid text-[14px]">Nenhuma baixa registrada.</Card>
        ) : (
          <div className="border border-hairline rounded-xs overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-[rgba(0,65,37,.06)] text-rm-mid">
                <tr>
                  <th className="text-left font-semibold px-4 py-2">Quando</th>
                  <th className="text-left font-semibold px-3 py-2">Produto</th>
                  <th className="text-left font-semibold px-3 py-2">Setor</th>
                  <th className="text-left font-semibold px-3 py-2">Responsável</th>
                  <th className="text-left font-semibold px-4 py-2">Serial</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {baixas.map((b, i) => (
                  <tr key={b.serial + i}>
                    <td className="px-4 py-2 whitespace-nowrap">{b.baixadaEm ? dtBR(b.baixadaEm) : '—'}</td>
                    <td className="px-3 py-2">{b.produto.nome}</td>
                    <td className="px-3 py-2">{b.setorSolicitante ?? '—'}</td>
                    <td className="px-3 py-2">{b.baixadaPor?.name ?? b.baixadaPor?.email ?? '—'}</td>
                    <td className="px-4 py-2 font-mono text-[12px]">{b.serial}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="rm-eyebrow text-rm-gold mb-3">Entradas (impressão de etiquetas)</h2>
        {entradas.length === 0 ? (
          <Card className="p-6 text-rm-mid text-[14px]">Nenhuma entrada nos últimos 30 dias.</Card>
        ) : (
          <div className="border border-hairline rounded-xs overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-[rgba(0,65,37,.06)] text-rm-mid">
                <tr>
                  <th className="text-left font-semibold px-4 py-2">Dia</th>
                  <th className="text-left font-semibold px-3 py-2">Produto</th>
                  <th className="text-left font-semibold px-3 py-2">Origem</th>
                  <th className="text-right font-semibold px-4 py-2">Qtd</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entradas.map((e, i) => (
                  <tr key={e.nome + e.dia + e.origem + i}>
                    <td className="px-4 py-2 whitespace-nowrap">{e.dia}</td>
                    <td className="px-3 py-2">{e.nome}</td>
                    <td className="px-3 py-2">
                      <Badge variant={e.origem === 'RECEBIMENTO' ? 'green' : 'gold'}>
                        {e.origem === 'RECEBIMENTO' ? 'Recebimento' : 'Avulso'}
                      </Badge>
                    </td>
                    <td className="text-right px-4 py-2 tabular-nums">{e.qtd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
