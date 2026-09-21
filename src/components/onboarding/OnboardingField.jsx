import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export default function OnboardingField({ label, required, hint, children, className }) {
  return (
    <div className={className}>
      <label className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-rust">*</span>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 font-mono text-[11px] text-muted-foreground/80 leading-relaxed">{hint}</p>}
    </div>
  );
}

export const OnboardingInput = forwardRef(({ className, mono = true, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full border-0 border-b border-border bg-transparent px-0 py-2 text-[15px] text-foreground',
      'focus:border-foreground focus:outline-none transition-colors placeholder:italic placeholder:text-muted-foreground/70',
      mono ? 'font-mono' : 'font-sans',
      className,
    )}
    {...props}
  />
));
OnboardingInput.displayName = 'OnboardingInput';
