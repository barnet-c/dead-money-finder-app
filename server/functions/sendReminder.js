import { getCurrentAppUserConnection, getProfile, buildRawEmail, sendGmail } from '../gmail.js';

export const GMAIL_NOT_CONNECTED = Object.freeze({ status: 403, code: 'gmail_not_connected', message: 'Connect your Gmail account to send email.' });

export async function requireGmail(userId) {
  const conn = await getCurrentAppUserConnection(userId);
  if (!conn?.access_token) throw Object.assign(new Error(GMAIL_NOT_CONNECTED.message), GMAIL_NOT_CONNECTED);
  return conn;
}

/**
 * Sends one reminder through the caller's own Gmail and records it.
 * Shared by sendReminder + autoSendReminders.
 */
export async function dispatchReminder({ entities, accessToken, senderEmail, customer, settings, messageBody }) {
  const subject = `Time to book your next ${customer.service_type || 'service'}`;
  const raw = buildRawEmail({
    from: senderEmail,
    fromName: settings?.business_name,
    to: customer.email,
    replyTo: settings?.reply_to_email || undefined,
    subject,
    body: messageBody,
  });
  await sendGmail(accessToken, raw);

  const now = new Date().toISOString();
  await Promise.all([
    Promise.resolve(entities.ReminderLog.create({
      customer_id: customer.id,
      customer_name: customer.customer_name,
      message_body: messageBody,
      sent_at: now,
      channel: 'email',
      status: 'sent',
    })),
    Promise.resolve(entities.CustomerServiceRecord.update(customer.id, {
      reminder_status: 'sent',
      last_reminder_sent_at: now,
    })),
  ]);
}

export async function sendReminder({ user, entities, body }) {
  const { customerId, messageBody } = body || {};
  if (!customerId || !messageBody?.trim()) throw Object.assign(new Error('customerId and messageBody are required'), { status: 400 });

  const customer = entities.CustomerServiceRecord.get(customerId);
  if (!customer) throw Object.assign(new Error('Customer not found'), { status: 404 });
  const settings = entities.BusinessSettings.list()[0] || null;

  const conn = await requireGmail(user.id);
  const profile = await getProfile(conn.access_token);

  await dispatchReminder({
    entities,
    accessToken: conn.access_token,
    senderEmail: profile.emailAddress,
    customer,
    settings,
    messageBody: messageBody.trim(),
  });

  return { success: true };
}
