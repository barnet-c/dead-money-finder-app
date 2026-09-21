import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { api } from '@/api/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Textarea } from './ui/input';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

export default function ReminderModal({ open, onOpenChange, customer, settings, onSent }) {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  const generate = async () => {
    if (!customer) return;
    setGenerating(true);
    setGenError(null);
    try {
      const { message: m } = await api.functions.invoke('generateReminderMessage', { customer, settings });
      setMessage(m || '');
    } catch (e) {
      setGenError(e.message);
      if (!message) setMessage(fallbackMessage(customer, settings));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (open && customer) { setMessage(''); generate(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id]);

  const send = useMutation({
    mutationFn: () => api.functions.invoke('sendReminder', { customerId: customer.id, messageBody: message }),
    onSuccess: () => {
      toast.success(`Reminder dispatched to ${customer.customer_name}`);
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['reminderLogs'] });
      onOpenChange(false);
      onSent?.(customer);
    },
    onError: (e) => {
      if (e.code === 'gmail_not_connected') toast.error('Connect your Gmail account first (see the banner on the Overview page).');
      else toast.error(e.message);
    },
  });

  const changeAccount = async () => {
    await api.connectors.connectAppUser();
    qc.invalidateQueries({ queryKey: ['gmail'] });
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogDescription>§ Reminder · {customer.service_type}</DialogDescription>
          <DialogTitle>A note to <em>{customer.customer_name.split(' ')[0]}</em></DialogTitle>
          <p className="font-mono text-xs text-muted-foreground">To: {customer.email}</p>
        </DialogHeader>

        {generating && !message ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <p className="pt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground animate-pulse">Drafting…</p>
          </div>
        ) : (
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[260px] font-sans" />
        )}

        {genError && (
          <p className="font-mono text-[11px] text-amber-ink">AI draft unavailable ({genError}). A plain template has been inserted — edit before sending.</p>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <button type="button" onClick={changeAccount} className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
            Change Gmail account
          </button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={generate} disabled={generating}>
              <RefreshCw className={generating ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} /> Regenerate
            </Button>
            <Button onClick={() => send.mutate()} disabled={!message.trim() || send.isPending || generating}>
              {send.isPending ? 'Sending…' : 'Dispatch →'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fallbackMessage(c, s) {
  const first = (c.customer_name || '').split(' ')[0];
  const biz = s?.business_name || 'us';
  return `Hi ${first},

It's been a little while since your last ${c.service_type} with ${biz}, and it's now due again. Booking in soon keeps everything running smoothly and avoids bigger problems later.

${s?.booking_link ? `You can book your next visit here: ${s.booking_link}` : 'Just reply to this email and we will find a time that suits you.'}
${s?.business_phone ? `\nAny questions, give us a call on ${s.business_phone}.` : ''}

Warm regards,
${s?.owner_name || biz}`;
}
