import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, Check, Unplug } from 'lucide-react';
import { api } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

export default function GmailConnectBanner({ compact = false, className }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['gmail', 'connection'],
    queryFn: () => api.functions.invoke('checkGmailConnection'),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const health = useQuery({ queryKey: ['health'], queryFn: api.health, staleTime: 5 * 60_000 });

  const connect = async () => {
    if (health.data && !health.data.gmail_configured) {
      toast.error('Gmail OAuth is not configured on the server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env.');
      return;
    }
    setBusy(true);
    const r = await api.connectors.connectAppUser();
    setBusy(false);
    if (!r.opened) toast.error('Popup blocked. Allow popups for this site and try again.');
    await qc.invalidateQueries({ queryKey: ['gmail'] });
    const fresh = await api.functions.invoke('checkGmailConnection').catch(() => null);
    if (fresh?.connected) toast.success(`Gmail connected as ${fresh.email}`);
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await api.connectors.disconnectGmail();
      toast.success('Gmail disconnected');
      qc.invalidateQueries({ queryKey: ['gmail'] });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) return null;

  if (isLoading) {
    return <div className={cn('h-9 w-40 animate-pulse rounded-sm bg-muted', className)} />;
  }

  if (data?.connected) {
    return (
      <div className={cn('inline-flex items-center gap-3 rounded-sm border border-olive/20 bg-olive/8 px-3 h-9', className)}>
        <Check className="h-3.5 w-3.5 text-olive" />
        <span className="font-mono text-[11px] uppercase tracking-wider text-olive">
          Gmail connected{!compact && data.email ? <span className="normal-case tracking-normal opacity-80"> · {data.email}</span> : null}
        </span>
        <button type="button" onClick={disconnect} disabled={busy} className="text-olive/70 hover:text-olive" title="Disconnect">
          <Unplug className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <Button variant="destructive" onClick={connect} disabled={busy} className={className}>
      <Mail className="h-3.5 w-3.5" /> {busy ? 'Waiting for Google…' : 'Connect Gmail'}
    </Button>
  );
}
