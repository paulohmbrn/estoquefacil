import { Bell } from 'lucide-react';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar';
import { LojaSwitcher, type LojaSwitcherItem } from './loja-switcher';
import { HeaderSearch } from './header-search';

interface Props {
  user: { name: string | null; email: string | null; image: string | null };
  papel: 'GESTOR' | 'OPERADOR' | null;
  lojas: LojaSwitcherItem[];
  lojaAtivaId: string | null;
}

function initials(name: string | null, email: string | null): string {
  const source = (name ?? email ?? 'U').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase();
}

export function Topbar({ user, papel, lojas, lojaAtivaId }: Props) {
  return (
    <div className="h-[60px] border-b border-strong flex items-center px-6 gap-4 bg-white shrink-0">
      <LojaSwitcher lojas={lojas} ativaId={lojaAtivaId} />
      <HeaderSearch />
      <div className="ml-auto flex items-center gap-[10px]">
        <Bell size={18} className="text-rm-mid" />
        <div className="text-right">
          <div className="text-[13px] font-semibold leading-tight">{user.name ?? user.email}</div>
          <div className="text-[10px] tracking-[.18em] uppercase text-rm-mid">
            {papel === 'GESTOR' ? 'Gestor' : papel === 'OPERADOR' ? 'Operador' : 'Sem vínculo'}
          </div>
        </div>
        <Avatar>
          {user.image && <AvatarImage src={user.image} alt={user.name ?? ''} />}
          <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
