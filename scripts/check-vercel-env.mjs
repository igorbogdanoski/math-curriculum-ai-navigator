#!/usr/bin/env node
/**
 * scripts/check-vercel-env.mjs
 *
 * П10 — Operational guard: verifies that the deployed Vercel environment
 * has the security-critical env vars configured.  Run via:
 *
 *   npm run vercel:env:check                         # uses production env
 *   npm run vercel:env:check -- --env=preview        # check preview
 *
 * Requires: Vercel CLI authenticated (`vercel login`).
 *
 * Exit code 0 = all required vars present (and ALLOWED_ORIGIN passes
 * shape check). Exit code 1 = at least one required var is missing or
 * malformed; CI/CD should fail.
 *
 * NOTE: This script never prints actual secret values. It only reports
 * presence + length + a host check for the public ALLOWED_ORIGIN.
 */

import { spawnSync } from 'node:child_process';

const ENV_ARG = process.argv.find(a => a.startsWith('--env='))?.split('=')[1] ?? 'production';

const REQUIRED_VARS = [
  // Security boundary
  'ALLOWED_ORIGIN',
  // Auth backend
  'FIREBASE_SERVICE_ACCOUNT',
  // AI backend (at least one of the rotation slots)
  ['GEMINI_API_KEY', 'GEMINI_API_KEY_1', 'VITE_GEMINI_API_KEY'],
  // Rate-limit backend
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

function fetchVercelEnv(env) {
  const result = spawnSync('vercel', ['env', 'ls', env], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.error('[check-vercel-env] `vercel env ls` failed.');
    console.error(result.stderr || result.stdout);
    process.exit(2);
  }
  // Each row: NAME  VALUE  ENVIRONMENTS  CREATED
  const lines = result.stdout.split('\n').slice(1).map(l => l.trim()).filter(Boolean);
  return new Set(lines.map(l => l.split(/\s+/)[0]).filter(Boolean));
}

function isHttpsUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function checkAllowedOriginShape() {
  // The script can't read the actual value via the CLI without `vercel env pull`.
  // Provide a soft hint: if VERCEL_ALLOWED_ORIGIN is exported locally, validate it.
  const local = process.env.ALLOWED_ORIGIN;
  if (!local) return { skipped: true };
  const parts = local.split(',').map(s => s.trim()).filter(Boolean);
  const bad = parts.filter(p => !isHttpsUrl(p));
  return { skipped: false, ok: bad.length === 0, bad };
}

function main() {
  console.log(`[check-vercel-env] Auditing Vercel env=${ENV_ARG} for required vars...`);
  const present = fetchVercelEnv(ENV_ARG);

  const missing = [];
  for (const entry of REQUIRED_VARS) {
    if (Array.isArray(entry)) {
      const anyOk = entry.some(name => present.has(name));
      if (!anyOk) missing.push(`one-of(${entry.join(', ')})`);
    } else if (!present.has(entry)) {
      missing.push(entry);
    }
  }

  if (missing.length > 0) {
    console.error(`❌ Missing required env vars in ${ENV_ARG}:`);
    for (const m of missing) console.error(`   - ${m}`);
    process.exit(1);
  }

  const shape = checkAllowedOriginShape();
  if (!shape.skipped) {
    if (!shape.ok) {
      console.error('❌ Local ALLOWED_ORIGIN shape check failed:');
      for (const b of shape.bad) console.error(`   - "${b}" is not an https:// URL`);
      process.exit(1);
    }
    console.log('✅ Local ALLOWED_ORIGIN shape OK');
  }

  console.log(`✅ All ${REQUIRED_VARS.length} required vars present in Vercel ${ENV_ARG}.`);
}

main();
