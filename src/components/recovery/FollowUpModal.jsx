import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Textarea } from '../ui/input';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { formatMoney } from './InvoiceRow';

export default function FollowUpModal({ open, onOpenChange, invoice }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  const generate = async () => {
    if (!invoice) return;
    setGenerating(true);
    setGenError(null);
    try {
      const { message: m } = await api.functions.invoke('generateInvoiceFollowUp', { invoice });
      setMessage(m || '');
    } catch (e) {
      setGenError(e.message);
      if (!message) setMessage(fallback(invoice));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (open && invoice) { setMessage(''); generate(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id]);

  const send = useMutation({
    mutationFn: () => api.functions.invoke('sendInvoiceFollowUp', { invoiceId: invoice.id, messageBody: message }),
    onSuccess: () => {
      toast.success('Follow-up sent');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['reminderLogs'] });
      onOpenChange(false);
    },
    onError: (e) => {
      if (e.code === 'gmail_not_connected') toast.error('Connect your Gmail account first (Overview page).');
      else toast.error(e.message);
    },
  });

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogDescription>§ Follow-up #{(invoice.follow_up_count || 0) + 1} · {invoice.invoice_number || invoice.stripe_invoice_id}</DialogDescription>
          <DialogTitle>Chasing <em>{formatMoney(invoice.amount_due, invoice.currency)}</em></DialogTitle>
          <p className="font-mono text-xs text-muted-foreground">To: {invoice.customer_email}</p>
        </DialogHeader>

        {generating && !message ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" />
            <p className="pt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground animate-pulse">Drafting…</p>
          </div>
        ) : (
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[240px] font-sans" />
        )}
        {genError && <p className="font-mono text-[11px] text-amber-ink">AI draft unavailable ({genError}). A plain template has been inserted.</p>}

        <DialogFooter>
          <Button variant="secondary" onClick={generate} disabled={generating}>
            <RefreshCw className={generating ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} /> Regenerate
          </Button>
          <Button onClick={() => send.mutate()} disabled={!message.trim() || send.isPending || generating}>
            {send.isPending ? 'Sending…' : 'Approve & Send →'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fallback(inv) {
  const first = (inv.customer_name || '').split(' ')[0] || 'there';
  return `Hi ${first},

Just a quick note that invoice ${inv.invoice_number || inv.stripe_invoice_id} for ${formatMoney(inv.amount_due, inv.currency)} is still outstanding.
${inv.hosted_invoice_url ? `\nYou can settle it here: ${inv.hosted_invoice_url}\n` : ''}
If it has already been paid, please ignore this — otherwise we would appreciate payment at your earliest convenience.

Many thanks`;
}
