'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { addProdutoLista } from '@/app/_actions/listas';

export type ProdutoOption = {
  id: string;
  cdarvprod: string;
  nome: string;
  unidade: string;
  grupo: string | null;
  jaNaLista: boolean;
};

interface Props {
  listaId: string;
  produtos: ProdutoOption[];
}

export function ProdutoSearch({ listaId, produtos }: Props) {
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const router = useRouter();

  const filtered = !query
    ? []
    : produtos
        .filter((p) => {
          const q = query.toLowerCase();
          return (
            p.nome.toLowerCase().includes(q) ||
            p.cdarvprod.includes(query) ||
            (p.grupo?.toLowerCase().includes(q) ?? false)
          );
        })
        .slice(0, 30);

  function add(produtoId: string) {
    setPendingId(produtoId);
    startTransition(async () => {
      const r = await addProdutoLista(listaId, produtoId);
      if (r.ok) router.refresh();
      else alert(r.error);
      setPendingId(null);
    });
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Buscar produto pra adicionar (nome, CDARVPROD ou grupo)…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query && filtered.length === 0 && (
        <p className="text-rm-mid text-[12px]">Nenhum produto encontrado.</p>
      )}
      {filtered.length > 0 && (
        <div className="border border-hairline rounded-xs max-h-[320px] overflow-auto">
          {filtered.map((p) => (
            <div
              key={p.id}
              className="px-3 py-2 flex items-center gap-3 border-b border-hairline last:border-0 hover:bg-[rgba(0,65,37,.04)]"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-rm-ink truncate">{p.nome}</p>
                <p className="text-[10px] tracking-[.12em] uppercase text-rm-mid">
                  {p.cdarvprod} · {p.unidade} · {p.grupo ?? '—'}
                </p>
              </div>
              {p.jaNaLista ? (
                <span className="text-[11px] text-rm-mid uppercase tracking-[.14em]">já na lista</span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending && pendingId === p.id}
                  onClick={() => add(p.id)}
                >
                  {pending && pendingId === p.id ? '…' : '+ Add'}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
