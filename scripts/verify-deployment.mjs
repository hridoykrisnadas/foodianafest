#!/usr/bin/env node

/**
 * Verifies a live deployment from the outside.
 *
 * Unlike the CI smoke test, this runs against real infrastructure, so it can
 * check the things that only fail in production: the service-role key actually
 * works, the frontend is serving, auth is switched on, and — if a staff password
 * is supplied — that the gate migration has been applied.
 *
 * Usage:
 *   SITE_URL=https://foodiana.com API_URL=https://api.foodiana.com node scripts/verify-deployment.mjs
 * Optional:
 *   ADMIN_PASSWORD=...   also verifies the database functions from the migration
 */

const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const API_URL = (process.env.API_URL || '').replace(/\/+$/, '');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

if (!API_URL) {
  console.error('[verify] API_URL is required (e.g. https://api.foodiana.com)');
  process.exit(1);
}

let failures = 0;
let warnings = 0;
let passes = 0;

function pass(name) { passes += 1; console.log(`  ok    ${name}`); }
function fail(name, detail) { failures += 1; console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
function warn(name, detail) { warnings += 1; console.warn(`  warn  ${name}${detail ? ` — ${detail}` : ''}`); }

async function get(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal, redirect: 'follow' });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: response.status, text, json, headers: response.headers };
  } catch (error) {
    return { status: 0, text: '', json: null, headers: new Headers(), error };
  } finally {
    clearTimeout(timer);
  }
}

console.log(`[verify] API  ${API_URL}`);
if (SITE_URL) console.log(`[verify] site ${SITE_URL}`);
console.log('');

// --- 1. API is alive --------------------------------------------------------
const health = await get(`${API_URL}/health`);
if (health.status === 200 && health.json?.status === 'ok') {
  pass('API /health is 200');
} else if (health.status === 0) {
  // Nothing else can be judged if the host is unreachable, and reporting
  // "admin routes are not protected" here would be actively misleading.
  fail('API is unreachable', health.error?.message || 'no response');
  console.error(
    `\n[verify] Cannot reach ${API_URL} at all — skipping the remaining checks.\n` +
      '  Check the Hostinger app is Running, the subdomain resolves, and SSL is issued.',
  );
  console.log(`\n[verify] ${passes} passed, ${warnings} warnings, ${failures} failed`);
  process.exit(1);
} else {
  fail('API /health', `status ${health.status}`);
}

// --- 2. API can reach the database -----------------------------------------
// This is the check that catches a wrong or missing SUPABASE_SERVICE_ROLE_KEY.
const ready = await get(`${API_URL}/health/ready`);
if (ready.status === 200) pass('API /health/ready — database reachable');
else fail('API /health/ready — database unreachable', ready.json?.detail || `status ${ready.status}`);

// --- 3. Real data reads work end to end ------------------------------------
const tiers = await get(`${API_URL}/api/public/ticket-tiers`);
if (tiers.status === 200 && Array.isArray(tiers.json?.tiers)) {
  if (tiers.json.tiers.length > 0) pass(`public ticket tiers load (${tiers.json.tiers.length} active)`);
  else warn('public ticket tiers load but none are active', 'registration will show no options');
} else {
  fail('public ticket tiers', `status ${tiers.status}`);
}

const content = await get(`${API_URL}/api/public/content`);
if (content.status === 200 && content.json && 'guests' in content.json) pass('public landing content loads');
else fail('public landing content', `status ${content.status}`);

// --- 4. Auth is switched on -------------------------------------------------
const unauth = await get(`${API_URL}/api/admin/metrics`);
if (unauth.status === 401) pass('admin routes require a token');
else fail('admin routes are not protected', `expected 401, got ${unauth.status}`);

const unauthScan = await get(`${API_URL}/api/scan/crowd`);
if (unauthScan.status === 401) pass('gate routes require a token');
else fail('gate routes are not protected', `expected 401, got ${unauthScan.status}`);

// --- 5. CORS is restricted -------------------------------------------------
const badOrigin = await get(`${API_URL}/health`, { headers: { origin: 'https://not-allowed.example' } });
if (badOrigin.status === 403) pass('CORS rejects an unlisted origin');
else if (badOrigin.headers.get('access-control-allow-origin') === '*') fail('CORS is wide open', 'ACAO is *');
else warn('CORS did not reject an unlisted origin', `status ${badOrigin.status}`);

if (SITE_URL) {
  const allowedOrigin = await get(`${API_URL}/health`, { headers: { origin: SITE_URL } });
  if (allowedOrigin.headers.get('access-control-allow-origin') === SITE_URL) {
    pass(`CORS allows the site origin (${SITE_URL})`);
  } else {
    fail('CORS does not allow the site origin', `add ${SITE_URL} to CORS_ORIGINS on the API app`);
  }
}

// --- 6. Frontend is serving ------------------------------------------------
if (SITE_URL) {
  const site = await get(`${SITE_URL}/`);
  if (site.status === 200 && /<title>/i.test(site.text)) pass('site homepage is 200');
  else fail('site homepage', site.error ? site.error.message : `status ${site.status}`);

  for (const route of ['/register', '/admin', '/admin/scan']) {
    const page = await get(`${SITE_URL}${route}`);
    if (page.status === 200) pass(`site ${route} is 200`);
    else fail(`site ${route}`, `status ${page.status}`);
  }

  // NEXT_PUBLIC_API_URL is inlined into the per-route JS chunks, NOT into the
  // HTML, so the page source has to be followed to its chunks to check it. This
  // is the check that catches a frontend built without the variable set.
  // Next references these as "static/chunks/..." in the prerendered HTML, usually
  // without a leading /_next/, so both forms are matched and normalised. The
  // per-route chunks under chunks/app/ are the ones that carry the inlined value,
  // so they are checked first.
  const chunkPaths = [...site.text.matchAll(/(?:\/_next\/)?(static\/chunks\/[A-Za-z0-9._/-]+?\.js)/g)]
    .map((m) => `/_next/${m[1]}`)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => Number(b.includes('/chunks/app/')) - Number(a.includes('/chunks/app/')))
    .slice(0, 25);

  if (chunkPaths.length === 0) {
    warn('could not find any JS chunks on the homepage', 'skipped the API URL check');
  } else {
    let sawApiOrigin = false;
    let sawPlaceholder = false;

    for (const chunkPath of chunkPaths) {
      const chunk = await get(`${SITE_URL}${chunkPath}`);
      if (chunk.status !== 200) continue;
      if (chunk.text.includes('localhost:4000')) sawPlaceholder = true;
      if (chunk.text.includes(new URL(API_URL).host)) sawApiOrigin = true;
    }

    if (sawPlaceholder) {
      fail(
        'the site bundle still points at localhost:4000',
        'NEXT_PUBLIC_API_URL was not set when Hostinger built the frontend — set it, then rebuild (a restart is not enough)',
      );
    } else if (sawApiOrigin) {
      pass(`site bundle points at ${new URL(API_URL).host}`);
    } else {
      warn('could not confirm the API URL in the site bundle', `scanned ${chunkPaths.length} chunks`);
    }
  }
}

// --- 7. The gate migration is applied --------------------------------------
// get_visitor_metrics() only exists after 20260818120000_backend_service_layer.sql,
// so a successful /api/admin/metrics proves the migration landed.
if (ADMIN_PASSWORD) {
  const login = await get(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });

  if (login.status === 200 && login.json?.token) {
    pass('staff login succeeds');
    const metrics = await get(`${API_URL}/api/admin/metrics`, {
      headers: { authorization: `Bearer ${login.json.token}` },
    });
    if (metrics.status === 200 && typeof metrics.json?.metrics?.total === 'number') {
      pass(`admin metrics load — gate migration is applied (${metrics.json.metrics.total} visitors)`);
    } else if (metrics.json?.code === 'MIGRATION_REQUIRED') {
      fail('gate migration is NOT applied', 'run: cd backend && supabase db push');
    } else {
      fail('admin metrics', `status ${metrics.status} ${metrics.json?.error || ''}`);
    }
  } else {
    fail('staff login failed', `status ${login.status} — is ADMIN_PASSWORD in sync with the API app?`);
  }
} else {
  warn('skipped the migration check', 'set ADMIN_PASSWORD to verify the gate database functions');
}

console.log(`\n[verify] ${passes} passed, ${warnings} warnings, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
