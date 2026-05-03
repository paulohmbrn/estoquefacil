'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FuncionarioForm } from './funcionario-form';
import { toggleFuncionarioAtivo } from '@/app/_actions/funcionarios';

export type FuncionarioRow = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  permissao: 'SEM_LOGIN' | 'COM_LOGIN' | 'GESTOR';
  ativo: boolean;
  userId: string | null;
};

interface Props {
  funcionarios: FuncionarioRow[];
  lojaId: string;
  isGestor: boolean;
}

const PERM_LABEL: Record<FuncionarioRow['permissao'], { label: string; variant: 'green' | 'gold' | 'neutral' }> = {
  SEM_LOGIN: { label: 'Sem login', variant: 'neutral' },
  COM_LOGIN: { label: 'Com login', variant: 'green' },
  GESTOR:    { label: 'Gestor',    variant: 'gold' },
};

export function FuncionariosClient({ funcionarios, lojaId, isGestor }: Props) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      {isGestor && (
        <div className="flex justify-end mb-5">
          <Button variant="primary" onClick={() => setShowForm(true)}>
            + Cadastrar funcionário
          </Button>
        </div>
      )}

      <Card className="overflow-hidden overflow-x-auto">
        {funcionarios.length === 0 ? (
          <div className="p-12 text-center text-rm-mid">
            Nenhum funcionário cadastrado nesta loja ainda.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left border-b border-hairline bg-[#fafaf7]">
                <Th>Nome</Th>
                <Th>Cargo</Th>
                <Th>E-mail / Login</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {funcionarios.map((f) => (
                <tr
                  key={f.id}
                  className={
                    f.ativo
                      ? 'border-b border-hairline hover:bg-[rgba(0,65,37,.03)]'
                      : 'border-b border-hairline opacity-50'
                  }
                >
                  <td className="px-4 py-3 font-medium text-rm-ink">
                    {f.nome}
                    {!f.ativo && (
                      <span className="ml-2 text-[10px] text-rm-mid uppercase tracking-[.16em]">inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-rm-mid">{f.cargo ?? '—'}</td>
                  <td className="px-4 py-3 rm-mono text-[11.5px] text-rm-ink-2">{f.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={PERM_LABEL[f.permissao].variant}>{PERM_LABEL[f.permissao].label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isGestor && (
                      <ToggleButton id={f.id} ativo={f.ativo} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {showForm && (
        <Modal onClose={() => setShowForm(false)} title="Novo funcionário">
          <FuncionarioForm lojaId={lojaId} onClose={() => setShowForm(false)} />
        </Modal>
      )}
    </>
  );
}

function ToggleButton({ id, ativo }: { id: string; ativo: boolean }) {
  return (
    <form
      action={async () => {
        await toggleFuncionarioAtivo(id);
      }}
      className="inline"
    >
      <button
        type="submit"
        className="text-[11px] uppercase tracking-[.16em] font-semibold text-rm-mid hover:text-rm-red transition-colors"
      >
        {ativo ? 'Desativar' : 'Reativar'}
      </button>
    </form>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th className={`px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px] ${className ?? ''}`}>
      {children}
    </th>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 bg-[rgba(10,26,16,.5)] flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xs shadow-lift max-w-[520px] w-full max-h-[90vh] overflow-auto border-t-[6px] border-rm-green"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-hairline flex items-center justify-between">
          <h2 className="rm-h3">{title}</h2>
          <button onClick={onClose} className="text-rm-mid text-2xl leading-none hover:text-rm-ink">×</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
