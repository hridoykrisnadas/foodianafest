# Foodiana 2026

Two independent projects in one repository:

| Path                | What it is                                              |
| ------------------- | ------------------------------------------------------- |
| `frontend/`         | Next.js 13 App Router web app                           |
| `backend/`          | Fastify + TypeScript JSON API, owns the DB migrations   |
| `scripts/`          | Dev runner and CI check scripts                          |
| `infra/nginx/`      | Load balancer config for the VPS/Docker path             |
| `.github/workflows/`| CI gate and live deployment verification                 |
| `docs/`             | [Hostinger deployment guide](docs/DEPLOY-HOSTINGER.md)   |

`backend/` and `frontend/` are **self-contained projects** — each has its own
`package.json`, lockfile and `node_modules`, and neither needs anything from the
repository root to install, build, run or deploy. The root `package.json` is a
convenience for local development only.

They deploy as **two independent Hostinger Node.js apps**, each pointed at its own
directory — see the [deployment guide](docs/DEPLOY-HOSTINGER.md) for the exact
hPanel fields.

## Architecture

```
                                        ┌──────────────────────────┐
  browser ──── HTTPS ────▶  nginx  ────▶│ backend replica 1        │
  (frontend, no DB creds)   (:4000)     │  ├─ worker (node cluster)│
                              │         │  └─ worker               │
                              ├────────▶│ backend replica 2  ...   │
                              └────────▶│ backend replica N  ...   │
                                        └────────────┬─────────────┘
                                                     │ service-role key
                                                     ▼
                                              Supabase Postgres
```

The browser holds **no database credentials**. Every read and write goes through
the backend, which is the only holder of the Supabase service-role key. That
boundary is what makes the backend independently scalable — add replicas and
workers without touching the frontend.

### Why the backend is safe to clone horizontally

- **Stateless auth.** Staff sign in against the backend and receive a signed JWT.
  Any replica can verify a token minted by any other — there is no session store
  to share.
- **Atomic gate operations.** Admission and exit run inside Postgres functions
  (`admit_visitor`, `exit_visitor`) that take an advisory lock, so the venue
  capacity ceiling holds even when several gates scan simultaneously against
  different replicas. Checking the count in application code and then updating
  would let two concurrent scans both pass a full-venue check.
- **No local cache to keep coherent.** Every request reads current state.

The one component that is *not* shared is the rate-limit counter, which lives in
each worker's memory. With N replicas the effective ceiling is N × `RATE_LIMIT_MAX`.
Point `@fastify/rate-limit` at a shared Redis store if you need one global budget
(see the note in `backend/src/server.ts`).

## Getting started

```bash
# 1. Install both projects (each has its own lockfile)
npm run install:all

# 2. Configure the backend
cp backend/.env.example backend/.env
#    fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, ADMIN_PASSWORD
#    generate a secret with:  openssl rand -base64 48

# 3. Configure the frontend
cp frontend/.env.example frontend/.env.local
#    NEXT_PUBLIC_API_URL=http://localhost:4000

# 4. Apply the database migrations (adds the gate functions and revokes anon access)
cd backend && supabase db push

# 5. Run both
npm run dev          # backend on :4000, frontend on :3000
```

Individually: `npm run dev:backend`, `npm run dev:frontend`.

## Running the backend as a cluster

```bash
cp .env.example .env      # root .env is read by docker-compose only

# 3 replicas behind nginx on :4000
docker compose up --build --scale backend=3
```

Two independent dials:

- **`--scale backend=N`** — replicas, load balanced by nginx.
- **`CLUSTER_WORKERS`** — worker processes forked inside each replica.
  `0` = one per CPU core, `1` = single process. Use `1` when an orchestrator
  (Kubernetes, ECS, Fly) already scales by replica; use `0` on a single large box.

Without Docker: `npm run build:backend && npm run start:backend` runs
`dist/index.js`, which forks `CLUSTER_WORKERS` processes sharing one port and
replaces any worker that dies. At `CLUSTER_WORKERS=1` it skips forking entirely,
which is what the Hostinger app uses.

Health probes for your balancer or orchestrator:

- `GET /health` — liveness (always cheap, never touches the database)
- `GET /health/ready` — readiness (verifies the database is reachable; 503 if not)

## API

Base URL is `NEXT_PUBLIC_API_URL`. Errors are always
`{ "error": string, "code": string, "details"?: unknown }`.

### Public — no auth

| Method | Path                       | Purpose                                              |
| ------ | -------------------------- | ---------------------------------------------------- |
| `GET`  | `/api/public/content`      | Landing page: countdown date + all five carousels    |
| `GET`  | `/api/public/event-settings` | Countdown dates only                               |
| `GET`  | `/api/public/ticket-tiers` | Active tiers for the registration form               |
| `POST` | `/api/register`            | Create a visitor, returns the server-issued QR code  |

`POST /api/register` accepts personal details and a `ticket_tier_id` and nothing
else. The price, concert entitlement, QR code, payment status and entry status
are all decided server-side, so none of them can be forged by the client.

### Auth

| Method | Path              | Purpose                                    |
| ------ | ----------------- | ------------------------------------------ |
| `POST` | `/api/auth/login` | Password → `{ token, role, expiresIn }`    |
| `GET`  | `/api/auth/me`    | Validate the current token                 |

`ADMIN_PASSWORD` grants role `admin`. The optional `AGENT_PASSWORD` grants role
`agent`, which can work the gate but cannot reach the dashboard.

### Gate — `Authorization: Bearer <token>`, role `admin` or `agent`

| Method | Path                            | Purpose                                     |
| ------ | ------------------------------- | ------------------------------------------- |
| `GET`  | `/api/scan/crowd`               | Live occupancy vs capacity                  |
| `GET`  | `/api/scan/lookup/:qrCodeId`    | Visitor + tier + derived gate status        |
| `POST` | `/api/scan/visitor/:id/entry`   | Atomic capacity-checked admission           |
| `POST` | `/api/scan/visitor/:id/exit`    | Atomic exit                                 |

Admission returns `422 CAPACITY_FULL` when the venue is at capacity, and
`409 CONFLICT` when the visitor is already inside or has already exited.

### Admin — role `admin` only

| Method   | Path                              | Purpose                              |
| -------- | --------------------------------- | ------------------------------------ |
| `GET`    | `/api/admin/metrics`              | All headline counts + occupancy      |
| `GET`    | `/api/admin/visitors`             | Paginated list (`filter`, `search`, `page`, `pageSize`) |
| `PATCH`  | `/api/admin/visitors/:id/payment` | Mark paid                            |
| `PATCH`  | `/api/admin/visitors/:id/entry`   | Manual admission (same atomic RPC)   |
| `PATCH`  | `/api/admin/visitors/:id/exit`    | Manual exit                          |
| `GET`    | `/api/admin/raffle`               | Paid visitors, oldest first          |
| `GET`    | `/api/admin/ticket-tiers`         | All tiers including inactive         |
| `POST`   | `/api/admin/ticket-tiers`         | Create tier                          |
| `PATCH`  | `/api/admin/ticket-tiers/:id`     | Update tier                          |
| `DELETE` | `/api/admin/ticket-tiers/:id`     | Delete tier                          |
| `GET`    | `/api/admin/event-settings`       | Dates + ground capacity              |
| `PATCH`  | `/api/admin/event-settings`       | Update dates / capacity              |
| `GET`    | `/api/admin/content/:table`       | List a content collection            |
| `POST`   | `/api/admin/content/:table`       | Create a row                         |
| `PATCH`  | `/api/admin/content/:table/:id`   | Update a row                         |
| `DELETE` | `/api/admin/content/:table/:id`   | Delete a row                         |

`:table` is one of `guests`, `advisors`, `management_members`, `sponsors`,
`brand_stalls`. Both the table names and every writable column are whitelisted in
`backend/src/lib/content.ts`. Because the service-role key bypasses RLS, that
registry is the only thing preventing arbitrary writes through the generic CRUD
routes — do not widen it elsewhere.

## Database

Migrations live in `backend/supabase/migrations` — the backend owns the schema
now that it is the sole database client. Run them with the Supabase CLI from the
`backend/` directory.

`20260818120000_backend_service_layer.sql` is the cutover migration. It:

1. **Drops every `anon_*` RLS policy.** Previously anyone with the public anon key
   could INSERT, UPDATE or DELETE any row — including marking their own ticket
   paid or flipping their own `entry_status`. With RLS enabled and no policies,
   `anon` and `authenticated` are denied everything; only `service_role` (which
   bypasses RLS) can read or write.
2. Adds `get_visitor_metrics()` so the dashboard's counts are one round trip.
3. Adds `admit_visitor()` and `exit_visitor()`, the atomic gate operations.
4. Adds indexes for the occupancy and payment-status counts the gate polls.

**Apply this migration before running the gate** — the scanner returns
`503 MIGRATION_REQUIRED` if the RPCs are missing rather than silently falling
back to a non-atomic capacity check.

## CI/CD

`.github/workflows/ci.yml` verifies the two applications **in parallel**, each on
Node 20 and 22, so neither can block or break the other:

**Backend** — `npm ci`, typecheck, build, then `scripts/smoke-test.mjs`. That boots
`dist/index.js` exactly as Hostinger does and asserts 20 behaviours needing no
database: startup, login, role separation, input validation, the content-table
whitelist, CORS in both directions, and graceful shutdown.

**Frontend** — `npm ci`, typecheck, build, then `scripts/check-frontend-bundle.mjs`,
which fails if a Supabase client or database credential reappears in anything
shipped to a browser. It is negative-tested, so it genuinely fails when violated.

On green, and only on `main`, the `promote` job fast-forwards the **`production`**
branch to the verified commit. Both Hostinger apps deploy from `production`, so a
failing build cannot reach production. `production` is a deploy pointer — never
commit to it directly.

`.github/workflows/verify-deployment.yml` checks the running deployment: database
reachability, real data reads, that auth is switched on, that CORS lists the real
site origin, that the frontend was not built with the placeholder API URL, and —
when `PRODUCTION_ADMIN_PASSWORD` is set — that the gate migration was applied.
Run it after a deploy, or let the 6-hourly schedule catch drift.

```bash
# same checks, locally
API_URL=https://api.your-domain.com \
SITE_URL=https://your-domain.com \
ADMIN_PASSWORD=... \
node scripts/verify-deployment.mjs
```

## Deployment

**Hostinger (current target)** — two Node.js apps on the Unlimited plan, both
deploying from `production`, one pointed at `backend/` and the other at
`frontend/`. Full walkthrough with every hPanel field, the required environment
variables, and a troubleshooting table:
**[docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md)**.

Two things bite most often:

- `NEXT_PUBLIC_API_URL` is inlined at **build** time. It must be set on the
  frontend app before the build; changing it later needs a rebuild, not a restart.
- `CORS_ORIGINS` on the API must list every site origin you serve, `www.` included.

**VPS / Docker (for when you outgrow shared hosting)** — `backend/Dockerfile`
plus `docker-compose.yml` and `infra/nginx/nginx.conf` give you nginx in front of
N replicas: `docker compose up --build --scale backend=3`. No application code
changes are needed to move, because the API is stateless and the capacity ceiling
lives in Postgres. Note that `docker compose` was never executed against a live
daemon in this environment, so treat the first run as unverified.

Keep `TRUST_PROXY=true` behind any proxy or load balancer — otherwise the rate
limiter counts every request against the proxy's IP instead of the client's.
