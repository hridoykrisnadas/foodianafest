# Foodiana 2026 — Web

Next.js 13 App Router web app for the Foodiana 2026 event: the public landing
page, visitor registration, the staff dashboard and the gate scanner UI.

The API is a **separate service in its own repository** —
[`foodiana-backend`](https://github.com/hridoykrisnadas/foodiana-backend). This app
holds **no database credentials**: every read and write goes through that API over
HTTP. The only coupling between the two is `NEXT_PUBLIC_API_URL` here and
`CORS_ORIGINS` there.

| Path                | What it is                                              |
| ------------------- | ------------------------------------------------------- |
| `frontend/`         | The Next.js app                                         |
| `scripts/`          | Credential-leak guard and live deployment verification   |
| `.github/workflows/`| CI gate and live deployment verification                 |
| `docs/`             | [Hostinger deployment guide](docs/DEPLOY-HOSTINGER.md)   |

`frontend/` is a **self-contained project** — it has its own `package.json`,
lockfile and `node_modules`, and needs nothing from the repository root to
install, build, run or deploy. The root `package.json` is a convenience for local
development only, and the Hostinger app is pointed at the `frontend` directory.

## Getting started

```bash
# 1. Install
npm run install:all

# 2. Configure
cp frontend/.env.example frontend/.env.local
#    NEXT_PUBLIC_API_URL=http://localhost:4000

# 3. Run
npm run dev          # http://localhost:3000
```

You will also need the API running. Clone
[`foodiana-backend`](https://github.com/hridoykrisnadas/foodiana-backend), follow
its README, and start it on `:4000`. Its default `CORS_ORIGINS` already allows
`http://localhost:3000`.

> **`NEXT_PUBLIC_API_URL` is inlined at build time, not read at runtime.**
> Changing it needs a rebuild, not a restart. This is the single most common
> deployment mistake on this project — the **Verify deployment** workflow exists
> largely to catch it.

## Architecture

```
  browser ──── HTTPS ────▶  this app (Next.js)
     │                          (no DB credentials, ever)
     │
     └──── HTTPS ────▶  foodiana-backend API ────▶ Supabase Postgres
                        (holds the service-role key)
```

The browser holds no database credentials and this app never talks to Postgres
directly. `scripts/check-frontend-bundle.mjs` enforces that boundary in CI: it
fails if a Supabase client or database credential reappears in anything shipped to
a browser. It is negative-tested, so it genuinely fails when violated.

That boundary is also why the two repositories can be deployed and scaled
independently — the API can run behind a load balancer with N replicas without
this app changing at all.

## CI/CD

`.github/workflows/ci.yml` runs on Node 20 and 22: `npm ci`, typecheck, build,
then `scripts/check-frontend-bundle.mjs`. A second job reproduces Hostinger's
production-only install (`npm ci --omit=dev`) and builds from it.

Hostinger deploys this site directly from the **`backend`** branch, so CI runs on
every push to it. Note that this means a red build does not stop a deploy — if
you want that guarantee, add a `production` pointer branch that only CI advances,
as the API repository does.

`.github/workflows/verify-deployment.yml` checks the running deployment: that the
site is serving, that the bundle was not built with the placeholder API URL, and
that the API's CORS allowlist includes this site's origin. Run it after a deploy,
or let the 6-hourly schedule catch drift.

```bash
# same checks, locally
SITE_URL=https://your-domain.com \
API_URL=https://api.your-domain.com \
npm run verify:deployment
```

The API's own pipeline — smoke tests, database reachability, the gate migration
check — lives in `foodiana-backend` and runs independently. Neither repository can
block or break the other's deploy.

## Deployment

**Hostinger (current target)** — one Node.js app on the Unlimited plan, deploying
from the `backend` branch, pointed at the `frontend` directory. Full walkthrough with
every hPanel field and a troubleshooting table:
**[docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md)**.

Two things bite most often:

- `NEXT_PUBLIC_API_URL` is inlined at **build** time. Set it before the first
  build; changing it later needs a rebuild, not a restart.
- `CORS_ORIGINS` **on the API app** must list every site origin you serve, `www.`
  included. That setting lives in the other repository's deployment, but it is
  this site that breaks when it is wrong.
