/**
 * check-gemini-models.mjs
 * Tests which Gemini model IDs are accessible with your API keys.
 *
 * Usage:
 *   node scripts/check-gemini-models.mjs
 *   node scripts/check-gemini-models.mjs AIzaSy...key1 AIzaSy...key2
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Models to test ──────────────────────────────────────────────────────────
const MODELS_TO_TEST = [
  // Gemini 2.5
  'gemini-2.5-pro',
  'gemini-2.5-pro-preview-05-06',
  'gemini-2.5-flash',
  'gemini-2.5-flash-preview-04-17',
  // Gemini 2.0
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  // Gemini 3.x (check if released)
  'gemini-3.0-pro',
  'gemini-3.0-flash',
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview',
  // Thinking variants
  'gemini-2.5-pro-exp-03-25',
];

const PROMPT = 'Reply with just the word "OK".';
const TIMEOUT_MS = 10_000;

// ── Load API keys ───────────────────────────────────────────────────────────
function loadKeys() {
  // 1. Keys passed as CLI arguments
  const cliKeys = process.argv.slice(2).filter(a => a.startsWith('AIza'));
  if (cliKeys.length > 0) return cliKeys;

  // 2. Keys from .env.local
  const envKeys = [];
  try {
    const envPath = join(__dirname, '..', '.env.local');
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^(?:GEMINI_API_KEY(?:_\d+)?|VITE_GEMINI_API_KEY)\s*=\s*(.+)$/);
      if (match) {
        const val = match[1].trim().replace(/^["']|["']$/g, '');
        if (val && val.startsWith('AIza')) envKeys.push(val);
      }
    }
  } catch { /* no .env.local */ }

  if (envKeys.length > 0) return [...new Set(envKeys)];

  // 3. GEMINI_API_KEY env var
  const envVar = process.env.GEMINI_API_KEY;
  if (envVar?.startsWith('AIza')) return [envVar];

  return [];
}

// ── Call Gemini REST API ────────────────────────────────────────────────────
async function testModel(apiKey, modelId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
    generationConfig: { maxOutputTokens: 10 },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const data = await res.json();
    if (res.ok) {
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '(no text)';
      return { ok: true, status: res.status, text: text.trim() };
    }
    const msg = data.error?.message ?? JSON.stringify(data);
    return { ok: false, status: res.status, error: msg };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') return { ok: false, status: 0, error: 'TIMEOUT' };
    return { ok: false, status: 0, error: err.message };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
const keys = loadKeys();

if (keys.length === 0) {
  console.error('❌ No API keys found.');
  console.error('   Pass key as argument: node scripts/check-gemini-models.mjs AIzaSy...');
  console.error('   Or set GEMINI_API_KEY in .env.local');
  process.exit(1);
}

console.log(`\n🔑 Testing ${keys.length} key(s) × ${MODELS_TO_TEST.length} models\n`);

for (const key of keys) {
  const masked = key.slice(0, 8) + '...' + key.slice(-4);
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Key: ${masked}`);
  console.log('─'.repeat(60));

  const working = [];
  const failed = [];

  for (const model of MODELS_TO_TEST) {
    process.stdout.write(`  Testing ${model.padEnd(42)} `);
    const result = await testModel(key, model);
    if (result.ok) {
      console.log(`✅  ${result.text}`);
      working.push(model);
    } else {
      const label = result.status === 404 ? 'NOT FOUND' :
                    result.status === 403 ? 'FORBIDDEN (not in your tier)' :
                    result.status === 429 ? 'QUOTA EXCEEDED' :
                    result.status === 0   ? result.error :
                    `ERROR ${result.status}`;
      console.log(`❌  ${label}`);
      failed.push({ model, label });
    }
  }

  console.log(`\n  ✅ WORKING (${working.length}): ${working.join(', ') || 'none'}`);
  if (failed.length) {
    console.log(`  ❌ FAILED  (${failed.length}): ${failed.map(f => f.model).join(', ')}`);
  }
}

console.log('\n✔ Done.\n');
