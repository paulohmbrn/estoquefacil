'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { startRecebimento } from '@/app/_actions/recebimento';

export type Funcionario = { id: string; nome: string; cargo: string | null };

export function IniciarRecebimentoClient({ funcionarios }: { funcionarios: Funcionario[] }) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function iniciar(formData: FormData) {
    if (!escolhido) return;
    startTransition(async () => {
      setErro(null);
      const r = await startRecebimento({
        responsavelId: escolhido,
        fornecedor: String(formData.get('fornecedor') ?? '') || undefined,
        numeroNf: String(formData.get('numeroNf') ?? '') || undefined,
        observacoes: String(formData.get('observacoes') ?? '') || undefined,
      });
      if (r.ok && r.data) router.push(`/recebimento/${r.data.id}`);
      else if (!r.ok) setErro(r.error);
    });
  }

  return (
    <form action={iniciar} className="space-y-5">
      <Field label="Fornecedor (opcional, mas necessário pra IA aprender)">
        <Input name="fornecedor" placeholder="ex: Frigorífico SLB" />
      </Field>
      <Field label="Número da NF">
        <Input name="numeroNf" placeholder="ex: 000.123.456" inputMode="numeric" />
      </Field>
      <Field label="Observações">
        <textarea
          name="observacoes"
          rows={2}
          className="w-full px-3 py-2 text-[13px] font-sans bg-white border border-hairline rounded-xs text-rm-ink placeholder:text-rm-mid focus:outline-none focus:border-rm-green"
        />
      </Field>

      <Field label="Responsável *">
        {funcionarios.length === 0 ? (
          <Card className="p-4 text-center text-rm-mid text-[13px]">
            Nenhum funcionário cadastrado nesta loja.
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {funcionarios.map((f) => {
              const initials = f.nome
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? '')
                .join('');
              const ativo = escolhido === f.id;
              return (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => setEscolhido(f.id)}
                  className={
                    ativo
                      ? 'bg-rm-green text-rm-cream border-2 border-rm-green rounded-xs p-3 text-left'
                      : 'bg-white border border-hairline rounded-xs p-3 text-left hover:border-rm-green'
                  }
                >
                  <div
                    className={
                      ativo
                        ? 'w-10 h-10 rounded-full bg-rm-cream text-rm-green grid place-items-center font-sans font-bold text-[14px] mb-2'
                        : 'w-10 h-10 rounded-full bg-rm-green text-rm-cream grid place-items-center font-sans font-bold text-[14px] mb-2'
                    }
                  >
                    {initials || '?'}
                  </div>
                  <p className="font-medium text-[13px]">{f.nome}</p>
                  {f.cargo && (
                    <p className={ativo ? 'text-[10px] uppercase tracking-[.16em] mt-1 opacity-80' : 'text-[10px] uppercase tracking-[.16em] mt-1 text-rm-mid'}>
                      {f.cargo}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Field>

      {erro && <p className="text-rm-red text-[13px]">{erro}</p>}

      <div className="flex justify-end gap-3 pt-3">
        <Button type="button" variant="ghost" onClick={() => history.back()}>Cancelar</Button>
        <Button type="submit" variant="primary" size="lg" disabled={!escolhido || pending}>
          {pending ? 'Iniciando…' : 'Iniciar recebimento →'}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-1">{label}</span>
      {children}
    </label>
  );
}
