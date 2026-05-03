'use client';

// Tab bar inferior para o app mobile (PWA standalone).
// Apenas <lg; desktop tem sidebar lateral.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Calculator, Truck, Tag, QrCode, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'home', label: 'Início', href: '/', icon: Home },
  { id: 'contagem', label: 'Contar', href: '/contagem', icon: Calculator },
  { id: 'listas', label: 'Listas', href: '/listas', icon: QrCode },
  { id: 'recebimento', label: 'Receber', href: '/recebimento', icon: Truck },
  { id: 'etiquetas', label: 'Etiq.', href: '/etiquetas', icon: Tag },
  { id: 'relatorios', label: 'Relat.', href: '/relatorios', icon: BarChart3 },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  // Esconde o tab bar nas telas imersivas:
  // - tela ativa de contagem (`/contagem/<id>`) — botão "Finalizar" usa o rodapé
  // - tela de bipe manual / fluxo de início
  // Mantém visível em /contagem (lista) e /contagem/<id>/sucesso.
  // Esconde nas telas imersivas (contagem ativa e recebimento ativo)
  const hideOnImmersive =
    (/^\/contagem\/[^/]+$/.test(pathname) || /^\/recebimento\/[^/]+$/.test(pathname)) &&
    !pathname.endsWith('/sucesso');
  if (hideOnImmersive) return null;

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-strong"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="flex items-stretch">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = isActive(t.href);
          return (
            <li key={t.id} className="flex-1">
              <Link
                href={t.href}
                className={cn(
                  'flex flex-col items-center justify-center py-2 gap-[2px] text-[10px] tracking-[.06em] uppercase transition-colors',
                  active ? 'text-rm-green font-semibold' : 'text-rm-mid font-medium',
                )}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
