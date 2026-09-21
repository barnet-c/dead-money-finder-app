import { differenceInCalendarDays, parseISO, differenceInHours } from 'date-fns';
import { InvokeLLM } from '../llm.js';
import { buildReminderPrompt } from './generateReminderMessage.js';
import { requireGmail, dispatchReminder } from './sendReminder.js';
import { getProfile } from '../gmail.js';

export function selectDueCustomers(customers, now = new Date()) {
  return customers.filter((c) => {
    if (!c.next_due_date) return false;
    if (c.reminder_status === 'opted_out') return false;
    const days = differenceInCalendarDays(parseISO(c.next_due_date), now);
    if (days > 3) return false;
    if (c.last_reminder_sent_at) {
      const hours = differenceInHours(now, new Date(c.last_reminder_sent_at));
      if (hours < 7 * 24) return false;
    }
    return true;
  });
}

export async function autoSendReminders({ user, entities }) {
  const customers = entities.CustomerServiceRecord.list();
  const settings = entities.BusinessSettings.list()[0] || null;
  const due = selectDueCustomers(customers);

  // Only the calling admin's own Gmail connection is ever used.
  const conn = await requireGmail(user.id);
  const profile = await getProfile(conn.access_token);

  let sent = 0;
  let failed = 0;
  const errors = [];

  for (const customer of due) {
    try {
      const { system, prompt } = buildReminderPrompt(customer, settings);
      const message = await InvokeLLM({ system, prompt, max_tokens: 600 });
      await dispatchReminder({
        entities,
        accessToken: conn.access_token,
        senderEmail: profile.emailAddress,
        customer,
        settings,
        messageBody: message,
      });
      sent++;
    } catch (e) {
      failed++;
      errors.push({ customer_id: customer.id, customer_name: customer.customer_name, error: e.message });
    }
  }

  return { sent, failed, errors };
}
