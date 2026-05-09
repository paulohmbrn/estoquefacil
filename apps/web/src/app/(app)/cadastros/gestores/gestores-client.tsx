'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  toggleSuperGestor,
  atribuirLoja,
  removerLoja,
  alterarPapel,
} from '@/app/_actions/gestores';

export interface GestorRow {
  id: string;
  name: string;
  email: string;
  superGestor: boolean;
  isMe: boolean;
  vinculos: Array<{
    id: string;
    lojaId: string;
    lojaApelido: string;
    lojaZmartbiId: string;
    papel: 'GESTOR' | 'OPERADOR';
    ativo: boolean;
  }>;
}

export interface LojaOpt {
  id: string;
  zmartbiId: string;
  apelido: string;
}

interface Props {
  users: GestorRow[];
  lojas: LojaOpt[];
}

export function GestoresClient({ users, lojas }: Props) {
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setErro(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setErro(r.error ?? 'Erro');
      else router.refresh();
    });
  }

  return (
    <div>
      {erro && (
        <div className="bg-rm-red/10 border-b border-rm-red text-rm-red px-4 py-3 text-[13px]">
          {erro}
        </div>
      )}

      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left bg-[#fafaf7] border-b border-hairline">
            <Th>Usuário</Th>
            <Th>E-mail</Th>
            <Th>Super Gestor</Th>
            <Th>Lojas vinculadas</Th>
            <Th className="text-right">Ações</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-hairline align-top">
              <td className="px-4 py-3">
                <p className="font-medium text-rm-ink">{u.name}</p>
                {u.isMe && <span className="text-[10px] uppercase tracking-[.18em] text-rm-mid">você</span>}
              </td>
              <td className="px-4 py-3 rm-mono text-[12px] text-rm-ink-2">{u.email}</td>
              <td className="px-4 py-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={u.superGestor}
                    disabled={pending || (u.isMe && u.superGestor)}
                    onChange={(e) =>
                      run(() => toggleSuperGestor({ userId: u.id, superGestor: e.target.checked }))
                    }
                  />
                  <span className="text-[12px]">
                    {u.superGestor ? <Badge variant="green">Super Gestor</Badge> : <span className="text-rm-mid">Gestor comum</span>}
                  </span>
                </label>
              </td>
              <td className="px-4 py-3">
                {u.superGestor ? (
                  <span className="text-[11px] italic text-rm-mid">Acesso a TODAS as lojas (Super Gestor)</span>
                ) : u.vinculos.length === 0 ? (
                  <span className="text-[11px] italic text-rm-mid">Nenhuma loja</span>
                ) : (
                  <ul className="space-y-1">
                    {u.vinculos.map((v) => (
                      <li key={v.id} className="flex items-center gap-2 text-[12px]">
                        <span className="rm-mono text-rm-mid">#{v.lojaZmartbiId}</span>
                        <span className="font-medium">{v.lojaApelido}</span>
                        <select
                          value={v.papel}
                          disabled={pending}
                          onChange={(e) =>
                            run(() =>
                              alterarPapel({
                                vinculoId: v.id,
                                papel: e.target.value as 'GESTOR' | 'OPERADOR',
                              }),
                            )
                          }
                          className="ml-1 px-2 py-[2px] border border-hairline rounded-xs text-[11px]"
                        >
                          <option value="GESTOR">Gestor</option>
                          <option value="OPERADOR">Operador</option>
                        </select>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (!confirm(`Remover acesso de ${u.name} à loja ${v.lojaApelido}?`)) return;
                            run(() => removerLoja({ vinculoId: v.id }));
                          }}
                          className="text-[11px] uppercase tracking-[.16em] text-rm-red hover:underline"
                        >
                          remover
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                {!u.superGestor && (
                  <AtribuirLojaInline
                    pending={pending}
                    lojas={lojas.filter((l) => !u.vinculos.some((v) => v.lojaId === l.id))}
                    onPick={(lojaId) =>
                      run(() => atribuirLoja({ userId: u.id, lojaId, papel: 'GESTOR' }))
                    }
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AtribuirLojaInline({
  pending,
  lojas,
  onPick,
}: {
  pending: boolean;
  lojas: LojaOpt[];
  onPick: (lojaId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (lojas.length === 0) {
    return <span className="text-[11px] italic text-rm-mid">todas atribuídas</span>;
  }
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setOpen(true)}>
        + atribuir loja
      </Button>
    );
  }
  return (
    <div className="inline-flex items-center gap-2">
      <select
        autoFocus
        disabled={pending}
        onChange={(e) => {
          if (e.target.value) {
            onPick(e.target.value);
            setOpen(false);
          }
        }}
        className="px-2 py-[3px] border border-hairline rounded-xs text-[12px]"
      >
        <option value="">— escolher —</option>
        {lojas.map((l) => (
          <option key={l.id} value={l.id}>
            #{l.zmartbiId} · {l.apelido}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[11px] uppercase tracking-[.16em] text-rm-mid hover:underline"
      >
        cancelar
      </button>
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
