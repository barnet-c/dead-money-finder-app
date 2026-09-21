import { ExternalLink } from 'lucide-react';
import { cn, daysUntil, fmtDate } from '@/lib/utils';
import { Button } from '../ui/button';

export function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(Number(amount) || 0);
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${(currency || 'usd').toUpperCase()}`;
  }
}

export default function InvoiceRow({ invoice, onFollowUp }) {
  const open = invoice.status === 'open';
  const overdue = open && invoice.due_date ? -(daysUntil(invoice.due_date) ?? 0) : 0;

  return (
    <div className={cn('grid grid-cols-1 gap-3 border-b border-border py-4 sm:grid-cols-[1fr_auto] sm:items-center', !open && 'opacity-70')}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>{invoice.invoice_number || invoice.stripe_invoice_id}</span>
          <span className="opacity-60">· {invoice.source}</span>
          {invoice.recovered && <span className="text-olive">· recovered</span>}
          {!open && <span>· {invoice.status}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <h3 className="font-serif text-xl leading-tight truncate">{invoice.customer_name || invoice.customer_email}</h3>
          {invoice.customer_name && <span className="font-mono text-[11px] text-muted-foreground truncate">{invoice.customer_email}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-[11px] text-muted-foreground">
          <span>Due {fmtDate(invoice.due_date)}</span>
          {overdue > 0 && <span className="text-rust">{overdue}d overdue</span>}
          {invoice.follow_up_count > 0 && (
            <span>{invoice.follow_up_count} follow-up{invoice.follow_up_count === 1 ? '' : 's'} · last {fmtDate(invoice.last_follow_up_at)}</span>
          )}
          {invoice.hosted_invoice_url && (
            <a href={invoice.hosted_invoice_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
              view <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <span className={cn('font-serif text-2xl tabular-nums', open ? 'text-foreground' : 'text-muted-foreground line-through decoration-1')}>
          {formatMoney(invoice.amount_due, invoice.currency)}
        </span>
        {open && onFollowUp && (
          <Button variant="secondary" size="sm" onClick={() => onFollowUp(invoice)}>Follow up →</Button>
        )}
      </div>
    </div>
  );
}
