import OnboardingField, { OnboardingInput } from './OnboardingField';

export default function StepBusiness({ form, set }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <OnboardingField label="Business name" required className="sm:col-span-2">
        <OnboardingInput mono={false} value={form.business_name} onChange={(e) => set('business_name', e.target.value)} placeholder="e.g. Hartley Heating" autoFocus />
      </OnboardingField>
      <OnboardingField label="Your name">
        <OnboardingInput mono={false} value={form.owner_name} onChange={(e) => set('owner_name', e.target.value)} placeholder="Who signs the emails" />
      </OnboardingField>
      <OnboardingField label="Business phone">
        <OnboardingInput value={form.business_phone} onChange={(e) => set('business_phone', e.target.value)} placeholder="+353 …" />
      </OnboardingField>
      <OnboardingField label="Reply-to email" hint="Customer replies land here." className="sm:col-span-2">
        <OnboardingInput type="email" value={form.reply_to_email} onChange={(e) => set('reply_to_email', e.target.value)} placeholder="hello@yourbusiness.com" />
      </OnboardingField>
    </div>
  );
}
