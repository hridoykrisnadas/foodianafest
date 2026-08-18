# Deploying to Hostinger

Target: the **Hostinger Unlimited** web hosting plan (the plan that replaced
Business in March 2025) — 2 CPU cores, 3 GB RAM, up to 5 Node.js websites.

This repo deploys as **two independent Hostinger Node.js applications**, each
pointed at its own directory in the repository:

| App | Domain | Directory | Build command | Start / entry |
| --- | --- | --- | --- | --- |
| Foodiana Web | `your-domain.com` | `frontend` | `npm run build` | `npm start` (`next start`) |
| Foodiana API | `api.your-domain.com` | `backend` | `npm run build` | `npm start` |

That uses 2 of your 5 Node.js app slots.

## Two Hostinger constraints this repo is shaped around

Both were found the hard way, so they are worth stating up front.

**1. The build runs with production dependencies only.** Hostinger installs with
devDependencies skipped, so a build tool in `devDependencies` simply is not on
disk and the build dies with `sh: tsc: command not found`. Anything the *build*
needs is therefore a regular dependency — `typescript` and `@types/node` are in
`backend/dependencies` for exactly this reason, not by accident. (The frontend was
never affected: it has no devDependencies at all.)

**2. A framework preset owns the entry point.** The Fastify preset rejects a
custom `Entry file` outright — *"Fastify framework does not support custom Entry
File configuration"* — and starts the app the standard way instead. So the backend
has exactly **one** entry point, `dist/index.js`, referenced by both `main` and
the `start` script. Clustering is selected by the `CLUSTER_WORKERS` environment
variable at runtime, never by pointing at a second file.

## Why each folder is self-contained

`backend/` and `frontend/` are separate projects, not workspaces. Each has its own
`package.json`, its own `package-lock.json` and its own `node_modules`. Nothing at
the repository root is needed to install, build, run or deploy either one.

That matters because a Hostinger Node.js app expects `package.json` at the
directory it is given: when you point the app at `backend`, Hostinger runs
`npm install` and the build command **inside that folder**. Nothing above it is
read. The root `package.json` exists only as a convenience for local development
(`npm run dev` runs both at once) and is never used by a deployment.

> **When picking the directory, make sure it is the *source* folder in the
> repository** (`backend` / `frontend`), not a destination folder on the server
> such as `public_html/api`. Hostinger's older Git integration has a separate
> "deploy directory" field that chooses where files land on the server — that one
> does **not** solve a monorepo, because it does not change where `package.json`
> is looked for. If your app only offers that field, tell me and I'll switch the
> setup to publish each folder to its own deploy branch instead (already tested).

## One-time setup

### 1. Point both apps at the `production` branch

CI promotes `main` to `production` only after both applications typecheck, build
and pass their checks, so `production` always holds a verified commit. Connect both
Hostinger apps to **`production`**, not `main` — connecting to `main` would deploy
every push, including broken ones.

### 2. Create the API app

hPanel → **Websites** → **Add Website** → **Deploy Web App** → GitHub.

| Field | Value |
| --- | --- |
| Repository | this repo |
| Branch | `production` |
| Directory / project root | `backend` |
| Framework preset | Fastify (or Other) |
| Package manager | npm |
| Build command | `npm run build` |
| Output directory | leave blank |
| Entry file | **leave blank** |
| Node version | 22.x |
| Domain | `api.your-domain.com` |

Environment variables:

```
NODE_ENV=production
LOG_LEVEL=info
CLUSTER_WORKERS=1
TRUST_PROXY=true

SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role key>

JWT_SECRET=<openssl rand -base64 48>
JWT_EXPIRES_IN=8h
ADMIN_PASSWORD=<strong password>
AGENT_PASSWORD=<optional, gate-only password>

CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com

RATE_LIMIT_MAX=300
REGISTER_RATE_LIMIT_MAX=10
```

Notes:

- **Do not set `PORT`.** Hostinger assigns it; the backend reads it from the
  environment and binds `0.0.0.0`.
- **`CLUSTER_WORKERS=1`** is deliberate. With 2 cores shared between both apps,
  one worker each is the sane split, and a single process is the safest shape on a
  managed platform. `dist/index.js` skips forking entirely at `1`, so the entry
  file stays the same if you later raise it.
- **`CORS_ORIGINS` must list every real site origin**, `www.` included. A missing
  origin looks like every browser request failing while `curl` still works.
- **Leave "Entry file" and "Output directory" blank.** The Fastify preset does
  not support them and the deploy fails with *"Fastify framework does not support
  custom Entry File configuration"* if they are set. The preset starts the app the
  standard way instead, and `backend/package.json` is set up for that: `main` and
  the `start` script both point at `dist/index.js`. There is only one entry point,
  so clustering is chosen by `CLUSTER_WORKERS` at runtime rather than by pointing
  at a different file.

### 3. Create the frontend app

Same flow, second app.

| Field | Value |
| --- | --- |
| Repository | this repo |
| Branch | `production` |
| Directory / project root | `frontend` |
| Framework preset | Next.js |
| Package manager | npm |
| Build command | `npm run build` |
| Output directory | `.next` |
| Entry file | leave blank (the Next.js preset handles it) |
| Node version | 22.x |
| Domain | `your-domain.com` |

Environment variables:

```
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

> **`NEXT_PUBLIC_API_URL` is inlined at build time, not read at runtime.**
> Set it in Hostinger *before* the first build. Changing it later needs a
> **rebuild**, not a restart — a restart keeps serving the old value baked into
> the JavaScript. If the deployed site calls `localhost:4000`, this is why. The
> **Verify deployment** workflow fetches the site's route chunks and checks for
> exactly this.

### 4. Apply the database migrations

The gate depends on Postgres functions added by
`backend/supabase/migrations/20260818120000_backend_service_layer.sql`. Hostinger
does not run migrations, so do it once from your machine:

```bash
cd backend
supabase db push
```

Until that runs, the scanner returns `503 MIGRATION_REQUIRED` rather than falling
back to a non-atomic capacity check.

### 5. Enable SSL

hPanel → **Security** → **SSL** for both `your-domain.com` and
`api.your-domain.com`. The site is served over HTTPS, so the API must be too or
the browser blocks every request as mixed content.

## Deploy flow

```
 push to main
      │
      ▼
 ┌───────────────────────────────┬───────────────────────────────┐
 │ CI: backend (node 20, 22)     │ CI: frontend (node 20, 22)    │
 │   npm ci                      │   npm ci                      │
 │   typecheck                   │   typecheck                   │
 │   build                       │   build                       │
 │   smoke test (20 checks)      │   credential-leak scan        │
 └───────────────┬───────────────┴───────────────┬───────────────┘
                 │            both green         │
                 └───────────────┬───────────────┘
                                 ▼
                    git push main → production
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
   Hostinger API app                     Hostinger Web app
   dir: backend                          dir: frontend
   npm install → build → restart         npm install → build → restart
                                 │
                                 ▼
                    Verify deployment workflow
```

The two applications are verified in parallel and deploy independently — nothing
in one app's pipeline can block or break the other.

## After the first deploy

Set two repository variables so verification knows where to look — GitHub →
Settings → Secrets and variables → Actions → **Variables**:

| Variable | Value |
| --- | --- |
| `PRODUCTION_API_URL` | `https://api.your-domain.com` |
| `PRODUCTION_SITE_URL` | `https://your-domain.com` |

Optionally add a **secret** `PRODUCTION_ADMIN_PASSWORD` (same value as the API
app's `ADMIN_PASSWORD`). When present, verification also signs in and calls
`/api/admin/metrics`, which proves the migration was applied.

Then run **Actions → Verify deployment → Run workflow**, or locally:

```bash
API_URL=https://api.your-domain.com \
SITE_URL=https://your-domain.com \
ADMIN_PASSWORD=... \
npm run verify:deployment
```

Also worth doing once: GitHub → Settings → Branches → protect `main` and require
the **Backend** and **Frontend** checks. Without that, nothing stops you merging a
red PR.

## Scaling on this plan, and when to leave it

The Unlimited plan is a single managed instance per app: no Docker, no nginx, no
horizontal replicas. Scaling is vertical only:

1. `CLUSTER_WORKERS=2` on the API — only worth it if the frontend moves off this
   plan, since there are just 2 cores.
2. Upgrade to **Cloud Startup** (4 cores, 4 GB, 10 Node.js apps).
3. Move the API to a **Hostinger VPS (KVM)** and use the `docker-compose.yml` and
   `infra/nginx/nginx.conf` in this repo: `docker compose up --build --scale backend=3`.

Option 3 is what the backend was designed for, and no application code changes:
the API is stateless (JWT auth, no in-process session or cache) and the venue
capacity ceiling is enforced inside Postgres, so replicas are safe to add. The one
caveat is that the rate-limit counter is per process — point `@fastify/rate-limit`
at Redis if you need one global budget across replicas.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| App exits at boot, logs list missing variables | An env var is unset. The message names each one. |
| `npm install` fails or installs nothing | The app's directory is not `backend` / `frontend`, so it cannot see that folder's `package.json`. |
| `Fastify framework does not support custom Entry File configuration` | Clear the Entry file and Output directory fields on the API app. The preset uses `npm start` / `main`, which already point at `dist/index.js`. |
| `sh: tsc: command not found` during build | Hostinger installs production dependencies only, so anything the build needs must be in `dependencies`, not `devDependencies`. `typescript` and `@types/node` are already there — if you add another build-time tool, put it in `dependencies` too. |
| `unable to determine transport target for "pino-pretty"` | `NODE_ENV` is not `production` on a production-only install. Set `NODE_ENV=production` (the code now degrades to JSON logs rather than crashing). |
| Build succeeds but the app will not start | Check `CLUSTER_WORKERS=1` and that all required env vars are set; the log names any that are missing. |
| Site loads, every API call fails in the browser, `curl` works | `CORS_ORIGINS` is missing the site origin — check `www.`. |
| Browser console shows calls to `localhost:4000` | `NEXT_PUBLIC_API_URL` was unset at build time. Set it, then **rebuild**. |
| Scanner returns `503 MIGRATION_REQUIRED` | `supabase db push` has not been run. |
| Mixed-content errors | SSL not issued on `api.` yet. |
| `429` during normal use | `RATE_LIMIT_MAX` is per process; raise it. |
