'use client';

import { ChevronDown, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { setLojaAtiva } from '@/app/_actions/loja-ativa';

export type LojaSwitcherItem = {
  id: string;
  zmartbiId: string;
  nome: string;
  apelido: string | null;
  papel: 'GESTOR' | 'OPERADOR';
};

interface Props {
  lojas: LojaSwitcherItem[];
  ativaId: string | null;
}

export function LojaSwitcher({ lojas, ativaId }: Props) {
  const router = useRouter();
  const ativa = lojas.find((l) => l.id === ativaId) ?? lojas[0];

  if (!ativa) {
    return (
      <span className="text-rm-mid text-[11px] uppercase tracking-[.18em]">
        Sem loja vinculada
      </span>
    );
  }

  if (lojas.length === 1) {
    return (
      <span className="font-sans text-[10px] tracking-[.22em] uppercase text-rm-mid font-semibold inline-flex items-center gap-2">
        Famiglia Reis Magos
        <Badge variant="green">{ativa.apelido ?? ativa.nome}</Badge>
      </span>
    );
  }

  async function onSelect(lojaId: string) {
    await setLojaAtiva(lojaId);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="font-sans text-[10px] tracking-[.22em] uppercase text-rm-mid font-semibold inline-flex items-center gap-2 hover:text-rm-green transition-colors">
          Famiglia Reis Magos
          <Badge variant="green">{ativa.apelido ?? ativa.nome}</Badge>
          <ChevronDown size={12} className="text-rm-mid" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[260px]">
        <DropdownMenuLabel>Trocar de loja</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {lojas.map((l) => (
          <DropdownMenuItem key={l.id} onSelect={() => onSelect(l.id)}>
            <span className="flex-1">
              <span className="block font-medium text-rm-ink">{l.apelido ?? l.nome}</span>
              <span className="block text-[10px] tracking-[.18em] uppercase text-rm-mid mt-[2px]">
                #{l.zmartbiId} · {l.papel === 'GESTOR' ? 'Gestor' : 'Operador'}
              </span>
            </span>
            {l.id === ativa.id && <Check size={14} className="text-rm-green" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
