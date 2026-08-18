#!/usr/bin/env node

/**
 * Regression guard for the frontend/backend boundary.
 *
 * The whole point of the split is that the browser holds no database
 * credentials. It is easy to undo that by accident — one `import { createClient }`
 * in a component and the anon key is back in the bundle. This fails the build if
 * that happens, so the boundary is enforced by CI rather than by memory.
 *
 * Run after `npm run build:frontend`.
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const frontendDir = path.join(repoRoot, 'frontend');
const buildDir = path.join(frontendDir, '.next');

const failures = [];

// --- 1. Source-level checks -------------------------------------------------

if (existsSync(path.join(frontendDir, 'lib', 'supabase.ts'))) {
  failures.push('frontend/lib/supabase.ts exists again — the browser must not hold a Supabase client');
}

const frontendPkg = JSON.parse(readFileSync(path.join(frontendDir, 'package.json'), 'utf8'));
const allDeps = { ...frontendPkg.dependencies, ...frontendPkg.devDependencies };
if (allDeps['@supabase/supabase-js']) {
  failures.push('frontend depends on @supabase/supabase-js again — it should only be a backend dependency');
}

// --- 2. Built-bundle checks -------------------------------------------------

if (!existsSync(buildDir)) {
  console.error(`[check] No build found at ${buildDir}. Run "npm run build:frontend" first.`);
  process.exit(1);
}

/** Strings that must never appear in anything shipped to a browser. */
const FORBIDDEN = [
  { needle: 'SUPABASE_SERVICE_ROLE_KEY', why: 'service-role key name leaked into the client bundle' },
  { needle: 'service_role', why: 'service-role reference leaked into the client bundle' },
  { needle: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', why: 'the old public anon key is back in the client bundle' },
  { needle: 'NEXT_PUBLIC_SUPABASE_URL', why: 'the old public Supabase URL is back in the client bundle' },
  { needle: 'foodiana-admin-authed', why: 'the old client-side admin gate is back' },
  { needle: 'Demo password', why: 'the demo password hint is back in the UI' },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

// Only client-reachable output matters: static chunks plus the prerendered HTML.
const scanned = walk(buildDir).filter(
  (f) =>
    (f.includes(`${path.sep}static${path.sep}`) || f.endsWith('.html')) &&
    /\.(js|html|json|css|txt)$/.test(f),
);

if (scanned.length === 0) {
  failures.push('found no client assets to scan — did the frontend build actually succeed?');
}

for (const file of scanned) {
  const content = readFileSync(file, 'utf8');
  for (const { needle, why } of FORBIDDEN) {
    if (content.includes(needle)) {
      failures.push(`${why} (${needle} found in ${path.relative(repoRoot, file)})`);
    }
  }
}

// --- 3. Report --------------------------------------------------------------

if (failures.length > 0) {
  console.error('\n[check] Frontend boundary violations:\n');
  for (const failure of [...new Set(failures)]) console.error(`  ✗ ${failure}`);
  console.error('');
  process.exit(1);
}

console.log(`[check] frontend boundary OK — scanned ${scanned.length} client assets, no credential leaks`);
