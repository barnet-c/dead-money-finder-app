# Deploying to Azure App Service

Same shape as the roof estimator: **App Service, Linux, Node, B1 plan**, deployed automatically from GitHub on every push to `main`.

Do **not** use Azure Static Web Apps. This app has an always-on Express server and a SQLite file that must live on a persistent disk.

---

## 1. Create the Web App (Azure Portal → Create a resource → Web App)

**Basics tab**

| Field | Value |
|---|---|
| Subscription | your subscription |
| Resource Group | `N8N` (same as the roof estimator) |
| Name | `dead-money-finder-app` |
| Publish | **Code** |
| Runtime stack | **Node 22 LTS** |
| Operating System | Linux |
| Region | West US 3 |
| Linux Plan | `ASP-N8N-b15e (B1)` — reuse the existing plan, no extra cost |
| Zone redundancy | Disabled |

**Deployment tab**

| Field | Value |
|---|---|
| Continuous deployment | **Enable** |
| GitHub account | barnet-c |
| Organization | barnet-c |
| Repository | `dead-money-finder-app` |
| Branch | `main` |
| Authentication type | User-assigned identity (the default) |

Leave every other tab at its defaults and click **Review + create → Create**.

Azure will commit a workflow file into `.github/workflows/` in the repo and add the three `AZUREAPPSERVICE_*` secrets. The first deploy starts within a minute or two. Watch it under the repo's **Actions** tab.

---

## 2. Application settings (Portal → your App Service → Settings → Environment variables → App settings)

Add each row, then **Apply**. The app restarts.

| Name | Value | Required |
|---|---|---|
| `NODE_ENV` | `production` | Yes |
| `JWT_SECRET` | a long random string (one is in the chat) | **Yes** — signs login cookies |
| `APP_URL` | `https://<your-app-hostname>` | Yes |
| `API_URL` | `https://<your-app-hostname>` | Yes |
| `DATABASE_PATH` | `/home/data/repeatflow.db` | Yes — `/home` survives redeploys |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `false` | Yes — GitHub Actions already builds |
| `ANTHROPIC_API_KEY` | your Claude key | For AI drafting and inbox scanning |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Optional |
| `GOOGLE_CLIENT_ID` | from Google Cloud Console | For the Gmail connector |
| `GOOGLE_CLIENT_SECRET` | from Google Cloud Console | For the Gmail connector |
| `CRON_DAILY_SYNC` | `0 9 * * *` | Optional (UTC on Azure) |
| `CRON_DAILY_DIGEST` | `30 7 * * *` | Optional (UTC on Azure) |

`<your-app-hostname>` is the default domain shown on the App Service Overview page, e.g. `dead-money-finder-app-evc7a7b3c6fhftas.westus3-01.azurewebsites.net`.

Do **not** set `WEBSITE_RUN_FROM_PACKAGE`. It makes the filesystem read-only and SQLite could not write.

---

## 3. Startup command (once)

Portal → App Service → **Settings → Configuration → General settings → Startup Command**:

```
npm start
```

Also turn **Always On** to **On** on the same page so the scheduled jobs run overnight. Save.

---

## 4. Gmail OAuth redirect

In Google Cloud Console → your OAuth client → **Authorised redirect URIs**, add:

```
https://<your-app-hostname>/api/gmail/callback
```

Keep the localhost one too if you still develop locally.

---

## 5. Check it

1. Open `https://<your-app-hostname>` — the login page loads.
2. Create an account (first account = admin), complete onboarding, add a customer.
3. Portal → **Log stream** should show `Repeat Flow API listening` and the two `[cron]` lines.
4. Push any commit to `main` → the Actions workflow redeploys. Your data stays because it lives in `/home/data`.

---

## Troubleshooting

- **"Application Error" page** → Log stream. Most often a missing `JWT_SECRET` or the startup command not set.
- **`ERR_UNKNOWN_BUILTIN_MODULE node:sqlite`** → the runtime is older than Node 22.13. Set runtime stack to Node 22 LTS (or newer).
- **Login works locally but not on Azure** → `APP_URL` must exactly match the site's https origin.
- **Gmail popup says redirect_uri_mismatch** → step 4 above.
