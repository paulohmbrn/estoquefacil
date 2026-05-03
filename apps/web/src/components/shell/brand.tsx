// Brand mark e wordmark do "Estoque Fácil" (variante desktop e mini).
// Reflete .ef-brand do design canvas.

import { cn } from '@/lib/utils';

export function BrandMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn(
        'grid place-items-center bg-rm-green text-rm-cream rounded-sm',
        'font-sans font-bold leading-none tracking-tight',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.6 }}
    >
      EF
    </div>
  );
}

export function BrandWordmark({
  subtitle,
  scale = 1,
}: {
  subtitle?: string;
  scale?: number;
}) {
  return (
    <div>
      <div
        className="font-sans font-bold tracking-tight leading-none text-rm-ink"
        style={{ fontSize: 22 * scale }}
      >
        estoque <em className="text-rm-green">fácil</em>
      </div>
      {subtitle && (
        <span
          className="block font-sans font-semibold uppercase text-rm-mid"
          style={{ fontSize: 9 * scale, letterSpacing: '.22em', marginTop: 3 }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}
