'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { selfBootstrapGestor } from '@/app/_actions/funcionarios';

export type LojaBootstrap = {
  id: string;
  zmartbiId: string;
  nome: string;
  apelido: string | null;
  /** quantos gestores já existem (pode ser 0+); apenas info */
  gestoresExistentes: number;
  /** se o user logado já é Gestor desta loja */
  jaSouVinculado: boolean;
};

interface Props {
  email: string;
  lojas: LojaBootstrap[];
}

export function BootstrapPicker({ email, lojas: initialLojas }: Props) {
  const [pending, startTransition] = useTransition();
  const [pendingLojaId, setPendingLojaId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [lojas, setLojas] = useState<LojaBootstrap[]>(initialLojas);
  const router = useRouter();

  const minhas = lojas.filter((l) => l.jaSouVinculado);
  const disponiveis = lojas.filter((l) => !l.jaSouVinculado);

  function reclamar(lojaId: string, nome: string) {
    setPendingLojaId(lojaId);
    startTransition(async () => {
      setErro(null);
      setOkMsg(null);
      const r = await selfBootstrapGestor(lojaId);
      if (r.ok) {
        setOkMsg(`Você agora é Gestor de ${nome}.`);
        // Atualização otimista: marca como vinculado e incrementa contagem.
        setLojas((prev) =>
          prev.map((l) =>
            l.id === lojaId
              ? { ...l, jaSouVinculado: true, gestoresExistentes: l.gestoresExistentes + 1 }
              : l,
          ),
        );
      } else {
        setErro(r.error);
      }
      setPendingLojaId(null);
    });
  }

  return (
    <div className="max-w-[860px] mx-auto space-y-8">
      <header className="text-center space-y-3">
        <p className="rm-eyebrow">Minhas lojas · Estoque Fácil</p>
        <h1 className="rm-h1">
          Bem-vindo, <em>{email.split('@')[0]?.split('.')[0]}.</em>
        </h1>
        <p className="rm-body max-w-[58ch] mx-auto">
          Você entrou com <span className="rm-mono text-rm-ink">{email}</span>. Selecione abaixo
          as lojas que você gerencia. Cada loja pode ter <strong>vários Gestores</strong> —
          basta cada um se vincular aqui.
        </p>
      </header>

      {okMsg && (
        <Card className="p-4 border-l-4 border-rm-green bg-[#eef5ef] text-rm-green text-[13px] text-center">
          {okMsg}
        </Card>
      )}
      {erro && (
        <Card className="p-4 border-l-4 border-rm-red bg-[#f9eaea] text-rm-red text-[13px] text-center">
          {erro}
        </Card>
      )}

      {minhas.length > 0 && (
        <section>
          <h2 className="rm-h4 mb-3 text-rm-green">Você gerencia ({minhas.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {minhas.map((l) => (
              <Card key={l.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-rm-ink">{l.apelido ?? l.nome}</p>
                  <p className="text-[10px] tracking-[.18em] uppercase text-rm-mid mt-1">
                    #{l.zmartbiId} ·{' '}
                    {l.gestoresExistentes > 1
                      ? `${l.gestoresExistentes} gestores`
                      : '1 gestor'}
                  </p>
                </div>
                <Badge variant="green">Vinculado</Badge>
              </Card>
            ))}
          </div>
          <div className="mt-5 text-center">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                router.refresh();
                router.push('/');
              }}
            >
              Continuar para o painel →
            </Button>
          </div>
        </section>
      )}

      {disponiveis.length > 0 && (
        <section>
          <h2 className="rm-h4 mb-3">
            {minhas.length > 0 ? 'Outras lojas disponíveis' : 'Lojas disponíveis'}
          </h2>
          <p className="rm-caption text-rm-mid mb-3">
            Toque em &quot;Sou Gestor&quot; para se vincular a uma loja. Múltiplos Gestores por loja
            são suportados — você não &quot;rouba&quot; o lugar de ninguém.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {disponiveis.map((l) => (
              <Card key={l.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-rm-ink truncate">{l.apelido ?? l.nome}</p>
                  <p className="text-[10px] tracking-[.18em] uppercase text-rm-mid mt-1">
                    #{l.zmartbiId} ·{' '}
                    {l.gestoresExistentes === 0
                      ? 'sem gestor ainda'
                      : l.gestoresExistentes === 1
                      ? '1 gestor'
                      : `${l.gestoresExistentes} gestores`}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => reclamar(l.id, l.apelido ?? l.nome)}
                >
                  {pending && pendingLojaId === l.id ? '…' : 'Sou Gestor'}
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
