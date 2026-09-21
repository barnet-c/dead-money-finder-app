import { differenceInCalendarDays, parseISO, format } from 'date-fns';
import { serviceRole } from '../entities.js';
import { SendEmail } from '../email.js';
import { listAdmins } from '../auth.js';

function bucket(customers, now = new Date()) {
  const overdue = [];
  const today = [];
  const soon = [];
  for (const c of customers) {
    if (!c.next_due_date || c.reminder_status === 'opted_out') continue;
    const d = differenceInCalendarDays(parseISO(c.next_due_date), now);
    if (d < 0) overdue.push({ ...c, days: d });
    else if (d === 0) today.push({ ...c, days: d });
    else if (d <= 14) soon.push({ ...c, days: d });
  }
  overdue.sort((a, b) => a.days - b.days);
  soon.sort((a, b) => a.days - b.days);
  return { overdue, today, soon };
}

function line(c) {
  const due = c.next_due_date ? format(parseISO(c.next_due_date), 'd MMM') : '—';
  const rel = c.days < 0 ? `${Math.abs(c.days)}d overdue` : c.days === 0 ? 'due today' : `in ${c.days}d`;
  return `  • ${c.customer_name} — ${c.service_type} (due ${due}, ${rel})${c.phone ? ' · ' + c.phone : ''}`;
}

export function buildDigest({ settings, customers, now = new Date() }) {
  const { overdue, today, soon } = bucket(customers, now);
  const parts = [
    `${settings.business_name} — Daily Digest for ${format(now, 'EEEE d MMMM yyyy')}`,
    '',
    `🔴 OVERDUE (${overdue.length})`,
    overdue.length ? overdue.map(line).join('\n') : '  Nothing overdue. Nice.',
    '',
    `🟡 DUE TODAY (${today.length})`,
    today.length ? today.map(line).join('\n') : '  No services due today.',
    '',
    `🔵 DUE IN THE NEXT 14 DAYS (${soon.length})`,
    soon.length ? soon.map(line).join('\n') : '  Nothing coming up in the next fortnight.',
    '',
    '— The Repeat Booking Journal',
  ];
  return {
    subject: `Daily Digest: ${overdue.length} overdue, ${today.length + soon.length} due soon`,
    body: parts.join('\n'),
    counts: { overdue: overdue.length, today: today.length, soon: soon.length },
  };
}

/**
 * Sends the digest for one owner (service role, no user session).
 */
export async function digestForOwner(ownerId) {
  const settings = serviceRole.BusinessSettings.list().find((s) => s.created_by_id === ownerId);
  if (!settings) return { skipped: 'no_settings' };
  if (!settings.owner_email) return { skipped: 'no_owner_email' };
  const customers = serviceRole.CustomerServiceRecord.list().filter((c) => c.created_by_id === ownerId);
  const { subject, body, counts } = buildDigest({ settings, customers });
  await SendEmail({ to: settings.owner_email, subject, body, from_name: settings.business_name, viaUserId: ownerId });
  return { sent: true, to: settings.owner_email, ...counts };
}

/** Manual trigger: digest for the calling admin. */
export async function dailyDigest({ user }) {
  const r = await digestForOwner(user.id);
  if (r.skipped === 'no_settings') throw Object.assign(new Error('Complete your business settings first.'), { status: 400 });
  if (r.skipped === 'no_owner_email') throw Object.assign(new Error('Add an owner email in Settings to receive the digest.'), { status: 400 });
  return r;
}

/** Scheduled: digest for every admin. */
export async function dailyDigestAll() {
  const results = [];
  for (const admin of listAdmins()) {
    try {
      results.push({ user: admin.email, ...(await digestForOwner(admin.id)) });
    } catch (e) {
      results.push({ user: admin.email, error: e.message });
    }
  }
  return { results };
}
