# Deploying the site to Hostinger

Target: the **Hostinger Unlimited** web hosting plan (the plan that replaced
Business in March 2025) — 2 CPU cores, 3 GB RAM, up to 5 Node.js websites.

This repository deploys as **one Hostinger Node.js application**:

| App | Domain | Directory | Build command | Start / entry |
| --- | --- | --- | --- | --- |
| Foodiana Web | `your-domain.com` | `frontend` | `npm run build` | `npm start` (`next start`) |

The API deploys as a second, independent app from the
[`foodiana-backend`](https://github.com/hridoykrisnadas/foodiana-backend)
repository — see that repo's `docs/DEPLOY-HOSTINGER.md`. Together they use 2 of
your 5 Node.js app slots.

## The Hostinger constraint this repo is shaped around

**The build runs with production dependencies only.** Hostinger installs with
devDependencies skipped, so a build tool in `devDependencies` simply is not on
disk when the build runs. The frontend has never been bitten by this — it has no
devDependencies at all — but keep it that way: anything the *build* needs must be
a regular dependency. CI reproduces that install so the mistake fails there
instead of on a real deploy.

## Why the directory field says `frontend`

A Hostinger Node.js app expects `package.json` at the directory it is given, and
runs `npm install` and the build command **inside that folder**. The app lives in
`frontend/`, so that is the directory to name. Nothing above it is read — the root
`package.json` is a local-development convenience and is never used by a
deployment.

> **Make sure it is the *source* folder in the repository** (`frontend`), not a
> destination folder on the server such as `public_html`. Hostinger's older Git
> integration has a separate "deploy directory" field that chooses where files
> land on the server — that one does **not** point the app at a subfolder, because
> it does not change where `package.json` is looked for.

## One-time setup

### 1. Point the app at the `backend` branch

This site currently deploys straight from **`backend`**, which is where the
frontend work lands. CI runs on every push to it, but nothing gates the deploy:
the branch you push is the branch that goes live, red build or not.

If you want a failing build to be unable to reach the site, add a `production`
branch that only CI fast-forwards and point Hostinger at that instead — the API
repository is set up that way and its `promote` job shows the pattern.

### 2. Create the web app

hPanel → **Websites** → **Add Website** → **Deploy Web App** → GitHub.

| Field | Value |
| --- | --- |
| Repository | this repo (`foodianafest`) |
| Branch | `backend` |
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

### 3. Allow this origin on the API

The API rejects browser requests from origins it does not know. On the **API**
app (in the `foodiana-backend` deployment), set:

```
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

Every real site origin, `www.` included. A missing origin looks like every
browser request failing while `curl` still works. This is the one setting that has
to be kept in step across the two repositories.

### 4. Enable SSL

hPanel → **Security** → **SSL** for `your-domain.com`. The site is served over
HTTPS, so the API must be too, or the browser blocks every request as mixed
content.

## Deploy flow

```
 push to backend
      │
      ├──────────────────────────────┐
      ▼                              ▼
 ┌───────────────────────────────┐   Hostinger Web app
 │ CI: frontend (node 20, 22)    │   dir: frontend
 │   npm ci                      │   npm install → build → restart
 │   typecheck                   │        │
 │   build                       │        ▼
 │   credential-leak scan        │   Verify deployment workflow
 ├───────────────────────────────┤
 │ CI: Hostinger install sim     │
 │   npm ci --omit=dev → build   │
 └───────────────────────────────┘
```

CI and the deploy run in parallel — CI does not gate the deploy. See
[Point the app at the `backend` branch](#1-point-the-app-at-the-backend-branch)
above if you want it to.

The API deploys from its own repository on its own pipeline — neither can block
or break the other.

## After the first deploy

Set two repository variables so verification knows where to look — GitHub →
Settings → Secrets and variables → Actions → **Variables**:

| Variable | Value |
| --- | --- |
| `PRODUCTION_SITE_URL` | `https://your-domain.com` |
| `PRODUCTION_API_URL` | `https://api.your-domain.com` (the origin the bundle must point at) |

Then run **Actions → Verify deployment → Run workflow**, or locally:

```bash
SITE_URL=https://your-domain.com \
API_URL=https://api.your-domain.com \
npm run verify:deployment
```

Also worth doing once: GitHub → Settings → Branches → protect `main` and require
the **Frontend** and **Hostinger install simulation** checks. Without that,
nothing stops you merging a red PR.

## Scaling on this plan

The Unlimited plan is a single managed instance per app: no Docker, no nginx, no
horizontal replicas. For the site, scaling is vertical only — upgrade to **Cloud
Startup** (4 cores, 4 GB, 10 Node.js apps).

The API is the component that actually needs to scale for the event, and it is
built to run behind a load balancer with N replicas. That path is documented in
the `foodiana-backend` repository and needs no change here.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `npm install` fails or installs nothing | The app's directory is not `frontend`, so it cannot see that folder's `package.json`. |
| Browser console shows calls to `localhost:4000` | `NEXT_PUBLIC_API_URL` was unset at build time. Set it, then **rebuild** — a restart is not enough. |
| Site loads, every API call fails in the browser, `curl` against the API works | `CORS_ORIGINS` **on the API app** is missing this site's origin — check `www.`. |
| Mixed-content errors | SSL not issued on `api.` yet. |
| A build tool is missing during build | Hostinger installs production dependencies only — put anything the build needs in `dependencies`, not `devDependencies`. |
| Site is up but every page shows API errors | The API app is down or its own migration was never applied — check the `foodiana-backend` deployment. |
