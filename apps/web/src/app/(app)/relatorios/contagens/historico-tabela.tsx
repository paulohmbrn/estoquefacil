'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type StatusVar = 'green' | 'gold' | 'red' | 'neutral' | 'ink';

const STATUS_BADGE: Record<string, { label: string; variant: StatusVar }> = {
  EM_ANDAMENTO: { label: 'Em andamento', variant: 'gold' },
  FINALIZADA:   { label: 'Finalizada',   variant: 'green' },
  EXPORTADA:    { label: 'Exportada',    variant: 'ink' },
  CANCELADA:    { label: 'Cancelada',    variant: 'neutral' },
};

const dt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
});
const dtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });

export interface ContagemRow {
  id: string;
  status: string;
  dataContagem: string; // ISO YYYY-MM-DD
  iniciadaEm: string;   // ISO datetime
  responsavelNome: string;
  listaNome: string | null;
  totalLancamentos: number;
}

interface Props {
  contagens: ContagemRow[];
}

export function HistoricoContagensTabela({ contagens }: Props) {
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<'pdf' | 'xlsx' | null>(null);

  const consolidaveis = useMemo(
    () => contagens.filter((c) => c.status === 'FINALIZADA' || c.status === 'EXPORTADA'),
    [contagens],
  );

  const selecaoArr = useMemo(() => [...selecionadas], [selecionadas]);
  const datasSelecionadas = useMemo(() => {
    const set = new Set<string>();
    for (const id of selecaoArr) {
      const c = contagens.find((x) => x.id === id);
      if (c) set.add(c.dataContagem);
    }
    return [...set];
  }, [selecaoArr, contagens]);

  const erroSelecao = useMemo(() => {
    if (datasSelecionadas.length > 1) {
      return 'Selecione apenas contagens da mesma data.';
    }
    return null;
  }, [datasSelecionadas]);

  function toggle(id: string): void {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllConsolidaveis(checked: boolean): void {
    if (!checked) {
      setSelecionadas(new Set());
      return;
    }
    // Marca todos os consolidáveis da PRIMEIRA data que aparecer (pra evitar misturar)
    const primeiraData = consolidaveis[0]?.dataContagem;
    if (!primeiraData) return;
    setSelecionadas(new Set(consolidaveis.filter((c) => c.dataContagem === primeiraData).map((c) => c.id)));
  }

  function limpar(): void {
    setSelecionadas(new Set());
  }

  async function baixar(formato: 'pdf' | 'xlsx'): Promise<void> {
    if (selecaoArr.length === 0 || erroSelecao) return;
    setDownloading(formato);
    try {
      const ids = selecaoArr.join(',');
      const res = await fetch(`/api/relatorios/consolidado?formato=${formato}&ids=${encodeURIComponent(ids)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Erro ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        `consolidado.${formato}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  const totalConsolidaveisPrimeiraData = useMemo(() => {
    const primeira = consolidaveis[0]?.dataContagem;
    return primeira ? consolidaveis.filter((c) => c.dataContagem === primeira).length : 0;
  }, [consolidaveis]);

  const todosConsolidaveisSelecionados =
    totalConsolidaveisPrimeiraData > 0 &&
    consolidaveis
      .filter((c) => c.dataContagem === consolidaveis[0]!.dataContagem)
      .every((c) => selecionadas.has(c.id));

  return (
    <>
      {/* Desktop: tabela */}
      <div className="hidden sm:block bg-white border border-hairline rounded-xs overflow-hidden overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left border-b border-hairline bg-[#fafaf7]">
              <Th className="w-[40px]">
                <input
                  type="checkbox"
                  aria-label="Selecionar todas as contagens consolidáveis da 1ª data"
                  checked={todosConsolidaveisSelecionados}
                  onChange={(e) => toggleAllConsolidaveis(e.target.checked)}
                  disabled={consolidaveis.length === 0}
                />
              </Th>
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
              <tr><td colSpan={8} className="px-4 py-8 text-center text-rm-mid">Sem contagens com esses filtros.</td></tr>
            )}
            {contagens.map((c) => {
              const consolidavel = c.status === 'FINALIZADA' || c.status === 'EXPORTADA';
              const checked = selecionadas.has(c.id);
              const isMisturaProibida =
                !checked && datasSelecionadas.length === 1 && datasSelecionadas[0] !== c.dataContagem;
              return (
                <tr key={c.id} className="border-b border-hairline hover:bg-[rgba(0,65,37,.03)]">
                  <td className="px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!consolidavel || isMisturaProibida}
                      onChange={() => toggle(c.id)}
                      title={
                        !consolidavel
                          ? 'Apenas Finalizadas/Exportadas podem ser consolidadas'
                          : isMisturaProibida
                          ? 'Selecione contagens da mesma data'
                          : 'Selecionar'
                      }
                    />
                  </td>
                  <td className="px-4 py-2 rm-mono text-[12px]">{dtData.format(new Date(c.dataContagem))}</td>
                  <td className="px-4 py-2 text-rm-ink-2">{c.listaNome ?? <span className="text-rm-mid italic">livre</span>}</td>
                  <td className="px-4 py-2">{c.responsavelNome}</td>
                  <td className="px-4 py-2">{c.totalLancamentos}</td>
                  <td className="px-4 py-2">
                    <Badge variant={STATUS_BADGE[c.status]?.variant ?? 'neutral'}>
                      {STATUS_BADGE[c.status]?.label ?? c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 rm-mono text-[11px] text-rm-mid">{dt.format(new Date(c.iniciadaEm))}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <Link href={`/relatorios/contagens/${c.id}`} className="text-[11px] uppercase tracking-[.16em] font-semibold text-rm-mid hover:text-rm-green">
                      Detalhe
                    </Link>
                    {consolidavel && (
                      <a
                        href={`/api/export/contagem/${c.id}`}
                        className="text-[11px] uppercase tracking-[.16em] font-semibold text-rm-green hover:underline"
                      >
                        .xlsx
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards (com checkbox) */}
      <ul className="sm:hidden space-y-2">
        {contagens.length === 0 && (
          <li className="bg-white border border-hairline rounded-xs p-6 text-center text-rm-mid text-[13px]">
            Sem contagens com esses filtros.
          </li>
        )}
        {contagens.map((c) => {
          const consolidavel = c.status === 'FINALIZADA' || c.status === 'EXPORTADA';
          const checked = selecionadas.has(c.id);
          const isMisturaProibida =
            !checked && datasSelecionadas.length === 1 && datasSelecionadas[0] !== c.dataContagem;
          return (
            <li key={c.id} className="bg-white border border-hairline rounded-xs p-3">
              <div className="flex items-start gap-3 mb-2">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!consolidavel || isMisturaProibida}
                  onChange={() => toggle(c.id)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/relatorios/contagens/${c.id}`}
                    className="font-medium text-rm-ink text-[14px] block truncate"
                  >
                    {c.listaNome ?? <span className="italic text-rm-mid">Contagem livre</span>}
                  </Link>
                  <p className="text-[11px] text-rm-mid mt-1">
                    {c.responsavelNome} · {c.totalLancamentos} {c.totalLancamentos === 1 ? 'item' : 'itens'}
                  </p>
                </div>
                <Badge variant={STATUS_BADGE[c.status]?.variant ?? 'neutral'}>
                  {STATUS_BADGE[c.status]?.label ?? c.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-2 border-t border-dashed border-hairline">
                <span className="rm-mono text-rm-mid">{dtData.format(new Date(c.dataContagem))}</span>
                {consolidavel && (
                  <a
                    href={`/api/export/contagem/${c.id}`}
                    className="uppercase tracking-[.16em] font-semibold text-rm-green"
                  >
                    Baixar .xlsx →
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Sticky toolbar — aparece quando há seleção */}
      {selecaoArr.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 bg-rm-ink text-rm-cream px-4 py-3 shadow-lift border-t-4 border-rm-green">
          <div className="max-w-[1240px] mx-auto flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-sans font-bold text-[15px]">
                {selecaoArr.length} contage{selecaoArr.length === 1 ? 'm' : 'ns'} selecionada{selecaoArr.length === 1 ? '' : 's'}
              </p>
              {erroSelecao ? (
                <p className="text-[11px] text-rm-gold mt-0.5">{erroSelecao}</p>
              ) : (
                <p className="text-[11px] opacity-70 mt-0.5">
                  Data: {datasSelecionadas[0] ? dtData.format(new Date(datasSelecionadas[0]!)) : '—'}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={limpar}
                className="text-rm-cream hover:bg-white/10"
              >
                Limpar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => baixar('xlsx')}
                disabled={Boolean(erroSelecao) || downloading !== null}
              >
                {downloading === 'xlsx' ? 'Gerando…' : 'Consolidar XLSX'}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => baixar('pdf')}
                disabled={Boolean(erroSelecao) || downloading !== null}
              >
                {downloading === 'pdf' ? 'Gerando…' : 'Consolidar PDF'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th className={`px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px] ${className ?? ''}`}>
      {children}
    </th>
  );
}
