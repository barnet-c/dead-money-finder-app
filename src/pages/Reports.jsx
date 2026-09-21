import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eachMonthOfInterval, subMonths, startOfMonth, endOfMonth, format, parseISO, isValid, isWithinInterval } from 'date-fns';
import { api } from '@/api/client';
import { daysUntil } from '@/lib/utils';
import { Masthead, SectionHeader, StatCell, StatStrip } from '@/components/Editorial';
import RevenueTrendChart from '@/components/reports/RevenueTrendChart';
import ConversionChart from '@/components/reports/ConversionChart';
import ServiceHeatmap from '@/components/reports/ServiceHeatmap';

export default function Reports() {
  const customersQ = useQuery({ queryKey: ['customers'], queryFn: () => api.entities.CustomerServiceRecord.list() });
  const logsQ = useQuery({ queryKey: ['reminderLogs'], queryFn: () => api.entities.ReminderLog.list('-sent_at') });
  const customers = customersQ.data || [];
  const logs = logsQ.data || [];

  const now = new Date();
  const months = useMemo(() => eachMonthOfInterval({ start: startOfMonth(subMonths(now, 5)), end: startOfMonth(now) }), [now.getMonth()]);

  const inMonth = (dateStr, m) => {
    if (!dateStr) return false;
    const d = typeof dateStr === 'string' && dateStr.length <= 10 ? parseISO(dateStr) : new Date(dateStr);
    return isValid(d) && isWithinInterval(d, { start: startOfMonth(m), end: endOfMonth(m) });
  };

  const trend = months.map((m) => ({
    month: format(m, 'MMM'),
    due: customers.filter((c) => inMonth(c.next_due_date, m)).length,
  }));

  const conversion = months.map((m) => {
    const sentLogs = logs.filter((l) => l.status === 'sent' && inMonth(l.sent_at || l.created_date, m));
    const ids = new Set(sentLogs.map((l) => l.customer_id));
    const booked = [...ids].filter((id) => customers.find((c) => c.id === id)?.booked_again).length;
    return { month: format(m, 'MMM'), sent: sentLogs.length, booked, rate: ids.size ? Math.round((booked / ids.size) * 100) : 0 };
  });

  const byService = useMemo(() => {
    const map = new Map();
    for (const c of customers) {
      const key = c.service_type || 'Unspecified';
      const row = map.get(key) || { service_type: key, volume: 0, overdue: 0, rebooked: 0 };
      row.volume++;
      const d = daysUntil(c.next_due_date);
      if (d !== null && d < 0 && c.reminder_status !== 'opted_out') row.overdue++;
      if (c.booked_again) row.rebooked++;
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.volume - a.volume);
  }, [customers]);

  const totalDue = customers.filter((c) => { const d = daysUntil(c.next_due_date); return d !== null && d <= 14 && c.reminder_status !== 'opted_out'; }).length;
  const remindedIds = new Set(logs.map((l) => l.customer_id));
  const convertedCount = [...remindedIds].filter((id) => customers.find((c) => c.id === id)?.booked_again).length;
  const conversionRate = remindedIds.size ? Math.round((convertedCount / remindedIds.size) * 100) : 0;

  return (
    <>
      <Masthead kicker="The Reports" meta="Past six months" title="The" italic="Reports" subtitle={`${format(months[0], 'MMMM')} – ${format(months[months.length - 1], 'MMMM yyyy')}`} />

      <section className="mb-14">
        <SectionHeader number={1} title={<>The <em>Headlines</em></>} />
        <StatStrip className="md:grid-cols-3">
          <StatCell label="Demand" value={totalDue} tone="rust" hint="due within 14 days" />
          <StatCell label="Conversion" value={`${conversionRate}%`} tone="olive" hint="reminder → booking" />
          <StatCell label="Coverage" value={byService.length} tone="slate" hint="service types tracked" />
        </StatStrip>
      </section>

      <section className="mb-14">
        <SectionHeader number={2} title={<>The <em>Trends</em></>} />
        <div className="grid gap-4 lg:grid-cols-2">
          <RevenueTrendChart data={trend} />
          <ConversionChart data={conversion} />
        </div>
      </section>

      <section>
        <SectionHeader number={3} title={<>By <em>Service</em></>} />
        <ServiceHeatmap rows={byService} />
      </section>
    </>
  );
}
