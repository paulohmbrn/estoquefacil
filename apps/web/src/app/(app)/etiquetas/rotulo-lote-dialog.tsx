'use client';

// Modal mostrado antes de imprimir o rótulo industrializado 100×100mm.
// Coleta dados que mudam por lote (não ficam no cadastro do produto):
//   - número do lote
//   - data de fabricação (default = hoje)
//   - conteúdo líquido (sugere o padrão cadastrado no produto)
//
// Quando há mais de um produto selecionado, gerencia 1 set de campos por produto
// — porém pré-preenche todos com os mesmos defaults pra agilizar o operador.

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export interface RotuloLoteItem {
  produtoId: string;
  produtoNome: string;
  qtd: number;
  conteudoLiquidoPadrao: string | null;
}

export interface RotuloLoteValores {
  produtoId: string;
  qtd: number;
  lote: string;
  fabricacao: string;
  conteudoLiquido: string;
}

interface Props {
  itens: RotuloLoteItem[];
  pending: boolean;
  onClose: () => void;
  onConfirm: (valores: RotuloLoteValores[]) => void;
}

function todayBR(): string {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
  });
  return fmt.format(new Date());
}

export function RotuloLoteDialog({ itens, pending, onClose, onConfirm }: Props) {
  const today = todayBR();
  const [valores, setValores] = useState<RotuloLoteValores[]>(() =>
    itens.map((it) => ({
      produtoId: it.produtoId,
      qtd: it.qtd,
      lote: '01',
      fabricacao: today,
      conteudoLiquido: it.conteudoLiquidoPadrao ?? '',
    })),
  );

  function update(idx: number, patch: Partial<RotuloLoteValores>) {
    setValores((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  function aplicarPraTodos(field: 'lote' | 'fabricacao' | 'conteudoLiquido', value: string) {
    setValores((prev) => prev.map((v) => ({ ...v, [field]: value })));
  }

  const podeConfirmar = valores.every(
    (v) => v.lote.trim() && /^\d{2}\/\d{2}\/\d{4}$/.test(v.fabricacao) && v.conteudoLiquido.trim(),
  );

  return (
    <div
      className="fixed inset-0 bg-[rgba(10,26,16,.55)] z-50 flex items-end sm:items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xs shadow-lift w-full max-w-[640px] border-t-[6px] border-rm-green max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-hairline">
          <p className="rm-eyebrow text-rm-green">Dados do lote</p>
          <h2 className="font-sans font-bold text-[20px] mt-2 leading-tight">
            Rótulo regulamentado · {itens.length} produto{itens.length > 1 ? 's' : ''}
          </h2>
          <p className="text-[12px] text-rm-mid mt-1">
            Esses campos não ficam salvos no produto — são impressos só nesta tiragem.
          </p>
        </div>

        <div className="flex-1 overflow-auto p-5 space-y-4">
          {itens.length > 1 && (
            <div className="bg-[#fafaf7] border border-hairline rounded-xs p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid">
                Aplicar para todos
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="LOTE (ex: 01)"
                  onBlur={(e) => e.target.value && aplicarPraTodos('lote', e.target.value)}
                />
                <Input
                  placeholder="dd/mm/aaaa"
                  defaultValue={today}
                  onBlur={(e) => e.target.value && aplicarPraTodos('fabricacao', e.target.value)}
                />
                <Input
                  placeholder="Conteúdo (ex: 6 UNI)"
                  onBlur={(e) => e.target.value && aplicarPraTodos('conteudoLiquido', e.target.value)}
                />
              </div>
            </div>
          )}

          {itens.map((it, idx) => {
            const v = valores[idx]!;
            return (
              <div key={it.produtoId} className="border border-hairline rounded-xs p-3">
                <p className="font-semibold text-[14px] truncate text-rm-ink">{it.produtoNome}</p>
                <p className="text-[11px] text-rm-mid mb-3">
                  {it.qtd} etiqueta{it.qtd > 1 ? 's' : ''}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Field label="Lote">
                    <Input
                      value={v.lote}
                      onChange={(e) => update(idx, { lote: e.target.value })}
                      maxLength={20}
                    />
                  </Field>
                  <Field label="Fabricação (dd/mm/aaaa)">
                    <Input
                      value={v.fabricacao}
                      onChange={(e) => update(idx, { fabricacao: e.target.value })}
                      placeholder="dd/mm/aaaa"
                    />
                  </Field>
                  <Field label="Conteúdo líquido">
                    <Input
                      value={v.conteudoLiquido}
                      onChange={(e) => update(idx, { conteudoLiquido: e.target.value })}
                      placeholder="6 UNI"
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t border-strong border-dashed flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={pending || !podeConfirmar}
            onClick={() => onConfirm(valores)}
          >
            {pending ? 'Imprimindo…' : 'Imprimir rótulos'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
