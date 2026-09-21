import { useState } from 'react';
import { toast } from 'sonner';
import { Check, KeyRound } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { Input } from './ui/input';
import { Button } from './ui/button';

export default function StripeKeySection() {
  const { user, refresh, isAdmin } = useAuth();
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (e) => {
    e?.preventDefault();
    const k = key.trim();
    if (!/^(sk|rk)_(test|live)_/.test(k)) {
      toast.error('Stripe secret keys start with sk_live_, sk_test_, rk_live_ or rk_test_.');
      return;
    }
    setBusy(true);
    try {
      await api.functions.invoke('saveStripeKey', { action: 'save', key: k });
      setKey('');
      await refresh();
      toast.success('Stripe key saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.functions.invoke('saveStripeKey', { action: 'remove' });
      await refresh();
      toast.success('Stripe key removed');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return <p className="font-mono text-xs text-muted-foreground">Only the account owner can manage the Stripe connection.</p>;
  }

  if (user?.has_stripe_key) {
    return (
      <div className="flex flex-col gap-3 border border-olive/20 bg-olive/8 p-4 rounded-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Check className="h-4 w-4 text-olive" />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-olive">Stripe connected</p>
            <p className="font-mono text-[11px] text-muted-foreground">Unpaid invoices sync daily at 09:00 and on demand from Recovery.</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={remove} disabled={busy}>Remove key</Button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk_live_…"
          />
        </div>
        <Button type="submit" disabled={busy || !key.trim()}>
          <KeyRound className="h-3.5 w-3.5" /> {busy ? 'Saving…' : 'Save key'}
        </Button>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground leading-relaxed">
        Use a restricted key with read access to Invoices if you can. The key is stored only on your account and used to read open and paid invoices.
      </p>
    </form>
  );
}
