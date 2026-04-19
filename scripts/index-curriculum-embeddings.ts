/**
 * AI1 — Phase 0: Curriculum Embedding Indexer
 *
 * Reads every concept from fullCurriculumData, generates a 768-dim Gemini
 * embedding for each, and writes it to Firestore concept_embeddings/{conceptId}.
 *
 * Uses Firebase Admin SDK to bypass security rules (the concept_embeddings
 * collection is `allow write: if false` for client SDK).
 *
 * Run once (or when curriculum changes):
 *   npx tsx scripts/index-curriculum-embeddings.ts
 *
 * Requirements (in .env.local at project root):
 *   GEMINI_API_KEY                         — for embedContent API
 *   GOOGLE_APPLICATION_CREDENTIALS_BASE64  — base64-encoded service account JSON
 *     (or FIREBASE_SERVICE_ACCOUNT with raw JSON)
 *   VITE_FIREBASE_PROJECT_ID               — project id (for admin init)
 *
 * Rate limit: 10 requests/sec (Gemini embedding quota buffer).
 * Estimated: ~500 concepts × 100ms = ~50 seconds.
 */

import { config as dotenvConfig } from 'dotenv';
// Load .env.local first (Vite convention), fallback to .env
dotenvConfig({ path: '.env.local' });
dotenvConfig({ path: '.env' });

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

// ── Gemini embedding ──────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? process.env.VITE_GEMINI_API_KEY ?? '';
const EMBED_MODEL    = 'text-embedding-004';
const EMBED_URL      = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`;

async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] } }),
  });
  if (!res.ok) throw new Error(`Embed API ${res.status}: ${await res.text()}`);
  const json = await res.json() as { embedding: { values: number[] } };
  return json.embedding.values;
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!GEMINI_API_KEY) {
    console.error('\n❌  Missing Gemini API key.');
    console.error('    Add to .env.local:  GEMINI_API_KEY=AIza...\n');
    process.exit(1);
  }

  const { fullCurriculumData } = await import('../data/curriculum');
  const grades = fullCurriculumData.curriculumData.grades;

  const concepts: { id: string; text: string }[] = [];

  for (const grade of grades) {
    for (const topic of grade.topics) {
      for (const concept of topic.concepts) {
        const lines: string[] = [concept.title];
        if (concept.description) lines.push(concept.description);
        if (concept.assessmentStandards?.length) {
          lines.push(...concept.assessmentStandards);
        }
        concepts.push({ id: concept.id, text: lines.join('\n') });
      }
    }
  }

  console.log(`Indexing ${concepts.length} concepts…`);

  let done = 0;
  let errors = 0;

  for (const { id, text } of concepts) {
    try {
      const vector = await getEmbedding(text);
      await db.collection('concept_embeddings').doc(id).set({
        vector,
        text,
        updatedAt: FieldValue.serverTimestamp(),
      });
      done++;
      if (done % 20 === 0) console.log(`  ${done}/${concepts.length} written…`);
      await sleep(100); // 10 req/sec
    } catch (err) {
      errors++;
      console.error(`  ERROR on ${id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nDone: ${done}/${concepts.length} written, ${errors} errors.`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(err => { console.error(err); process.exit(1); });
