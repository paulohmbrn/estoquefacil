'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { upsertProdutoMeta } from '@/app/_actions/produto-meta';

type Metodo = 'congelado' | 'resfriado' | 'ambiente';

export interface ProdutoMetaFormProps {
  produtoId: string;
  initial: {
    fotoUrl: string;
    validadeResfriado: number | null;
    validadeCongelado: number | null;
    validadeAmbiente: number | null;
    metodos: Metodo[];
    observacoes: string;
  };
}

export function ProdutoMetaForm({ produtoId, initial }: ProdutoMetaFormProps) {
  const [pending, startTransition] = useTransition();
  const [metodos, setMetodos] = useState<Set<Metodo>>(new Set(initial.metodos));
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function toggle(m: Metodo) {
    setMetodos((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setOkMsg(null);
        setErro(null);
        const fd = new FormData(e.currentTarget);
        const payload = {
          produtoId,
          fotoUrl: (fd.get('fotoUrl') as string) || null,
          validadeResfriado: parseNumeric(fd.get('validadeResfriado')),
          validadeCongelado: parseNumeric(fd.get('validadeCongelado')),
          validadeAmbiente: parseNumeric(fd.get('validadeAmbiente')),
          metodos: [...metodos],
          observacoes: (fd.get('observacoes') as string) || null,
        };
        startTransition(async () => {
          const r = await upsertProdutoMeta(payload);
          if (r.ok) {
            setOkMsg('Salvo.');
            router.refresh();
          } else {
            setErro(r.error);
          }
        });
      }}
      className="space-y-4"
    >
      <Field label="Foto (URL)">
        <Input name="fotoUrl" type="url" defaultValue={initial.fotoUrl} placeholder="https://…" />
      </Field>

      <fieldset>
        <legend className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-2">
          Métodos disponíveis
        </legend>
        <div className="grid grid-cols-3 gap-2">
          {(['congelado', 'resfriado', 'ambiente'] as Metodo[]).map((m) => {
            const on = metodos.has(m);
            return (
              <button
                type="button"
                key={m}
                onClick={() => toggle(m)}
                className={
                  on
                    ? 'border border-rm-green bg-[rgba(0,65,37,.06)] text-rm-green text-[12px] font-semibold uppercase tracking-[.14em] px-3 py-2 rounded-xs'
                    : 'border border-hairline text-rm-ink-2 text-[12px] font-semibold uppercase tracking-[.14em] px-3 py-2 rounded-xs hover:border-rm-green hover:text-rm-green'
                }
              >
                {m}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-3 gap-3">
        <Field label="Val. resfriado (dias)">
          <Input name="validadeResfriado" type="number" min={0} max={365} defaultValue={initial.validadeResfriado ?? ''} />
        </Field>
        <Field label="Val. congelado (dias)">
          <Input name="validadeCongelado" type="number" min={0} max={365} defaultValue={initial.validadeCongelado ?? ''} />
        </Field>
        <Field label="Val. ambiente (dias)">
          <Input name="validadeAmbiente" type="number" min={0} max={365} defaultValue={initial.validadeAmbiente ?? ''} />
        </Field>
      </div>

      <Field label="Observações">
        <textarea
          name="observacoes"
          defaultValue={initial.observacoes}
          rows={3}
          className="w-full px-3 py-2 text-[13px] font-sans bg-white border border-hairline rounded-xs text-rm-ink placeholder:text-rm-mid focus:outline-none focus:border-rm-green focus:shadow-focus"
        />
      </Field>

      {okMsg && <p className="text-rm-green text-[12px]">{okMsg}</p>}
      {erro && <p className="text-rm-red text-[12px]">{erro}</p>}

      <div className="flex justify-end pt-2">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar metadados'}
        </Button>
      </div>
    </form>
  );
}

function parseNumeric(v: FormDataEntryValue | null): number | null {
  if (v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-1">{label}</span>
      {children}
    </label>
  );
}
