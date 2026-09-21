/**
 * Entity layer — replaces the Base44 entity SDK.
 *
 * Every custom entity gets a SQLite table with the declared fields plus
 * id / created_by_id / created_date / updated_date.  Row-Level Security is
 * enforced here: every method takes a `userId` and only ever touches rows
 * whose created_by_id matches it.  `serviceRole` bypasses that filter and
 * is used only by scheduled jobs.
 */
import { randomUUID } from 'node:crypto';
import { db } from './db.js';

const SCHEMAS = {
  CustomerServiceRecord: {
    customer_name: 'string',
    email: 'string',
    phone: 'string',
    service_type: 'string',
    last_service_date: 'string',
    repeat_interval_days: 'number',
    next_due_date: 'string',
    notes: 'string',
    reminder_status: { type: 'string', default: 'pending' },
    last_reminder_sent_at: 'string',
    booked_again: { type: 'boolean', default: false },
  },
  BusinessSettings: {
    business_name: 'string',
    owner_name: 'string',
    business_phone: 'string',
    booking_link: 'string',
    reply_to_email: 'string',
    owner_email: 'string',
    default_tone: { type: 'string', default: 'friendly' },
    default_intervals: { type: 'json', default: [] },
  },
  ReminderLog: {
    customer_id: 'string',
    customer_name: 'string',
    message_body: 'string',
    sent_at: 'string',
    channel: { type: 'string', default: 'email' },
    status: { type: 'string', default: 'draft' },
  },
  Invoice: {
    stripe_invoice_id: 'string',
    customer_name: 'string',
    customer_email: 'string',
    amount_due: 'number',
    currency: 'string',
    due_date: 'string',
    status: { type: 'string', default: 'open' },
    hosted_invoice_url: 'string',
    invoice_number: 'string',
    last_follow_up_at: 'string',
    follow_up_count: { type: 'number', default: 0 },
    recovered: { type: 'boolean', default: false },
    source: { type: 'string', default: 'stripe' },
  },
  UnconfirmedInvoice: {
    source_email_id: 'string',
    email_subject: 'string',
    email_from: 'string',
    email_date: 'string',
    invoice_number: 'string',
    amount_due: 'number',
    currency: 'string',
    due_date: 'string',
    customer_name: 'string',
    customer_email: 'string',
    status: { type: 'string', default: 'pending' },
  },
};

const REQUIRED = {
  CustomerServiceRecord: ['customer_name', 'email', 'service_type', 'last_service_date', 'repeat_interval_days'],
  BusinessSettings: ['business_name'],
  ReminderLog: ['customer_id', 'message_body'],
  Invoice: ['stripe_invoice_id', 'customer_email', 'amount_due'],
  UnconfirmedInvoice: ['source_email_id'],
};

const norm = (def) => (typeof def === 'string' ? { type: def } : def);
const sqlType = (t) => (t === 'number' ? 'REAL' : t === 'boolean' ? 'INTEGER' : 'TEXT');

// --- create tables ---------------------------------------------------------
for (const [name, fields] of Object.entries(SCHEMAS)) {
  const cols = Object.entries(fields)
    .map(([f, d]) => `${f} ${sqlType(norm(d).type)}`)
    .join(',\n    ');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${name} (
      id TEXT PRIMARY KEY,
      created_by_id TEXT NOT NULL,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      ${cols}
    );
    CREATE INDEX IF NOT EXISTS idx_${name}_owner ON ${name}(created_by_id);
  `);
}

// --- (de)serialisation -----------------------------------------------------
function toRow(name, data) {
  const out = {};
  for (const [f, d] of Object.entries(SCHEMAS[name])) {
    if (!(f in data)) continue;
    const { type } = norm(d);
    const v = data[f];
    if (v === undefined) continue;
    if (v === null || v === '') { out[f] = null; continue; }
    if (type === 'json') out[f] = JSON.stringify(v);
    else if (type === 'boolean') out[f] = v ? 1 : 0;
    else if (type === 'number') out[f] = Number(v);
    else out[f] = String(v);
  }
  return out;
}

function fromRow(name, row) {
  if (!row) return null;
  const out = { id: row.id, created_by_id: row.created_by_id, created_date: row.created_date, updated_date: row.updated_date };
  for (const [f, d] of Object.entries(SCHEMAS[name])) {
    const { type, default: dflt } = norm(d);
    const v = row[f];
    if (v === null || v === undefined) { out[f] = dflt ?? (type === 'boolean' ? false : type === 'json' ? null : null); continue; }
    if (type === 'json') { try { out[f] = JSON.parse(v); } catch { out[f] = dflt ?? null; } }
    else if (type === 'boolean') out[f] = !!v;
    else out[f] = v;
  }
  return out;
}

function applyDefaults(name, data) {
  const out = { ...data };
  for (const [f, d] of Object.entries(SCHEMAS[name])) {
    const { default: dflt } = norm(d);
    if (out[f] === undefined && dflt !== undefined) out[f] = dflt;
  }
  return out;
}

function validateRequired(name, data) {
  for (const f of REQUIRED[name] || []) {
    if (data[f] === undefined || data[f] === null || data[f] === '') {
      const err = new Error(`${name}.${f} is required`);
      err.status = 400;
      throw err;
    }
  }
}

function parseSort(name, sort) {
  if (!sort) return 'created_date DESC';
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  const allowed = new Set([...Object.keys(SCHEMAS[name]), 'created_date', 'updated_date']);
  if (!allowed.has(field)) return 'created_date DESC';
  return `${field} ${desc ? 'DESC' : 'ASC'}`;
}

function buildWhere(name, where, ownerId) {
  const clauses = [];
  const params = [];
  if (ownerId !== null) { clauses.push('created_by_id = ?'); params.push(ownerId); }
  for (const [f, v] of Object.entries(where || {})) {
    if (!(f in SCHEMAS[name]) && f !== 'id') continue;
    const row = f === 'id' ? { id: v } : toRow(name, { [f]: v });
    if (Array.isArray(v)) {
      clauses.push(`${f} IN (${v.map(() => '?').join(',')})`);
      params.push(...v.map((x) => (typeof x === 'boolean' ? (x ? 1 : 0) : x)));
    } else if (row[f] === null || row[f] === undefined) {
      clauses.push(`${f} IS NULL`);
    } else {
      clauses.push(`${f} = ?`);
      params.push(row[f]);
    }
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

// --- repository factory ----------------------------------------------------
function makeEntity(name, ownerId) {
  const scoped = ownerId !== null;
  return {
    list(sort, limit) {
      const order = parseSort(name, sort);
      const { sql, params } = buildWhere(name, {}, ownerId);
      const lim = limit ? `LIMIT ${Number(limit)}` : '';
      return db.prepare(`SELECT * FROM ${name} ${sql} ORDER BY ${order} ${lim}`).all(...params).map((r) => fromRow(name, r));
    },
    filter(where, sort, limit) {
      const order = parseSort(name, sort);
      const { sql, params } = buildWhere(name, where, ownerId);
      const lim = limit ? `LIMIT ${Number(limit)}` : '';
      return db.prepare(`SELECT * FROM ${name} ${sql} ORDER BY ${order} ${lim}`).all(...params).map((r) => fromRow(name, r));
    },
    get(id) {
      const { sql, params } = buildWhere(name, { id }, ownerId);
      return fromRow(name, db.prepare(`SELECT * FROM ${name} ${sql}`).get(...params));
    },
    create(data, asUserId = ownerId) {
      if (!asUserId) throw Object.assign(new Error('created_by_id required'), { status: 400 });
      const full = applyDefaults(name, data);
      validateRequired(name, full);
      const row = toRow(name, full);
      const now = new Date().toISOString();
      const id = randomUUID();
      const cols = ['id', 'created_by_id', 'created_date', 'updated_date', ...Object.keys(row)];
      const vals = [id, asUserId, now, now, ...Object.values(row)];
      db.prepare(`INSERT INTO ${name} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
      return this.get(id) ?? fromRow(name, db.prepare(`SELECT * FROM ${name} WHERE id = ?`).get(id));
    },
    bulkCreate(items, asUserId = ownerId) {
      const results = [];
      db.exec('BEGIN');
      try {
        for (const item of items) results.push(this.create(item, asUserId));
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
      return results;
    },
    update(id, data) {
      const existing = this.get(id);
      if (!existing) throw Object.assign(new Error(`${name} not found`), { status: 404 });
      const row = toRow(name, data);
      const sets = Object.keys(row).map((k) => `${k} = ?`);
      sets.push('updated_date = ?');
      const params = [...Object.values(row), new Date().toISOString(), id];
      let sql = `UPDATE ${name} SET ${sets.join(', ')} WHERE id = ?`;
      if (scoped) { sql += ' AND created_by_id = ?'; params.push(ownerId); }
      db.prepare(sql).run(...params);
      return this.get(id);
    },
    delete(id) {
      const existing = this.get(id);
      if (!existing) throw Object.assign(new Error(`${name} not found`), { status: 404 });
      const params = [id];
      let sql = `DELETE FROM ${name} WHERE id = ?`;
      if (scoped) { sql += ' AND created_by_id = ?'; params.push(ownerId); }
      db.prepare(sql).run(...params);
      return { success: true };
    },
  };
}

export const ENTITY_NAMES = Object.keys(SCHEMAS);

/** Entities scoped to a user (RLS applied). */
export function entitiesFor(userId) {
  const out = {};
  for (const name of ENTITY_NAMES) out[name] = makeEntity(name, userId);
  return out;
}

/** Service-role entities — no RLS.  Scheduled jobs only. */
export const serviceRole = (() => {
  const out = {};
  for (const name of ENTITY_NAMES) out[name] = makeEntity(name, null);
  return out;
})();
