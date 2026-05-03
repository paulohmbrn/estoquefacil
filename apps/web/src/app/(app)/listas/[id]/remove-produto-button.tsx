'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeProdutoLista } from '@/app/_actions/listas';

interface Props {
  listaId: string;
  produtoId: string;
}

export function RemoveProdutoButton({ listaId, produtoId }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-[11px] uppercase tracking-[.16em] font-semibold text-rm-mid hover:text-rm-red transition-colors"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const r = await removeProdutoLista(listaId, produtoId);
          if (r.ok) router.refresh();
          else alert(r.error);
        })
      }
    >
      {pending ? '…' : 'Remover'}
    </button>
  );
}
