import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE = 'rf_session';

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    has_stripe_key: !!row.stripe_secret_key,
    created_date: row.created_date,
  };
}

export function findUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
}

export function listAdmins() {
  return db.prepare("SELECT * FROM users WHERE role = 'admin'").all();
}

export function updateUser(id, patch) {
  const allowed = ['full_name', 'stripe_secret_key'];
  const sets = [];
  const params = [];
  for (const k of allowed) {
    if (k in patch) { sets.push(`${k} = ?`); params.push(patch[k]); }
  }
  if (!sets.length) return findUserById(id);
  params.push(id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...params);
  return findUserById(id);
}

export async function register({ email, password, full_name }) {
  email = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Valid email required'), { status: 400 });
  if (!password || String(password).length < 8) throw Object.assign(new Error('Password must be at least 8 characters'), { status: 400 });
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) throw Object.assign(new Error('An account with that email already exists'), { status: 409 });

  // Every account is the admin of its own tenant (data is isolated per user by
  // RLS, so "admin" here means "owner of this business", not a global admin).
  // Set DEFAULT_USER_ROLE=user to make later sign-ups read-only members.
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  const role = count === 0 ? 'admin' : (process.env.DEFAULT_USER_ROLE || 'admin');
  const id = randomUUID();
  const hash = await bcrypt.hash(String(password), 10);
  db.prepare('INSERT INTO users (id, email, full_name, password_hash, role, created_date) VALUES (?,?,?,?,?,?)')
    .run(id, email, full_name || null, hash, role, new Date().toISOString());
  return findUserById(id);
}

export async function login({ email, password }) {
  email = String(email || '').trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!row) throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  const ok = await bcrypt.compare(String(password || ''), row.password_hash);
  if (!ok) throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  return row;
}

export function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

export function setSessionCookie(res, user) {
  res.cookie(COOKIE, signToken(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 3600 * 1000,
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

/** Attach req.user if a valid session cookie is present. */
export function attachUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { sub } = jwt.verify(token, JWT_SECRET);
      req.user = findUserById(sub);
    } catch {
      req.user = null;
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden', message: 'Admin access required' });
  next();
}
