import { gmailFetch } from '../gmail.js';
import { requireGmail } from './sendReminder.js';
import { InvokeLLM, sanitize, INJECTION_DEFENSE } from '../llm.js';

const QUERY = 'subject:(invoice OR "payment due" OR overdue OR "amount due" OR "payment reminder") newer_than:90d';

function decodeB64Url(s) {
  return Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** Walk the MIME tree: prefer text/plain, fall back to text/html stripped of tags. */
export function extractPlainText(payload) {
  let plain = '';
  let html = '';
  const walk = (part) => {
    if (!part) return;
    const mime = part.mimeType || '';
    if (part.body?.data) {
      if (mime === 'text/plain' && !plain) plain = decodeB64Url(part.body.data);
      else if (mime === 'text/html' && !html) html = decodeB64Url(part.body.data);
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  const text = plain || (html ? stripHtml(html) : '');
  return text.slice(0, 4000);
}

const header = (headers, name) => headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

const SCHEMA = {
  type: 'object',
  properties: {
    is_unpaid_invoice: { type: 'boolean', description: 'True only if this email is an unpaid invoice or a payment request that is still outstanding. False for receipts, payment confirmations, marketing, newsletters, or statements showing a zero balance.' },
    invoice_number: { type: ['string', 'null'] },
    amount_due: { type: ['number', 'null'], description: 'Numeric amount still owed, without currency symbol.' },
    currency: { type: ['string', 'null'], description: 'ISO 4217 code such as usd, eur, gbp.' },
    due_date: { type: ['string', 'null'], description: 'YYYY-MM-DD or null.' },
    customer_name: { type: ['string', 'null'], description: 'The person or company who owes the money.' },
    customer_email: { type: ['string', 'null'] },
  },
  required: ['is_unpaid_invoice'],
};

export async function scanGmailInbox({ user, entities }) {
  const conn = await requireGmail(user.id);
  const token = conn.access_token;

  let list;
  try {
    list = await gmailFetch(token, `/messages?q=${encodeURIComponent(QUERY)}&maxResults=25`);
  } catch (e) {
    if (e.status === 403) throw Object.assign(new Error('Your Gmail connection does not include read permission. Reconnect Gmail and grant read access.'), { status: 403, code: 'gmail_read_permission_missing' });
    throw e;
  }
  const messages = list?.messages || [];

  // Dedup sets
  const unconfirmed = entities.UnconfirmedInvoice.list();
  const invoices = entities.Invoice.list();
  const seenEmailIds = new Set(unconfirmed.map((u) => u.source_email_id));
  const knownNumbers = new Set(
    [...unconfirmed.map((u) => u.invoice_number), ...invoices.map((i) => i.invoice_number)]
      .filter(Boolean)
      .map((n) => String(n).trim().toLowerCase()),
  );
  for (const inv of invoices) if (inv.stripe_invoice_id?.startsWith('gmail_')) seenEmailIds.add(inv.stripe_invoice_id.slice(6));

  let scanned = 0;
  let found = 0;

  for (const m of messages) {
    if (seenEmailIds.has(m.id)) continue;
    scanned++;
    let full;
    try {
      full = await gmailFetch(token, `/messages/${m.id}?format=full`);
    } catch {
      continue;
    }
    const headers = full.payload?.headers || [];
    const subject = header(headers, 'Subject');
    const from = header(headers, 'From');
    const date = header(headers, 'Date');
    const text = extractPlainText(full.payload);

    const system = `You classify emails for a small business and extract invoice details.
${INJECTION_DEFENSE}`;
    const prompt = `Determine whether the email below is an UNPAID invoice or payment request that is still outstanding, and extract its details.

<email_data>
subject: ${sanitize(subject, 300)}
from: ${sanitize(from, 200)}
date: ${sanitize(date, 60)}
body:
${text.replace(/[<>]/g, '')}
</email_data>

Exclude payment confirmations, receipts, "thank you for your payment", marketing, and newsletters (is_unpaid_invoice = false for those).
Return due_date as YYYY-MM-DD or null. amount_due must be a number or null.`;

    let result;
    try {
      result = await InvokeLLM({ system, prompt, response_json_schema: SCHEMA, max_tokens: 400 });
    } catch (e) {
      if (e.code === 'llm_not_configured') throw e;
      continue;
    }
    if (!result?.is_unpaid_invoice) continue;

    const num = result.invoice_number ? String(result.invoice_number).trim() : '';
    if (num && knownNumbers.has(num.toLowerCase())) continue;

    entities.UnconfirmedInvoice.create({
      source_email_id: m.id,
      email_subject: subject,
      email_from: from,
      email_date: date,
      invoice_number: num || null,
      amount_due: result.amount_due ?? null,
      currency: result.currency ? String(result.currency).toLowerCase() : null,
      due_date: result.due_date || null,
      customer_name: result.customer_name || null,
      customer_email: result.customer_email || null,
      status: 'pending',
    });
    if (num) knownNumbers.add(num.toLowerCase());
    seenEmailIds.add(m.id);
    found++;
  }

  return { scanned, found };
}
