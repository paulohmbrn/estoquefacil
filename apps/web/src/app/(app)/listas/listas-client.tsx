'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createLista, deleteLista } from '@/app/_actions/listas';

export type ListaRow = {
  id: string;
  nome: string;
  icone: string | null;
  tags: string[];
  ativo: boolean;
  totalProdutos: number;
  totalContagens: number;
};

export function ListasClient({ listas, isGestor }: { listas: ListaRow[]; isGestor: boolean }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      {isGestor && (
        <div className="flex justify-end mb-5">
          <Button variant="primary" onClick={() => setShowForm(true)}>
            + Nova lista
          </Button>
        </div>
      )}

      {listas.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="rm-eyebrow">Sem listas ainda</p>
          <h2 className="rm-h3 mt-3">Crie sua primeira lista de contagem</h2>
          <p className="rm-caption text-rm-mid mt-3 max-w-[42ch] mx-auto">
            Listas agrupam produtos para uma contagem específica (ex: Proteínas, Bebidas, Hortifruti).
            Cada lista tem um QR único que carrega todos os itens em sequência no app de contagem.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {listas.map((l) => (
            <Card key={l.id} className="p-5 flex flex-col">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                  <p className="rm-eyebrow text-rm-mid">Lista</p>
                  <h3 className="rm-h4 mt-1 truncate">{l.nome}</h3>
                </div>
                <Badge variant="green">{l.totalProdutos} itens</Badge>
              </div>
              {l.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {l.tags.map((t) => (
                    <Badge key={t} variant="neutral">{t}</Badge>
                  ))}
                </div>
              )}
              <p className="text-[12px] text-rm-mid mb-4">
                {l.totalContagens === 0
                  ? 'Nunca usada em contagem'
                  : `Usada em ${l.totalContagens} contagem${l.totalContagens > 1 ? 's' : ''}`}
              </p>
              <div className="mt-auto flex flex-col gap-2 pt-3 border-t border-dashed border-hairline">
                <div className="flex gap-2">
                  <Link href={`/listas/${l.id}`} className="ef-btn ef-btn-ghost ef-btn-sm flex-1 justify-center">
                    Editar
                  </Link>
                  {isGestor && <DeleteButton id={l.id} nome={l.nome} />}
                </div>
                {isGestor && l.totalProdutos > 0 && (
                  <Link
                    href={`/etiquetas/lista?listaId=${l.id}`}
                    className="ef-btn ef-btn-primary ef-btn-sm w-full justify-center"
                  >
                    Imprimir etiquetas →
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {showForm && <NovaListaModal onClose={() => setShowForm(false)} />}
    </>
  );
}

function DeleteButton({ id, nome }: { id: string; nome: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-[11px] uppercase tracking-[.16em] font-semibold text-rm-mid hover:text-rm-red transition-colors px-2"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Apagar a lista "${nome}"?`)) return;
        startTransition(async () => {
          const r = await deleteLista(id);
          if (r.ok) router.refresh();
          else alert(r.error);
        });
      }}
    >
      {pending ? '…' : 'Apagar'}
    </button>
  );
}

function NovaListaModal({ onClose }: { onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="fixed inset-0 bg-[rgba(10,26,16,.5)] flex items-center justify-center z-50 p-6" onClick={onClose}>
      <div
        className="bg-white rounded-xs shadow-lift max-w-[480px] w-full border-t-[6px] border-rm-green"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-hairline flex items-center justify-between">
          <h2 className="rm-h3">Nova lista de contagem</h2>
          <button onClick={onClose} className="text-rm-mid text-2xl leading-none hover:text-rm-ink">×</button>
        </div>
        <form
          className="p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              setErro(null);
              const r = await createLista(fd);
              if (r.ok && r.data) {
                router.push(`/listas/${r.data.id}`);
                onClose();
              } else if (!r.ok) {
                setErro(r.error);
              }
            });
          }}
        >
          <Field label="Nome *">
            <Input name="nome" required autoFocus placeholder="Ex: Proteínas, Bebidas, Hortifruti…" />
          </Field>
          <Field label="Tags (separadas por vírgula)">
            <Input name="tags" placeholder="freezer, refrigerado, semanal" />
          </Field>
          {erro && <p className="text-rm-red text-[13px]">{erro}</p>}
          <div className="flex gap-3 justify-end pt-3 border-t border-dashed border-strong">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Criando…' : 'Criar e adicionar produtos'}
            </Button>
          </div>
        </form>
      </div>
    </div>
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
