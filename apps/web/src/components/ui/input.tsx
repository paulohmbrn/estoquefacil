import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-[38px] w-full px-3 text-[13px] font-sans bg-white border border-hairline rounded-xs',
        'text-rm-ink placeholder:text-rm-mid',
        'focus:outline-none focus:border-rm-green focus:shadow-focus',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export { Input };
