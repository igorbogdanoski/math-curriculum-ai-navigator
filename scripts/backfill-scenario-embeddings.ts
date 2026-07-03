/**
 * Backfill — Scenario Bank Embeddings
 *
 * The Firestore trigger `onScenarioPublishedEmbed` (functions/src/index.ts) only fires
 * on future writes to `scenario_bank`. This script embeds scenarios that were already
 * published *before* that trigger was deployed (2026-07-03).
 *
 * Mirrors the trigger's exact logic (same field names, same embeddable-entry-type set,
 * same embed text builder, same contentHash skip) so results are indistinguishable from
 * what the trigger would have produced.
 *
 * Run once (safe to re-run — skips docs whose contentHash already matches):
 *   npx tsx scripts/backfill-scenario-embeddings.ts
 *
 * Requirements (in .env.local at project root):
 *   GEMINI_API_KEY                         — for embedContent API
 *   GOOGLE_APPLICATION_CREDENTIALS_BASE64  — base64-encoded service account JSON
 *   VITE_FIREBASE_PROJECT_ID               — project id (for admin init)
 *
 * Rate limit: 10 requests/sec (Gemini embedding quota buffer).
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig({ path: '.env' });

import crypto from 'crypto';
import { initializeApp, cert, getApps, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// ── Firebase Admin init (bypasses security rules) ────────────────────────────

function initFirebaseAdmin(): App {
  if (getApps().length > 0) return getApps()[0]!;

  const rawSa = process.env.FIREBASE_SERVICE_ACCOUNT
    ?? process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64
    ?? '';

  if (!rawSa) {
    throw new Error(
      'Missing service account. Set FIREBASE_SERVICE_ACCOUNT (raw JSON) or ' +
      'GOOGLE_APPLICATION_CREDENTIALS_BASE64 (base64-encoded JSON) in .env.local',
    );
  }

  let parsed: Record<string, unknown>;
  try {
    const decoded = rawSa.trim().startsWith('{')
      ? rawSa
      : Buffer.from(rawSa, 'base64').toString('utf8');
    parsed = JSON.parse(decoded);
  } catch (err) {
    throw new Error(
      `Failed to parse service account JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return initializeApp({
    credential: cert(parsed as Parameters<typeof cert>[0]),
    projectId: process.env.VITE_FIREBASE_PROJECT_ID ?? (parsed.project_id as string | undefined),
  });
}

initFirebaseAdmin();
const db = getFirestore();
db.settings({ preferRest: true }); // avoid gRPC TLS issues on Windows corporate networks

// ── Gemini embedding — same model/dims/taskType as onScenarioPublishedEmbed ──

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY ?? '';
const EMBED_MODEL = 'gemini-embedding-2';
const EMBED_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBED_MODEL}`,
      content: { parts: [{ text }] },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: 768,
    }),
  });
  if (!res.ok) throw new Error(`Embed API ${res.status}: ${await res.text()}`);
  const json = await res.json() as { embedding: { values: number[] } };
  return json.embedding.values;
}

// ── Mirrors buildScenarioEmbedText / EMBEDDABLE_ENTRY_TYPES from functions/src/index.ts ──

const EMBEDDABLE_ENTRY_TYPES = new Set([undefined, 'lesson_plan']);

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function buildScenarioEmbedText(entry: FirebaseFirestore.DocumentData): string {
  return [
    entry.title,
    entry.topicTitle,
    entry.scenarioIntro,
    ...(Array.isArray(entry.scenarioMain) ? entry.scenarioMain : []),
    entry.scenarioConcluding,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .join('\n\n')
    .slice(0, 8000);
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('\nMissing Gemini API key. Add GEMINI_API_KEY to .env.local or .env.\n');
    process.exit(1);
  }

  const snap = await db.collection('scenario_bank')
    .where('deleted', '==', false)
    .where('isPublic', '==', true)
    .get();

  console.log(`Found ${snap.size} published, non-deleted scenario_bank docs.`);

  let embedded = 0;
  let skippedUnchanged = 0;
  let skippedNotEmbeddable = 0;
  let skippedEmptyText = 0;
  let errors = 0;

  for (const doc of snap.docs) {
    const entryId = doc.id;
    const entry = doc.data();

    if (!EMBEDDABLE_ENTRY_TYPES.has(entry.entryType)) {
      skippedNotEmbeddable++;
      continue;
    }

    const text = buildScenarioEmbedText(entry);
    if (!text.trim()) {
      skippedEmptyText++;
      continue;
    }

    const contentHash = hashText(text);
    const embedRef = db.collection('concept_embeddings').doc(`scenario_${entryId}`);
    const existing = await embedRef.get();
    if (existing.exists && existing.data()?.contentHash === contentHash) {
      skippedUnchanged++;
      continue;
    }

    try {
      const vector = await getEmbedding(text);
      await embedRef.set({
        vector,
        text,
        grade: entry.grade ?? null,
        secondaryTrack: entry.secondaryTrack ?? null,
        topicTitle: entry.topicTitle ?? '',
        source: 'scenario_bank',
        sourceScenarioId: entryId,
        contentHash,
        model: EMBED_MODEL,
        indexedAt: FieldValue.serverTimestamp(),
      });
      embedded++;
      console.log(`  embedded: ${entryId} — ${entry.title ?? '(untitled)'}`);
      await sleep(100); // 10 req/sec
    } catch (err) {
      errors++;
      console.error(`  ERROR on ${entryId}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nDone. embedded=${embedded} skipped(unchanged)=${skippedUnchanged} ` +
    `skipped(entryType)=${skippedNotEmbeddable} skipped(emptyText)=${skippedEmptyText} errors=${errors}`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
