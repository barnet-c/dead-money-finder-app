import GmailConnectBanner from '../GmailConnectBanner';
import StripeKeySection from '../StripeKeySection';

export default function StepConnections() {
  return (
    <div className="space-y-10">
      <div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Gmail</span><span className="rule flex-1" />
        </div>
        <p className="mt-3 font-sans text-sm text-muted-foreground leading-relaxed">
          Reminders and invoice follow-ups are sent from your own Gmail account, and your inbox is scanned for unpaid invoices. Nothing is sent without your approval.
        </p>
        <div className="mt-4"><GmailConnectBanner /></div>
      </div>
      <div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span>Stripe</span><span className="rule flex-1" />
        </div>
        <p className="mt-3 font-sans text-sm text-muted-foreground leading-relaxed">
          Paste a secret key to pull open invoices into Recovery. Both can be added later in Settings.
        </p>
        <div className="mt-4"><StripeKeySection /></div>
      </div>
    </div>
  );
}
