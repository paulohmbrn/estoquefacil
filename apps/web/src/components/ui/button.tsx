'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// Reflete .ef-btn / .ef-btn-primary / .ef-btn-ghost / .ef-btn-danger do design canvas.
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-sans font-semibold tracking-wide rounded-xs ' +
    'transition-colors duration-base ease-warm focus-visible:outline-none focus-visible:shadow-focus ' +
    'disabled:opacity-50 disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        default:
          'bg-rm-ink text-rm-cream border border-rm-ink hover:bg-rm-green hover:border-rm-green',
        primary:
          'bg-rm-green text-rm-cream border border-rm-green hover:bg-rm-green-2 hover:border-rm-green-2',
        ghost:
          'bg-transparent text-rm-ink border border-strong hover:bg-[rgba(0,65,37,0.06)] hover:border-rm-green hover:text-rm-green',
        danger:
          'bg-rm-red text-rm-cream border border-rm-red hover:bg-rm-red-2 hover:border-rm-red-2',
        link: 'bg-transparent text-rm-green underline-offset-4 hover:underline border-transparent',
      },
      size: {
        sm: 'h-[30px] px-3 text-[12px]',
        md: 'h-[38px] px-4 text-[13px]',
        lg: 'h-[46px] px-[22px] text-[14px]',
        icon: 'h-[38px] w-[38px] p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
