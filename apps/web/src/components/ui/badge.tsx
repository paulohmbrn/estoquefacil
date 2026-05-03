import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center px-2 py-[2px] text-[10px] font-semibold tracking-[.18em] uppercase rounded-xs',
  {
    variants: {
      variant: {
        green: 'bg-[rgba(0,65,37,.08)] text-rm-green',
        red: 'bg-[rgba(170,0,0,.08)] text-rm-red',
        gold: 'bg-[rgba(184,144,46,.12)] text-rm-gold',
        ink: 'bg-rm-ink text-rm-cream',
        neutral: 'bg-[rgba(10,26,16,.06)] text-rm-ink-2',
      },
    },
    defaultVariants: { variant: 'green' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
