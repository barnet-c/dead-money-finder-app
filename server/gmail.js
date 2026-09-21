/**
 * Gmail app-user connector — replaces base44's Gmail connector.
 * Each user connects their own Google account via OAuth; tokens are stored
 * per user and refreshed automatically.
 */
import { randomBytes } from 'node:crypto';
import { db } from './db.js';

export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
];

const clientId = () => process.env.GOOGLE_CLIENT_ID;
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET;
const redirectUri = () => `${process.env.API_URL || 'http://localhost:3001'}/api/gmail/callback`;

export function isGmailConfigured() {
  return !!(clientId() && clientSecret());
}

export function buildAuthUrl(userId) {
  const state = randomBytes(24).toString('hex');
  db.prepare('DELETE FROM oauth_states WHERE created_at < ?').run(Date.now() - 15 * 60 * 1000);
  db.prepare('INSERT INTO oauth_states (state, user_id, created_at) VALUES (?,?,?)').run(state, userId, Date.now());
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    scope: GMAIL_SCOPES.join(' '),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleCallback({ code, state }) {
  const row = db.prepare('SELECT * FROM oauth_states WHERE state = ?').get(state);
  if (!row) throw Object.assign(new Error('Invalid or expired OAuth state'), { status: 400 });
  db.prepare('DELETE FROM oauth_states WHERE state = ?').run(state);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId(),
      client_secret: clientSecret(),
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  const tok = await res.json();
  if (!res.ok) throw Object.assign(new Error(tok.error_description || tok.error || 'Token exchange failed'), { status: 400 });

  const expiresAt = Date.now() + (tok.expires_in || 3600) * 1000 - 60_000;
  const existing = db.prepare('SELECT refresh_token FROM gmail_connections WHERE user_id = ?').get(row.user_id);
  const refresh = tok.refresh_token || existing?.refresh_token || null;

  let email = null;
  try {
    const p = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (p.ok) email = (await p.json()).emailAddress;
  } catch { /* ignore */ }

  db.prepare(`
    INSERT INTO gmail_connections (user_id, email, access_token, refresh_token, expires_at, scope, created_date)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET
      email = excluded.email, access_token = excluded.access_token,
      refresh_token = excluded.refresh_token, expires_at = excluded.expires_at, scope = excluded.scope
  `).run(row.user_id, email, tok.access_token, refresh, expiresAt, tok.scope || '', new Date().toISOString());

  return { userId: row.user_id, email };
}

export function disconnect(userId) {
  const conn = db.prepare('SELECT * FROM gmail_connections WHERE user_id = ?').get(userId);
  if (conn?.access_token) {
    fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refresh_token || conn.access_token)}`, { method: 'POST' }).catch(() => {});
  }
  db.prepare('DELETE FROM gmail_connections WHERE user_id = ?').run(userId);
}

/**
 * Equivalent of base44.connectors.getCurrentAppUserConnection(GMAIL_CONNECTOR_ID).
 * Returns { access_token, email, scope } for the calling user ONLY, or null.
 */
export async function getCurrentAppUserConnection(userId) {
  const conn = db.prepare('SELECT * FROM gmail_connections WHERE user_id = ?').get(userId);
  if (!conn) return null;
  if (conn.expires_at && conn.expires_at > Date.now()) return conn;
  if (!conn.refresh_token) return null;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: conn.refresh_token,
      client_id: clientId(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token',
    }),
  });
  const tok = await res.json();
  if (!res.ok || !tok.access_token) {
    // Refresh token revoked — drop the connection.
    db.prepare('DELETE FROM gmail_connections WHERE user_id = ?').run(userId);
    return null;
  }
  const expiresAt = Date.now() + (tok.expires_in || 3600) * 1000 - 60_000;
  db.prepare('UPDATE gmail_connections SET access_token = ?, expires_at = ? WHERE user_id = ?').run(tok.access_token, expiresAt, userId);
  return { ...conn, access_token: tok.access_token, expires_at: expiresAt };
}

export async function gmailFetch(accessToken, path, init = {}) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Gmail API error ${res.status}`);
    err.status = res.status;
    err.gmail = data;
    throw err;
  }
  return data;
}

export async function getProfile(accessToken) {
  return gmailFetch(accessToken, '/profile');
}

/**
 * Build a raw RFC 2822 message.  CR/LF are stripped from every header value
 * to prevent header injection.
 */
export function buildRawEmail({ from, to, subject, body, replyTo, fromName }) {
  const clean = (v) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim();
  const encodeHeader = (v) => (/[^\x20-\x7E]/.test(v) ? `=?UTF-8?B?${Buffer.from(v, 'utf8').toString('base64')}?=` : v);
  const fromHeader = fromName ? `${encodeHeader(clean(fromName))} <${clean(from)}>` : clean(from);
  const lines = [
    `From: ${fromHeader}`,
    `To: ${clean(to)}`,
    `Subject: ${encodeHeader(clean(subject))}`,
  ];
  if (replyTo) lines.push(`Reply-To: ${clean(replyTo)}`);
  lines.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset="UTF-8"', 'Content-Transfer-Encoding: 7bit', '', String(body ?? ''));
  return lines.join('\r\n');
}

export function base64url(str) {
  return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendGmail(accessToken, rawMessage) {
  return gmailFetch(accessToken, '/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw: base64url(rawMessage) }),
  });
}
