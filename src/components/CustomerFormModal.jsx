import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/api/client';
import { calcNextDue } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input, Textarea } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';

const OTHER = '__other__';

const empty = {
  customer_name: '',
  email: '',
  phone: '',
  service_type: '',
  last_service_date: '',
  repeat_interval_days: 90,
  reminder_status: 'pending',
  notes: '',
};

export default function CustomerFormModal({ open, onOpenChange, customer, settings }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [customType, setCustomType] = useState(false);

  const intervals = useMemo(() => settings?.default_intervals || [], [settings]);
  const knownTypes = useMemo(() => intervals.map((i) => i.service_type).filter(Boolean), [intervals]);

  useEffect(() => {
    if (!open) return;
    if (customer) {
      setForm({ ...empty, ...customer, phone: customer.phone || '', notes: customer.notes || '' });
      setCustomType(!knownTypes.includes(customer.service_type));
    } else {
      setForm(empty);
      setCustomType(knownTypes.length === 0);
    }
  }, [open, customer, knownTypes]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onTypeSelect = (v) => {
    if (v === OTHER) { setCustomType(true); set('service_type', ''); return; }
    setCustomType(false);
    const match = intervals.find((i) => i.service_type === v);
    setForm((f) => ({ ...f, service_type: v, repeat_interval_days: match ? match.interval_days : f.repeat_interval_days }));
  };

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customer_name: form.customer_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        service_type: form.service_type.trim(),
        last_service_date: form.last_service_date,
        repeat_interval_days: Number(form.repeat_interval_days),
        next_due_date: calcNextDue(form.last_service_date, form.repeat_interval_days),
        reminder_status: form.reminder_status,
        notes: form.notes.trim() || null,
      };
      return customer?.id
        ? api.entities.CustomerServiceRecord.update(customer.id, payload)
        : api.entities.CustomerServiceRecord.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success(customer ? 'Customer updated' : 'Customer added');
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const valid = form.customer_name.trim() && form.email.trim() && form.service_type.trim() && form.last_service_date && Number(form.repeat_interval_days) > 0;
  const nextDue = calcNextDue(form.last_service_date, form.repeat_interval_days);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogDescription>§ {customer ? 'Edit record' : 'New record'}</DialogDescription>
          <DialogTitle>{customer ? 'Amend the ' : 'Add a '}<em>customer</em></DialogTitle>
        </DialogHeader>

        <form
          className="grid gap-5 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); if (valid) mutation.mutate(); }}
        >
          <Field label="Name" required>
            <Input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} placeholder="Full name" autoFocus />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+353 …" />
          </Field>
          <Field label="Email" required className="sm:col-span-2">
            <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="name@example.com" />
          </Field>

          <Field label="Service type" required>
            {knownTypes.length > 0 && !customType ? (
              <Select value={form.service_type || undefined} onValueChange={onTypeSelect}>
                <SelectTrigger><SelectValue placeholder="Choose a service" /></SelectTrigger>
                <SelectContent>
                  {knownTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  <SelectItem value={OTHER}>Other…</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-end gap-2">
                <Input value={form.service_type} onChange={(e) => set('service_type', e.target.value)} placeholder="e.g. Boiler service" />
                {knownTypes.length > 0 && (
                  <button type="button" className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground pb-2" onClick={() => setCustomType(false)}>
                    list
                  </button>
                )}
              </div>
            )}
          </Field>
          <Field label="Repeat every (days)" required>
            <Input type="number" min={1} value={form.repeat_interval_days} onChange={(e) => set('repeat_interval_days', e.target.value)} />
          </Field>

          <Field label="Last service date" required>
            <Input type="date" value={form.last_service_date} onChange={(e) => set('last_service_date', e.target.value)} />
          </Field>
          <Field label="Next due" hint="auto-calculated">
            <div className="h-10 flex items-center border-b border-border font-mono text-[15px] text-muted-foreground tabular-nums">{nextDue || '—'}</div>
          </Field>

          <Field label="Reminder status">
            <Select value={form.reminder_status} onValueChange={(v) => set('reminder_status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="booked">Booked</SelectItem>
                <SelectItem value="opted_out">Opted out</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Anything worth remembering…" className="min-h-[80px]" />
          </Field>

          <DialogFooter className="sm:col-span-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || mutation.isPending}>
              {mutation.isPending ? 'Saving…' : customer ? 'Save changes' : 'Add customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, required, hint, className, children }) {
  return (
    <div className={className}>
      <Label>
        {label}
        {required && <span className="text-rust ml-1">*</span>}
        {hint && <span className="ml-2 normal-case tracking-normal italic opacity-70">{hint}</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
