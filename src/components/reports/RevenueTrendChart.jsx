import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const INK = 'hsl(30 10% 12%)';
const MUTED = 'hsl(30 8% 45%)';
const GRID = 'hsl(35 12% 85%)';
const SLATE = 'hsl(215 15% 40%)';

export function EditorialTooltip({ active, payload, label, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-card px-3 py-2 shadow-md rounded-sm">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="mt-1 flex items-baseline justify-between gap-4">
          <span className="font-mono text-[11px] text-muted-foreground">{p.name}</span>
          <span className="font-serif text-lg tabular-nums" style={{ color: p.color || INK }}>
            {formatter ? formatter(p.value, p.dataKey) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export const axisProps = {
  tick: { fontFamily: 'var(--font-mono)', fontSize: 10, fill: MUTED, letterSpacing: '0.08em' },
  axisLine: false,
  tickLine: false,
};

export default function RevenueTrendChart({ data }) {
  return (
    <div className="border border-border bg-card p-5 rounded-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-serif text-lg">Customers due, <em>by month</em></h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Demand</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="dueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SLATE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={SLATE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} />
            <Tooltip content={<EditorialTooltip />} cursor={{ stroke: GRID }} />
            <Area type="monotone" dataKey="due" name="Due" stroke={SLATE} strokeWidth={1.5} fill="url(#dueFill)" dot={{ r: 2.5, fill: SLATE, strokeWidth: 0 }} activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
