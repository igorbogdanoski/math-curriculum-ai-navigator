/**
 * scripts/import-matura-all.mjs
 * Batch-imports every JSON file found in data/matura/raw/ into Firestore.
 *
 * Usage:
 *   npm run matura:import-all              # import all, skip already-imported
 *   npm run matura:import-all -- --force   # re-import even if exam already exists
 *   npm run matura:import-all -- --dry-run # validate all, write nothing
 *
 * Requires:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/firebase-adminsdk-key.json
 */

import fs   from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR    = path.resolve(__dirname, '../data/matura/raw');
const IMPORT_SCR = path.resolve(__dirname, 'import-matura.mjs');

const args   = process.argv.slice(2);
const force  = args.includes('--force');
const dryRun = args.includes('--dry-run');

// Collect all JSON files
const files = fs.readdirSync(RAW_DIR)
  .filter(f => f.endsWith('.json'))
  .sort()
  .map(f => path.join(RAW_DIR, f));

if (!files.length) {
  console.error('No JSON files found in', RAW_DIR);
  process.exit(1);
}

console.log(`\nDIM Matura — batch import`);
console.log(`Found ${files.length} file(s) in data/matura/raw/`);
if (dryRun) console.log('DRY-RUN mode — nothing will be written.\n');
if (force)  console.log('FORCE mode — re-importing all.\n');
console.log('');

// If not dry-run, check Firebase credentials early
if (!dryRun && !process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error(
    'ERROR: No Firebase credentials found.\n' +
    '  Set GOOGLE_APPLICATION_CREDENTIALS=path/to/firebase-adminsdk-key.json\n' +
    '  or FIREBASE_SERVICE_ACCOUNT=<inline JSON>',
  );
  process.exit(1);
}

// Optional: check which exams already exist in Firestore to skip them
let existingIds = new Set();
if (!dryRun && !force) {
  try {
    const adminMod = await import('firebase-admin');
    const admin = adminMod.default;
    if (!admin.apps.length) {
      const saEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (saEnv) {
        admin.initializeApp({ credential: admin.credential.cert(JSON.parse(saEnv)) });
      } else {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
      }
    }
    const db   = admin.firestore();
    const snap = await db.collection('matura_exams').get();
    snap.forEach(doc => existingIds.add(doc.id));
    console.log(`Already in Firestore: ${existingIds.size} exam(s) — will skip unless --force.\n`);
  } catch (e) {
    console.warn('Could not pre-check Firestore — will import all:', e.message);
  }
}

let ok = 0, skipped = 0, failed = 0;

for (const filePath of files) {
  const rel = path.relative(process.cwd(), filePath);

  // Peek at the exam id without full validation
  let examId;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    examId = raw?.exam?.id;
  } catch {
    console.error(`  SKIP (bad JSON): ${rel}`);
    failed++;
    continue;
  }

  if (!dryRun && !force && examId && existingIds.has(examId)) {
    console.log(`  -- SKIP (already imported): ${rel}  [${examId}]`);
    skipped++;
    continue;
  }

  console.log(`  >> ${rel}  [${examId ?? '?'}]`);

  const extraFlag = dryRun ? ' --dry-run' : '';
  try {
    execSync(
      `node "${IMPORT_SCR}" --input "${filePath}"${extraFlag}`,
      { stdio: 'inherit', env: process.env },
    );
    ok++;
  } catch {
    console.error(`  ERROR importing ${rel}`);
    failed++;
  }
  console.log('');
}

console.log('─'.repeat(50));
console.log(`Done.  OK: ${ok}  |  Skipped: ${skipped}  |  Failed: ${failed}`);
if (failed) process.exit(1);
