import { serviceRole } from '../entities.js';
import { listAdmins } from '../auth.js';
import { syncStripeInvoices } from '../shared/stripeSync.js';

/**
 * Syncs every admin account that has a Stripe key.  Callable by the scheduler
 * (admin context) or manually by an admin.
 */
export async function dailySync() {
  const admins = listAdmins().filter((u) => u.stripe_secret_key);
  const results = [];
  for (const admin of admins) {
    try {
      const r = await syncStripeInvoices({ entities: serviceRole, stripeKey: admin.stripe_secret_key, ownerId: admin.id });
      results.push({ user: admin.email, ...r });
    } catch (e) {
      results.push({ user: admin.email, error: e.message });
    }
  }
  return { success: true, accountsSynced: admins.length, results };
}
