#!/usr/bin/env node
/**
 * scripts/hash-prompts.mjs
 *
 * Prompt version governance tool — D3 of S16 World-Class Upgrade.
 *
 * Usage:
 *   node scripts/hash-prompts.mjs --check      # Fail if any prompt has drifted from registry
 *   node scripts/hash-prompts.mjs --update     # Recompute hashes, bump patch version, update changelog
 *   node scripts/hash-prompts.mjs --list       # Print all tracked prompts with current versions
 *
 * Prompts are delimited in source files by sentinel comments:
 *   // @prompt-start: <ID>
 *   // @prompt-end: <ID>
 *
 * The text between sentinels (exclusive) is hashed with SHA-256.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const REGISTRY_PATH = resolve(ROOT, 'prompts/prompt-registry.json');
const CHANGELOG_PATH = resolve(ROOT, 'prompts/CHANGELOG.md');

// ─── helpers ────────────────────────────────────────────────────────────────

function loadRegistry() {
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'));
}

function saveRegistry(reg) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2) + '\n', 'utf-8');
}

/**
 * Extract the text between // @prompt-start: <id> and // @prompt-end: <id>
 * sentinels in the given source file. Returns the trimmed content.
 */
function extractPromptText(sourceFile, promptId) {
  const src = readFileSync(resolve(ROOT, sourceFile), 'utf-8');
  const lines = src.split('\n');

  const startPattern = `// @prompt-start: ${promptId}`;
  const endPattern   = `// @prompt-end: ${promptId}`;

  const startIdx = lines.findIndex(l => l.includes(startPattern));
  if (startIdx === -1) {
    throw new Error(`Sentinel "@prompt-start: ${promptId}" not found in ${sourceFile}`);
  }

  const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes(endPattern));
  if (endIdx === -1) {
    throw new Error(`Sentinel "@prompt-end: ${promptId}" not found in ${sourceFile}`);
  }

  return lines.slice(startIdx + 1, endIdx).join('\n').trim();
}

function computeHash(text) {
  return createHash('sha256').update(text, 'utf-8').digest('hex');
}

function bumpPatch(semver) {
  const parts = semver.split('.').map(Number);
  parts[2] = (parts[2] ?? 0) + 1;
  return parts.join('.');
}

// ─── modes ──────────────────────────────────────────────────────────────────

const mode = process.argv[2] ?? '--check';

if (mode === '--list') {
  const registry = loadRegistry();
  const ids = Object.keys(registry.prompts);
  console.log(`\nPrompt Registry v${registry.version} — ${ids.length} tracked prompts\n`);
  console.log('  ID'.padEnd(38) + 'VER'.padEnd(10) + 'LAST MODIFIED  DESCRIPTION');
  console.log('  ' + '─'.repeat(90));
  for (const id of ids) {
    const p = registry.prompts[id];
    const hashStatus = p.hash ? `${p.hash.slice(0, 8)}…` : '(no hash)';
    console.log(
      `  ${id.padEnd(36)} v${p.version.padEnd(8)} ${p.lastModified}   ${p.description}`
    );
  }
  console.log('');
  process.exit(0);
}

if (mode === '--update') {
  const registry = loadRegistry();
  const today = new Date().toISOString().slice(0, 10);
  const changes = [];

  console.log('\nUpdating prompt hashes…\n');

  for (const [id, p] of Object.entries(registry.prompts)) {
    try {
      const text = extractPromptText(p.sourceFile, id);
      const hash = computeHash(text);

      if (hash !== p.hash) {
        const oldVer = p.version;
        const newVer = bumpPatch(p.version);

        // Push current state to history (keep last 10)
        p.history = p.history ?? [];
        p.history.unshift({ version: oldVer, hash: p.hash, replacedAt: today });
        if (p.history.length > 10) p.history = p.history.slice(0, 10);

        p.hash         = hash;
        p.version      = newVer;
        p.lastModified = today;
        changes.push({ id, oldVer, newVer });

        console.log(`  UPDATED   ${id.padEnd(34)} v${oldVer} → v${newVer}`);
      } else {
        console.log(`  UNCHANGED ${id.padEnd(34)} v${p.version} — hash matches`);
      }
    } catch (err) {
      console.error(`  ERROR     ${id.padEnd(34)} ${err.message}`);
    }
  }

  saveRegistry(registry);

  if (changes.length) {
    const entry = [
      `\n## ${today}`,
      ...changes.map(c => `- **${c.id}**: v${c.oldVer} → v${c.newVer}`)
    ].join('\n') + '\n';

    const changelog = readFileSync(CHANGELOG_PATH, 'utf-8');
    writeFileSync(CHANGELOG_PATH, changelog + entry, 'utf-8');
    console.log(`\nChangelog updated — ${changes.length} change(s) recorded.`);
  } else {
    console.log('\nNo changes — registry is up to date.');
  }

  console.log('\nDone.\n');
  process.exit(0);
}

if (mode === '--check') {
  const registry = loadRegistry();
  let pass = true;

  console.log('\nChecking prompt hashes against registry…\n');

  for (const [id, p] of Object.entries(registry.prompts)) {
    try {
      const text = extractPromptText(p.sourceFile, id);
      const hash = computeHash(text);

      if (!p.hash) {
        console.warn(`  WARN      ${id.padEnd(34)} no baseline hash — run --update first`);
      } else if (hash !== p.hash) {
        console.error(`  DRIFT     ${id.padEnd(34)} expected ${p.hash.slice(0, 12)}… got ${hash.slice(0, 12)}…`);
        pass = false;
      } else {
        console.log(`  OK        ${id.padEnd(34)} v${p.version} ✓`);
      }
    } catch (err) {
      console.error(`  ERROR     ${id.padEnd(34)} ${err.message}`);
      pass = false;
    }
  }

  if (!pass) {
    console.error('\n✗ Prompt drift detected. Run `npm run prompts:update` to update the registry,');
    console.error('  or revert the source changes to restore the known-good prompt text.\n');
    process.exit(1);
  }

  console.log('\n✓ All prompts match registry.\n');
  process.exit(0);
}

console.error(`Unknown mode: ${mode}. Use --check, --update, or --list.`);
process.exit(1);
