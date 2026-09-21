import { updateUser } from '../auth.js';

const KEY_RE = /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,200}$/;

export async function saveStripeKey({ user, body }) {
  const { action, key } = body || {};
  if (action === 'remove') {
    updateUser(user.id, { stripe_secret_key: null });
    return { success: true };
  }
  if (action === 'save') {
    const k = String(key || '').trim();
    if (!KEY_RE.test(k)) throw Object.assign(new Error('That does not look like a valid Stripe secret key (sk_live_… or sk_test_…).'), { status: 400 });
    updateUser(user.id, { stripe_secret_key: k });
    return { success: true };
  }
  throw Object.assign(new Error('action must be "save" or "remove"'), { status: 400 });
}
