import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
import { api } from '@/api/client';
import { cn, fmtDateTime } from '@/lib/utils';
import { Masthead, StatCell, StatStrip, EmptyState } from '@/components/Editorial';
import { Skeleton } from '@/components/ui/skeleton';

const DOT = { sent: 'bg-olive', failed: 'bg-rust', draft: 'bg-muted-foreground' };

export default function ReminderLog() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState(null);

  const logsQ = useQuery({ queryKey: ['reminderLogs'], queryFn: () => api.entities.ReminderLog.list('-sent_at') });
  const customersQ = useQuery({ queryKey: ['customers'], queryFn: () => api.entities.CustomerServiceRecord.list() });

  const logs = logsQ.data || [];
  const customersById = useMemo(() => Object.fromEntries((customersQ.data || []).map((c) => [c.id, c])), [customersQ.data]);

  const dispatched = logs.filter((l) => l.status === 'sent').length;
  const remindedCustomerIds = new Set(logs.map((l) => l.customer_id));
  const converted = [...remindedCustomerIds].filter((id) => customersById[id]?.booked_again).length;
  const rate = remindedCustomerIds.size ? Math.round((converted / remindedCustomerIds.size) * 100) : 0;

  const toggleConverted = useMutation({
    mutationFn: ({ customer, value }) => api.entities.CustomerServiceRecord.update(customer.id, {
      booked_again: value,
      reminder_status: value ? 'booked' : 'sent',
    }),
    onSuccess: (_d, { value }) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success(value ? 'Marked as converted' : 'Conversion undone');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <Masthead kicker="The Reminders" meta={`${logs.length} entr${logs.length === 1 ? 'y' : 'ies'}`} title="The" italic="Reminders" />

      <StatStrip className="mb-12 md:grid-cols-3">
        <StatCell label="Dispatched" value={dispatched} />
        <StatCell label="Converted" value={converted} tone="olive" />
        <StatCell label="Rate" value={`${rate}%`} tone="slate" />
      </StatStrip>

      {logsQ.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : logs.length === 0 ? (
        <EmptyState title="No reminders dispatched yet." line="Send one from the Overview or Customers page and it will be recorded here." />
      ) : (
        <div className="border-t border-border">
          {logs.map((log) => {
            const customer = customersById[log.customer_id];
            const booked = !!customer?.booked_again;
            const expanded = openId === log.id;
            return (
              <div key={log.id} className="border-b border-border py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <button type="button" onClick={() => setOpenId(expanded ? null : log.id)} className="flex items-start gap-3 text-left min-w-0">
                    <span className={cn('mt-2 h-2 w-2 shrink-0 rounded-full', DOT[log.status] || DOT.draft)} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="font-serif text-xl leading-tight">{log.customer_name || 'Unknown'}</span>
                        {booked && <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-olive">· Converted</span>}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                        {fmtDateTime(log.sent_at || log.created_date)} · {log.channel} · {log.status}
                      </div>
                    </div>
                    <ChevronDown className={cn('mt-1.5 h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
                  </button>
                  {customer && (
                    <button
                      type="button"
                      onClick={() => toggleConverted.mutate({ customer, value: !booked })}
                      disabled={toggleConverted.isPending}
                      className={cn('shrink-0 font-mono text-[11px] uppercase tracking-wider hover:underline underline-offset-4', booked ? 'text-muted-foreground' : 'text-olive')}
                    >
                      {booked ? 'Undo' : 'Mark converted →'}
                    </button>
                  )}
                </div>
                {expanded && (
                  <blockquote className="mt-4 ml-5 border-l-2 border-border pl-4 font-sans text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {log.message_body}
                  </blockquote>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
