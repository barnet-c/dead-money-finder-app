import { cn } from '@/lib/utils';

/** "§ 01 · LABEL" mono kicker + rule + serif heading */
export function SectionHeader({ number, label, title, action, className }) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex items-center gap-3 font-mono text-xs tracking-[0.18em] uppercase text-muted-foreground">
        <span>§ {String(number).padStart(2, '0')}</span>
        <span className="rule flex-1" />
        {label && <span>{label}</span>}
      </div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <h2 className="font-serif text-2xl leading-tight">{title}</h2>
        {action}
      </div>
    </div>
  );
}

/** Page masthead: kicker + rule + meta, then huge serif title with an italic word. */
export function Masthead({ kicker, meta, title, italic, subtitle, children, className }) {
  return (
    <header className={cn('mb-10', className)}>
      <div className="flex items-center gap-3 font-mono text-xs tracking-[0.18em] uppercase text-muted-foreground">
        <span>{kicker}</span>
        <span className="rule flex-1" />
        {meta && <span className="tabular-nums">{meta}</span>}
      </div>
      <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-serif text-5xl md:text-6xl leading-[0.95] tracking-tight">
            {title} {italic && <em className="font-light">{italic}</em>}
          </h1>
          {subtitle && <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">{subtitle}</p>}
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </header>
  );
}

const TONES = {
  default: 'text-foreground',
  rust: 'text-rust',
  olive: 'text-olive',
  slate: 'text-slate-ink',
  amber: 'text-amber-ink',
};

export function StatCell({ label, value, tone = 'default', hint, className }) {
  return (
    <div className={cn('py-5 pr-6', className)}>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={cn('mt-2 font-serif text-4xl tabular-nums leading-none', TONES[tone])}>{value}</div>
      {hint && <div className="mt-2 font-mono text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function StatStrip({ children, className }) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 divide-x divide-border border-y border-border [&>*]:pl-6 [&>*:first-child]:pl-0', className)}>
      {children}
    </div>
  );
}

export function EmptyState({ title, line, action, className }) {
  return (
    <div className={cn('py-20 text-center', className)}>
      <p className="font-serif text-2xl italic text-muted-foreground">{title}</p>
      {line && <p className="mt-2 font-mono text-xs text-muted-foreground">{line}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
