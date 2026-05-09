#!/usr/bin/env node
/**
 * Vercel ignoreCommand — exit 0 to *skip* the build, exit 1 to proceed.
 *
 * We skip Vercel rebuilds when the commit only touches files that don't
 * affect the production bundle (tests, eval data, markdown, GitHub
 * Actions, scripts not used at build time, prompts registry). This
 * dramatically lowers monthly Vercel Build/CPU minute charges.
 *
 * Vercel sets these env vars during ignoreCommand:
 *   VERCEL_GIT_COMMIT_REF      — branch (build only on `main`)
 *   VERCEL_GIT_PREVIOUS_SHA    — last deployed sha (range start)
 *   VERCEL_GIT_COMMIT_SHA      — current sha (range end)
 */
import { execSync } from 'node:child_process';

const branch = process.env.VERCEL_GIT_COMMIT_REF || '';
const prev = process.env.VERCEL_GIT_PREVIOUS_SHA || '';
const cur = process.env.VERCEL_GIT_COMMIT_SHA || 'HEAD';

// 1) Only build `main`.
if (branch && branch !== 'main') {
  console.log(`[vercel-ignore] branch=${branch} → skip (only main builds)`);
  process.exit(0);
}

// 2) If we don't know the previous sha, build to be safe.
if (!prev) {
  console.log('[vercel-ignore] no previous sha → build');
  process.exit(1);
}

let changed = '';
try {
  changed = execSync(`git diff --name-only ${prev} ${cur}`, { encoding: 'utf8' });
} catch (e) {
  console.log('[vercel-ignore] git diff failed → build to be safe');
  process.exit(1);
}

const files = changed.split('\n').map(f => f.trim()).filter(Boolean);
if (files.length === 0) {
  console.log('[vercel-ignore] no files changed → skip');
  process.exit(0);
}

const SKIP_PREFIXES = [
  '__tests__/',
  'tests/',
  'playwright/',
  'eval/',
  'docs/',
  '.github/',
  'prompts/',
  '.vscode/',
];
const SKIP_EXACT = new Set([
  'README.md',
  'AGENTS.md',
  'CHANGELOG.md',
  '.gitignore',
  '.gitattributes',
  '.commitmsg.tmp',
  'lint-staged.config.mjs',
  'playwright.config.ts',
  'vitest.config.ts',
]);

const isSkippable = (f) => {
  if (SKIP_EXACT.has(f)) return true;
  if (SKIP_PREFIXES.some(p => f.startsWith(p))) return true;
  // Markdown files outside docs/ (e.g. S60_*.md, S61_*.md plans)
  if (f.endsWith('.md')) return true;
  // Test specs colocated near sources
  if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) return true;
  if (f.endsWith('.spec.ts') || f.endsWith('.spec.tsx')) return true;
  return false;
};

const buildRelevant = files.filter(f => !isSkippable(f));
if (buildRelevant.length === 0) {
  console.log(`[vercel-ignore] ${files.length} file(s) all skippable → skip build`);
  console.log(files.map(f => '  - ' + f).join('\n'));
  process.exit(0);
}

console.log(`[vercel-ignore] ${buildRelevant.length} build-relevant file(s) → build`);
console.log(buildRelevant.slice(0, 10).map(f => '  + ' + f).join('\n'));
process.exit(1);
