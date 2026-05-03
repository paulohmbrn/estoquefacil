// /cadastros/produtos — listagem da loja ativa, com busca + filtro por grupo.
// Canvas: cad-prod (desktop). Sprint 2 entrega leitura + busca; edição de meta vem depois.

import Link from 'next/link';
import { Prisma } from '@estoque/db';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 50;

interface SearchParams {
  q?: string;
  grupo?: string;
  page?: string;
  controlado?: string; // "1" filtra apenas controlados
}

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { lojaId } = await requireLojaAtiva();
  const params = await searchParams;
  const q = params.q?.trim() ?? '';
  const grupoId = params.grupo ?? null;
  const apenasControlados = params.controlado === '1';
  const page = Math.max(1, Number(params.page ?? 1));
  const skip = (page - 1) * PAGE_SIZE;

  const where: Prisma.ProdutoWhereInput = {
    lojaId,
    ativo: true,
    ...(grupoId ? { grupoId } : {}),
    ...(apenasControlados ? { meta: { controlado: true } } : {}),
    ...(q
      ? {
          OR: [
            { nome: { contains: q, mode: 'insensitive' } },
            { cdarvprod: { contains: q } },
            { cdProduto: { contains: q } },
          ],
        }
      : {}),
  };

  const [grupos, produtos, total, totalControlados] = await Promise.all([
    prisma.grupo.findMany({
      where: { produtos: { some: { lojaId, ativo: true } } },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, _count: { select: { produtos: { where: { lojaId, ativo: true } } } } },
    }),
    prisma.produto.findMany({
      where,
      orderBy: { nome: 'asc' },
      skip,
      take: PAGE_SIZE,
      include: {
        grupo: { select: { nome: true } },
        subgrupo: { select: { nome: true } },
        meta: { select: { controlado: true, estoqueMinimo: true } },
      },
    }),
    prisma.produto.count({ where }),
    prisma.produto.count({ where: { lojaId, ativo: true, meta: { controlado: true } } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-[1240px] mx-auto">
      <PageHead
        eyebrow="Cadastros · Produtos"
        title={
          <>
            Catálogo <em>sincronizado</em>
          </>
        }
        sub={`${total.toLocaleString('pt-BR')} produtos ativos · sincronizado do ZmartBI · catálogo é read-only (edite metadados visuais clicando no item)`}
        action={
          <Link
            href="/sincronizacao"
            className="text-[12px] tracking-[.18em] uppercase font-semibold text-rm-green hover:underline"
          >
            Status de sync →
          </Link>
        }
      />

      {total === 0 ? (
        <EmptyState />
      ) : (
        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
          {/* Filtros — desktop sidebar / mobile select */}
          <aside className="hidden lg:block space-y-3">
            <p className="rm-meta text-rm-mid">Tipo</p>
            <div className="flex flex-col gap-1">
              <FilterLink active={!apenasControlados && !grupoId} q={q}>
                Todos
              </FilterLink>
              <FilterLink active={apenasControlados} q={q} controlado grupoId={grupoId}>
                <span className="flex items-center justify-between gap-2 w-full">
                  <span>Controlados</span>
                  <span className="text-rm-mid text-[11px] shrink-0">{totalControlados}</span>
                </span>
              </FilterLink>
            </div>
            <p className="rm-meta text-rm-mid pt-2">Filtrar por grupo</p>
            <div className="flex flex-col gap-1">
              <FilterLink active={!grupoId} q={q} controlado={apenasControlados}>
                Todos · {total}
              </FilterLink>
              {grupos.map((g) => (
                <FilterLink key={g.id} active={grupoId === g.id} q={q} grupoId={g.id} controlado={apenasControlados}>
                  <span className="flex items-center justify-between gap-2 w-full">
                    <span className="truncate">{g.nome}</span>
                    <span className="text-rm-mid text-[11px] shrink-0">{g._count.produtos}</span>
                  </span>
                </FilterLink>
              ))}
            </div>
          </aside>

          <section>
            <form className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4" action="" method="get">
              <Input
                name="q"
                defaultValue={q}
                placeholder="Buscar nome ou código…"
                className="flex-1"
                inputMode="search"
              />
              <select
                name="grupo"
                defaultValue={grupoId ?? ''}
                className="lg:hidden bg-white border border-hairline px-3 py-2 rounded-xs text-[13px]"
              >
                <option value="">Todos os grupos · {total}</option>
                {grupos.map((g) => (
                  <option key={g.id} value={g.id}>{g.nome} · {g._count.produtos}</option>
                ))}
              </select>
              {grupoId && <input type="hidden" name="grupo" value={grupoId} className="hidden lg:block" />}
              <Button variant="ghost" type="submit">Buscar</Button>
            </form>

            {/* Desktop: tabela */}
            <Card className="hidden lg:block overflow-hidden overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left border-b border-hairline bg-[#fafaf7]">
                    <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px]">CDARVPROD</th>
                    <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px]">Produto</th>
                    <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px]">Grupo</th>
                    <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px] text-center">Un</th>
                    <th className="px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px]">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p) => (
                    <tr key={p.id} className="border-b border-hairline hover:bg-[rgba(0,65,37,.04)]">
                      <td className="px-4 py-3 rm-mono text-[12px] text-rm-ink-2">
                        <Link href={`/cadastros/produtos/${p.id}`} className="hover:text-rm-green">{p.cdarvprod}</Link>
                      </td>
                      <td className="px-4 py-3 font-medium text-rm-ink">{p.nome}</td>
                      <td className="px-4 py-3 text-rm-mid">
                        <span className="block truncate max-w-[280px]" title={p.grupo?.nome ?? ''}>
                          {p.grupo?.nome ?? '—'}
                        </span>
                        <span className="block text-[11px] text-rm-silt truncate max-w-[280px]" title={p.subgrupo?.nome ?? ''}>
                          {p.subgrupo?.nome ?? ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="neutral">{p.unidade}</Badge>
                        {p.meta?.controlado && (
                          <Badge variant="green" className="ml-1" title={`Mínimo ${p.meta?.estoqueMinimo ?? '?'} ${p.unidade}`}>Ctrl</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-rm-mid text-[11px] uppercase tracking-[.12em]">{p.tipoProduto}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Mobile: lista de cards */}
            <ul className="lg:hidden space-y-2">
              {produtos.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/cadastros/produtos/${p.id}`}
                    className="block bg-white border border-hairline rounded-xs p-3 hover:border-rm-green active:bg-[rgba(0,65,37,.04)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-rm-ink text-[14px] leading-tight">{p.nome}</p>
                        <p className="rm-mono text-[10px] text-rm-mid mt-1">{p.cdarvprod}</p>
                        {p.grupo?.nome && (
                          <p className="text-[11px] text-rm-mid mt-1 truncate">{p.grupo.nome}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge variant="neutral">{p.unidade}</Badge>
                        {p.meta?.controlado && <Badge variant="green">Ctrl</Badge>}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>

            <Pagination page={page} total={totalPages} q={q} grupoId={grupoId} />
          </section>
        </div>
      )}
    </div>
  );
}

function FilterLink({
  active,
  q,
  grupoId,
  controlado,
  children,
}: {
  active: boolean;
  q: string;
  grupoId?: string | null;
  controlado?: boolean;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (grupoId) params.set('grupo', grupoId);
  if (controlado) params.set('controlado', '1');
  const href = `/cadastros/produtos${params.toString() ? `?${params}` : ''}`;
  return (
    <Link
      href={href}
      className={
        active
          ? 'block px-3 py-2 rounded-sm text-[13px] font-semibold bg-[rgba(0,65,37,.08)] text-rm-green border border-[rgba(0,65,37,.15)]'
          : 'block px-3 py-2 rounded-sm text-[13px] font-medium text-rm-ink-2 border border-transparent hover:bg-[rgba(0,65,37,.04)] hover:text-rm-green'
      }
    >
      {children}
    </Link>
  );
}

function Pagination({
  page,
  total,
  q,
  grupoId,
}: {
  page: number;
  total: number;
  q: string;
  grupoId: string | null;
}) {
  if (total <= 1) return null;
  const buildHref = (p: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (grupoId) params.set('grupo', grupoId);
    if (p > 1) params.set('page', String(p));
    return `/cadastros/produtos${params.toString() ? `?${params}` : ''}`;
  };
  return (
    <nav className="mt-5 flex items-center justify-between text-[12px] text-rm-mid">
      <span>
        Página {page} de {total}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={buildHref(page - 1)} className="ef-btn ef-btn-ghost ef-btn-sm">
            Anterior
          </Link>
        )}
        {page < total && (
          <Link href={buildHref(page + 1)} className="ef-btn ef-btn-ghost ef-btn-sm">
            Próxima →
          </Link>
        )}
      </div>
    </nav>
  );
}

function EmptyState() {
  return (
    <Card className="p-12 text-center">
      <p className="rm-eyebrow">Catálogo vazio</p>
      <h2 className="rm-h3 mt-3">Nenhum produto sincronizado ainda</h2>
      <p className="rm-caption text-rm-mid mt-3 max-w-[42ch] mx-auto">
        O catálogo é puxado do ZmartBI no agendamento diário (06:15). Você também pode disparar manualmente
        agora — apenas Gestor.
      </p>
      <div className="mt-6">
        <Link href="/sincronizacao" className="ef-btn ef-btn-primary">
          Ir para sincronização
        </Link>
      </div>
    </Card>
  );
}
