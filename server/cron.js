import cron from 'node-cron';
import { dailySync } from './functions/dailySync.js';
import { dailyDigestAll } from './functions/dailyDigest.js';

/**
 * Scheduled automations — replaces the Base44 automations panel.
 *  - Daily Stripe Sync   (CRON_DAILY_SYNC,   default 09:00)
 *  - Daily Digest        (CRON_DAILY_DIGEST, default 07:30; empty string disables)
 */
export function startScheduler() {
  const syncExpr = process.env.CRON_DAILY_SYNC ?? '0 9 * * *';
  const digestExpr = process.env.CRON_DAILY_DIGEST ?? '30 7 * * *';

  if (syncExpr && cron.validate(syncExpr)) {
    cron.schedule(syncExpr, async () => {
      try {
        const r = await dailySync();
        console.log(`[cron] dailySync → ${r.accountsSynced} account(s)`, JSON.stringify(r.results));
      } catch (e) {
        console.error('[cron] dailySync failed:', e.message);
      }
    });
    console.log(`[cron] Daily Stripe Sync scheduled: "${syncExpr}"`);
  }

  if (digestExpr && cron.validate(digestExpr)) {
    cron.schedule(digestExpr, async () => {
      try {
        const r = await dailyDigestAll();
        console.log('[cron] dailyDigest →', JSON.stringify(r.results));
      } catch (e) {
        console.error('[cron] dailyDigest failed:', e.message);
      }
    });
    console.log(`[cron] Daily Digest scheduled: "${digestExpr}"`);
  }
}
