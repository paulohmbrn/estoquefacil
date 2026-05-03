// Cabeçalho de página padrão (eyebrow + título Glitten + sub + ação).
// Mobile: empilha título e ação. Desktop: lado-a-lado, baseline.

import { cn } from '@/lib/utils';

interface Props {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function PageHead({ eyebrow, title, sub, action, className }: Props) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-end sm:justify-between border-b border-hairline pb-4 mb-5 sm:pb-5 sm:mb-7 gap-3 sm:gap-6',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="rm-eyebrow">{eyebrow}</p>}
        {/* h2 desktop, h3 mobile pra evitar Glitten gigante esmagando */}
        <h1 className="font-sans font-bold text-[28px] sm:text-h2 leading-[1.05] mt-2">{title}</h1>
        {sub && <p className="rm-caption text-rm-mid mt-2 max-w-[64ch]">{sub}</p>}
      </div>
      {action && <div className="sm:shrink-0">{action}</div>}
    </div>
  );
}
