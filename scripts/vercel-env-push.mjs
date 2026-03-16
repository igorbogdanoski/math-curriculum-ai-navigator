#!/usr/bin/env node
/**
 * scripts/vercel-env-push.mjs
 *
 * Reads .env.local and pushes every variable to Vercel.
 * Vercel CLI requires ONE environment per call, so each var is pushed separately.
 *
 *   node scripts/vercel-env-push.mjs              ← push to production + preview
 *   node scripts/vercel-env-push.mjs --dry-run    ← preview only, no changes
 *   node scripts/vercel-env-push.mjs --env=production
 */

import { spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT   = resolve(__dir, '..');
const ENV_FILE = resolve(ROOT, '.env.local');

// ── CLI flags ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const envArg  = process.argv.find(a => a.startsWith('--env='))?.split('=')[1];
const ENVIRONMENTS = (envArg ?? 'production preview').split(' ').filter(Boolean);

// ── Vars to skip ───────────────────────────────────────────────────────────────
const SKIP = new Set(['SENTRY_AUTH_TOKEN']);

// ── Extra vars not in .env.local ──────────────────────────────────────────────
const EXTRA = {
  ALLOWED_ORIGIN: 'https://math-curriculum-ai-navigator.vercel.app',
  VITE_DEMO_MODE: 'false',
};

// ── Parse .env.local ──────────────────────────────────────────────────────────
if (!existsSync(ENV_FILE)) {
  console.error('❌  .env.local not found:', ENV_FILE);
  process.exit(1);
}

const vars = {};
for (const line of readFileSync(ENV_FILE, 'utf-8').split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq === -1) continue;
  vars[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

// GOOGLE_APPLICATION_CREDENTIALS_BASE64 → FIREBASE_SERVICE_ACCOUNT alias
if (vars['GOOGLE_APPLICATION_CREDENTIALS_BASE64'] && !vars['FIREBASE_SERVICE_ACCOUNT']) {
  vars['FIREBASE_SERVICE_ACCOUNT'] = vars['GOOGLE_APPLICATION_CREDENTIALS_BASE64'];
  console.log('ℹ️   FIREBASE_SERVICE_ACCOUNT ← mapped from GOOGLE_APPLICATION_CREDENTIALS_BASE64\n');
}

// Merge extras (don't overwrite existing)
for (const [k, v] of Object.entries(EXTRA)) {
  if (!vars[k]) vars[k] = v;
}

// ── Push ───────────────────────────────────────────────────────────────────────
let ok = 0, fail = 0, skip = 0;

for (const [key, value] of Object.entries(vars)) {
  if (SKIP.has(key) || !value) {
    console.log(`⏭️   SKIP   ${key}`);
    skip++;
    continue;
  }

  const preview = value.length > 50
    ? value.slice(0, 22) + '…' + value.slice(-10)
    : value;

  for (const env of ENVIRONMENTS) {
    const label = `${key}  [${env}]`;
    if (DRY_RUN) {
      console.log(`🔍 DRY  ${label}  =  ${preview}`);
      ok++;
      continue;
    }

    process.stdout.write(`🚀 SET   ${label} … `);

    // Pass value via stdin — avoids ALL shell escaping problems
    // shell:true required on Windows where vercel is a .cmd file
    const result = spawnSync('vercel', ['env', 'add', key, env, '--force'], {
      cwd: ROOT,
      input: value,
      encoding: 'utf-8',
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (result.status === 0) {
      console.log('✅');
      ok++;
    } else {
      const msg = (result.stderr || result.stdout || '').trim().split('\n').pop();
      console.log(`❌  ${msg}`);
      fail++;
    }
  }
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`✅ OK: ${ok}   ❌ Failed: ${fail}   ⏭️ Skipped: ${skip}`);
if (DRY_RUN) console.log('\nDry run — remove --dry-run to apply changes.');
if (fail > 0) process.exit(1);
