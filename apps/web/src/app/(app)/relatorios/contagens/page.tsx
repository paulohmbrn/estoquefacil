// /relatorios/contagens — histórico filtrável + ações por linha (ver detalhe, exportar).

import Link from 'next/link';
import type { Prisma } from '@estoque/db';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const STATUS_BADGE: Record<string, { label: string; variant: 'green' | 'gold' | 'red' | 'neutral' | 'ink' }> = {
  EM_ANDAMENTO: { label: 'Em andamento', variant: 'gold' },
  FINALIZADA:   { label: 'Finalizada',   variant: 'green' },
  EXPORTADA:    { label: 'Exportada',    variant: 'ink' },
  CANCELADA:    { label: 'Cancelada',    variant: 'neutral' },
};

const PAGE = 30;

const dt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

const dtData = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: 'UTC',
});

interface Search {
  status?: string;
  data?: string;
  page?: string;
}

export default async function HistoricoContagens({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { lojaId } = await requireLojaAtiva();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const skip = (page - 1) * PAGE;

  const where: Prisma.ContagemWhereInput = {
    lojaId,
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.data
      ? (() => {
          const [y, m, d] = params.data!.split('-').map(Number);
          if (!y || !m || !d) return {};
          return { dataContagem: new Date(Date.UTC(y, m - 1, d)) };
        })()
      : {}),
  };

  const [contagens, total, datasComContagem] = await Promise.all([
    prisma.contagem.findMany({
      where,
      orderBy: [{ dataContagem: 'desc' }, { iniciadaEm: 'desc' }],
      take: PAGE,
      skip,
      include: {
        responsavel: { select: { nome: true } },
        lista: { select: { nome: true } },
        _count: { select: { lancamentos: true } },
      },
    }),
    prisma.contagem.count({ where }),
    prisma.contagem.groupBy({
      by: ['dataContagem'],
      where: { lojaId, status: { in: ['FINALIZADA', 'EXPORTADA'] } },
      _count: true,
      orderBy: { dataContagem: 'desc' },
      take: 60,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  // Agrupa contagens por data para o botão "exportar dia consolidado"
  const datasMap = new Map<string, number>();
  for (const d of datasComContagem) {
    datasMap.set(d.dataContagem.toISOString().slice(0, 10), d._count);
  }

  return (
    <div className="max-w-[1240px] mx-auto">
      <PageHead
        eyebrow={
          <>
            <Link href="/relatorios" className="hover:underline">Relatórios</Link> · Contagens
          </>
        }
        title={
          <>
            Histórico de <em>contagens</em>
          </>
        }
        sub={`${total.toLocaleString('pt-BR')} contagens nesta loja. Exporte individualmente ou consolide o dia inteiro.`}
      />

      <Card className="p-4 mb-5 flex flex-wrap items-center gap-3">
        <span className="rm-meta text-rm-mid">Filtros:</span>
        <FilterChip label="Todos" href="/relatorios/contagens" active={!params.status && !params.data} />
        <FilterChip label="Finalizadas" href="/relatorios/contagens?status=FINALIZADA" active={params.status === 'FINALIZADA'} />
        <FilterChip label="Exportadas" href="/relatorios/contagens?status=EXPORTADA" active={params.status === 'EXPORTADA'} />
        <FilterChip label="Em andamento" href="/relatorios/contagens?status=EM_ANDAMENTO" active={params.status === 'EM_ANDAMENTO'} />
        <FilterChip label="Canceladas" href="/relatorios/contagens?status=CANCELADA" active={params.status === 'CANCELADA'} />
      </Card>

      {datasMap.size > 0 && (
        <Card className="p-4 mb-5">
          <p className="rm-meta text-rm-mid mb-2">Exportar dia consolidado</p>
          <div className="flex flex-wrap gap-2">
            {[...datasMap.entries()].slice(0, 14).map(([iso, n]) => (
              <a
                key={iso}
                href={`/api/export/dia?lojaId=${lojaId}&data=${iso}`}
                className="ef-btn ef-btn-ghost ef-btn-sm"
                title={`${n} contagem${n !== 1 ? 's' : ''} em ${dtData.format(new Date(iso))}`}
              >
                {dtData.format(new Date(iso))} · {n}
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Desktop: tabela */}
      <Card className="hidden sm:block overflow-hidden overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left border-b border-hairline bg-[#fafaf7]">
              <Th>Data</Th>
              <Th>Lista</Th>
              <Th>Responsável</Th>
              <Th>Itens</Th>
              <Th>Status</Th>
              <Th>Início</Th>
              <Th className="text-right">Ações</Th>
            </tr>
          </thead>
          <tbody>
            {contagens.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-rm-mid">Sem contagens com esses filtros.</td></tr>
            )}
            {contagens.map((c) => (
              <tr key={c.id} className="border-b border-hairline hover:bg-[rgba(0,65,37,.03)]">
                <td className="px-4 py-2 rm-mono text-[12px]">{dtData.format(c.dataContagem)}</td>
                <td className="px-4 py-2 text-rm-ink-2">{c.lista?.nome ?? <span className="text-rm-mid italic">livre</span>}</td>
                <td className="px-4 py-2">{c.responsavel.nome}</td>
                <td className="px-4 py-2">{c._count.lancamentos}</td>
                <td className="px-4 py-2">
                  <Badge variant={STATUS_BADGE[c.status]?.variant ?? 'neutral'}>
                    {STATUS_BADGE[c.status]?.label ?? c.status}
                  </Badge>
                </td>
                <td className="px-4 py-2 rm-mono text-[11px] text-rm-mid">{dt.format(c.iniciadaEm)}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  <Link href={`/relatorios/contagens/${c.id}`} className="text-[11px] uppercase tracking-[.16em] font-semibold text-rm-mid hover:text-rm-green">
                    Detalhe
                  </Link>
                  {(c.status === 'FINALIZADA' || c.status === 'EXPORTADA') && (
                    <a
                      href={`/api/export/contagem/${c.id}`}
                      className="text-[11px] uppercase tracking-[.16em] font-semibold text-rm-green hover:underline"
                    >
                      .xlsx
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile: cards */}
      <ul className="sm:hidden space-y-2">
        {contagens.length === 0 && (
          <li className="bg-white border border-hairline rounded-xs p-6 text-center text-rm-mid text-[13px]">
            Sem contagens com esses filtros.
          </li>
        )}
        {contagens.map((c) => (
          <li key={c.id} className="bg-white border border-hairline rounded-xs p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <Link
                  href={`/relatorios/contagens/${c.id}`}
                  className="font-medium text-rm-ink text-[14px] block truncate"
                >
                  {c.lista?.nome ?? <span className="italic text-rm-mid">Contagem livre</span>}
                </Link>
                <p className="text-[11px] text-rm-mid mt-1">
                  {c.responsavel.nome} · {c._count.lancamentos} {c._count.lancamentos === 1 ? 'item' : 'itens'}
                </p>
              </div>
              <Badge variant={STATUS_BADGE[c.status]?.variant ?? 'neutral'}>
                {STATUS_BADGE[c.status]?.label ?? c.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-2 border-t border-dashed border-hairline">
              <span className="rm-mono text-rm-mid">{dtData.format(c.dataContagem)}</span>
              {(c.status === 'FINALIZADA' || c.status === 'EXPORTADA') && (
                <a
                  href={`/api/export/contagem/${c.id}`}
                  className="uppercase tracking-[.16em] font-semibold text-rm-green"
                >
                  Baixar .xlsx →
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <nav className="mt-5 flex items-center justify-between text-[12px] text-rm-mid">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/relatorios/contagens?page=${page - 1}${params.status ? `&status=${params.status}` : ''}`} className="ef-btn ef-btn-ghost ef-btn-sm">
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/relatorios/contagens?page=${page + 1}${params.status ? `&status=${params.status}` : ''}`} className="ef-btn ef-btn-ghost ef-btn-sm">
                Próxima →
              </Link>
            )}
          </div>
        </nav>
      )}
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

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'px-3 py-1 rounded-xs text-[11px] uppercase tracking-[.16em] font-semibold bg-rm-green text-rm-cream'
          : 'px-3 py-1 rounded-xs text-[11px] uppercase tracking-[.16em] font-semibold border border-hairline text-rm-ink-2 hover:border-rm-green hover:text-rm-green'
      }
    >
      {label}
    </Link>
  );
}
