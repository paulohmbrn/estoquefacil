// /recebimento — hub: NFs SEFAZ recentes (≤48h) + recebimentos em andamento + histórico

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NfsClient, type NfPendente, type FuncionarioOpt } from './nfs-pendentes/nfs-client';

const dt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const dtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });

const WINDOW_HORAS_RECENTE = 48;

const STATUS_BADGE: Record<string, { label: string; variant: 'green' | 'gold' | 'red' | 'neutral' | 'ink' }> = {
  EM_ANDAMENTO: { label: 'Em andamento', variant: 'gold' },
  FINALIZADO: { label: 'Finalizado', variant: 'green' },
  CANCELADO: { label: 'Cancelado', variant: 'neutral' },
};

export default async function RecebimentoHubPage() {
  const { lojaId } = await requireLojaAtiva();
  const limite48h = new Date(Date.now() - WINDOW_HORAS_RECENTE * 60 * 60 * 1000);

  const [abertos, recentes, nfsRecentesRaw, funcionariosRaw] = await Promise.all([
    prisma.recebimento.findMany({
      where: { lojaId, status: 'EM_ANDAMENTO' },
      orderBy: { iniciadaEm: 'desc' },
      include: {
        responsavel: { select: { nome: true } },
        _count: { select: { itens: true } },
      },
    }),
    prisma.recebimento.findMany({
      where: { lojaId, status: { in: ['FINALIZADO', 'CANCELADO'] } },
      orderBy: { iniciadaEm: 'desc' },
      take: 12,
      include: {
        responsavel: { select: { nome: true } },
        _count: { select: { itens: true } },
      },
    }),
    prisma.notaFiscalImportada.findMany({
      where: { lojaId, status: 'PENDENTE', dataEmissao: { gte: limite48h } },
      orderBy: { dataEmissao: 'desc' },
      take: 50,
    }),
    prisma.funcionario.findMany({
      where: { lojaId, ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
  ]);

  const nfsRecentes: NfPendente[] = nfsRecentesRaw.map((n) => ({
    id: n.id,
    chaveAcesso: n.chaveAcesso,
    numeroNf: n.numeroNf,
    serieNf: n.serieNf,
    emissorNome: n.emissorNome,
    emissorCnpj: n.emissorCnpj,
    dataEmissao: n.dataEmissao?.toISOString() ?? null,
    valorTotal: n.valorTotal ? Number(n.valorTotal) : null,
    qtdItens: n.qtdItens,
    schemaTipo: n.schemaTipo,
  }));
  const funcionarios: FuncionarioOpt[] = funcionariosRaw;

  return (
    <div className="max-w-[920px] mx-auto">
      <PageHead
        eyebrow="Operação · Recebimento"
        title={
          <>
            Receber <em>mercadoria</em>
          </>
        }
        sub="Bipa, tira foto da NF, ou recebe direto de uma NFe baixada da SEFAZ pelo CNPJ desta loja."
        action={
          <div className="flex gap-2">
            <Link href="/recebimento/nfs-pendentes" className="ef-btn ef-btn-ghost">
              NFs SEFAZ (atrasadas) →
            </Link>
            <Link href="/recebimento/iniciar" className="ef-btn ef-btn-primary">
              + Novo
            </Link>
          </div>
        }
      />

      {nfsRecentes.length > 0 && (
        <section className="mb-8">
          <h2 className="rm-eyebrow text-rm-green mb-3">
            NFs SEFAZ recentes — últimas {WINDOW_HORAS_RECENTE}h ({nfsRecentes.length})
          </h2>
          <NfsClient nfs={nfsRecentes} funcionarios={funcionarios} />
        </section>
      )}

      {abertos.length > 0 && (
        <section className="mb-8">
          <h2 className="rm-eyebrow text-rm-gold mb-3">Em andamento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {abertos.map((r) => (
              <Link
                key={r.id}
                href={`/recebimento/${r.id}`}
                className="block bg-white border border-rm-gold rounded-xs p-4 hover:shadow-lift transition-shadow"
              >
                <p className="rm-eyebrow text-rm-gold">{r.fornecedor ?? 'Sem fornecedor'}</p>
                <p className="font-sans font-bold text-[16px] mt-1">{r.responsavel?.nome ?? '—'}</p>
                <p className="text-[12px] text-rm-mid mt-1">
                  {r._count.itens} item(s) · NF {r.numeroNf ?? '—'}
                </p>
                <Badge variant="gold" className="mt-3">Continuar →</Badge>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="rm-eyebrow mb-3">Recentes</h2>
        {recentes.length === 0 ? (
          <Card className="p-6 text-center text-rm-mid text-[13px]">
            Sem recebimentos finalizados ainda.
          </Card>
        ) : (
          <ul className="space-y-2">
            {recentes.map((r) => (
              <li key={r.id} className="bg-white border border-hairline rounded-xs p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[14px] truncate">
                      {r.fornecedor ?? <span className="italic text-rm-mid">Sem fornecedor</span>}
                      {r.numeroNf && <span className="text-rm-mid"> · NF {r.numeroNf}</span>}
                    </p>
                    <p className="text-[11px] text-rm-mid mt-1">
                      {r.responsavel?.nome ?? '—'} · {r._count.itens} item(s) · {dtData.format(r.dataRecebimento)}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[r.status]?.variant ?? 'neutral'}>
                    {STATUS_BADGE[r.status]?.label ?? r.status}
                  </Badge>
                </div>
                <div className="text-[10px] tracking-[.14em] uppercase text-rm-mid mt-2 rm-mono">
                  {dt.format(r.iniciadaEm)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
