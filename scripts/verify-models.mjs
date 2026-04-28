/**
 * verify-models.mjs
 * Compares the model IDs used in core.constants.ts against Google's live model list.
 * Run this before deploy or when Google announces model deprecations.
 *
 * Usage:
 *   node scripts/verify-models.mjs
 *   node scripts/verify-models.mjs AIzaSy...key   (override key)
 *
 * Exit 1 if any active model constant is no longer available.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── Read API key ─────────────────────────────────────────────────────────────
function loadKey() {
  const cli = process.argv.slice(2).find(a => a.startsWith('AIza'));
  if (cli) return cli;
  try {
    for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^(?:GEMINI_API_KEY(?:_\d+)?|VITE_GEMINI_API_KEY)\s*=\s*(.+)$/);
      if (m) { const v = m[1].trim().replace(/^["']|["']$/g, ''); if (v.startsWith('AIza')) return v; }
    }
  } catch { /* no .env.local */ }
  return process.env.GEMINI_API_KEY ?? null;
}

// ── Parse model constants from TypeScript source (no compile step) ───────────
function parseConstants() {
  const src = readFileSync(join(ROOT, 'services/gemini/core.constants.ts'), 'utf8');
  const models = {};
  for (const [, name, value] of src.matchAll(/export const (\w+_MODEL)\s*=\s*'([^']+)'/g)) {
    models[name] = value;
  }
  return models;
}

// ── Fetch live model list ─────────────────────────────────────────────────────
async function fetchLiveModels(key) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`,
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'API error');
  return new Set((data.models ?? []).map(m => m.name.replace('models/', '')));
}

// ── Main ──────────────────────────────────────────────────────────────────────
const key = loadKey();
if (!key) {
  console.error('❌ No API key found. Pass it as: node scripts/verify-models.mjs AIzaSy...');
  process.exit(1);
}

const [constants, liveModels] = await Promise.all([
  Promise.resolve(parseConstants()),
  fetchLiveModels(key),
]);

console.log('\n🔍 Gemini Model Verification');
console.log('─'.repeat(60));

let allOk = true;
for (const [constName, modelId] of Object.entries(constants)) {
  const ok = liveModels.has(modelId);
  const icon = ok ? '✅' : '❌';
  console.log(`${icon}  ${constName.padEnd(20)} → ${modelId}`);
  if (!ok) {
    allOk = false;
    // Find closest alternative
    const similar = [...liveModels].filter(m =>
      m.includes('flash') && modelId.includes('flash') ||
      m.includes('pro')   && modelId.includes('pro')
    ).slice(0, 3);
    if (similar.length) console.log(`   ⚠️  Suggestions: ${similar.join(', ')}`);
  }
}

console.log('─'.repeat(60));
if (allOk) {
  console.log('✅ All model constants are valid.\n');
  process.exit(0);
} else {
  console.log('❌ Some models are no longer available — update core.constants.ts!\n');
  console.log('Run this to see all current models:');
  console.log('  node scripts/list-gemini-models.mjs\n');
  process.exit(1);
}
