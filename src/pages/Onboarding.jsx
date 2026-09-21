import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/api/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import StepBusiness from '@/components/onboarding/StepBusiness';
import StepPreferences from '@/components/onboarding/StepPreferences';
import StepConnections from '@/components/onboarding/StepConnections';

const STEPS = [
  { n: '01', title: 'Your Business', italic: 'Business', lead: 'Your', blurb: 'Who you are and how customers reach you.' },
  { n: '02', title: 'How You Write', italic: 'Write', lead: 'How You', blurb: 'Where to send bookings and the voice of your emails.' },
  { n: '03', title: 'Connections', italic: 'Connections', lead: '', blurb: 'Gmail for sending, Stripe for invoices. Optional.' },
];

const empty = { business_name: '', owner_name: '', business_phone: '', reply_to_email: '', booking_link: '', owner_email: '', default_tone: 'friendly' };

export default function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(empty);
  const [settingsId, setSettingsId] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const list = await api.entities.BusinessSettings.list();
      if (list[0]) {
        setSettingsId(list[0].id);
        setForm((f) => ({ ...f, ...Object.fromEntries(Object.entries(list[0]).filter(([k]) => k in empty).map(([k, v]) => [k, v ?? ''])) }));
      }
      return list;
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        business_name: form.business_name.trim(),
        owner_name: form.owner_name.trim() || null,
        business_phone: form.business_phone.trim() || null,
        reply_to_email: form.reply_to_email.trim() || null,
        booking_link: form.booking_link.trim() || null,
        owner_email: form.owner_email.trim() || null,
        default_tone: form.default_tone,
      };
      const saved = settingsId ? await api.entities.BusinessSettings.update(settingsId, payload) : await api.entities.BusinessSettings.create(payload);
      setSettingsId(saved.id);
      qc.invalidateQueries({ queryKey: ['settings'] });
      return saved;
    },
    onError: (e) => toast.error(e.message),
  });

  const next = async () => {
    if (step === 0 && !form.business_name.trim()) { toast.error('Business name is required'); return; }
    await save.mutateAsync();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const finish = async () => {
    await save.mutateAsync();
    toast.success('Welcome to the Journal');
    navigate('/', { replace: true });
  };

  const skip = async () => {
    if (form.business_name.trim()) await save.mutateAsync();
    else if (!settingsId) {
      await api.entities.BusinessSettings.create({ business_name: 'My Business', default_tone: 'friendly' });
      qc.invalidateQueries({ queryKey: ['settings'] });
    }
    navigate('/', { replace: true });
  };

  const current = STEPS[step];

  return (
    <div className="min-h-screen bg-background paper-texture">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-12 md:grid-cols-[280px_1fr] md:py-20">
        <aside>
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Vol. I · Getting Started</div>
          <div className="mt-3 font-serif text-3xl leading-[1.05]">The Repeat<br /><em className="font-light">Booking Journal</em></div>

          <ol className="mt-12 space-y-1">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={s.n}>
                  <button
                    type="button"
                    onClick={() => i < step && setStep(i)}
                    className={cn('flex w-full items-center gap-3 px-2 py-2.5 text-left rounded-sm', active ? 'text-foreground' : 'text-muted-foreground', done && 'hover:text-foreground')}
                  >
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10px]', done ? 'border-olive bg-olive text-background' : active ? 'border-foreground' : 'border-border')}>
                      {done ? <Check className="h-3 w-3" strokeWidth={3} /> : s.n.slice(1)}
                    </span>
                    <span className={cn('font-serif text-lg', active && 'italic')}>{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <button type="button" onClick={skip} className="mt-12 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
            Skip for now →
          </button>
        </aside>

        <section className="max-w-2xl">
          <div className="flex items-center gap-3 font-mono text-xs tracking-[0.18em] uppercase text-muted-foreground">
            <span>§ {current.n}</span><span className="rule flex-1" /><span>Step {step + 1} of {STEPS.length}</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              <h1 className="mt-5 font-serif text-5xl leading-[0.95]">
                {current.lead && <>{current.lead} </>}<em className="font-light">{current.italic}</em>
              </h1>
              <p className="mt-3 font-sans text-sm text-muted-foreground">{current.blurb}</p>

              <div className="mt-10">
                {step === 0 && <StepBusiness form={form} set={set} />}
                {step === 1 && <StepPreferences form={form} set={set} />}
                {step === 2 && <StepConnections />}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-12 flex items-center justify-between border-t border-border pt-6">
            <Button type="button" variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>← Back</Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Continue →'}</Button>
            ) : (
              <Button type="button" onClick={finish} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Finish setup'}</Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
