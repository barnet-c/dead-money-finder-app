import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { entitiesFor, ENTITY_NAMES } from './entities.js';
import {
  attachUser, requireAuth, requireAdmin, register, login, publicUser,
  setSessionCookie, clearSessionCookie, updateUser,
} from './auth.js';
import { FUNCTIONS } from './functions/index.js';
import { buildAuthUrl, handleCallback, disconnect, isGmailConfigured } from './gmail.js';
import { startScheduler } from './cron.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

const app = express();
app.set('trust proxy', 1); // Azure App Service terminates TLS in front of us
app.use(cors({ origin: APP_URL, credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(attachUser);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---- health ---------------------------------------------------------------
app.get('/api/health', (_req, res) => res.json({
  ok: true,
  gmail_configured: isGmailConfigured(),
  llm_configured: !!process.env.ANTHROPIC_API_KEY,
}));

// ---- auth -----------------------------------------------------------------
app.post('/api/auth/register', wrap(async (req, res) => {
  const user = await register(req.body || {});
  setSessionCookie(res, user);
  res.json(publicUser(user));
}));
app.post('/api/auth/login', wrap(async (req, res) => {
  const user = await login(req.body || {});
  setSessionCookie(res, user);
  res.json(publicUser(user));
}));
app.post('/api/auth/logout', (_req, res) => { clearSessionCookie(res); res.json({ success: true }); });
app.get('/api/auth/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  res.json(publicUser(req.user));
});
app.patch('/api/auth/me', requireAuth, wrap(async (req, res) => {
  const { full_name } = req.body || {};
  res.json(publicUser(updateUser(req.user.id, { full_name })));
}));

// ---- entities (RLS: scoped to req.user) -----------------------------------
app.use('/api/entities/:name', requireAuth, (req, res, next) => {
  if (!ENTITY_NAMES.includes(req.params.name)) return res.status(404).json({ error: 'unknown_entity' });
  req.repo = entitiesFor(req.user.id)[req.params.name];
  next();
});
app.get('/api/entities/:name', wrap((req, res) => {
  const { sort, limit, ...where } = req.query;
  const parsed = {};
  for (const [k, v] of Object.entries(where)) {
    if (v === 'true') parsed[k] = true;
    else if (v === 'false') parsed[k] = false;
    else parsed[k] = v;
  }
  res.json(Object.keys(parsed).length ? req.repo.filter(parsed, sort, limit) : req.repo.list(sort, limit));
}));
app.post('/api/entities/:name/filter', wrap((req, res) => {
  const { where, sort, limit } = req.body || {};
  res.json(req.repo.filter(where || {}, sort, limit));
}));
app.get('/api/entities/:name/:id', wrap((req, res) => {
  const row = req.repo.get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json(row);
}));
app.post('/api/entities/:name', wrap((req, res) => res.status(201).json(req.repo.create(req.body || {}))));
app.post('/api/entities/:name/bulk', wrap((req, res) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });
  res.status(201).json(req.repo.bulkCreate(items));
}));
app.patch('/api/entities/:name/:id', wrap((req, res) => res.json(req.repo.update(req.params.id, req.body || {}))));
app.put('/api/entities/:name/:id', wrap((req, res) => res.json(req.repo.update(req.params.id, req.body || {}))));
app.delete('/api/entities/:name/:id', wrap((req, res) => res.json(req.repo.delete(req.params.id))));

// ---- backend functions ----------------------------------------------------
app.post('/api/functions/:name', requireAuth, wrap(async (req, res) => {
  const def = FUNCTIONS[req.params.name];
  if (!def) return res.status(404).json({ error: 'unknown_function' });
  if (def.admin && req.user.role !== 'admin') return res.status(403).json({ error: 'forbidden', message: 'Admin access required' });
  const result = await def.handler({ user: req.user, entities: entitiesFor(req.user.id), body: req.body || {} });
  res.json(result ?? {});
}));

// ---- Gmail app-user connector ---------------------------------------------
app.get('/api/gmail/connect', requireAdmin, (req, res) => {
  if (!isGmailConfigured()) {
    return res.status(503).send(oauthPage('Gmail is not configured', 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the server .env file, then restart the server.'));
  }
  res.redirect(buildAuthUrl(req.user.id));
});
app.get('/api/gmail/callback', wrap(async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(oauthPage('Connection cancelled', String(error)));
  try {
    const r = await handleCallback({ code, state });
    res.send(oauthPage('Gmail connected', `Connected as ${r.email || 'your Google account'}. You can close this window.`, true));
  } catch (e) {
    res.status(400).send(oauthPage('Connection failed', e.message));
  }
}));
app.post('/api/gmail/disconnect', requireAdmin, (req, res) => { disconnect(req.user.id); res.json({ success: true }); });

function oauthPage(title, text, success = false) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>body{font-family:Georgia,serif;background:#f6f3ee;color:#221e1b;display:grid;place-items:center;height:100vh;margin:0}
  main{max-width:420px;padding:32px;border:1px solid #d9d2c7;background:#fffdfa}h1{font-weight:400;font-size:28px;margin:0 0 12px}
  p{font-family:ui-monospace,monospace;font-size:13px;color:#6b625a}</style></head>
  <body><main><h1>${title}</h1><p>${text}</p></main>
  ${success ? '<script>try{window.opener&&window.opener.postMessage({type:"gmail_connected"},"*")}catch(e){};setTimeout(()=>window.close(),1200)</script>' : ''}
  </body></html>`;
}

// ---- static (production) --------------------------------------------------
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// ---- errors ---------------------------------------------------------------
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.code || (status === 500 ? 'internal_error' : 'error'), message: err.message });
});

app.listen(PORT, () => {
  console.log(`Repeat Flow API listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('  ! ANTHROPIC_API_KEY missing — AI drafting disabled');
  if (!isGmailConfigured()) console.warn('  ! GOOGLE_CLIENT_ID/SECRET missing — Gmail connector disabled');
  startScheduler();
});
