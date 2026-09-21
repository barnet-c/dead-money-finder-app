import { syncStripeInvoices as runSync } from '../shared/stripeSync.js';

export async function syncStripeInvoices({ user, entities }) {
  if (!user.stripe_secret_key) {
    throw Object.assign(new Error('Add your Stripe secret key in Settings first.'), { status: 400, code: 'stripe_not_configured' });
  }
  return runSync({ entities, stripeKey: user.stripe_secret_key });
}
