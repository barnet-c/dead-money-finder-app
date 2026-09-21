import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { calcNextDue } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';

export default function BulkUpdateIntervalModal({ open, onOpenChange, customers, onDone }) {
  const qc = useQueryClient();
  const [days, setDays] = useState('');

  useEffect(() => { if (open) setDays(''); }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const n = Number(days);
      await Promise.all(customers.map((c) => api.entities.CustomerServiceRecord.update(c.id, {
        repeat_interval_days: n,
        next_due_date: calcNextDue(c.last_service_date, n),
      })));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success(`Interval updated for ${customers.length} ${customers.length === 1 ? 'customer' : 'customers'}`);
      onOpenChange(false);
      onDone?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const valid = Number(days) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogDescription>§ Bulk edit</DialogDescription>
          <DialogTitle>Change the <em>cadence</em></DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (valid) mutation.mutate(); }} className="space-y-5">
          <div>
            <Label>Repeat every (days)</Label>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} placeholder="e.g. 90" autoFocus className="mt-1.5" />
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">Next due dates are recalculated from each customer's last service date.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || mutation.isPending}>
              {mutation.isPending ? 'Applying…' : `Apply to ${customers.length}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
