/**
 * Shared Stripe sync logic — used by both the user-triggered syncStripeInvoices
 * function and the scheduled dailySync job.
 *
 * @param {object} opts
 * @param {object} opts.entities   entity repository (user-scoped or service role)
 * @param {string} opts.stripeKey  the account's Stripe secret key
 * @param {string} [opts.ownerId]  when using service-role entities, the user who owns the rows
 */
export async function syncStripeInvoices({ entities, stripeKey, ownerId }) {
  if (!stripeKey) throw Object.assign(new Error('Stripe key not configured'), { status: 400, code: 'stripe_not_configured' });

  async function stripeList(status) {
    const res = await fetch(`https://api.stripe.com/v1/invoices?status=${status}&limit=100`, {
      headers: { Authorization: `Bearer ${stripeKey}` },
    });
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data?.error?.message || `Stripe API error ${res.status}`);
      err.status = res.status === 401 ? 400 : 502;
      err.code = res.status === 401 ? 'stripe_invalid_key' : 'stripe_error';
      throw err;
    }
    return data.data || [];
  }

  const [openInvoices, paidInvoices] = await Promise.all([stripeList('open'), stripeList('paid')]);

  // With user-scoped entities list() is already RLS-filtered; with service-role
  // entities we narrow to the account owner manually.
  const all = entities.Invoice.list();
  const tracked = ownerId ? all.filter((i) => i.created_by_id === ownerId) : all;
  const byStripeId = new Map(tracked.map((i) => [i.stripe_invoice_id, i]));

  let created = 0;
  let updated = 0;
  let markedPaid = 0;

  const toRecord = (inv) => ({
    stripe_invoice_id: inv.id,
    customer_name: inv.customer_name || inv.customer_details?.name || '',
    customer_email: inv.customer_email || inv.customer_details?.email || 'unknown@unknown',
    amount_due: (inv.amount_due ?? inv.amount_remaining ?? 0) / 100,
    currency: inv.currency || 'usd',
    due_date: inv.due_date ? new Date(inv.due_date * 1000).toISOString().slice(0, 10) : null,
    status: 'open',
    hosted_invoice_url: inv.hosted_invoice_url || '',
    invoice_number: inv.number || '',
    source: 'stripe',
  });

  for (const inv of openInvoices) {
    const rec = toRecord(inv);
    const found = byStripeId.get(inv.id);
    if (found) {
      entities.Invoice.update(found.id, rec);
      updated++;
    } else {
      entities.Invoice.create(rec, ownerId);
      created++;
    }
  }

  const paidIds = new Set(paidInvoices.map((i) => i.id));
  for (const tr of tracked) {
    if (tr.status === 'open' && paidIds.has(tr.stripe_invoice_id)) {
      entities.Invoice.update(tr.id, {
        status: 'paid',
        recovered: (tr.follow_up_count || 0) > 0,
      });
      markedPaid++;
    }
  }

  return { created, updated, markedPaid, totalOpen: openInvoices.length };
}
