/**
 * list-gemini-models.mjs
 * Lists ALL Gemini models available for your API key (like genai.list_models() in Python).
 *
 * Usage:
 *   node scripts/list-gemini-models.mjs
 *   node scripts/list-gemini-models.mjs AIzaSy...yourkey
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadKey() {
  const cliKey = process.argv.slice(2).find(a => a.startsWith('AIza'));
  if (cliKey) return cliKey;

  try {
    const lines = readFileSync(join(__dirname, '..', '.env.local'), 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^(?:GEMINI_API_KEY(?:_\d+)?|VITE_GEMINI_API_KEY)\s*=\s*(.+)$/);
      if (m) {
        const val = m[1].trim().replace(/^["']|["']$/g, '');
        if (val.startsWith('AIza')) return val;
      }
    }
  } catch { /* no .env.local */ }

  return process.env.GEMINI_API_KEY ?? null;
}

const key = loadKey();
if (!key) {
  console.error('❌ No API key found. Pass it as argument: node scripts/list-gemini-models.mjs AIzaSy...');
  process.exit(1);
}

const masked = key.slice(0, 8) + '...' + key.slice(-4);
console.log(`\n🔑 Key: ${masked}`);
console.log('Се поврзувам со Google Gemini API...\n');

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=100`;
const res = await fetch(url);
const data = await res.json();

if (!res.ok) {
  console.error('❌ Грешка:', data.error?.message ?? JSON.stringify(data));
  process.exit(1);
}

const models = data.models ?? [];
console.log(`✅ Успешна конекција! Вкупно модели: ${models.length}`);
console.log('─'.repeat(75));

// Group by family
const generateModels = models.filter(m => m.supportedGenerationMethods?.includes('generateContent'));
const streamModels   = models.filter(m => m.supportedGenerationMethods?.includes('streamGenerateContent'));
const embedModels    = models.filter(m => m.supportedGenerationMethods?.includes('embedContent'));
const otherModels    = models.filter(m =>
  !m.supportedGenerationMethods?.includes('generateContent') &&
  !m.supportedGenerationMethods?.includes('embedContent')
);

function printGroup(title, list) {
  if (!list.length) return;
  console.log(`\n${title} (${list.length})`);
  for (const m of list) {
    const name   = m.name.replace('models/', '');
    const disp   = m.displayName ?? name;
    const stream = m.supportedGenerationMethods?.includes('streamGenerateContent') ? ' 🌊stream' : '';
    const tokens = m.inputTokenLimit ? ` | in:${(m.inputTokenLimit/1000).toFixed(0)}k` : '';
    const out    = m.outputTokenLimit ? ` out:${(m.outputTokenLimit/1000).toFixed(0)}k` : '';
    console.log(`  🔹 ${name.padEnd(45)} ${disp}`);
    console.log(`     └─ ${(m.supportedGenerationMethods ?? []).join(', ')}${stream}${tokens}${out}`);
  }
}

printGroup('🧠 GENERATE CONTENT (можат да генерираат текст)', generateModels);
printGroup('🔢 EMBEDDING (само за embeddings)', embedModels);
printGroup('🔧 ОСТАНАТИ', otherModels);

console.log('\n' + '─'.repeat(75));
console.log('📋 Само имиња — за copy-paste во constants:\n');
for (const m of generateModels) {
  console.log(`  '${m.name.replace('models/', '')}',`);
}
console.log();
