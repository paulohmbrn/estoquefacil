'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { confirmarRecebimentoFromNfManual, type PreviewItem, type PreviewNota } from '@/app/_actions/sefaz';

export type ProdutoOpt = {
  id: string;
  cdarvprod: string;
  nome: string;
  unidade: string;
  grupo: string | null;
};

type RowState = {
  produtoId: string | null;
  produtoLabel: string | null;
  produtoUnidade: string | null;
  source: PreviewItem['sugestaoSource'];
  ignorar: boolean;
  salvarMapeamento: boolean;
  // Quantidade que vai entrar no estoque, na unidade do produto da loja.
  // Default = qtd da NF; usuário ajusta quando a unidade do fornecedor é diferente
  // (ex.: NF "24 UN" → estoque "60 KG").
  qtdEstoque: string;
};

const dtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const fmtBrl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtQty = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
// Formato pra editar dentro de um <input>: usa "." como separador decimal e remove .000
function formatQtdEdit(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const s = n.toFixed(4);
  return s.replace(/\.?0+$/, '');
}

export function PrepararClient({
  nota,
  itens,
  produtosSugeridos,
  funcionarios,
}: {
  nota: PreviewNota;
  itens: PreviewItem[];
  produtosSugeridos: ProdutoOpt[];
  funcionarios: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [responsavel, setResponsavel] = useState<string>(funcionarios[0]?.id ?? '');

  const sugMap = useMemo(() => new Map(produtosSugeridos.map((p) => [p.id, p])), [produtosSugeridos]);

  const [rows, setRows] = useState<RowState[]>(() =>
    itens.map((it) => {
      const p = it.sugestaoProdutoId ? sugMap.get(it.sugestaoProdutoId) : null;
      // Se o mapa anterior salvou um fator (ex.: 2,5), aplica agora pra não obrigar
      // o usuário a digitar de novo. Sem fator (ou sem mapa) → mantém quantidade da NF.
      const qtdInicial = it.qCom * (it.sugestaoFator || 1);
      return {
        produtoId: it.sugestaoProdutoId,
        produtoLabel: p ? `${p.cdarvprod} — ${p.nome}` : null,
        produtoUnidade: p?.unidade ?? null,
        source: it.sugestaoSource,
        ignorar: false,
        salvarMapeamento: it.sugestaoSource === 'cdarvprod' || it.sugestaoSource === null,
        qtdEstoque: formatQtdEdit(qtdInicial),
      };
    }),
  );

  const totals = useMemo(() => {
    let mapeados = 0; let ignorados = 0; let pendentes = 0;
    for (const r of rows) {
      if (r.ignorar) ignorados += 1;
      else if (r.produtoId) mapeados += 1;
      else pendentes += 1;
    }
    return { mapeados, ignorados, pendentes };
  }, [rows]);

  const updateRow = (idx: number, patch: Partial<RowState>): void => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const confirmar = (): void => {
    if (!responsavel) { setErro('Selecione o responsável.'); return; }
    if (totals.pendentes > 0) {
      const ok = confirm(
        `${totals.pendentes} item(ns) sem produto da loja serão IGNORADOS. Continuar?`,
      );
      if (!ok) return;
    }
    // Valida quantidades: precisa ser número > 0 nos itens não ignorados
    for (let i = 0; i < rows.length; i += 1) {
      const r = rows[i]!;
      if (r.ignorar || !r.produtoId) continue;
      const q = Number(String(r.qtdEstoque).replace(',', '.'));
      if (!Number.isFinite(q) || q <= 0) {
        setErro(`Linha ${i + 1}: quantidade inválida (${r.qtdEstoque}).`);
        return;
      }
    }
    setErro(null);
    startTransition(async () => {
      const r = await confirmarRecebimentoFromNfManual({
        notaId: nota.id,
        responsavelId: responsavel,
        itens: itens.map((it, i) => ({
          cProd: it.cProd,
          xProd: it.xProd,
          qComNf: it.qCom,
          qCom: Number(String(rows[i]!.qtdEstoque).replace(',', '.')) || it.qCom,
          produtoId: rows[i]!.produtoId,
          salvarMapeamento: rows[i]!.salvarMapeamento && !rows[i]!.ignorar && Boolean(rows[i]!.produtoId),
          ignorar: rows[i]!.ignorar,
        })),
      });
      if (r.ok && r.data) {
        router.push(`/recebimento/${r.data.recebimentoId}`);
      } else if (!r.ok) {
        setErro(r.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="rm-eyebrow text-rm-mid">Fornecedor</p>
            <p className="font-medium text-[15px] truncate">{nota.emissorNome ?? '—'}</p>
            <p className="text-[11px] text-rm-mid mt-1">
              CNPJ {nota.emissorCnpj ?? '—'} · NF {nota.numeroNf ?? '—'}/{nota.serieNf ?? '—'} ·{' '}
              {nota.dataEmissao ? dtData.format(new Date(nota.dataEmissao)) : '—'}
              {nota.valorTotal != null && ` · ${fmtBrl(nota.valorTotal)}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="green">{totals.mapeados} mapeados</Badge>
            <Badge variant={totals.pendentes > 0 ? 'gold' : 'green'}>{totals.pendentes} pendentes</Badge>
            <Badge variant="gold">{totals.ignorados} ignorados</Badge>
          </div>
        </div>
      </Card>

      {funcionarios.length === 0 && (
        <Card className="p-4 border-l-4 border-rm-gold bg-[#fdf7e3]">
          <p className="rm-eyebrow text-rm-gold">Cadastre um funcionário primeiro</p>
          <p className="text-[13px] text-rm-ink-2 mt-1">
            Pra confirmar este Recebimento você precisa indicar quem recebeu fisicamente.
            Vá em <a href="/cadastros/funcionarios" className="rm-link">Cadastros → Funcionários</a>,
            adicione ao menos um funcionário ativo, e volte aqui.
          </p>
        </Card>
      )}

      <Card className="p-4">
        <label className="block">
          <span className="rm-eyebrow text-rm-mid mb-1 block">Responsável pelo recebimento</span>
          <select
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="w-full sm:w-[360px] bg-white border border-hairline px-3 py-2 rounded-xs text-[13px]"
          >
            {funcionarios.length === 0 && <option value="">— sem funcionários cadastrados —</option>}
            {funcionarios.map((f) => (
              <option key={f.id} value={f.id}>{f.nome}</option>
            ))}
          </select>
        </label>
      </Card>

      <Card>
        <div className="hidden md:grid grid-cols-[100px_minmax(0,1fr)_110px_minmax(260px,1.1fr)_170px_130px] gap-2 px-3 py-2 bg-[#fafaf7] border-b border-hairline rounded-t-xs text-[10px] uppercase tracking-[.16em] text-rm-mid font-semibold">
          <div>Cód NF</div>
          <div>Descrição na NF</div>
          <div>Qtd da NF</div>
          <div>Produto da loja</div>
          <div>Entrada estoque</div>
          <div>Ações</div>
        </div>
        <ul>
          {itens.map((it, i) => (
            <ItemRow
              key={`${it.cProd}-${i}`}
              item={it}
              row={rows[i]!}
              onChange={(patch) => updateRow(i, patch)}
            />
          ))}
        </ul>
      </Card>

      {erro && <p className="text-rm-red text-[13px]">{erro}</p>}

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={confirmar}
          disabled={pending || !responsavel || (totals.mapeados === 0 && totals.ignorados === 0)}
        >
          {pending ? 'Criando…' : `Confirmar recebimento (${totals.mapeados})`}
        </Button>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  row,
  onChange,
}: {
  item: PreviewItem;
  row: RowState;
  onChange: (patch: Partial<RowState>) => void;
}) {
  const sourceLabel: Record<NonNullable<PreviewItem['sugestaoSource']>, string> = {
    'map': 'mapa anterior',
    'map-cprod': 'mapa (código)',
    'cdarvprod': 'cód. direto',
  };
  const status: 'ignorar' | 'ok' | 'pendente' = row.ignorar ? 'ignorar' : row.produtoId ? 'ok' : 'pendente';

  // Detecta se a unidade da NF difere da unidade do produto da loja — sinaliza conversão
  const unidadeDivergente = Boolean(
    row.produtoUnidade &&
      row.produtoUnidade.trim().toUpperCase() !== item.uCom.trim().toUpperCase(),
  );
  const qtdNumero = Number(String(row.qtdEstoque).replace(',', '.')) || 0;
  const fator = qtdNumero && item.qCom ? qtdNumero / item.qCom : null;
  // Houve mapeamento anterior com fator ≠ 1 (já vem pré-preenchido)
  const fatorVemDoMapa = (row.source === 'map' || row.source === 'map-cprod') && item.sugestaoFator !== 1;

  return (
    <li
      className={`grid md:grid-cols-[100px_minmax(0,1fr)_110px_minmax(260px,1.1fr)_170px_130px] gap-2 px-3 py-3 border-b border-hairline last:border-0 ${
        status === 'ignorar' ? 'bg-[#fbf7e8]' : status === 'ok' ? '' : 'bg-[#fdf3f2]'
      }`}
    >
      <div className={`rm-mono text-[11px] text-rm-mid break-all ${row.ignorar ? 'line-through' : ''}`}>
        {item.cProd}
        {item.cEAN && item.cEAN !== 'SEM GTIN' && (
          <div className="text-[9px] mt-0.5">EAN {item.cEAN}</div>
        )}
      </div>

      <div className={`text-[13px] leading-snug ${row.ignorar ? 'line-through text-rm-mid' : ''}`}>
        {item.xProd}
        {row.ignorar && (
          <span className="ml-2 inline-block text-[10px] uppercase tracking-[.18em] font-bold text-rm-gold no-underline align-middle">
            ignorado
          </span>
        )}
      </div>

      <div className={`text-[13px] tabular-nums ${row.ignorar ? 'line-through text-rm-mid' : ''}`}>
        <strong>{fmtQty(item.qCom)}</strong> <span className="text-rm-mid text-[11px]">{item.uCom}</span>
        <div className="text-[10px] text-rm-mid mt-0.5 no-underline">{fmtBrl(item.vProd)}</div>
      </div>

      <div className="space-y-1.5">
        {row.ignorar ? (
          <p className="text-[11px] text-rm-mid italic">não vai entrar no recebimento</p>
        ) : (
          <>
            <ProdutoSearch
              value={row.produtoId}
              label={row.produtoLabel}
              onPick={(p) =>
                onChange({
                  produtoId: p?.id ?? null,
                  produtoLabel: p ? `${p.cdarvprod} — ${p.nome}` : null,
                  produtoUnidade: p?.unidade ?? null,
                  source: p ? null : row.source,
                })
              }
              initialQuery={item.xProd.split(' ').slice(0, 3).join(' ')}
            />
            {row.source && row.produtoId && (
              <p className="text-[10px] text-rm-mid">sugerido por {sourceLabel[row.source]}</p>
            )}
          </>
        )}
      </div>

      {/* Quantidade que vai pro estoque, na unidade do produto da loja */}
      <div className="space-y-1">
        {row.ignorar || !row.produtoId ? (
          <p className="text-[11px] text-rm-mid italic">—</p>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={row.qtdEstoque}
                onChange={(e) => onChange({ qtdEstoque: e.target.value })}
                onFocus={(e) => e.currentTarget.select()}
                className={`w-[100px] h-9 px-2 text-[13px] tabular-nums text-right border rounded-xs ${
                  unidadeDivergente
                    ? 'border-rm-gold bg-[#fdf7e3]'
                    : 'border-hairline bg-white'
                } focus:outline-none focus:border-rm-green`}
              />
              <span className="rm-eyebrow text-rm-mid text-[10px]">{row.produtoUnidade ?? '—'}</span>
            </div>
            {unidadeDivergente && (
              <p className="text-[10px] text-rm-gold leading-tight">
                ⚠ NF em <strong>{item.uCom}</strong>, estoque em <strong>{row.produtoUnidade}</strong>
                {fator && fator !== 1 && (
                  <> — {fator >= 1 ? `${fmtQty(fator)}× / unid.` : `÷ ${fmtQty(1 / fator)} / unid.`}</>
                )}
              </p>
            )}
            {fatorVemDoMapa && (
              <p className="text-[10px] text-rm-green leading-tight">
                ✓ fator salvo do recebimento anterior
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5 text-[11px]">
        <label className="inline-flex items-center gap-1.5 select-none cursor-pointer">
          <input
            type="checkbox"
            checked={row.ignorar}
            onChange={(e) => onChange({ ignorar: e.target.checked })}
          />
          Ignorar
        </label>
        <label className="inline-flex items-center gap-1.5 select-none cursor-pointer text-rm-mid">
          <input
            type="checkbox"
            checked={row.salvarMapeamento}
            onChange={(e) => onChange({ salvarMapeamento: e.target.checked })}
            disabled={row.ignorar || !row.produtoId}
          />
          Salvar mapa
        </label>
      </div>
    </li>
  );
}

function ProdutoSearch({
  value,
  label,
  onPick,
  disabled,
  initialQuery,
}: {
  value: string | null;
  label: string | null;
  onPick: (p: ProdutoOpt | null) => void;
  disabled?: boolean;
  initialQuery: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<ProdutoOpt[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const term = q.trim().length >= 2 ? q.trim() : initialQuery;
    if (term.length < 2) { setResults([]); return; }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/produtos?q=${encodeURIComponent(term)}&stock=1`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.produtos ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [open, q, initialQuery]);

  if (!open) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={`block w-full text-left text-[12px] px-2.5 py-1.5 border rounded-xs ${
          value
            ? 'border-rm-green/40 bg-[#f1f7f3] text-rm-ink'
            : 'border-dashed border-strong text-rm-mid hover:border-rm-green'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {value ? label : 'Buscar produto da loja…'}
      </button>
    );
  }

  return (
    <div className="relative">
      <Input
        autoFocus
        placeholder={`Buscar “${initialQuery}”…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="text-[12px] h-8"
      />
      <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-hairline rounded-xs shadow-lift max-h-[260px] overflow-auto">
        {loading && <div className="p-2 text-[11px] text-rm-mid">buscando…</div>}
        {!loading && results.length === 0 && (
          <div className="p-2 text-[11px] text-rm-mid">sem resultados — digite ao menos 2 letras</div>
        )}
        {results.map((p) => (
          <button
            key={p.id}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onPick(p); setOpen(false); setQ(''); }}
            className="block w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-[#f1f7f3] border-b last:border-0 border-hairline"
          >
            <div className="rm-mono text-[10px] text-rm-mid">{p.cdarvprod} · {p.unidade}{p.grupo ? ` · ${p.grupo}` : ''}</div>
            <div className="text-rm-ink">{p.nome}</div>
          </button>
        ))}
        {value && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onPick(null); setOpen(false); setQ(''); }}
            className="block w-full text-left px-2.5 py-1.5 text-[11px] text-rm-red hover:bg-[#fdf3f2] border-t border-hairline"
          >
            limpar seleção
          </button>
        )}
      </div>
    </div>
  );
}
