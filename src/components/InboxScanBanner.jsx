import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { api } from '@/api/client';

export default function InboxScanBanner() {
  const { data } = useQuery({
    queryKey: ['unconfirmedInvoices'],
    queryFn: () => api.entities.UnconfirmedInvoice.filter({ status: 'pending' }, '-created_date'),
  });
  const count = data?.length || 0;
  if (!count) return null;

  return (
    <div className="mb-8 flex flex-col gap-3 border border-amber-ink/20 bg-amber-ink/8 p-4 rounded-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Inbox className="h-4 w-4 text-amber-ink shrink-0" />
        <p className="font-sans text-sm text-foreground">
          <span className="font-mono tabular-nums text-amber-ink">{count}</span> potential unpaid {count === 1 ? 'invoice' : 'invoices'} found in your inbox.
        </p>
      </div>
      <Link to="/recovery" className="font-mono text-[11px] uppercase tracking-wider text-amber-ink hover:underline underline-offset-4">
        Review now →
      </Link>
    </div>
  );
}
