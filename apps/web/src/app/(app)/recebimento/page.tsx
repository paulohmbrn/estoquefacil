// /recebimento — hub de recebimentos: em andamento + iniciar novo + histórico curto

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const dt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const dtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });

const STATUS_BADGE: Record<string, { label: string; variant: 'green' | 'gold' | 'red' | 'neutral' | 'ink' }> = {
  EM_ANDAMENTO: { label: 'Em andamento', variant: 'gold' },
  FINALIZADO: { label: 'Finalizado', variant: 'green' },
  CANCELADO: { label: 'Cancelado', variant: 'neutral' },
};

export default async function RecebimentoHubPage() {
  const { lojaId } = await requireLojaAtiva();
  const [abertos, recentes] = await Promise.all([
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
  ]);

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
              NFs SEFAZ →
            </Link>
            <Link href="/recebimento/iniciar" className="ef-btn ef-btn-primary">
              + Novo
            </Link>
          </div>
        }
      />

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
