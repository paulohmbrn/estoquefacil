'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Tag,
  QrCode,
  RefreshCw,
  Calculator,
  FileBarChart,
  Box,
  Settings,
  ChevronUp,
  ChevronDown,
  Truck,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const NAV = [
  { id: 'home', label: 'Início', href: '/', icon: Home },
  { id: 'contagem', label: 'Contagem', href: '/contagem', icon: Calculator },
  { id: 'recebimento', label: 'Recebimento', href: '/recebimento', icon: Truck },
  { id: 'controlados', label: 'Controlados', href: '/controlados', icon: AlertTriangle },
  { id: 'listas', label: 'Listas (QR)', href: '/listas', icon: QrCode },
  { id: 'etiquetas', label: 'Etiquetas', href: '/etiquetas', icon: Tag },
  { id: 'sincronizacao', label: 'Sincronização', href: '/sincronizacao', icon: RefreshCw },
  { id: 'relatorios', label: 'Relatórios', href: '/relatorios', icon: FileBarChart },
] as const;

const CADASTROS = [
  { id: 'produtos', label: 'Produtos', href: '/cadastros/produtos' },
  { id: 'grupos', label: 'Grupos', href: '/cadastros/grupos' },
  { id: 'funcionarios', label: 'Funcionários', href: '/cadastros/funcionarios' },
  { id: 'lojas', label: 'Lojas (fiscal)', href: '/cadastros/lojas' },
] as const;

const CADASTROS_SUPER = [
  { id: 'gestores', label: 'Gestores', href: '/cadastros/gestores' },
] as const;

interface SidebarNavProps {
  isSuperGestor?: boolean;
}

export function SidebarNav({ isSuperGestor = false }: SidebarNavProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);
  const cadastrosAuto = pathname.startsWith('/cadastros');
  const [cadastrosOpen, setCadastrosOpen] = useState<boolean>(cadastrosAuto);

  // Sempre que a rota mudar pra /cadastros/*, garante aberto
  useEffect(() => {
    if (cadastrosAuto) setCadastrosOpen(true);
  }, [cadastrosAuto]);

  return (
    <nav className="flex flex-col gap-[2px]">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href);
        return (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              'flex items-center gap-[11px] px-3 py-[9px] rounded-sm text-[13px] font-medium border border-transparent transition-colors duration-base ease-warm',
              active
                ? 'bg-[rgba(0,65,37,.08)] text-rm-green border-[rgba(0,65,37,.15)] font-semibold'
                : 'text-rm-ink-2 hover:bg-[rgba(0,65,37,.06)] hover:text-rm-green',
            )}
          >
            <Icon size={18} className="shrink-0" />
            <span>{item.label}</span>
            {'badge' in item && typeof item.badge === 'string' && (
              <span className="ml-auto">
                <Badge variant="gold" className="!px-[6px] !text-[8px] !tracking-[.16em]">
                  {String(item.badge)}
                </Badge>
              </span>
            )}
          </Link>
        );
      })}

      <button
        type="button"
        onClick={() => setCadastrosOpen((v) => !v)}
        className={cn(
          'flex items-center gap-[11px] px-3 py-[9px] rounded-sm text-[13px] font-medium border border-transparent mt-2 text-left w-full transition-colors',
          cadastrosAuto
            ? 'bg-[rgba(0,65,37,.08)] text-rm-green border-[rgba(0,65,37,.15)] font-semibold'
            : 'text-rm-ink-2 hover:bg-[rgba(0,65,37,.06)] hover:text-rm-green',
        )}
      >
        <Box size={18} />
        <span>Cadastros</span>
        {cadastrosOpen ? (
          <ChevronUp size={14} className="ml-auto opacity-50" />
        ) : (
          <ChevronDown size={14} className="ml-auto opacity-50" />
        )}
      </button>
      {cadastrosOpen && (
        <div className="ml-[28px] pl-3 border-l border-dashed border-strong flex flex-col gap-[1px] mt-[2px] mb-1">
          {[...CADASTROS, ...(isSuperGestor ? CADASTROS_SUPER : [])].map((c) => (
            <Link
              key={c.id}
              href={c.href}
              className={cn(
                'px-[10px] py-[6px] rounded-sm text-[12.5px] font-medium transition-colors',
                isActive(c.href)
                  ? 'bg-[rgba(0,65,37,.08)] text-rm-green font-semibold'
                  : 'text-rm-ink-2 hover:text-rm-green',
              )}
            >
              {c.label}
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/configuracoes"
        className={cn(
          'flex items-center gap-[11px] px-3 py-[9px] rounded-sm text-[13px] font-medium border border-transparent transition-colors',
          isActive('/configuracoes')
            ? 'bg-[rgba(0,65,37,.08)] text-rm-green border-[rgba(0,65,37,.15)] font-semibold'
            : 'text-rm-ink-2 hover:text-rm-green hover:bg-[rgba(0,65,37,.06)]',
        )}
      >
        <Settings size={18} />
        <span>Configurações</span>
      </Link>
    </nav>
  );
}
