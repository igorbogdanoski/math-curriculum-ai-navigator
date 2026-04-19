/**
 * AI1 — Phase 0: Curriculum Embedding Indexer
 *
 * Reads every concept from fullCurriculumData, generates a 768-dim Gemini
 * embedding for each, and writes it to Firestore concept_embeddings/{conceptId}.
 *
 * Run once (or when curriculum changes):
 *   npx tsx scripts/index-curriculum-embeddings.ts
 *
 * Requirements:
 *   VITE_FIREBASE_*  env vars (or a .env file at project root)
 *   VITE_GEMINI_API_KEY
 *
 * Rate limit: 10 requests/sec (Gemini embedding quota buffer).
 * Estimated: ~500 concepts × 100ms = ~50 seconds.
 */

import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// ── Firebase init ─────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            process.env.VITE_FIREBASE_API_KEY,
  authDomain:        process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Gemini embedding ──────────────────────────────────────────────────────────

const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY ?? '';
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
  if (!GEMINI_API_KEY) { console.error('Missing VITE_GEMINI_API_KEY'); process.exit(1); }

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
      await setDoc(doc(db, 'concept_embeddings', id), {
        vector,
        text,
        updatedAt: serverTimestamp(),
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
