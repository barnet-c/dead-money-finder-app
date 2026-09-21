import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { api } from '@/api/client';
import { daysUntil } from '@/lib/utils';
import { Masthead, StatCell, StatStrip, EmptyState } from '@/components/Editorial';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import CustomerCard from '@/components/CustomerCard';
import GmailConnectBanner from '@/components/GmailConnectBanner';
import InboxScanBanner from '@/components/InboxScanBanner';
import ReminderModal from '@/components/ReminderModal';
import CustomerFormModal from '@/components/CustomerFormModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [remind, setRemind] = useState(null);
  const [edit, setEdit] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: () => api.entities.BusinessSettings.list() });
  const customersQ = useQuery({ queryKey: ['customers'], queryFn: () => api.entities.CustomerServiceRecord.list('next_due_date') });

  const settings = settingsQ.data?.[0] || null;
  const customers = customersQ.data || [];

  useEffect(() => {
    if (settingsQ.isSuccess && (settingsQ.data?.length ?? 0) === 0) navigate('/onboarding', { replace: true });
  }, [settingsQ.isSuccess, settingsQ.data, navigate]);

  const buckets = useMemo(() => {
    const active = customers.filter((c) => c.reminder_status !== 'opted_out');
    const overdue = [];
    const soon = [];
    const upcoming = [];
    for (const c of active) {
      const d = daysUntil(c.next_due_date);
      if (d === null) { upcoming.push(c); continue; }
      if (d < 0) overdue.push(c);
      else if (d <= 14) soon.push(c);
      else upcoming.push(c);
    }
    return { overdue, soon, upcoming };
  }, [customers]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['customers'] });
    qc.invalidateQueries({ queryKey: ['unconfirmedInvoices'] });
    qc.invalidateQueries({ queryKey: ['gmail'] });
  };

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <Masthead kicker="The Edition" meta={today} title="Today's" italic="Bookings" subtitle={settings?.business_name}>
        <GmailConnectBanner compact />
        <Button variant="secondary" onClick={refresh}><RefreshCw className={customersQ.isFetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Refresh</Button>
        <Button onClick={() => { setEdit(null); setFormOpen(true); }}><Plus className="h-3.5 w-3.5" /> Add customer</Button>
      </Masthead>

      <InboxScanBanner />

      <StatStrip className="mb-10">
        <StatCell label="Total customers" value={customers.length} />
        <StatCell label="Overdue" value={buckets.overdue.length} tone="rust" />
        <StatCell label="Due soon" value={buckets.soon.length} tone="slate" hint="within 14 days" />
        <StatCell label="Upcoming" value={buckets.upcoming.length} tone="olive" />
      </StatStrip>

      <Tabs defaultValue={buckets.overdue.length ? 'overdue' : 'soon'}>
        <TabsList>
          <TabsTrigger value="overdue">Overdue <Count n={buckets.overdue.length} tone="text-rust" /></TabsTrigger>
          <TabsTrigger value="soon">Due soon <Count n={buckets.soon.length} tone="text-slate-ink" /></TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming <Count n={buckets.upcoming.length} tone="text-olive" /></TabsTrigger>
        </TabsList>

        {['overdue', 'soon', 'upcoming'].map((key) => (
          <TabsContent key={key} value={key}>
            {customersQ.isLoading ? (
              <Grid>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</Grid>
            ) : buckets[key].length === 0 ? (
              <EmptyState
                title={key === 'overdue' ? 'Nothing overdue.' : key === 'soon' ? 'A quiet fortnight ahead.' : 'No upcoming services yet.'}
                line={customers.length === 0 ? 'Add your first customer to start the journal.' : 'Check the other columns, or add a customer.'}
                action={customers.length === 0 && <Button onClick={() => setFormOpen(true)}><Plus className="h-3.5 w-3.5" /> Add customer</Button>}
              />
            ) : (
              <Grid>
                {buckets[key].map((c) => (
                  <CustomerCard key={c.id} customer={c} onEdit={(x) => { setEdit(x); setFormOpen(true); }} onRemind={setRemind} />
                ))}
              </Grid>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <ReminderModal open={!!remind} onOpenChange={(o) => !o && setRemind(null)} customer={remind} settings={settings} />
      <CustomerFormModal open={formOpen} onOpenChange={setFormOpen} customer={edit} settings={settings} />
    </>
  );
}

function Grid({ children }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function Count({ n, tone }) {
  return <span className={`tabular-nums ${n ? tone : 'text-muted-foreground/60'}`}>{String(n).padStart(2, '0')}</span>;
}
