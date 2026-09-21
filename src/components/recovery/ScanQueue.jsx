import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { api } from '@/api/client';
import { fmtDate } from '@/lib/utils';
import { formatMoney } from './InvoiceRow';
import { Button } from '../ui/button';
import { SectionHeader } from '../Editorial';

export default function ScanQueue() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ['unconfirmedInvoices'],
    queryFn: () => api.entities.UnconfirmedInvoice.filter({ status: 'pending' }, '-created_date'),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['unconfirmedInvoices'] });
    qc.invalidateQueries({ queryKey: ['invoices'] });
  };

  const track = useMutation({
    mutationFn: async (u) => {
      await api.entities.Invoice.create({
        stripe_invoice_id: `gmail_${u.source_email_id}`,
        customer_name: u.customer_name || senderName(u.email_from),
        customer_email: u.customer_email || senderEmail(u.email_from) || 'unknown@unknown',
        amount_due: Number(u.amount_due) || 0,
        currency: u.currency || 'usd',
        due_date: u.due_date || null,
        status: 'open',
        invoice_number: u.invoice_number || `INBOX-${u.source_email_id.slice(0, 6).toUpperCase()}`,
        source: 'gmail',
      });
      await api.entities.UnconfirmedInvoice.update(u.id, { status: 'confirmed' });
    },
    onSuccess: () => { toast.success('Invoice is now tracked'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const ignore = useMutation({
    mutationFn: (u) => api.entities.UnconfirmedInvoice.update(u.id, { status: 'ignored' }),
    onSuccess: () => { toast('Ignored'); invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  if (!items.length) return null;

  return (
    <section className="mb-12">
      <SectionHeader number={1} label={`${items.length} to review`} title={<>From the <em>inbox</em></>} />
      <div className="border-t border-border">
        {items.map((u) => (
          <div key={u.id} className="grid gap-3 border-b border-border py-4 sm:grid-cols-[auto_1fr_auto] sm:items-start">
            <Mail className="mt-1 h-4 w-4 text-amber-ink" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate">
                {senderName(u.email_from) || u.email_from} {u.invoice_number && <>· {u.invoice_number}</>}
              </div>
              <p className="mt-1 font-serif text-lg leading-snug truncate">{u.email_subject || '(no subject)'}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[11px] text-muted-foreground">
                <span className="text-foreground">{u.amount_due != null ? formatMoney(u.amount_due, u.currency) : 'Amount unknown'}</span>
                <span>Due {fmtDate(u.due_date)}</span>
                {u.customer_email && <span className="truncate">{u.customer_email}</span>}
              </div>
            </div>
            <div className="flex gap-2 sm:justify-end">
              <Button size="sm" onClick={() => track.mutate(u)} disabled={track.isPending}>Track</Button>
              <Button size="sm" variant="secondary" onClick={() => ignore.mutate(u)} disabled={ignore.isPending}>Ignore</Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function senderName(from = '') {
  const m = from.match(/^"?([^"<]+)"?\s*</);
  return m ? m[1].trim() : '';
}
function senderEmail(from = '') {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1].trim() : from.includes('@') ? from.trim() : '';
}
