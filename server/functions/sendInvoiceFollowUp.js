import { getProfile, buildRawEmail, sendGmail } from '../gmail.js';
import { requireGmail } from './sendReminder.js';

export async function sendInvoiceFollowUp({ user, entities, body }) {
  const { invoiceId, messageBody } = body || {};
  if (!invoiceId || !messageBody?.trim()) throw Object.assign(new Error('invoiceId and messageBody are required'), { status: 400 });

  const invoice = entities.Invoice.get(invoiceId);
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { status: 404 });
  const settings = entities.BusinessSettings.list()[0] || null;

  const conn = await requireGmail(user.id);
  const profile = await getProfile(conn.access_token);

  const number = invoice.invoice_number || invoice.stripe_invoice_id;
  const raw = buildRawEmail({
    from: profile.emailAddress,
    fromName: settings?.business_name,
    to: invoice.customer_email,
    replyTo: settings?.reply_to_email || undefined,
    subject: `Invoice ${number} — payment reminder`,
    body: messageBody.trim(),
  });
  await sendGmail(conn.access_token, raw);

  const now = new Date().toISOString();
  entities.ReminderLog.create({
    customer_id: invoice.id,
    customer_name: invoice.customer_name || invoice.customer_email,
    message_body: messageBody.trim(),
    sent_at: now,
    channel: 'email',
    status: 'sent',
  });
  const updated = entities.Invoice.update(invoice.id, {
    follow_up_count: (invoice.follow_up_count || 0) + 1,
    last_follow_up_at: now,
  });

  return { success: true, invoice: updated };
}
