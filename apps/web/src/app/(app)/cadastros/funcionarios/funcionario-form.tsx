'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createFuncionario } from '@/app/_actions/funcionarios';

interface Props {
  lojaId: string;
  onClose: () => void;
}

export function FuncionarioForm({ lojaId, onClose }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [permissao, setPermissao] = useState<'SEM_LOGIN' | 'COM_LOGIN' | 'GESTOR'>('SEM_LOGIN');
  const router = useRouter();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set('lojaId', lojaId);
        startTransition(async () => {
          setError(null);
          const r = await createFuncionario(fd);
          if (r.ok) {
            router.refresh();
            onClose();
          } else {
            setError(r.error);
          }
        });
      }}
      className="space-y-5"
    >
      <Field label="Nome completo *">
        <Input name="nome" required autoFocus />
      </Field>

      <Field label="Cargo / função">
        <Input name="cargo" placeholder="Cozinheiro, Gerente, Pizzaiolo…" />
      </Field>

      <Field label="Telefone">
        <Input name="telefone" placeholder="(84) 9 0000-0000" />
      </Field>

      <Field label="Tipo de acesso *">
        <div className="grid grid-cols-3 gap-2">
          {(['SEM_LOGIN', 'COM_LOGIN', 'GESTOR'] as const).map((p) => (
            <label
              key={p}
              className={
                permissao === p
                  ? 'border border-rm-green bg-[rgba(0,65,37,.06)] text-rm-green text-[12px] font-semibold uppercase tracking-[.14em] px-3 py-2 rounded-xs cursor-pointer text-center'
                  : 'border border-hairline text-rm-ink-2 text-[12px] font-semibold uppercase tracking-[.14em] px-3 py-2 rounded-xs cursor-pointer text-center hover:border-rm-green hover:text-rm-green'
              }
            >
              <input
                type="radio"
                name="permissao"
                value={p}
                checked={permissao === p}
                onChange={() => setPermissao(p)}
                className="sr-only"
              />
              {p === 'SEM_LOGIN' ? 'Sem login' : p === 'COM_LOGIN' ? 'Com login' : 'Gestor'}
            </label>
          ))}
        </div>
      </Field>

      {permissao !== 'SEM_LOGIN' && (
        <Field label="E-mail Google (obrigatório para login)">
          <Input
            name="email"
            type="email"
            placeholder="nome@reismagos.com.br"
            required
          />
        </Field>
      )}

      {error && <p className="text-rm-red text-[13px]">{error}</p>}

      <div className="flex gap-3 justify-end pt-3 border-t border-dashed border-strong">
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Salvando…' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
