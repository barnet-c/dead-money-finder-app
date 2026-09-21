import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { api } from '@/api/client';
import { Masthead, SectionHeader } from '@/components/Editorial';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Field } from '@/components/CustomerFormModal';
import StripeKeySection from '@/components/StripeKeySection';
import GmailConnectBanner from '@/components/GmailConnectBanner';
import { TONES } from '@/components/onboarding/StepPreferences';

const empty = {
  business_name: '', owner_name: '', business_phone: '', booking_link: '', reply_to_email: '', owner_email: '',
  default_tone: 'friendly', default_intervals: [],
};

export default function Settings() {
  const qc = useQueryClient();
  const settingsQ = useQuery({ queryKey: ['settings'], queryFn: () => api.entities.BusinessSettings.list() });
  const existing = settingsQ.data?.[0] || null;
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (existing) {
      setForm({ ...empty, ...Object.fromEntries(Object.entries(existing).map(([k, v]) => [k, v ?? ''])), default_intervals: existing.default_intervals || [] });
    }
  }, [existing]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setInterval_ = (i, k, v) => setForm((f) => ({ ...f, default_intervals: f.default_intervals.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)) }));
  const addInterval = () => set('default_intervals', [...form.default_intervals, { service_type: '', interval_days: 90 }]);
  const removeInterval = (i) => set('default_intervals', form.default_intervals.filter((_, idx) => idx !== i));

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        business_name: form.business_name.trim(),
        owner_name: form.owner_name.trim() || null,
        business_phone: form.business_phone.trim() || null,
        booking_link: form.booking_link.trim() || null,
        reply_to_email: form.reply_to_email.trim() || null,
        owner_email: form.owner_email.trim() || null,
        default_tone: form.default_tone,
        default_intervals: form.default_intervals
          .map((r) => ({ service_type: String(r.service_type || '').trim(), interval_days: Number(r.interval_days) || 0 }))
          .filter((r) => r.service_type && r.interval_days > 0),
      };
      return existing ? api.entities.BusinessSettings.update(existing.id, payload) : api.entities.BusinessSettings.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved'); },
    onError: (e) => toast.error(e.message),
  });

  const digest = useMutation({
    mutationFn: () => api.functions.invoke('dailyDigest'),
    onSuccess: (r) => toast.success(`Digest sent to ${r.to}`),
    onError: (e) => toast.error(e.message),
  });

  const autoSend = useMutation({
    mutationFn: () => api.functions.invoke('autoSendReminders'),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['reminderLogs'] });
      toast.success(`Auto-send complete · ${r.sent} sent, ${r.failed} failed`);
    },
    onError: (e) => toast.error(e.code === 'gmail_not_connected' ? 'Connect Gmail first.' : e.message),
  });

  return (
    <>
      <Masthead kicker="The Setup" meta="Configuration · Vol. I" title="The" italic="Setup">
        <Button onClick={() => save.mutate()} disabled={save.isPending || !form.business_name.trim()}>{save.isPending ? 'Saving…' : 'Save settings'}</Button>
      </Masthead>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="max-w-3xl space-y-16">
        <section>
          <SectionHeader number={1} title={<>Business <em>Particulars</em></>} />
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="Business name" required className="sm:col-span-2"><Input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} className="font-sans" /></Field>
            <Field label="Owner name"><Input value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} className="font-sans" placeholder="Signs the emails" /></Field>
            <Field label="Business phone"><Input value={form.business_phone} onChange={(e) => set('business_phone', e.target.value)} placeholder="+353 …" /></Field>
            <Field label="Booking link" className="sm:col-span-2"><Input value={form.booking_link} onChange={(e) => set('booking_link', e.target.value)} placeholder="https://…" /></Field>
            <Field label="Reply-to email" hint="customer replies"><Input type="email" value={form.reply_to_email} onChange={(e) => set('reply_to_email', e.target.value)} placeholder="hello@…" /></Field>
            <Field label="Owner email" hint="daily digest"><Input type="email" value={form.owner_email} onChange={(e) => set('owner_email', e.target.value)} placeholder="you@…" /></Field>
          </div>
        </section>

        <section>
          <SectionHeader number={2} title={<>Voice & <em>Tone</em></>} />
          <div className="max-w-sm">
            <Field label="Default tone">
              <Select value={form.default_tone} onValueChange={(v) => set('default_tone', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TONES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <p className="mt-3 font-sans text-xs text-muted-foreground leading-relaxed">{TONES.find((t) => t.value === form.default_tone)?.blurb}</p>
          </div>
        </section>

        <section>
          <SectionHeader
            number={3}
            title={<>Service <em>Cadence</em></>}
            action={<Button type="button" variant="secondary" size="sm" onClick={addInterval}><Plus className="h-3 w-3" /> Add service</Button>}
          />
          {form.default_intervals.length === 0 ? (
            <p className="font-serif text-xl italic text-muted-foreground">No default services yet. Add the services you offer and how often they repeat.</p>
          ) : (
            <div className="border-t border-border">
              {form.default_intervals.map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_32px] items-end gap-4 border-b border-border py-3">
                  <Field label="Service type"><Input value={row.service_type} onChange={(e) => setInterval_(i, 'service_type', e.target.value)} placeholder="e.g. Boiler service" className="font-sans" /></Field>
                  <Field label="Every (days)"><Input type="number" min={1} value={row.interval_days} onChange={(e) => setInterval_(i, 'interval_days', e.target.value)} /></Field>
                  <button type="button" onClick={() => removeInterval(i)} className="mb-2 text-muted-foreground hover:text-rust" aria-label="Remove"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <SectionHeader number={4} title={<>Connections</>} />
          <div className="space-y-8">
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Gmail</p>
              <GmailConnectBanner />
            </div>
            <div>
              <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Stripe</p>
              <StripeKeySection />
            </div>
          </div>
        </section>

        <section>
          <SectionHeader number={5} title={<>Automations</>} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="border border-border bg-card p-5 rounded-sm">
              <p className="font-serif text-lg">Auto-send reminders</p>
              <p className="mt-1 font-sans text-xs text-muted-foreground leading-relaxed">Drafts and sends a reminder to every customer due within 3 days who has not been reminded in the last week. Uses your Gmail.</p>
              <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => autoSend.mutate()} disabled={autoSend.isPending}>{autoSend.isPending ? 'Sending…' : 'Run now'}</Button>
            </div>
            <div className="border border-border bg-card p-5 rounded-sm">
              <p className="font-serif text-lg">Daily digest</p>
              <p className="mt-1 font-sans text-xs text-muted-foreground leading-relaxed">Overdue, due today and due-in-14-days lists, emailed to the owner email above. Runs each morning automatically.</p>
              <Button type="button" variant="secondary" size="sm" className="mt-4" onClick={() => digest.mutate()} disabled={digest.isPending}>{digest.isPending ? 'Sending…' : 'Send test digest'}</Button>
            </div>
          </div>
        </section>

        <div className="flex justify-end border-t border-border pt-6">
          <Button type="submit" disabled={save.isPending || !form.business_name.trim()}>{save.isPending ? 'Saving…' : 'Save settings'}</Button>
        </div>
      </form>
    </>
  );
}
