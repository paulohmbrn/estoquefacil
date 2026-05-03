// Casca mobile: header fixo top (brand + switcher de loja + avatar).
// Navegação principal fica no MobileBottomNav inferior.

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BrandMark } from './brand';
import { MobileLojaSwitcher } from './mobile-loja-switcher';
import type { LojaSwitcherItem } from './loja-switcher';

interface Props {
  user: { name: string | null; email: string | null; image: string | null };
  apelidoLoja: string | null;
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

export function MobileChrome({ user, apelidoLoja, lojas, lojaAtivaId }: Props) {
  return (
    <>
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-strong flex items-center px-4 gap-3"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', height: 'calc(56px + env(safe-area-inset-top, 0px))' }}
      >
        <BrandMark size={28} />
        <div className="flex-1 min-w-0">
          <div
            className="font-sans font-bold text-rm-ink leading-none truncate"
            style={{ fontSize: 18, letterSpacing: '-.02em' }}
          >
            estoque <em className="text-rm-green">fácil</em>
          </div>
          <MobileLojaSwitcher
            lojas={lojas}
            ativaId={lojaAtivaId}
            apelidoLoja={apelidoLoja}
          />
        </div>
        <Avatar className="h-9 w-9 shrink-0">
          {user.image && <AvatarImage src={user.image} alt={user.name ?? ''} />}
          <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>
      </header>
      {/* Spacer pra empurrar conteúdo abaixo do header fixo */}
      <div
        className="lg:hidden"
        aria-hidden
        style={{ height: 'calc(56px + env(safe-area-inset-top, 0px))' }}
      />
    </>
  );
}
