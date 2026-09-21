import { generateReminderMessage } from './generateReminderMessage.js';
import { sendReminder } from './sendReminder.js';
import { autoSendReminders } from './autoSendReminders.js';
import { generateInvoiceFollowUp } from './generateInvoiceFollowUp.js';
import { sendInvoiceFollowUp } from './sendInvoiceFollowUp.js';
import { syncStripeInvoices } from './syncStripeInvoices.js';
import { dailySync } from './dailySync.js';
import { saveStripeKey } from './saveStripeKey.js';
import { checkGmailConnection } from './checkGmailConnection.js';
import { scanGmailInbox } from './scanGmailInbox.js';
import { dailyDigest } from './dailyDigest.js';

/**
 * Registry of callable backend functions.
 * `admin: true` mirrors the Base44 admin-only checks.
 */
export const FUNCTIONS = {
  generateReminderMessage: { handler: generateReminderMessage, admin: false },
  sendReminder: { handler: sendReminder, admin: true },
  autoSendReminders: { handler: autoSendReminders, admin: true },
  generateInvoiceFollowUp: { handler: generateInvoiceFollowUp, admin: false },
  sendInvoiceFollowUp: { handler: sendInvoiceFollowUp, admin: false },
  syncStripeInvoices: { handler: syncStripeInvoices, admin: false },
  dailySync: { handler: dailySync, admin: true },
  saveStripeKey: { handler: saveStripeKey, admin: true },
  checkGmailConnection: { handler: checkGmailConnection, admin: true },
  scanGmailInbox: { handler: scanGmailInbox, admin: true },
  dailyDigest: { handler: dailyDigest, admin: true },
};
