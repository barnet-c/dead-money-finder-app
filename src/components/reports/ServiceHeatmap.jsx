import { cn } from '@/lib/utils';

const COLS = [
  { key: 'volume', label: 'Volume', bar: 'bg-slate-ink', text: 'text-slate-ink' },
  { key: 'overdue', label: 'Overdue', bar: 'bg-rust', text: 'text-rust' },
  { key: 'rebooked', label: 'Rebooked', bar: 'bg-olive', text: 'text-olive' },
];

export default function ServiceHeatmap({ rows }) {
  if (!rows.length) {
    return <p className="font-serif text-xl italic text-muted-foreground">No services tracked yet.</p>;
  }
  const max = Object.fromEntries(COLS.map((c) => [c.key, Math.max(1, ...rows.map((r) => r[c.key] || 0))]));

  return (
    <div className="border border-border bg-card rounded-sm overflow-hidden">
      <div className="grid grid-cols-[1.4fr_repeat(3,1fr)] border-b border-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <div>Service</div>
        {COLS.map((c) => <div key={c.key} className="text-right">{c.label}</div>)}
      </div>
      {rows.map((r) => (
        <div key={r.service_type} className="grid grid-cols-[1.4fr_repeat(3,1fr)] items-center gap-4 border-b border-border last:border-0 px-5 py-3">
          <div className="font-serif text-base truncate">{r.service_type}</div>
          {COLS.map((c) => {
            const v = r[c.key] || 0;
            const pct = Math.round((v / max[c.key]) * 100);
            return (
              <div key={c.key} className="flex items-center justify-end gap-3">
                <div className="h-1.5 w-full max-w-[120px] bg-muted rounded-sm overflow-hidden">
                  <div className={cn('h-full rounded-sm transition-all', c.bar)} style={{ width: `${pct}%`, opacity: 0.35 + 0.65 * (pct / 100) }} />
                </div>
                <span className={cn('w-7 text-right font-mono text-xs tabular-nums', v > 0 ? c.text : 'text-muted-foreground/50')}>{v}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
