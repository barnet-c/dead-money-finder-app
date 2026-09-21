import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EditorialTooltip, axisProps } from './RevenueTrendChart';

const GRID = 'hsl(35 12% 85%)';
const INK = 'hsl(30 10% 12%)';
const OLIVE = 'hsl(70 25% 38%)';
const RUST = 'hsl(12 55% 45%)';

export default function ConversionChart({ data }) {
  return (
    <div className="border border-border bg-card p-5 rounded-sm">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-serif text-lg">Reminders sent <em>vs</em> booked</h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Conversion</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: -10, bottom: 0, left: -20 }} barGap={2}>
            <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="2 4" />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis yAxisId="left" allowDecimals={false} {...axisProps} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickFormatter={(v) => `${v}%`} {...axisProps} />
            <Tooltip content={<EditorialTooltip formatter={(v, k) => (k === 'rate' ? `${v}%` : v)} />} cursor={{ fill: 'hsl(40 15% 93%)' }} />
            <Legend
              iconType="square"
              iconSize={8}
              wrapperStyle={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', paddingTop: 8 }}
            />
            <Bar yAxisId="left" dataKey="sent" name="Sent" fill={INK} fillOpacity={0.85} maxBarSize={22} />
            <Bar yAxisId="left" dataKey="booked" name="Booked" fill={OLIVE} maxBarSize={22} />
            <Line yAxisId="right" type="monotone" dataKey="rate" name="Rate" stroke={RUST} strokeWidth={1.5} dot={{ r: 2.5, fill: RUST, strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
