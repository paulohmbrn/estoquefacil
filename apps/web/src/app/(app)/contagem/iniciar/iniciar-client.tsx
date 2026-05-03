'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { startContagem } from '@/app/_actions/contagem';

export type Funcionario = {
  id: string;
  nome: string;
  cargo: string | null;
};

interface Props {
  funcionarios: Funcionario[];
  listaId: string | null;
  listaNome: string | null;
}

export function IniciarClient({ funcionarios, listaId, listaNome }: Props) {
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();

  function iniciar() {
    if (!escolhido) return;
    setErro(null);
    startTransition(async () => {
      const r = await startContagem({ responsavelId: escolhido, listaId });
      if (r.ok && r.data) {
        router.push(`/contagem/${r.data.id}`);
      } else if (!r.ok) {
        setErro(r.error);
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-rm-mid text-[14px]">
        {listaNome ? (
          <>Lista: <strong className="text-rm-ink">{listaNome}</strong></>
        ) : (
          'Contagem livre — você poderá bipar qualquer produto.'
        )}
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
              key={f.id}
              type="button"
              onClick={() => setEscolhido(f.id)}
              className={
                ativo
                  ? 'bg-rm-green text-rm-cream border-2 border-rm-green rounded-xs p-4 text-left transition-all'
                  : 'bg-white border border-hairline rounded-xs p-4 text-left hover:border-rm-green transition-colors'
              }
            >
              <div
                className={
                  ativo
                    ? 'w-12 h-12 rounded-full bg-rm-cream text-rm-green grid place-items-center font-sans font-bold text-[18px] mb-3'
                    : 'w-12 h-12 rounded-full bg-rm-green text-rm-cream grid place-items-center font-sans font-bold text-[18px] mb-3'
                }
              >
                {initials || '?'}
              </div>
              <p className="font-semibold text-[14px]">{f.nome}</p>
              {f.cargo && (
                <p className={ativo ? 'text-[10px] uppercase tracking-[.16em] mt-1 opacity-80' : 'text-[10px] uppercase tracking-[.16em] mt-1 text-rm-mid'}>
                  {f.cargo}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {funcionarios.length === 0 && (
        <Card className="p-6 text-center text-rm-mid">
          Nenhum funcionário cadastrado nesta loja. Cadastre em{' '}
          <Link className="rm-link" href="/cadastros/funcionarios">Cadastros → Funcionários</Link>.
        </Card>
      )}

      {erro && <p className="text-rm-red text-[13px]">{erro}</p>}

      <div className="flex justify-end gap-3 pt-3">
        <Button variant="ghost" onClick={() => history.back()}>Cancelar</Button>
        <Button
          variant="primary"
          size="lg"
          disabled={!escolhido || pending}
          onClick={iniciar}
        >
          {pending ? 'Iniciando…' : 'Iniciar contagem →'}
        </Button>
      </div>
    </div>
  );
}
