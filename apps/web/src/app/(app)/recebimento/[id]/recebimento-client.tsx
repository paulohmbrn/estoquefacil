'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { QrScanner } from '@/app/(app)/contagem/[id]/qr-scanner';
import {
  identificarProdutoRecebimento,
  setItemQuantidade,
  finalizarRecebimento,
  cancelarRecebimento,
  processarNfComIa,
  aplicarMapeamentoFornecedor,
  type IaItemResultado,
} from '@/app/_actions/recebimento';

export type ItemRow = {
  produtoId: string;
  cdarvprod: string;
  nome: string;
  unidade: string;
  quantidade: string;
};

interface Props {
  recebimentoId: string;
  responsavelNome: string;
  fornecedor: string | null;
  numeroNf: string | null;
  iaConfigured: boolean;
  itens: ItemRow[];
}

type Toast = { kind: 'ok' | 'erro'; text: string } | null;

type QtyTarget = {
  produtoId: string;
  cdarvprod: string;
  nome: string;
  unidade: string;
  quantidadeAtual: string;
  descricaoNf?: string;
};

export function RecebimentoClient({
  recebimentoId,
  responsavelNome,
  fornecedor,
  numeroNf,
  iaConfigured,
  itens: initialItens,
}: Props) {
  const router = useRouter();
  const [itens, setItens] = useState<ItemRow[]>(initialItens);
  const [scannerOn, setScannerOn] = useState(true);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast>(null);
  const [qtyTarget, setQtyTarget] = useState<QtyTarget | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [showIa, setShowIa] = useState(false);

  function flash(t: NonNullable<Toast>, ms = 2200): void {
    setToast(t);
    setTimeout(() => setToast(null), ms);
  }

  function handleScan(text: string): void {
    if (qtyTarget) return;
    startTransition(async () => {
      const r = await identificarProdutoRecebimento(recebimentoId, text);
      if (r.ok && r.data) setQtyTarget(r.data);
      else if (!r.ok) flash({ kind: 'erro', text: r.error });
    });
  }

  function confirmarQty(valor: number): void {
    if (!qtyTarget) return;
    const t = qtyTarget;
    startTransition(async () => {
      const r = await setItemQuantidade(recebimentoId, t.produtoId, valor, t.descricaoNf);
      if (!r.ok) {
        flash({ kind: 'erro', text: r.error });
        return;
      }
      flash({ kind: 'ok', text: `${t.nome} → ${String(valor).replace('.', ',')} ${t.unidade}` });
      setItens((prev) => {
        if (valor <= 0) return prev.filter((i) => i.produtoId !== t.produtoId);
        const exists = prev.find((i) => i.produtoId === t.produtoId);
        if (exists) {
          return prev.map((i) =>
            i.produtoId === t.produtoId ? { ...i, quantidade: String(valor) } : i,
          );
        }
        return [
          {
            produtoId: t.produtoId,
            cdarvprod: t.cdarvprod,
            nome: t.nome,
            unidade: t.unidade,
            quantidade: String(valor),
          },
          ...prev,
        ];
      });
      setQtyTarget(null);
    });
  }

  function ajustarManual(produtoId: string, valor: number): void {
    startTransition(async () => {
      const r = await setItemQuantidade(recebimentoId, produtoId, valor);
      if (!r.ok) {
        flash({ kind: 'erro', text: r.error });
        return;
      }
      if (valor <= 0) {
        setItens((prev) => prev.filter((i) => i.produtoId !== produtoId));
      } else {
        setItens((prev) =>
          prev.map((i) =>
            i.produtoId === produtoId ? { ...i, quantidade: String(valor) } : i,
          ),
        );
      }
    });
  }

  function finalizar(): void {
    if (!confirm(`Finalizar recebimento com ${itens.length} item(s)?`)) return;
    startTransition(async () => {
      const r = await finalizarRecebimento(recebimentoId);
      if (r.ok) router.push(`/recebimento/${recebimentoId}/sucesso`);
      else flash({ kind: 'erro', text: r.error });
    });
  }

  function cancelar(): void {
    if (!confirm('Cancelar este recebimento?')) return;
    startTransition(async () => {
      const r = await cancelarRecebimento(recebimentoId);
      if (r.ok) router.push('/recebimento');
      else flash({ kind: 'erro', text: r.error });
    });
  }

  return (
    <div className="max-w-[680px] mx-auto pb-32">
      <header className="mb-3">
        <p className="rm-eyebrow">Recebimento em andamento</p>
        <h1 className="font-sans font-bold text-[22px] mt-1">{fornecedor ?? 'Sem fornecedor'}</h1>
        <p className="text-[12px] text-rm-mid mt-1">
          {numeroNf ? `NF ${numeroNf} · ` : ''}{responsavelNome}
        </p>
      </header>

      <div className="rounded-xs overflow-hidden border border-hairline mb-4">
        {scannerOn ? (
          <QrScanner onScan={handleScan} pause={pending || qtyTarget !== null} />
        ) : (
          <div className="bg-rm-ink text-rm-cream p-8 text-center text-[13px]">
            Câmera pausada
          </div>
        )}
        <div className="flex items-center justify-between bg-white border-t border-hairline px-3 py-2 gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={() => setScannerOn((v) => !v)}>
            {scannerOn ? 'Pausar câmera' : 'Ativar câmera'}
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" size="sm" onClick={() => setShowManual(true)}>
              Código manual
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowIa(true)}
            >
              📷 Foto da NF
            </Button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={
            toast.kind === 'ok'
              ? 'fixed left-3 right-3 bottom-24 bg-rm-green text-rm-cream px-4 py-3 rounded-xs shadow-lift z-40 text-[13px]'
              : 'fixed left-3 right-3 bottom-24 bg-rm-red text-rm-cream px-4 py-3 rounded-xs shadow-lift z-40 text-[13px]'
          }
        >
          {toast.text}
        </div>
      )}

      <section>
        <h2 className="rm-eyebrow mb-2">Recebidos ({itens.length})</h2>
        {itens.length === 0 ? (
          <Card className="p-6 text-center text-rm-mid text-[13px]">
            Bipa um QR, digita o código ou tira foto da NF para começar.
          </Card>
        ) : (
          <ul className="space-y-2">
            {itens.map((i) => (
              <ItemCard
                key={i.produtoId}
                row={i}
                onAjuste={(v) => ajustarManual(i.produtoId, v)}
              />
            ))}
          </ul>
        )}
      </section>

      <div
        className="fixed left-0 right-0 bottom-0 bg-white border-t border-hairline p-3 z-40 flex gap-3 shadow-[0_-4px_16px_rgba(10,26,16,.08)]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <Button variant="ghost" onClick={cancelar} disabled={pending}>Cancelar</Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          onClick={finalizar}
          disabled={pending || itens.length === 0}
        >
          Finalizar recebimento
        </Button>
      </div>

      {showManual && (
        <ManualModal
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
          pending={pending}
          onClose={() => setQtyTarget(null)}
          onSubmit={confirmarQty}
        />
      )}

      {showIa && (
        <IaModal
          recebimentoId={recebimentoId}
          fornecedor={fornecedor}
          iaConfigured={iaConfigured}
          onClose={() => setShowIa(false)}
          onItemConfirmed={(produtoId, quantidade, descricaoNf, info) => {
            setQtyTarget({
              produtoId,
              cdarvprod: info.cdarvprod,
              nome: info.nome,
              unidade: info.unidade,
              quantidadeAtual: '0',
              descricaoNf,
            });
            // Pré-preenche e abre modal já com a quantidade da IA
            // (o user revisa e confirma)
            void quantidade;
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// ItemCard — quantidade editável com formato BR (3 casas)
// ============================================================

function ItemCard({ row, onAjuste }: { row: ItemRow; onAjuste: (v: number) => void }) {
  const qtdNum = Number(row.quantidade);
  const formatBR = (n: number): string =>
    n.toLocaleString('pt-BR', { maximumFractionDigits: 3, minimumFractionDigits: 0 });
  const [draft, setDraft] = useState<string>(formatBR(qtdNum));

  useEffect(() => setDraft(formatBR(Number(row.quantidade))), [row.quantidade]);

  function sanitize(raw: string): string {
    let v = raw.replace(/[^\d,]/g, '');
    const fc = v.indexOf(',');
    if (fc >= 0) {
      v = v.slice(0, fc + 1) + v.slice(fc + 1).replace(/,/g, '');
      const [intp, decp = ''] = v.split(',');
      v = intp + ',' + decp.slice(0, 3);
    }
    if (v.length > 1 && v.startsWith('0') && !v.startsWith('0,')) v = v.replace(/^0+/, '') || '0';
    return v;
  }
  function commit(): void {
    const n = Number(draft.replace(',', '.'));
    if (Number.isFinite(n) && n >= 0) {
      const r = Math.round(n * 1000) / 1000;
      if (r !== qtdNum) onAjuste(r);
      setDraft(formatBR(r));
    } else {
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
        >−</button>
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(sanitize(e.target.value))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          className="w-20 text-center tabular-nums bg-white border border-hairline rounded-xs text-[13px] px-1 py-1 focus:outline-none focus:border-rm-green"
        />
        <span className="text-[10px] tracking-[.14em] uppercase text-rm-mid font-semibold ml-1 w-7 text-left">
          {row.unidade.toLowerCase()}
        </span>
        <button
          type="button"
          className="w-7 h-7 border border-hairline rounded-xs hover:bg-[rgba(0,65,37,.06)] ml-1"
          onClick={() => onAjuste(qtdNum + 1)}
        >+</button>
      </div>
    </li>
  );
}

// ============================================================
// QtyModal (mesmo do contagem)
// ============================================================

function QtyModal({
  target,
  pending,
  onClose,
  onSubmit,
}: {
  target: QtyTarget;
  pending: boolean;
  onClose: () => void;
  onSubmit: (v: number) => void;
}) {
  const initial = (() => {
    const n = Number(target.quantidadeAtual);
    if (!Number.isFinite(n) || n <= 0) return '';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  })();
  const [valor, setValor] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);

  function sanitize(raw: string): string {
    let v = raw.replace(/[^\d,]/g, '');
    const fc = v.indexOf(',');
    if (fc >= 0) {
      v = v.slice(0, fc + 1) + v.slice(fc + 1).replace(/,/g, '');
      const [intp, decp = ''] = v.split(',');
      v = intp + ',' + decp.slice(0, 3);
    }
    if (v.length > 1 && v.startsWith('0') && !v.startsWith('0,')) v = v.replace(/^0+/, '') || '0';
    return v;
  }
  const parsed = (() => {
    if (!valor.trim()) return null;
    const n = Number(valor.replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 1000) / 1000;
  })();

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
          <p className="rm-eyebrow text-rm-green">Recebido · informe a quantidade</p>
          <h2 className="font-sans font-bold text-[20px] mt-2 leading-tight">{target.nome}</h2>
          <p className="rm-mono text-[11px] text-rm-mid mt-1">
            {target.cdarvprod} · em {target.unidade}
          </p>
          {target.descricaoNf && (
            <p className="text-[11px] text-rm-mid mt-2">
              Da NF: <em className="text-rm-ink not-italic font-semibold">{target.descricaoNf}</em>
            </p>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed !== null) onSubmit(parsed);
          }}
          className="p-5 space-y-4"
        >
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
                className="flex-1 h-14 text-center text-[28px] font-bold tabular-nums bg-white border border-hairline rounded-xs focus:outline-none focus:border-rm-green focus:shadow-focus"
              />
              <span className="grid place-items-center px-3 bg-[#fafaf7] border border-hairline rounded-xs text-rm-mid text-[12px] tracking-[.16em] uppercase font-semibold min-w-[52px]">
                {target.unidade}
              </span>
            </div>
            <p className="text-[11px] text-rm-mid mt-2">Use vírgula. Até 3 casas decimais.</p>
          </label>
          <div className="flex gap-2 justify-end pt-3 border-t border-dashed border-strong">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={parsed === null || pending}>
              {pending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// ManualModal — digita CDARVPROD
// ============================================================

function ManualModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (c: string) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="fixed inset-0 bg-[rgba(10,26,16,.55)] z-50 flex items-center justify-center p-6" onClick={onClose}>
      <div
        className="bg-white rounded-xs shadow-lift max-w-[420px] w-full border-t-[6px] border-rm-green"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-hairline flex items-center justify-between">
          <h2 className="font-sans font-bold text-[18px]">Receber por código</h2>
          <button onClick={onClose} className="text-rm-mid text-2xl leading-none">×</button>
        </div>
        <form
          className="p-5 space-y-4"
          onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSubmit(v.trim()); }}
        >
          <Input
            inputMode="numeric"
            placeholder="CDARVPROD (13 dígitos)"
            value={v}
            onChange={(e) => setV(e.target.value)}
            autoFocus
            className="text-[16px]"
          />
          <div className="flex gap-3 justify-end pt-2 border-t border-dashed border-strong">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" variant="primary" disabled={!v.trim()}>Continuar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// IaModal — upload de foto + processamento + resolução manual
// ============================================================

function IaModal({
  recebimentoId,
  fornecedor,
  iaConfigured,
  onClose,
  onItemConfirmed,
}: {
  recebimentoId: string;
  fornecedor: string | null;
  iaConfigured: boolean;
  onClose: () => void;
  onItemConfirmed: (
    produtoId: string,
    quantidade: number,
    descricaoNf: string,
    info: { cdarvprod: string; nome: string; unidade: string },
  ) => void;
}) {
  const [imagem, setImagem] = useState<string | null>(null);
  const [items, setItems] = useState<IaItemResultado[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function handleFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => setImagem(String(reader.result));
    reader.readAsDataURL(file);
  }

  function processar(): void {
    if (!imagem) return;
    setErro(null);
    startTransition(async () => {
      const r = await processarNfComIa(recebimentoId, imagem);
      if (r.ok && r.data) {
        setItems(r.data.items);
      } else if (!r.ok) {
        if (r.error === 'AI_NOT_CONFIGURED') {
          setErro('IA não configurada. Adicione ANTHROPIC_API_KEY no servidor pra ativar.');
        } else {
          setErro(r.error);
        }
      }
    });
  }

  function aplicarItem(item: IaItemResultado): void {
    if (!item.produtoId || !item.produtoNome || !item.produtoUnidade) return;
    onItemConfirmed(
      item.produtoId,
      item.quantidade,
      item.descricaoNf,
      {
        cdarvprod: item.candidatos.find((c) => c.id === item.produtoId)?.cdarvprod ?? '',
        nome: item.produtoNome,
        unidade: item.produtoUnidade,
      },
    );
  }

  function selecionarManual(item: IaItemResultado, candidato: IaItemResultado['candidatos'][number]): void {
    if (fornecedor) {
      // Salva mapeamento pra próxima vez
      void aplicarMapeamentoFornecedor(recebimentoId, item.descricaoNf, candidato.id);
    }
    onItemConfirmed(
      candidato.id,
      item.quantidade,
      item.descricaoNf,
      { cdarvprod: candidato.cdarvprod, nome: candidato.nome, unidade: candidato.unidade },
    );
  }

  return (
    <div className="fixed inset-0 bg-[rgba(10,26,16,.6)] z-50 flex items-end sm:items-center justify-center p-3 sm:p-6" onClick={onClose}>
      <div
        className="bg-white rounded-xs shadow-lift w-full max-w-[640px] max-h-[90vh] overflow-auto border-t-[6px] border-rm-green"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-hairline flex items-center justify-between">
          <div>
            <p className="rm-eyebrow text-rm-green">Foto da NF · IA</p>
            <h2 className="font-sans font-bold text-[18px] mt-1">Receber por foto</h2>
          </div>
          <button onClick={onClose} className="text-rm-mid text-2xl leading-none">×</button>
        </div>

        {!iaConfigured && (
          <div className="m-5 p-3 border border-rm-gold bg-[#fdf7e3] text-rm-ink-2 rounded-xs text-[12px]">
            ⚙️ IA não está configurada neste servidor. Funciona quando <span className="rm-mono">ANTHROPIC_API_KEY</span> for setada — fala com o admin. Você pode usar foto de qualquer jeito mas vai precisar resolver tudo manualmente.
          </div>
        )}

        <div className="p-5 space-y-4">
          {!items && (
            <>
              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-2">
                  1. Tire ou escolha a foto da NF
                </span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                  className="block w-full text-[13px] file:mr-3 file:px-3 file:py-2 file:bg-rm-green file:text-rm-cream file:border-0 file:rounded-xs"
                />
              </label>

              {imagem && (
                <div className="space-y-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagem} alt="NF" className="w-full max-h-[400px] object-contain border border-hairline rounded-xs" />
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={processar}
                    disabled={pending || !iaConfigured}
                  >
                    {pending ? 'Processando…' : '2. Processar com IA'}
                  </Button>
                </div>
              )}

              {erro && <p className="text-rm-red text-[13px]">{erro}</p>}
            </>
          )}

          {items && (
            <div className="space-y-3">
              <p className="rm-eyebrow text-rm-green">{items.length} itens lidos da NF</p>
              {items.map((it, idx) => (
                <Card key={idx} className="p-3">
                  <p className="font-semibold text-[14px]">{it.descricaoNf}</p>
                  <p className="text-[11px] text-rm-mid mt-1">
                    Qtd: <strong>{it.quantidade}</strong>
                    {it.unidadeNf ? ` ${it.unidadeNf}` : ''}
                  </p>
                  {it.produtoId && it.produtoNome ? (
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div>
                        <Badge variant="green">Match: {it.produtoNome}</Badge>
                      </div>
                      <Button variant="primary" size="sm" onClick={() => aplicarItem(it)}>
                        Adicionar →
                      </Button>
                    </div>
                  ) : it.candidatos.length === 0 ? (
                    <p className="text-[11px] text-rm-red mt-2">
                      Nenhum candidato no catálogo. Tente código manual.
                    </p>
                  ) : (
                    <div className="mt-2">
                      <p className="text-[11px] text-rm-mid mb-2">Selecione qual produto da loja:</p>
                      <ul className="space-y-1">
                        {it.candidatos.map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => selecionarManual(it, c)}
                              className="w-full text-left text-[12px] px-3 py-2 border border-hairline rounded-xs hover:border-rm-green hover:bg-[rgba(0,65,37,.04)]"
                            >
                              <span className="font-medium">{c.nome}</span>
                              <span className="text-rm-mid"> · {c.unidade} · </span>
                              <span className="rm-mono text-[10px]">{c.cdarvprod}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-dashed border-strong flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}
