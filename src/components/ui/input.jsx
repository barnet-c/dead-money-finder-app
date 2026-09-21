import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Input = forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-10 w-full rounded-none border-0 border-b border-border bg-transparent px-0 py-2 font-mono text-[15px] text-foreground',
      'focus:border-foreground focus:outline-none focus:ring-0 transition-colors',
      'placeholder:italic placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-50',
      'file:border-0 file:bg-transparent file:text-sm file:font-medium',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-[120px] w-full rounded-sm border border-border bg-card px-3 py-2 font-sans text-[15px] leading-relaxed text-foreground',
      'focus:border-foreground focus:outline-none focus:ring-0 transition-colors placeholder:italic placeholder:text-muted-foreground/70',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export { Input, Textarea };
