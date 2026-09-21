import OnboardingField, { OnboardingInput } from './OnboardingField';
import { cn } from '@/lib/utils';

export const TONES = [
  { value: 'friendly', label: 'Friendly', blurb: 'Warm, first-name terms, a little personality.' },
  { value: 'professional', label: 'Professional', blurb: 'Polished and courteous. Suits trades and clinics.' },
  { value: 'urgent', label: 'Urgent', blurb: 'Direct, time-sensitive, clear on consequences.' },
  { value: 'casual', label: 'Casual', blurb: 'Relaxed and short, like a text from a mate.' },
];

export default function StepPreferences({ form, set }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-6 sm:grid-cols-2">
        <OnboardingField label="Booking link" hint="Where reminder emails send customers to book." className="sm:col-span-2">
          <OnboardingInput value={form.booking_link} onChange={(e) => set('booking_link', e.target.value)} placeholder="https://…" />
        </OnboardingField>
        <OnboardingField label="Digest email" hint="Receives a daily summary of what's overdue and due soon." className="sm:col-span-2">
          <OnboardingInput type="email" value={form.owner_email} onChange={(e) => set('owner_email', e.target.value)} placeholder="you@yourbusiness.com" />
        </OnboardingField>
      </div>

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Default tone</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {TONES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => set('default_tone', t.value)}
              className={cn(
                'text-left border p-4 rounded-sm transition-colors',
                form.default_tone === t.value ? 'border-foreground bg-card' : 'border-border hover:border-foreground/40',
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-serif text-lg">{t.label}</span>
                <span className={cn('h-2 w-2 rounded-full', form.default_tone === t.value ? 'bg-foreground' : 'bg-border')} />
              </div>
              <p className="mt-1 font-sans text-xs text-muted-foreground leading-relaxed">{t.blurb}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
