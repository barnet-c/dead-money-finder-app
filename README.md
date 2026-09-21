# Repeat Flow — *The Repeat Booking Journal*

Service tracking, invoice recovery and reporting for service businesses. This is the
self-hosted version: the Base44 platform has been replaced with a plain Node + React stack
you can run from VS Code.

| Base44 piece | Replaced with |
|---|---|
| Entities + Row-Level Security | SQLite (`node:sqlite`, no native build) with a per-user entity layer in `server/entities.js` |
| Auth (`base44.auth`) | Email + password, bcrypt, httpOnly JWT cookie (`server/auth.js`) |
| Backend functions (Deno) | Express handlers in `server/functions/*.js`, called via `POST /api/functions/:name` |
| Gmail app-user connector | Google OAuth per user, tokens stored per user, auto-refresh (`server/gmail.js`) |
| `Core.InvokeLLM` | Anthropic Messages API (`server/llm.js`) |
| `Core.SendEmail` | Admin's Gmail, falling back to SMTP (`server/email.js`) |
| Automations | `node-cron` jobs in `server/cron.js` |
| `@base44/sdk` on the frontend | `src/api/client.js` with the same `entities` / `functions.invoke` shape |

## Run it

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173 · API: http://localhost:3001 (Vite proxies `/api`).

The first account you create becomes the admin. You are then taken through the
three-step onboarding wizard.

## Configure `.env`

A `.env` was generated from `.env.example` with a random `JWT_SECRET`. Fill in what you need:

- **`ANTHROPIC_API_KEY`** — required for AI-drafted reminders, invoice follow-ups and inbox scanning. Without it the app still works; drafting falls back to a plain template.
- **`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`** — required for the Gmail connector (sending + inbox scan).
  1. Google Cloud Console → APIs & Services → enable the **Gmail API**.
  2. Credentials → Create OAuth client → *Web application*.
  3. Authorised redirect URI: `http://localhost:3001/api/gmail/callback`.
  4. Add your Google account as a test user on the OAuth consent screen (scopes: `gmail.readonly`, `gmail.send`).
- **Stripe** — no server config. Each user pastes their own secret key in Settings § 04.
- **`SMTP_*`** — optional. Only used for the daily digest when the owner has no Gmail connected.
- **`CRON_DAILY_SYNC` / `CRON_DAILY_DIGEST`** — schedules for the two automations (server local time). Leave a value empty to disable.

## Production

```bash
npm run build      # builds the React app into dist/
npm start          # Express serves dist/ and the API on one port
```

Set `APP_URL` and `API_URL` to your public origin and `NODE_ENV=production` so the session cookie is marked `Secure`.

## Layout

```
server/
  index.js            Express app, routes, static hosting
  db.js               SQLite connection + users / gmail tables
  entities.js         Entity schemas, RLS-scoped repositories, service-role access
  auth.js             Register / login / JWT cookie / admin guard
  gmail.js            OAuth flow, token refresh, RFC 2822 builder (header-injection safe), send
  llm.js              Anthropic client, sanitize(), prompt-injection defence text
  email.js            SendEmail for the digest (Gmail → SMTP fallback)
  cron.js             Scheduled automations
  shared/stripeSync.js
  functions/          One file per backend function (same names as the Base44 spec)
src/
  api/client.js       API client mirroring the Base44 SDK surface
  hooks/useAuth.jsx   AuthProvider
  pages/              Layout, Login, Dashboard, Customers, Recovery, ReminderLog, Reports, Settings, Onboarding
  components/         CustomerCard, DueBadge, modals, banners, recovery/, reports/, onboarding/, ui/
```

## Security notes

- Every entity query is scoped to `created_by_id = current user`; the service role is used only by the scheduler.
- Admin-only functions: `sendReminder`, `autoSendReminders`, `checkGmailConnection`, `scanGmailInbox`, `saveStripeKey`, `dailyDigest`, `dailySync`.
- All customer / invoice / email content is sanitised (angle brackets stripped, length-capped) and wrapped in `<customer_data>` / `<invoice_data>` / `<email_data>` tags with explicit instructions to ignore embedded commands.
- Email headers are stripped of CR/LF before the raw message is built.
- Stripe keys must match `/^(sk|rk)_(test|live)_[A-Za-z0-9]{10,200}$/` before being stored.
- Gmail tokens are only ever read for the calling user; scheduled jobs never borrow another user's connection.
