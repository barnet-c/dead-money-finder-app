import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Inbox, RefreshCw, AlertTriangle } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { Masthead, StatCell, StatStrip, SectionHeader, EmptyState } from '@/components/Editorial';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import InvoiceRow, { formatMoney } from '@/components/recovery/InvoiceRow';
import ScanQueue from '@/components/recovery/ScanQueue';
import FollowUpModal from '@/components/recovery/FollowUpModal';

export default function Recovery() {
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [followUp, setFollowUp] = useState(null);

  const invoicesQ = useQuery({ queryKey: ['invoices'], queryFn: () => api.entities.Invoice.list('due_date') });
  const invoices = invoicesQ.data || [];

  const open = useMemo(() => invoices.filter((i) => i.status === 'open'), [invoices]);
  const settled = useMemo(() => invoices.filter((i) => i.status !== 'open'), [invoices]);

  const currency = open[0]?.currency || invoices[0]?.currency || 'usd';
  const outstanding = open.reduce((s, i) => s + (Number(i.amount_due) || 0), 0);
  const recovered = invoices.filter((i) => i.recovered).reduce((s, i) => s + (Number(i.amount_due) || 0), 0);
  const followUps = invoices.reduce((s, i) => s + (Number(i.follow_up_count) || 0), 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['invoices'] });
    qc.invalidateQueries({ queryKey: ['unconfirmedInvoices'] });
  };

  const scan = useMutation({
    mutationFn: () => api.functions.invoke('scanGmailInbox'),
    onSuccess: (r) => {
      invalidate();
      toast.success(r.found ? `Found ${r.found} potential invoice${r.found === 1 ? '' : 's'} in ${r.scanned} new email${r.scanned === 1 ? '' : 's'}` : `Scanned ${r.scanned} new email${r.scanned === 1 ? '' : 's'} — nothing new to review`);
    },
    onError: (e) => {
      if (e.code === 'gmail_not_connected') toast.error('Connect Gmail on the Overview page first.');
      else if (e.code === 'gmail_read_permission_missing') toast.error('Gmail read permission missing. Reconnect and grant inbox access.');
      else if (e.code === 'llm_not_configured') toast.error('AI is not configured on the server (ANTHROPIC_API_KEY).');
      else toast.error(e.message);
    },
  });

  const sync = useMutation({
    mutationFn: () => api.functions.invoke('syncStripeInvoices'),
    onSuccess: (r) => {
      invalidate();
      toast.success(`Stripe synced · ${r.created} new, ${r.updated} updated, ${r.markedPaid} marked paid`);
    },
    onError: (e) => {
      if (e.code === 'stripe_not_configured') toast.error('Add your Stripe secret key in Settings first.');
      else toast.error(e.message);
    },
  });

  return (
    <>
      <Masthead kicker="The Recovery" meta={`${open.length} unpaid`} title="The" italic="Recovery">
        {isAdmin && (
          <Button variant="secondary" onClick={() => scan.mutate()} disabled={scan.isPending}>
            <Inbox className={scan.isPending ? 'h-3.5 w-3.5 animate-pulse' : 'h-3.5 w-3.5'} /> {scan.isPending ? 'Scanning…' : 'Scan inbox'}
          </Button>
        )}
        <Button onClick={() => sync.mutate()} disabled={sync.isPending || !user?.has_stripe_key} title={!user?.has_stripe_key ? 'Add a Stripe key in Settings' : undefined}>
          <RefreshCw className={sync.isPending ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> {sync.isPending ? 'Syncing…' : 'Sync Stripe'}
        </Button>
      </Masthead>

      {!user?.has_stripe_key && (
        <div className="mb-8 flex flex-col gap-2 border border-amber-ink/20 bg-amber-ink/8 p-4 rounded-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-ink shrink-0" />
            <p className="font-sans text-sm">No Stripe key configured. Invoices from Stripe will not sync until you add one.</p>
          </div>
          <Link to="/settings" className="font-mono text-[11px] uppercase tracking-wider text-amber-ink hover:underline underline-offset-4">Open settings →</Link>
        </div>
      )}

      <StatStrip className="mb-12 md:grid-cols-3">
        <StatCell label="Outstanding" value={formatMoney(outstanding, currency)} tone="rust" hint={`${open.length} open`} />
        <StatCell label="Recovered" value={formatMoney(recovered, currency)} tone="olive" hint="paid after a follow-up" />
        <StatCell label="Follow-ups sent" value={followUps} />
      </StatStrip>

      <ScanQueue />

      <section className="mb-12">
        <SectionHeader number={2} label={`${open.length}`} title={<>Awaiting <em>payment</em></>} />
        {invoicesQ.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : open.length === 0 ? (
          <EmptyState title="Nothing outstanding." line="Sync Stripe or scan your inbox to find unpaid invoices." className="py-12" />
        ) : (
          <div className="border-t border-border">
            {open.map((inv) => <InvoiceRow key={inv.id} invoice={inv} onFollowUp={setFollowUp} />)}
          </div>
        )}
      </section>

      {settled.length > 0 && (
        <section>
          <SectionHeader number={3} label={`${settled.length}`} title={<>Settled</>} />
          <div className="border-t border-border">
            {settled.map((inv) => <InvoiceRow key={inv.id} invoice={inv} />)}
          </div>
        </section>
      )}

      <FollowUpModal open={!!followUp} onOpenChange={(o) => !o && setFollowUp(null)} invoice={followUp} />
    </>
  );
}
