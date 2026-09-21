import { cn, daysUntil } from '@/lib/utils';

const TONES = {
  overdue: 'text-rust border-rust/20 bg-rust/8',
  today: 'text-amber-ink border-amber-ink/20 bg-amber-ink/8',
  soon: 'text-slate-ink border-slate-ink/20 bg-slate-ink/8',
  ok: 'text-olive border-olive/20 bg-olive/8',
  neutral: 'text-muted-foreground border-border',
};

const DOTS = {
  overdue: 'bg-rust',
  today: 'bg-amber-ink',
  soon: 'bg-slate-ink',
  ok: 'bg-olive',
  neutral: 'bg-muted-foreground',
};

export function dueInfo(dateStr) {
  const d = daysUntil(dateStr);
  if (d === null) return { tone: 'neutral', label: 'No date', days: null };
  if (d < 0) return { tone: 'overdue', label: `${Math.abs(d)}d overdue`, days: d };
  if (d === 0) return { tone: 'today', label: 'Due today', days: d };
  if (d <= 14) return { tone: 'soon', label: `Due in ${d}d`, days: d };
  return { tone: 'ok', label: `In ${d}d`, days: d };
}

export default function DueBadge({ date, className }) {
  const { tone, label } = dueInfo(date);
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[11px] uppercase tracking-wider font-mono', TONES[tone], className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone])} />
      {label}
    </span>
  );
}
