// /controlados — produtos com controle de estoque mínimo. Mostra status de
// reposição usando estoque estimado (última contagem + recebimentos posteriores).

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { calcularEstoqueAtual, statusReposicao, type StatusReposicao } from '@/lib/estoque-atual';

const dtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });

interface SearchParams {
  status?: 'todos' | 'repor' | 'atencao';
  grupo?: string;
}

const STATUS_BADGE: Record<StatusReposicao, { label: string; variant: 'green' | 'gold' | 'red' | 'neutral' }> = {
  ok: { label: 'OK', variant: 'green' },
  atencao: { label: 'Atenção', variant: 'gold' },
  repor: { label: 'Repor', variant: 'red' },
  sem_dado: { label: 'Sem contagem', variant: 'neutral' },
};

function fmtQty(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function diasDesde(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
}

export default async function ControladosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { lojaId } = await requireLojaAtiva();
  const params = await searchParams;
  const filtroStatus = params.status ?? 'todos';
  const filtroGrupo = params.grupo ?? null;

  const produtos = await prisma.produto.findMany({
    where: {
      lojaId,
      ativo: true,
      meta: { controlado: true },
      ...(filtroGrupo ? { grupoId: filtroGrupo } : {}),
    },
    orderBy: { nome: 'asc' },
    include: {
      grupo: { select: { id: true, nome: true } },
      meta: { select: { estoqueMinimo: true } },
    },
  });

  const grupos = await prisma.grupo.findMany({
    where: {
      produtos: { some: { lojaId, ativo: true, meta: { controlado: true } } },
    },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  });

  const estoqueMap = await calcularEstoqueAtual({
    lojaId,
    produtoIds: produtos.map((p) => p.id),
  });

  type Linha = (typeof produtos)[number] & {
    estoqueAtual: number;
    minimo: number;
    ultimaContagemEm: Date | null;
    recebidoDesdeContagem: number;
    status: StatusReposicao;
  };

  const linhas: Linha[] = produtos.map((p) => {
    const e = estoqueMap.get(p.id)!;
    const minimo = p.meta?.estoqueMinimo ? Number(p.meta.estoqueMinimo) : 0;
    return {
      ...p,
      estoqueAtual: e.estoqueAtual,
      minimo,
      ultimaContagemEm: e.ultimaContagemEm,
      recebidoDesdeContagem: e.recebidoDesdeContagem,
      status: statusReposicao(e.estoqueAtual, minimo, e.ultimaContagemEm, e.recebidoDesdeContagem),
    };
  });

  // Aplica filtro de status
  const filtradas = linhas.filter((l) => {
    if (filtroStatus === 'repor') return l.status === 'repor';
    if (filtroStatus === 'atencao') return l.status === 'atencao' || l.status === 'repor';
    return true;
  });

  // Ordena: piores primeiro (repor → atencao → sem_dado → ok)
  const ordemStatus: Record<StatusReposicao, number> = { repor: 0, atencao: 1, sem_dado: 2, ok: 3 };
  filtradas.sort((a, b) => {
    const s = ordemStatus[a.status] - ordemStatus[b.status];
    if (s !== 0) return s;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });

  const counts = linhas.reduce(
    (acc, l) => {
      acc[l.status] += 1;
      return acc;
    },
    { ok: 0, atencao: 0, repor: 0, sem_dado: 0 } as Record<StatusReposicao, number>,
  );

  return (
    <div className="max-w-[1240px] mx-auto">
      <PageHead
        eyebrow="Operação · Controle de estoque"
        title={
          <>
            Produtos a <em>repor</em>
          </>
        }
        sub={`${linhas.length} produtos controlados nesta loja. Estoque calculado a partir da última contagem + recebimentos posteriores.`}
      />

      {/* Resumo + filtros de status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <StatusFilter href={hrefWith(params, { status: 'repor' })} active={filtroStatus === 'repor'} count={counts.repor} variant="red" label="Repor já" />
        <StatusFilter href={hrefWith(params, { status: 'atencao' })} active={filtroStatus === 'atencao'} count={counts.atencao + counts.repor} variant="gold" label="Atenção+" />
        <StatusFilter href={hrefWith(params, { status: 'todos' })} active={filtroStatus === 'todos' || !filtroStatus} count={linhas.length} variant="neutral" label="Todos" />
        <StatusFilter href="/cadastros/produtos?controlado=1" active={false} count={linhas.length} variant="green" label="Editar lista" external />
      </div>

      {/* Filtro por grupo (opcional) */}
      {grupos.length > 1 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <Link
            href={hrefWith(params, { grupo: undefined })}
            className={`px-3 py-1 text-[11px] uppercase tracking-[.16em] font-semibold rounded-xs border ${
              !filtroGrupo ? 'border-rm-green text-rm-green bg-[rgba(0,65,37,.06)]' : 'border-hairline text-rm-mid hover:border-rm-green hover:text-rm-green'
            }`}
          >
            Todos os grupos
          </Link>
          {grupos.map((g) => (
            <Link
              key={g.id}
              href={hrefWith(params, { grupo: g.id })}
              className={`px-3 py-1 text-[11px] uppercase tracking-[.16em] font-semibold rounded-xs border ${
                filtroGrupo === g.id ? 'border-rm-green text-rm-green bg-[rgba(0,65,37,.06)]' : 'border-hairline text-rm-mid hover:border-rm-green hover:text-rm-green'
              }`}
            >
              {g.nome}
            </Link>
          ))}
        </div>
      )}

      {filtradas.length === 0 ? (
        <Card className="p-12 text-center">
          {linhas.length === 0 ? (
            <>
              <p className="rm-eyebrow">Nada controlado ainda</p>
              <h2 className="rm-h3 mt-3">Marque produtos como controlados</h2>
              <p className="rm-caption text-rm-mid mt-3 max-w-[42ch] mx-auto">
                Vá em <Link href="/cadastros/produtos" className="rm-link">Cadastros → Produtos</Link>, abra o
                produto e ative <strong>&quot;Produto controlado&quot;</strong> + defina o estoque mínimo.
              </p>
            </>
          ) : (
            <p className="text-rm-mid text-[13px]">Nenhum produto neste filtro.</p>
          )}
        </Card>
      ) : (
        <>
          {/* Desktop: tabela */}
          <Card className="hidden lg:block overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left border-b border-hairline bg-[#fafaf7]">
                  <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px]">Status</th>
                  <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px]">Produto</th>
                  <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px] text-right">Atual</th>
                  <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px] text-right">Mínimo</th>
                  <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px]">Última contagem</th>
                  <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px] text-right">Recebido</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => {
                  const dias = diasDesde(l.ultimaContagemEm);
                  return (
                    <tr key={l.id} className="border-b border-hairline hover:bg-[rgba(0,65,37,.04)]">
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_BADGE[l.status].variant}>{STATUS_BADGE[l.status].label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/cadastros/produtos/${l.id}`} className="font-medium text-rm-ink hover:text-rm-green block">
                          {l.nome}
                        </Link>
                        <span className="block rm-mono text-[10px] text-rm-mid mt-1">{l.cdarvprod} · {l.grupo?.nome ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {fmtQty(l.estoqueAtual)} <span className="text-rm-mid text-[11px]">{l.unidade}</span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-rm-mid">
                        {fmtQty(l.minimo)} <span className="text-[11px]">{l.unidade}</span>
                      </td>
                      <td className="px-4 py-3 text-rm-mid text-[12px]">
                        {l.ultimaContagemEm ? (
                          <>
                            {dtData.format(l.ultimaContagemEm)}
                            <span className="block text-[10px]">{dias === 0 ? 'hoje' : `há ${dias}d`}</span>
                          </>
                        ) : (
                          <span className="italic">nunca</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-rm-mid text-[12px]">
                        {l.recebidoDesdeContagem > 0 ? `+${fmtQty(l.recebidoDesdeContagem)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile: cards */}
          <ul className="lg:hidden space-y-2">
            {filtradas.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/cadastros/produtos/${l.id}`}
                  className="block bg-white border border-hairline rounded-xs p-3 hover:border-rm-green active:bg-[rgba(0,65,37,.04)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-rm-ink text-[14px] leading-tight">{l.nome}</p>
                      <p className="text-[11px] text-rm-mid mt-1">
                        {fmtQty(l.estoqueAtual)} {l.unidade} <span className="text-rm-silt">·</span> mín {fmtQty(l.minimo)} {l.unidade}
                      </p>
                      <p className="text-[10px] text-rm-mid mt-1">
                        {l.ultimaContagemEm ? `Contado ${dtData.format(l.ultimaContagemEm)}` : 'Nunca contado'}
                        {l.recebidoDesdeContagem > 0 && ` · +${fmtQty(l.recebidoDesdeContagem)} recebido`}
                      </p>
                    </div>
                    <Badge variant={STATUS_BADGE[l.status].variant} className="shrink-0">{STATUS_BADGE[l.status].label}</Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function hrefWith(current: SearchParams, patch: Partial<SearchParams> & { grupo?: string | undefined }): string {
  const merged: Record<string, string | undefined> = {
    status: current.status,
    grupo: current.grupo,
    ...patch,
  };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
  return `/controlados${params.toString() ? `?${params}` : ''}`;
}

function StatusFilter({
  href,
  active,
  count,
  label,
  variant,
  external,
}: {
  href: string;
  active: boolean;
  count: number;
  label: string;
  variant: 'red' | 'gold' | 'green' | 'neutral';
  external?: boolean;
}) {
  const palette = {
    red: 'border-rm-red text-rm-red bg-[#fdf3f2]',
    gold: 'border-rm-gold text-rm-gold bg-[#fdf7e3]',
    green: 'border-rm-green text-rm-green bg-[rgba(0,65,37,.06)]',
    neutral: 'border-hairline text-rm-mid bg-white',
  }[variant];
  return (
    <Link
      href={href}
      className={`block p-3 rounded-xs border-l-4 ${palette} ${active ? 'shadow-card' : 'opacity-80 hover:opacity-100'}`}
    >
      <p className="rm-eyebrow text-[10px]">{label}</p>
      <p className="font-sans font-bold text-[20px] mt-1">{count}</p>
      {external && <p className="text-[10px] text-rm-mid mt-1">→</p>}
    </Link>
  );
}
