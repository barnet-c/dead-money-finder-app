import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import OnboardingField, { OnboardingInput } from '@/components/onboarding/OnboardingField';
import { Button } from '@/components/ui/button';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', full_name: '' });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') await login({ email: form.email, password: form.password });
      else await register(form);
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background paper-texture flex items-center justify-center px-5">
      <div className="w-full max-w-md">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Vol. I · {mode === 'login' ? 'Sign in' : 'Subscribe'}</div>
        <div className="rule mt-3" />
        <h1 className="mt-6 font-serif text-5xl leading-[0.95]">The Repeat<br /><em className="font-light">Booking Journal</em></h1>
        <p className="mt-4 font-sans text-sm text-muted-foreground leading-relaxed">
          Service tracking, invoice recovery and the occasional gentle nudge — for businesses that live on repeat work.
        </p>

        <form onSubmit={submit} className="mt-10 space-y-6">
          {mode === 'register' && (
            <OnboardingField label="Your name">
              <OnboardingInput mono={false} value={form.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Full name" autoFocus />
            </OnboardingField>
          )}
          <OnboardingField label="Email" required>
            <OnboardingInput type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="you@business.com" autoFocus={mode === 'login'} required />
          </OnboardingField>
          <OnboardingField label="Password" required hint={mode === 'register' ? 'At least 8 characters.' : undefined}>
            <OnboardingInput type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" required minLength={8} />
          </OnboardingField>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'Create an account' : 'I already have an account'}
            </button>
            <Button type="submit" disabled={busy}>{busy ? 'One moment…' : mode === 'login' ? 'Sign in →' : 'Create account →'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
