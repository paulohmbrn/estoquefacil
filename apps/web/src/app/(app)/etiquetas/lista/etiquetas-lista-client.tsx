'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export type ListaOption = {
  id: string;
  nome: string;
  produtos: Array<{ id: string; cdarvprod: string; nome: string; unidade: string }>;
};

type Metodo = 'CONGELADO' | 'RESFRIADO' | 'AMBIENTE';
type FormatoId =
  | 'TERMICA_60'
  | 'TERMICA_40'
  | 'A4_PIMACO'
  | 'ARGOX_100X60'
  | 'ARGOX_NETWORK'
  | 'ARGOX_CLOUD'
  | 'ZEBRA_48X40_DUPLA_CLOUD';

interface Props {
  listas: ListaOption[];
  initialListaId?: string;
  argoxBridgeUrl: string | null;
  argoxCloudReady: boolean;
}

export function EtiquetasListaClient({
  listas,
  initialListaId,
  argoxBridgeUrl,
  argoxCloudReady,
}: Props) {
  const initial = initialListaId && listas.some((l) => l.id === initialListaId)
    ? initialListaId
    : listas[0]?.id ?? null;
  const [listaId, setListaId] = useState<string | null>(initial);
  const [qtdPorProduto, setQtdPorProduto] = useState<number>(1);
  const [metodo, setMetodo] = useState<Metodo>('RESFRIADO');
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [showFormatoPicker, setShowFormatoPicker] = useState(false);

  const lista = listas.find((l) => l.id === listaId);
  const totalProdutos = lista?.produtos.length ?? 0;
  const totalEtiquetas = totalProdutos * qtdPorProduto;

  function gerarPdf(formato: FormatoId) {
    if (!lista || totalEtiquetas === 0) return;
    setErro(null);
    setShowFormatoPicker(false);

    const itens = lista.produtos.map((p) => ({
      produtoId: p.id, qtd: qtdPorProduto, metodo,
    }));

    // Caminho cloud: WebSocket via apps/api → agente local
    if (formato === 'ARGOX_CLOUD' || formato === 'ZEBRA_48X40_DUPLA_CLOUD') {
      const formatoBackend = formato === 'ZEBRA_48X40_DUPLA_CLOUD'
        ? 'ZEBRA_48X40_DUPLA'
        : 'ZEBRA_100X60_SIMPLES';
      startTransition(async () => {
        try {
          const res = await fetch('/api/etiquetas/imprimir-ws', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ formato: formatoBackend, itens }),
          });
          const j = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(j.error ?? `Erro ${res.status}`);
          alert(`✓ ${totalEtiquetas} etiqueta(s) enviadas pra impressora.`);
        } catch (e) {
          setErro((e as Error).message);
        }
      });
      return;
    }

    const enviarPraImpressora = formato === 'ARGOX_NETWORK';
    const formatoBackend = enviarPraImpressora ? 'ARGOX_100X60' : formato;

    startTransition(async () => {
      try {
        const res = await fetch('/api/etiquetas/lote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ formato: formatoBackend, itens }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Erro ${res.status}`);
        }

        if (enviarPraImpressora) {
          if (!argoxBridgeUrl) throw new Error('URL do agente Argox não cadastrada');
          const zpl = await res.text();
          const printRes = await fetch(`${argoxBridgeUrl.replace(/\/+$/, '')}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            body: zpl,
          });
          if (!printRes.ok) {
            const txt = await printRes.text().catch(() => '');
            throw new Error(`Agente respondeu ${printRes.status}: ${txt || 'erro'}`);
          }
          alert(`✓ ${totalEtiquetas} etiqueta(s) enviadas pra impressora.`);
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download =
          res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
          `etiquetas-lista.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } catch (e) {
        const msg = (e as Error).message;
        setErro(
          msg.includes('Failed to fetch') && enviarPraImpressora
            ? 'Não consegui falar com o agente Argox. Verifique se ele está rodando e acessível pela rede.'
            : msg,
        );
      }
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <Card>
        <CardHeader><CardTitle>Selecionar lista</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {listas.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setListaId(l.id)}
                className={
                  listaId === l.id
                    ? 'text-left bg-rm-green text-rm-cream rounded-xs p-3'
                    : 'text-left bg-white border border-hairline rounded-xs p-3 hover:border-rm-green'
                }
              >
                <p className="font-semibold text-[14px]">{l.nome}</p>
                <p
                  className={
                    listaId === l.id
                      ? 'text-[11px] uppercase tracking-[.14em] mt-1 opacity-80'
                      : 'text-[11px] uppercase tracking-[.14em] mt-1 text-rm-mid'
                  }
                >
                  {l.produtos.length} produtos
                </p>
              </button>
            ))}
          </div>

          {lista && (
            <div className="pt-3 border-t border-dashed border-hairline">
              <p className="rm-meta text-rm-mid mb-2">Produtos da lista ({lista.produtos.length})</p>
              <ul className="text-[12px] max-h-[280px] overflow-auto pr-2 divide-y divide-hairline">
                {lista.produtos.map((p) => (
                  <li key={p.id} className="py-1.5 flex justify-between gap-2">
                    <span className="truncate text-rm-ink-2">{p.nome}</span>
                    <Badge variant="neutral">{p.unidade}</Badge>
                  </li>
                ))}
                {lista.produtos.length === 0 && (
                  <li className="py-3 text-center text-rm-mid">Lista vazia.</li>
                )}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <aside>
        <Card className="sticky top-6">
          <CardHeader><CardTitle>Configurar lote</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Quantidade por produto">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="w-8 h-9 border border-hairline rounded-xs hover:bg-[rgba(0,65,37,.06)]"
                  onClick={() => setQtdPorProduto(Math.max(1, qtdPorProduto - 1))}
                >−</button>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={qtdPorProduto}
                  onChange={(e) => setQtdPorProduto(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className="w-16 text-center bg-white border border-hairline rounded-xs text-[14px] py-1.5"
                />
                <button
                  type="button"
                  className="w-8 h-9 border border-hairline rounded-xs hover:bg-[rgba(0,65,37,.06)]"
                  onClick={() => setQtdPorProduto(Math.min(50, qtdPorProduto + 1))}
                >+</button>
              </div>
            </Field>

            <Field label="Método">
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as Metodo)}
                className="w-full bg-white border border-hairline px-3 py-2 rounded-xs text-[13px]"
              >
                <option value="RESFRIADO">Resfriado</option>
                <option value="CONGELADO">Congelado</option>
                <option value="AMBIENTE">Ambiente</option>
              </select>
            </Field>

            <div className="pt-3 border-t border-dashed border-hairline space-y-1">
              <p className="rm-eyebrow text-rm-mid">Total de etiquetas</p>
              <p className="font-sans font-bold text-[28px] tabular-nums">{totalEtiquetas}</p>
              <p className="text-[11px] text-rm-mid">
                {totalProdutos} produtos × {qtdPorProduto} etiqueta{qtdPorProduto > 1 ? 's' : ''}
              </p>
            </div>

            {erro && <p className="text-rm-red text-[12px]">{erro}</p>}

            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={pending || !lista || totalEtiquetas === 0}
              onClick={() => setShowFormatoPicker(true)}
            >
              {pending ? 'Imprimindo…' : `Imprimir (${totalEtiquetas})`}
            </Button>
          </CardContent>
        </Card>
      </aside>

      {showFormatoPicker && (
        <div
          className="fixed inset-0 bg-[rgba(10,26,16,.55)] z-50 flex items-end sm:items-center justify-center p-3 sm:p-6"
          onClick={() => setShowFormatoPicker(false)}
        >
          <div
            className="bg-white rounded-xs shadow-lift w-full max-w-[500px] border-t-[6px] border-rm-green"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-hairline">
              <p className="rm-eyebrow text-rm-green">Escolha o formato</p>
              <h2 className="font-sans font-bold text-[20px] mt-2">{totalEtiquetas} etiquetas</h2>
            </div>
            <div className="p-3 space-y-2">
              {(() => {
                const opcoes: Array<{ id: FormatoId; titulo: string; sub: string; badge?: string }> = [
                  { id: 'TERMICA_60', titulo: 'Térmica 60×60mm', sub: 'Elgin L42 Pro · 1 etiqueta/página', badge: 'Padrão' },
                  { id: 'TERMICA_40', titulo: 'Térmica 40×40mm', sub: 'Elgin L42 Pro · compacta', badge: 'Compacta' },
                  { id: 'A4_PIMACO', titulo: 'A4 — PIMACO A4360', sub: '21/folha · 63,5 × 38,1mm', badge: 'Folha avulsa' },
                  ...(argoxCloudReady
                    ? [{ id: 'ARGOX_CLOUD' as const, titulo: 'Argox 100×60mm — Imprimir (cloud)', sub: 'Funciona em qualquer dispositivo via WebSocket', badge: 'Recomendado' }]
                    : []),
                  ...(argoxCloudReady
                    ? [{ id: 'ZEBRA_48X40_DUPLA_CLOUD' as const, titulo: 'Zebra 48×40mm dupla — Imprimir (cloud)', sub: 'Rolo Microline 48×40×02 (2 etiquetas por linha)', badge: 'FFB' }]
                    : []),
                  ...(argoxBridgeUrl
                    ? [{ id: 'ARGOX_NETWORK' as const, titulo: 'Argox 100×60mm — Imprimir (rede local)', sub: `Direto pra ${argoxBridgeUrl}`, badge: argoxCloudReady ? 'Local' : 'Recomendado' }]
                    : []),
                  { id: 'ARGOX_100X60', titulo: 'Argox 100×60mm — Baixar .zpl', sub: 'Fallback (envio manual)', badge: 'ZPL' },
                ];
                return opcoes.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={pending}
                    onClick={() => gerarPdf(o.id)}
                    className="w-full text-left bg-white border border-hairline rounded-xs p-4 hover:border-rm-green hover:bg-[rgba(0,65,37,.04)] disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-sans font-bold text-[14px]">{o.titulo}</p>
                        <p className="text-[11px] text-rm-mid mt-1">{o.sub}</p>
                      </div>
                      {o.badge && <Badge variant="neutral">{o.badge}</Badge>}
                    </div>
                  </button>
                ));
              })()}
            </div>
            <div className="p-3 border-t border-dashed border-strong flex justify-end">
              <Button type="button" variant="ghost" onClick={() => setShowFormatoPicker(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-2">
        {label}
      </span>
      {children}
    </label>
  );
}
