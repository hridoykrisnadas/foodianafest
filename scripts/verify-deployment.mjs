#!/usr/bin/env node

/**
 * Verifies a live frontend deployment from the outside.
 *
 * Unlike CI, this runs against real infrastructure, so it can check the things
 * that only fail in production: the site is actually serving, and the bundle was
 * built with the real API URL rather than the placeholder.
 *
 * The API's own health, auth, CORS and migration checks live in the
 * foodiana-backend repository. API_URL is needed here only to know which origin
 * the bundle is supposed to point at.
 *
 * Usage:
 *   SITE_URL=https://foodiana.com API_URL=https://api.foodiana.com node scripts/verify-deployment.mjs
 */

const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
const API_URL = (process.env.API_URL || '').replace(/\/+$/, '');

if (!SITE_URL) {
  console.error('[verify] SITE_URL is required (e.g. https://foodiana.com)');
  process.exit(1);
}
if (!API_URL) {
  console.error('[verify] API_URL is required — it is the origin the bundle must point at');
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
    return { status: response.status, text, headers: response.headers };
  } catch (error) {
    return { status: 0, text: '', headers: new Headers(), error };
  } finally {
    clearTimeout(timer);
  }
}

console.log(`[verify] site ${SITE_URL}`);
console.log(`[verify] expecting the bundle to call ${API_URL}`);
console.log('');

// --- 1. The site is serving -------------------------------------------------
const site = await get(`${SITE_URL}/`);
if (site.status === 200 && /<title>/i.test(site.text)) {
  pass('site homepage is 200');
} else if (site.status === 0) {
  // Nothing else can be judged if the host is unreachable.
  fail('site is unreachable', site.error?.message || 'no response');
  console.error(
    `\n[verify] Cannot reach ${SITE_URL} at all — skipping the remaining checks.\n` +
      '  Check the Hostinger app is Running, the domain resolves, and SSL is issued.',
  );
  console.log(`\n[verify] ${passes} passed, ${warnings} warnings, ${failures} failed`);
  process.exit(1);
} else {
  fail('site homepage', `status ${site.status}`);
}

for (const route of ['/register', '/admin', '/admin/scan']) {
  const page = await get(`${SITE_URL}${route}`);
  if (page.status === 200) pass(`site ${route} is 200`);
  else fail(`site ${route}`, `status ${page.status}`);
}

// --- 2. The bundle points at the real API ----------------------------------
// NEXT_PUBLIC_API_URL is inlined into the per-route JS chunks, NOT into the
// HTML, so the page source has to be followed to its chunks to check it. This is
// the check that catches a frontend built without the variable set.
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
      'NEXT_PUBLIC_API_URL was not set when Hostinger built the site — set it, then rebuild (a restart is not enough)',
    );
  } else if (sawApiOrigin) {
    pass(`site bundle points at ${new URL(API_URL).host}`);
  } else {
    warn('could not confirm the API URL in the site bundle', `scanned ${chunkPaths.length} chunks`);
  }
}

// --- 3. The API accepts this site as a browser origin ----------------------
// A cross-repository check on purpose: CORS_ORIGINS is configured on the API app,
// but it is this site that breaks when the origin is missing.
const cors = await get(`${API_URL}/health`, { headers: { origin: SITE_URL } });
if (cors.status === 0) {
  warn('could not reach the API to check CORS', cors.error?.message || 'no response');
} else if (cors.headers.get('access-control-allow-origin') === SITE_URL) {
  pass(`the API allows this site's origin (${SITE_URL})`);
} else {
  fail(
    'the API does not allow this site\'s origin',
    `add ${SITE_URL} to CORS_ORIGINS on the API app (foodiana-backend)`,
  );
}

console.log(`\n[verify] ${passes} passed, ${warnings} warnings, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
