'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { QrScanner } from './qr-scanner';
import {
  identificarProdutoPorScan,
  setQuantidade,
  removeLancamento,
  finalizarContagem,
  cancelarContagem,
} from '@/app/_actions/contagem';

export type ProdutoLista = {
  id: string;
  cdarvprod: string;
  nome: string;
  unidade: string;
};

export type LancamentoRow = {
  produtoId: string;
  cdarvprod: string;
  nome: string;
  unidade: string;
  quantidade: string;
};

interface Props {
  contagemId: string;
  responsavelNome: string;
  listaNome: string | null;
  produtosListaPendentes: ProdutoLista[];
  lancamentos: LancamentoRow[];
}

type Toast = { kind: 'ok' | 'erro' | 'info'; text: string } | null;

export function ContagemClient({
  contagemId,
  responsavelNome,
  listaNome,
  produtosListaPendentes,
  lancamentos: initialLancamentos,
}: Props) {
  const router = useRouter();
  const [lancamentos, setLancamentos] = useState(initialLancamentos);
  const [pendentes, setPendentes] = useState(produtosListaPendentes);
  const [scannerOn, setScannerOn] = useState(true);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast>(null);
  const [showManual, setShowManual] = useState(false);

  // Modal de quantidade — abre toda vez que um QR de produto é identificado
  type QtyTarget = {
    produtoId: string;
    cdarvprod: string;
    nome: string;
    unidade: string;
    quantidadeAtual: string;
  };
  const [qtyTarget, setQtyTarget] = useState<QtyTarget | null>(null);

  function flash(t: NonNullable<Toast>, ms = 2200) {
    setToast(t);
    setTimeout(() => setToast(null), ms);
  }

  function handleScan(text: string) {
    // Se já tem modal aberto, ignora bipes adicionais (evita conflito)
    if (qtyTarget) return;
    startTransition(async () => {
      const r = await identificarProdutoPorScan(contagemId, text);
      if (r.ok && r.data) {
        setQtyTarget(r.data);
      } else if (!r.ok) {
        flash({ kind: 'erro', text: r.error });
      }
    });
  }

  function confirmarQty(valor: number) {
    if (!qtyTarget) return;
    const target = qtyTarget;
    startTransition(async () => {
      const r = await setQuantidade({ contagemId, produtoId: target.produtoId, quantidade: valor });
      if (!r.ok) {
        flash({ kind: 'erro', text: r.error });
        return;
      }
      const novaQtd = String(valor);
      flash({
        kind: 'ok',
        text: `${target.nome} → ${novaQtd.replace('.', ',')} ${target.unidade}`,
      });
      setLancamentos((prev) => {
        const existing = prev.find((l) => l.produtoId === target.produtoId);
        if (valor <= 0) return prev.filter((l) => l.produtoId !== target.produtoId);
        if (existing) {
          return prev.map((l) =>
            l.produtoId === target.produtoId ? { ...l, quantidade: novaQtd } : l,
          );
        }
        return [
          ...prev,
          {
            produtoId: target.produtoId,
            cdarvprod: target.cdarvprod,
            nome: target.nome,
            unidade: target.unidade,
            quantidade: novaQtd,
          },
        ];
      });
      setPendentes((prev) => prev.filter((p) => p.id !== target.produtoId));
      setQtyTarget(null);
    });
  }

  function ajustarManual(produtoId: string, valor: number) {
    startTransition(async () => {
      const r = await setQuantidade({ contagemId, produtoId, quantidade: valor });
      if (r.ok) {
        if (valor === 0) {
          setLancamentos((prev) => prev.filter((l) => l.produtoId !== produtoId));
        } else {
          setLancamentos((prev) =>
            prev.map((l) =>
              l.produtoId === produtoId ? { ...l, quantidade: String(valor) } : l,
            ),
          );
        }
      } else {
        flash({ kind: 'erro', text: r.error });
      }
    });
  }

  function remover(produtoId: string) {
    startTransition(async () => {
      const r = await removeLancamento(contagemId, produtoId);
      if (r.ok) {
        setLancamentos((prev) => prev.filter((l) => l.produtoId !== produtoId));
      } else {
        flash({ kind: 'erro', text: r.error });
      }
    });
  }

  function finalizar() {
    if (!confirm(`Finalizar contagem com ${lancamentos.length} produtos contados?`)) return;
    setScannerOn(false);
    startTransition(async () => {
      const r = await finalizarContagem(contagemId);
      if (r.ok) router.replace(`/contagem/${contagemId}/sucesso`);
      else flash({ kind: 'erro', text: r.error });
    });
  }

  function cancelar() {
    if (!confirm('Descartar esta contagem? Os lançamentos serão preservados, mas marcada como cancelada.')) return;
    // Pausa a câmera ANTES de chamar a action — evita o cleanup do scanner
    // disparar enquanto a navegação acontece (rebenta o html5-qrcode em algumas builds).
    setScannerOn(false);
    startTransition(async () => {
      const r = await cancelarContagem(contagemId);
      if (r.ok) {
        // replace (não push) — não deixa "voltar" pra contagem cancelada via history.
        router.replace('/contagem');
      } else {
        flash({ kind: 'erro', text: r.error });
      }
    });
  }

  return (
    <div className="max-w-[680px] mx-auto pb-36">
      <header className="mb-4">
        <p className="rm-eyebrow">Em andamento</p>
        <h1 className="rm-h2 mt-1">{listaNome ?? 'Contagem livre'}</h1>
        <p className="text-[13px] text-rm-mid mt-1">
          Responsável: <strong className="text-rm-ink">{responsavelNome}</strong>
        </p>
      </header>

      <div className="rounded-xs overflow-hidden border border-hairline mb-4">
        {scannerOn ? <QrScanner onScan={handleScan} pause={pending || qtyTarget !== null} /> : (
          <div className="bg-rm-ink text-rm-cream p-8 text-center text-[13px]">
            Câmera pausada
          </div>
        )}
        <div className="flex items-center justify-between bg-white border-t border-hairline px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setScannerOn((v) => !v)}
          >
            {scannerOn ? 'Pausar câmera' : 'Ativar câmera'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowManual(true)}>
            Contar por código manual
          </Button>
        </div>
      </div>

      {toast && (
        <div
          className={
            toast.kind === 'ok'
              ? 'fixed left-3 right-3 bottom-20 bg-rm-green text-rm-cream px-4 py-3 rounded-xs shadow-lift z-40 text-[13px]'
              : 'fixed left-3 right-3 bottom-20 bg-rm-red text-rm-cream px-4 py-3 rounded-xs shadow-lift z-40 text-[13px]'
          }
        >
          {toast.text}
        </div>
      )}

      <section>
        <h2 className="rm-eyebrow mb-2">Contados ({lancamentos.length})</h2>
        {lancamentos.length === 0 ? (
          <Card className="p-6 text-center text-rm-mid text-[13px]">
            Bipa o QR da etiqueta, o código de barras do produto, ou digita o código pra começar.
          </Card>
        ) : (
          <ul className="space-y-2">
            {lancamentos.map((l) => (
              <LancamentoCard
                key={l.produtoId}
                row={l}
                onAjuste={(v) => ajustarManual(l.produtoId, v)}
                onRemove={() => remover(l.produtoId)}
              />
            ))}
          </ul>
        )}
      </section>

      {pendentes.length > 0 && (
        <section className="mt-6">
          <h2 className="rm-eyebrow mb-2">Da lista — pendentes ({pendentes.length})</h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-hairline">
              {pendentes.slice(0, 30).map((p) => (
                <li key={p.id} className="px-4 py-2 text-[13px] flex justify-between items-center">
                  <span className="truncate pr-2">{p.nome}</span>
                  <Badge variant="neutral">{p.unidade}</Badge>
                </li>
              ))}
              {pendentes.length > 30 && (
                <li className="px-4 py-2 text-rm-mid text-[12px] text-center">
                  + {pendentes.length - 30} pendentes
                </li>
              )}
            </ul>
          </Card>
        </section>
      )}

      {(() => {
        const temLista = listaNome !== null;
        const totalLista = temLista ? lancamentos.length + pendentes.length : 0;
        const faltam = temLista ? pendentes.length : 0;
        const bloqueado = pending || lancamentos.length === 0 || (temLista && faltam > 0);
        return (
          <div
            className="fixed left-0 right-0 bottom-0 bg-white border-t border-hairline p-3 z-40 space-y-2 shadow-[0_-4px_16px_rgba(10,26,16,.08)]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
          >
            {temLista && (
              <div className="flex items-center justify-between text-[11px] tracking-[.14em] uppercase font-semibold">
                <span className={faltam > 0 ? 'text-rm-gold' : 'text-rm-green'}>
                  {faltam > 0
                    ? `Faltam ${faltam} de ${totalLista} itens`
                    : `Lista completa · ${totalLista} itens`}
                </span>
                <span className="text-rm-mid">{lancamentos.length}/{totalLista}</span>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="ghost" onClick={cancelar} disabled={pending}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="lg"
                className="flex-1"
                onClick={finalizar}
                disabled={bloqueado}
                title={
                  temLista && faltam > 0
                    ? `Conte os ${faltam} itens restantes da lista para finalizar`
                    : undefined
                }
              >
                {temLista && faltam > 0
                  ? `Faltam ${faltam} itens`
                  : 'Finalizar contagem'}
              </Button>
            </div>
          </div>
        );
      })()}

      {showManual && (
        <ManualScanModal
          onClose={() => setShowManual(false)}
          onSubmit={(code) => {
            setShowManual(false);
            handleScan(code);
          }}
        />
      )}

      {qtyTarget && (
        <QtyModal
          target={qtyTarget}
          onClose={() => setQtyTarget(null)}
          onSubmit={confirmarQty}
          pending={pending}
        />
      )}
    </div>
  );
}

function QtyModal({
  target,
  onClose,
  onSubmit,
  pending,
}: {
  target: { nome: string; cdarvprod: string; unidade: string; quantidadeAtual: string };
  onClose: () => void;
  onSubmit: (valor: number) => void;
  pending: boolean;
}) {
  // Input mascarado: aceita dígitos + 1 vírgula + até 3 casas decimais.
  // Default: quantidade atual (se >0) ou vazio. Auto-foca + seleciona tudo.
  const initial = (() => {
    const n = Number(target.quantidadeAtual);
    if (!Number.isFinite(n) || n <= 0) return '';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 3, minimumFractionDigits: 0 });
  })();
  const [valor, setValor] = useState<string>(initial);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function sanitize(raw: string): string {
    // Mantém apenas dígitos e UMA vírgula; max 3 casas após vírgula
    let v = raw.replace(/[^\d,]/g, '');
    const firstComma = v.indexOf(',');
    if (firstComma >= 0) {
      v = v.slice(0, firstComma + 1) + v.slice(firstComma + 1).replace(/,/g, '');
      const [intp, decp = ''] = v.split(',');
      v = intp + ',' + decp.slice(0, 3);
    }
    // Remove zeros à esquerda redundantes (mas mantém "0," e "0")
    if (v.length > 1 && v.startsWith('0') && !v.startsWith('0,')) v = v.replace(/^0+/, '') || '0';
    return v;
  }

  function parseValor(): number | null {
    if (!valor.trim()) return null;
    const n = Number(valor.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 1000) / 1000;
  }

  const parsed = parseValor();
  const podeSalvar = parsed !== null;

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!podeSalvar) return;
    onSubmit(parsed!);
  }

  return (
    <div
      className="fixed inset-0 bg-[rgba(10,26,16,.55)] z-50 flex items-end sm:items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xs shadow-lift w-full max-w-[420px] border-t-[6px] border-rm-green"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-hairline">
          <p className="rm-eyebrow text-rm-green">Bipou · informe a quantidade</p>
          <h2 className="font-sans font-bold text-[20px] mt-2 leading-tight">{target.nome}</h2>
          <p className="rm-mono text-[11px] text-rm-mid mt-1">
            {target.cdarvprod} · em {target.unidade}
          </p>
          {Number(target.quantidadeAtual) > 0 && (
            <p className="text-[12px] text-rm-mid mt-2">
              Já tinha:{' '}
              <strong className="text-rm-ink">
                {Number(target.quantidadeAtual).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {target.unidade}
              </strong>{' '}
              (será substituído).
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-2">
              Quantidade ({target.unidade})
            </span>
            <div className="flex items-stretch gap-2">
              <input
                ref={inputRef}
                type="text"
                inputMode="decimal"
                placeholder="0,000"
                value={valor}
                onChange={(e) => setValor(sanitize(e.target.value))}
                className="flex-1 h-14 text-center text-[28px] font-bold tabular-nums bg-white border border-hairline rounded-xs text-rm-ink focus:outline-none focus:border-rm-green focus:shadow-focus"
              />
              <span className="grid place-items-center px-3 bg-[#fafaf7] border border-hairline rounded-xs text-rm-mid text-[12px] tracking-[.16em] uppercase font-semibold min-w-[52px]">
                {target.unidade}
              </span>
            </div>
            <p className="text-[11px] text-rm-mid mt-2">Use vírgula. Até 3 casas decimais (ex: 3,456).</p>
          </label>

          <div className="flex gap-2 justify-end pt-3 border-t border-dashed border-strong">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={!podeSalvar || pending}>
              {pending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LancamentoCard({
  row,
  onAjuste,
  onRemove,
}: {
  row: LancamentoRow;
  onAjuste: (v: number) => void;
  onRemove: () => void;
}) {
  const qtdNum = Number(row.quantidade);
  // Estado local pra exibir formato brasileiro com vírgula até 3 casas.
  // O commit (chama onAjuste) acontece no blur ou Enter — não a cada tecla.
  const formatBR = (n: number): string =>
    n.toLocaleString('pt-BR', {
      maximumFractionDigits: 3,
      minimumFractionDigits: 0,
    });
  const [draft, setDraft] = useState<string>(formatBR(qtdNum));

  // Sincroniza quando a prop muda externamente (após bipe, ±, etc)
  useEffect(() => {
    setDraft(formatBR(Number(row.quantidade)));
  }, [row.quantidade]);

  function sanitize(raw: string): string {
    let v = raw.replace(/[^\d,]/g, '');
    const firstComma = v.indexOf(',');
    if (firstComma >= 0) {
      v = v.slice(0, firstComma + 1) + v.slice(firstComma + 1).replace(/,/g, '');
      const [intp, decp = ''] = v.split(',');
      v = intp + ',' + decp.slice(0, 3);
    }
    if (v.length > 1 && v.startsWith('0') && !v.startsWith('0,')) v = v.replace(/^0+/, '') || '0';
    return v;
  }

  function commit(): void {
    const n = Number(draft.replace(',', '.'));
    if (Number.isFinite(n) && n >= 0) {
      const rounded = Math.round(n * 1000) / 1000;
      if (rounded !== qtdNum) onAjuste(rounded);
      setDraft(formatBR(rounded));
    } else {
      // Inválido: volta ao valor anterior
      setDraft(formatBR(qtdNum));
    }
  }

  return (
    <li className="bg-white border border-hairline rounded-xs px-3 py-2 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-[13px] truncate">{row.nome}</p>
        <p className="text-[10px] tracking-[.14em] uppercase text-rm-mid">
          {row.cdarvprod} · {row.unidade}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="w-7 h-7 border border-hairline rounded-xs hover:bg-[rgba(0,65,37,.06)]"
          onClick={() => onAjuste(Math.max(0, qtdNum - 1))}
        >
          −
        </button>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(sanitize(e.target.value))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="0,000"
          className="w-20 text-center tabular-nums bg-white border border-hairline rounded-xs text-[13px] px-1 py-1 focus:outline-none focus:border-rm-green"
        />
        <span className="text-[10px] tracking-[.14em] uppercase text-rm-mid font-semibold ml-1 w-7 text-left">
          {row.unidade.toLowerCase()}
        </span>
        <button
          type="button"
          className="w-7 h-7 border border-hairline rounded-xs hover:bg-[rgba(0,65,37,.06)] ml-1"
          onClick={() => onAjuste(qtdNum + 1)}
        >
          +
        </button>
      </div>
      <button
        type="button"
        className="text-rm-mid hover:text-rm-red text-[16px] px-2"
        onClick={onRemove}
        aria-label="Remover"
      >
        ×
      </button>
    </li>
  );
}

function ManualScanModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (code: string) => void;
}) {
  const [v, setV] = useState('');
  return (
    <div
      className="fixed inset-0 bg-[rgba(10,26,16,.5)] z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xs shadow-lift max-w-[420px] w-full border-t-[6px] border-rm-green"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-hairline flex items-center justify-between">
          <h2 className="rm-h4">Contar por código</h2>
          <button onClick={onClose} className="text-rm-mid text-2xl leading-none">×</button>
        </div>
        <form
          className="p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (v.trim()) onSubmit(v.trim());
          }}
        >
          <Input
            inputMode="numeric"
            placeholder="CDARVPROD, código de barras, ou URL do QR"
            value={v}
            onChange={(e) => setV(e.target.value)}
            autoFocus
            className="text-[16px]"
          />
          <p className="text-[11px] text-rm-mid">
            Cada submit conta como +1. Use os botões na lista pra ajustar a quantidade.
          </p>
          <div className="flex gap-3 justify-end pt-2 border-t border-dashed border-strong">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={!v.trim()}>+1</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
