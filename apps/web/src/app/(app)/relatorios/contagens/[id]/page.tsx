// /relatorios/contagens/[id] — detalhe drill-down de uma contagem.

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toDtlancestq } from '@estoque/shared';

const dt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
});

const STATUS_BADGE: Record<string, { label: string; variant: 'green' | 'gold' | 'red' | 'neutral' | 'ink' }> = {
  EM_ANDAMENTO: { label: 'Em andamento', variant: 'gold' },
  FINALIZADA:   { label: 'Finalizada',   variant: 'green' },
  EXPORTADA:    { label: 'Exportada',    variant: 'ink' },
  CANCELADA:    { label: 'Cancelada',    variant: 'neutral' },
};

export default async function ContagemDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lojaId } = await requireLojaAtiva();

  const c = await prisma.contagem.findUnique({
    where: { id },
    include: {
      loja: { select: { zmartbiId: true, nome: true, apelido: true } },
      responsavel: { select: { nome: true } },
      criadaPor: { select: { name: true, email: true } },
      lista: { select: { nome: true } },
      lancamentos: {
        include: { produto: { select: { cdarvprod: true, nome: true, unidade: true, grupo: { select: { nome: true } } } } },
        orderBy: { produto: { nome: 'asc' } },
      },
    },
  });
  if (!c || c.lojaId !== lojaId) notFound();

  const totalQtd = c.lancamentos.reduce((acc, l) => acc + Number(l.quantidade), 0);
  const dtlancestq = toDtlancestq(c.dataContagem);

  return (
    <div className="max-w-[1240px] mx-auto">
      <PageHead
        eyebrow={
          <>
            <Link href="/relatorios/contagens" className="hover:underline">Histórico</Link> · {c.id.slice(0, 8)}
          </>
        }
        title={
          <>
            {c.lista?.nome ?? 'Contagem livre'}
          </>
        }
        sub={`${c.loja.apelido ?? c.loja.nome} · ${c.responsavel.nome}`}
        action={
          <div className="flex gap-2">
            <a
              href={`/api/contagem/${c.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="ef-btn ef-btn-ghost"
            >
              Imprimir A4
            </a>
            {(c.status === 'FINALIZADA' || c.status === 'EXPORTADA') && (
              <a
                href={`/api/export/contagem/${c.id}`}
                className="ef-btn ef-btn-primary"
              >
                Exportar .xlsx
              </a>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <Stat label="Status" value={
          <Badge variant={STATUS_BADGE[c.status]?.variant ?? 'neutral'}>
            {STATUS_BADGE[c.status]?.label ?? c.status}
          </Badge>
        } />
        <Stat label="Itens" value={String(c.lancamentos.length)} />
        <Stat label="Qtd. total" value={totalQtd.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} />
        <Stat label="DTLANCESTQ" value={<span className="rm-mono">{dtlancestq}</span>} />
        <Stat label="Iniciada" value={dt.format(c.iniciadaEm)} />
      </div>

      <Card className="overflow-hidden overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left border-b border-hairline bg-[#fafaf7]">
              <Th>CDARVPROD</Th>
              <Th>Produto</Th>
              <Th>Grupo</Th>
              <Th className="text-center">Un</Th>
              <Th className="text-right">Quantidade</Th>
              <Th className="text-right">Registrado em</Th>
            </tr>
          </thead>
          <tbody>
            {c.lancamentos.map((l) => (
              <tr key={l.id} className="border-b border-hairline">
                <td className="px-4 py-2 rm-mono text-[12px]">{l.produto.cdarvprod}</td>
                <td className="px-4 py-2 font-medium">{l.produto.nome}</td>
                <td className="px-4 py-2 text-rm-mid text-[12px]">{l.produto.grupo?.nome ?? '—'}</td>
                <td className="px-4 py-2 text-center"><Badge variant="neutral">{l.produto.unidade}</Badge></td>
                <td className="px-4 py-2 text-right rm-mono">{Number(l.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</td>
                <td className="px-4 py-2 text-right text-rm-mid text-[11px] rm-mono">{dt.format(l.registradoEm)}</td>
              </tr>
            ))}
            {c.lancamentos.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-rm-mid">Sem lançamentos.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white border border-hairline rounded-xs p-4">
      <p className="rm-eyebrow text-rm-mid">{label}</p>
      <p className="rm-h4 mt-2">{value}</p>
    </div>
  );
}
function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th className={`px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px] ${className ?? ''}`}>
      {children}
    </th>
  );
}
