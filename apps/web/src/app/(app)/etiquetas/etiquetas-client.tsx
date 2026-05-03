'use client';

import { useMemo, useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export type ProdutoEtiqueta = {
  id: string;
  cdarvprod: string;
  nome: string;
  unidade: string;
  grupoId: string | null;
  grupoNome: string | null;
};

export type GrupoOpt = { id: string; nome: string; total: number };

interface Props {
  produtos: ProdutoEtiqueta[];
  grupos: GrupoOpt[];
}

type Selection = Record<
  string,
  { qtd: number; metodo: 'CONGELADO' | 'RESFRIADO' | 'AMBIENTE' }
>;

export function EtiquetasClient({ produtos, grupos }: Props) {
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<Selection>({});
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [showFormatoPicker, setShowFormatoPicker] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return produtos.filter((p) => {
      if (grupoId && p.grupoId !== grupoId) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        p.cdarvprod.includes(query) ||
        (p.grupoNome?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [produtos, query, grupoId]);

  const totalEtiquetas = Object.values(sel).reduce((acc, s) => acc + s.qtd, 0);
  const itensSelecionados = Object.entries(sel).filter(([, s]) => s.qtd > 0);

  function setQty(id: string, qtd: number, metodo?: Selection[string]['metodo']) {
    setSel((prev) => {
      const next = { ...prev };
      if (qtd <= 0) {
        delete next[id];
      } else {
        next[id] = { qtd, metodo: metodo ?? prev[id]?.metodo ?? 'RESFRIADO' };
      }
      return next;
    });
  }

  function gerarPdf(formato: 'TERMICA_60' | 'TERMICA_40' | 'A4_PIMACO' | 'ARGOX_100X60') {
    if (itensSelecionados.length === 0) return;
    setErro(null);
    setShowFormatoPicker(false);
    startTransition(async () => {
      try {
        const res = await fetch('/api/etiquetas/lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            formato,
            itens: itensSelecionados.map(([produtoId, s]) => ({
              produtoId,
              qtd: s.qtd,
              metodo: s.metodo,
            })),
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Erro ${res.status}`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'etiquetas.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        setErro((e as Error).message);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_320px] gap-6">
      <aside className="space-y-3 hidden lg:block">
        <p className="rm-meta text-rm-mid">Filtrar por grupo</p>
        <button
          className={
            !grupoId
              ? 'block w-full text-left px-3 py-2 rounded-sm text-[13px] font-semibold bg-[rgba(0,65,37,.08)] text-rm-green border border-[rgba(0,65,37,.15)]'
              : 'block w-full text-left px-3 py-2 rounded-sm text-[13px] font-medium text-rm-ink-2 border border-transparent hover:bg-[rgba(0,65,37,.04)] hover:text-rm-green'
          }
          onClick={() => setGrupoId(null)}
        >
          Todos · {produtos.length}
        </button>
        {grupos.map((g) => (
          <button
            key={g.id}
            className={
              grupoId === g.id
                ? 'block w-full text-left px-3 py-2 rounded-sm text-[13px] font-semibold bg-[rgba(0,65,37,.08)] text-rm-green border border-[rgba(0,65,37,.15)]'
                : 'block w-full text-left px-3 py-2 rounded-sm text-[13px] font-medium text-rm-ink-2 border border-transparent hover:bg-[rgba(0,65,37,.04)] hover:text-rm-green'
            }
            onClick={() => setGrupoId(g.id)}
          >
            <span className="flex items-center justify-between gap-2 w-full">
              <span className="truncate">{g.nome}</span>
              <span className="text-rm-mid text-[11px] shrink-0">{g.total}</span>
            </span>
          </button>
        ))}
      </aside>

      <section className="min-w-0">
        <div className="lg:hidden mb-3">
          <select
            className="w-full bg-white border border-hairline px-3 py-2 rounded-xs text-[13px]"
            value={grupoId ?? ''}
            onChange={(e) => setGrupoId(e.target.value || null)}
          >
            <option value="">Todos os grupos · {produtos.length}</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>{g.nome} · {g.total}</option>
            ))}
          </select>
        </div>
        <Input
          placeholder="Buscar por nome / CDARVPROD"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mb-4"
        />
        <Card className="overflow-hidden overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left border-b border-hairline bg-[#fafaf7]">
                <Th>Produto</Th>
                <Th>CDARVPROD</Th>
                <Th>Método</Th>
                <Th className="text-center">Qtd</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((p) => {
                const s = sel[p.id];
                return (
                  <tr key={p.id} className="border-b border-hairline hover:bg-[rgba(0,65,37,.03)]">
                    <td className="px-4 py-2">
                      <p className="font-medium text-rm-ink truncate max-w-[280px]">{p.nome}</p>
                      <p className="text-[11px] text-rm-mid">{p.grupoNome ?? '—'} · {p.unidade}</p>
                    </td>
                    <td className="px-4 py-2 rm-mono text-[11.5px]">{p.cdarvprod}</td>
                    <td className="px-4 py-2">
                      <select
                        className="bg-white border border-hairline px-2 py-1 rounded-xs text-[12px]"
                        value={s?.metodo ?? 'RESFRIADO'}
                        onChange={(e) =>
                          setQty(p.id, s?.qtd ?? 0, e.target.value as Selection[string]['metodo'])
                        }
                      >
                        <option value="RESFRIADO">Resfriado</option>
                        <option value="CONGELADO">Congelado</option>
                        <option value="AMBIENTE">Ambiente</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="w-6 h-6 border border-hairline rounded-xs hover:bg-[rgba(0,65,37,.06)]"
                          onClick={() => setQty(p.id, Math.max(0, (s?.qtd ?? 0) - 1))}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={200}
                          value={s?.qtd ?? 0}
                          onChange={(e) => setQty(p.id, Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
                          className="w-12 text-center bg-white border border-hairline rounded-xs text-[13px] px-1 py-1"
                        />
                        <button
                          type="button"
                          className="w-6 h-6 border border-hairline rounded-xs hover:bg-[rgba(0,65,37,.06)]"
                          onClick={() => setQty(p.id, Math.min(200, (s?.qtd ?? 0) + 1))}
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-rm-mid">Nada encontrado.</td></tr>
              )}
              {filtered.length > 200 && (
                <tr><td colSpan={4} className="px-4 py-4 text-center text-rm-mid text-[12px]">
                  Mostrando 200 de {filtered.length}. Refine a busca para ver mais.
                </td></tr>
              )}
            </tbody>
          </table>
        </Card>
      </section>

      <aside>
        <Card className="sticky top-6">
          <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="rm-eyebrow text-rm-mid">Itens selecionados</p>
              <p className="rm-h2 mt-1">{itensSelecionados.length}</p>
            </div>
            <div>
              <p className="rm-eyebrow text-rm-mid">Total de etiquetas</p>
              <p className="rm-h2 mt-1">{totalEtiquetas}</p>
            </div>
            <p className="rm-caption text-rm-mid">Você escolhe o formato no próximo passo.</p>
            {itensSelecionados.length > 0 && (
              <ul className="text-[12px] space-y-1 max-h-[160px] overflow-auto pr-2 border-t border-dashed border-hairline pt-3">
                {itensSelecionados.map(([id, s]) => {
                  const p = produtos.find((x) => x.id === id);
                  if (!p) return null;
                  return (
                    <li key={id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-rm-ink-2">{p.nome}</span>
                      <Badge variant="green">{s.qtd}</Badge>
                    </li>
                  );
                })}
              </ul>
            )}
            {erro && <p className="text-rm-red text-[12px]">{erro}</p>}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={pending || totalEtiquetas === 0}
              onClick={() => setShowFormatoPicker(true)}
            >
              {pending ? 'Gerando PDF…' : `Gerar PDF (${totalEtiquetas})`}
            </Button>
          </CardContent>
        </Card>
      </aside>

      {showFormatoPicker && (
        <FormatoPicker
          totalEtiquetas={totalEtiquetas}
          pending={pending}
          onClose={() => setShowFormatoPicker(false)}
          onPick={gerarPdf}
        />
      )}
    </div>
  );
}

function FormatoPicker({
  totalEtiquetas,
  pending,
  onClose,
  onPick,
}: {
  totalEtiquetas: number;
  pending: boolean;
  onClose: () => void;
  onPick: (formato: 'TERMICA_60' | 'TERMICA_40' | 'A4_PIMACO' | 'ARGOX_100X60') => void;
}) {
  const opcoes: Array<{
    id: 'TERMICA_60' | 'TERMICA_40' | 'A4_PIMACO' | 'ARGOX_100X60';
    titulo: string;
    sub: string;
    badge: string;
  }> = [
    { id: 'TERMICA_60', titulo: 'Térmica 60×60mm', sub: 'Elgin L42 Pro · 1 etiqueta/página', badge: 'Padrão' },
    { id: 'TERMICA_40', titulo: 'Térmica 40×40mm', sub: 'Elgin L42 Pro · 1 etiqueta/página', badge: 'Compacta' },
    { id: 'A4_PIMACO', titulo: 'A4 — PIMACO A4360', sub: '21 etiquetas/folha · 63,5 × 38,1mm cada', badge: 'Folha avulsa' },
    { id: 'ARGOX_100X60', titulo: 'Argox OS-214 Plus 100×60mm', sub: 'Arquivo .zpl · envia direto pra impressora (modo ZPL)', badge: 'ZPL' },
  ];
  return (
    <div
      className="fixed inset-0 bg-[rgba(10,26,16,.55)] z-50 flex items-end sm:items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xs shadow-lift w-full max-w-[500px] border-t-[6px] border-rm-green"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-hairline">
          <p className="rm-eyebrow text-rm-green">Escolha o formato</p>
          <h2 className="font-sans font-bold text-[20px] mt-2 leading-tight">
            {totalEtiquetas} etiquetas
          </h2>
          <p className="text-[12px] text-rm-mid mt-1">
            Térmica vai pra Elgin L42 Pro. A4 vai pra impressora comum (Pimaco A4360).
          </p>
        </div>
        <div className="p-3 space-y-2">
          {opcoes.map((o) => (
            <button
              key={o.id}
              type="button"
              disabled={pending}
              onClick={() => onPick(o.id)}
              className="w-full text-left bg-white border border-hairline rounded-xs p-4 hover:border-rm-green hover:bg-[rgba(0,65,37,.04)] transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-sans font-bold text-[14px] text-rm-ink">{o.titulo}</p>
                  <p className="text-[11px] text-rm-mid mt-1">{o.sub}</p>
                </div>
                <Badge variant="neutral">{o.badge}</Badge>
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-dashed border-strong flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
        </div>
      </div>
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
