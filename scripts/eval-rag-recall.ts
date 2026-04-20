/**
 * S36-B2 — RAG Recall Evaluation Harness
 *
 * Runs 20 anchor queries against the live concept_embeddings Firestore collection
 * and measures Recall@3 against the gold-set in eval/rag-anchor-queries.json.
 *
 * Usage (local):
 *   npx tsx scripts/eval-rag-recall.ts
 *
 * Usage (CI):
 *   npx tsx scripts/eval-rag-recall.ts --fail-below 0.70
 *
 * Output:
 *   - Per-query pass/fail table
 *   - Overall Recall@3
 *   - Exit code 1 if recall < threshold (for CI gate)
 *
 * Env vars required (same as embedding indexer):
 *   GEMINI_API_KEY
 *   GOOGLE_APPLICATION_CREDENTIALS_BASE64 or FIREBASE_SERVICE_ACCOUNT
 *   VITE_FIREBASE_PROJECT_ID
 */

import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env.local' });
dotenvConfig({ path: '.env' });

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AnchorQuery {
  id: string;
  query: string;
  goldConceptIds: string[];
  tags: string[];
}

interface AnchorQueriesFile {
  recallThreshold: number;
  queries: AnchorQuery[];
}

interface EmbeddingDoc {
  conceptId: string;
  embedding: number[];
}

// ── Firebase Admin init ───────────────────────────────────────────────────────

function initAdmin(): void {
  if (getApps().length) return;
  const b64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
  const raw  = process.env.FIREBASE_SERVICE_ACCOUNT;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID ?? '';

  if (b64) {
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'));
    initializeApp({ credential: cert(json), projectId });
  } else if (raw) {
    initializeApp({ credential: cert(JSON.parse(raw)), projectId });
  } else {
    throw new Error('No Firebase Admin credentials found. Set GOOGLE_APPLICATION_CREDENTIALS_BASE64.');
  }
}

// ── Embedding ─────────────────────────────────────────────────────────────────

async function embedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'models/text-embedding-004', content: { parts: [{ text }] } }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embed API error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { embedding?: { values?: number[] } };
  const values = data?.embedding?.values;
  if (!values?.length) throw new Error('Empty embedding returned');
  return values;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const failBelowArg = args.find(a => a.startsWith('--fail-below='));
  const failBelow = failBelowArg ? parseFloat(failBelowArg.split('=')[1]) : undefined;

  // Load anchor queries
  const anchorPath = join(process.cwd(), 'eval', 'rag-anchor-queries.json');
  const { queries, recallThreshold }: AnchorQueriesFile = JSON.parse(readFileSync(anchorPath, 'utf-8'));
  const threshold = failBelow ?? recallThreshold;

  console.log(`\n🔍 RAG Recall@3 Evaluation — ${queries.length} anchor queries`);
  console.log(`   Recall threshold: ${(threshold * 100).toFixed(0)}%\n`);

  // Init Firebase + load all embeddings
  initAdmin();
  const db = getFirestore();
  console.log('📥 Loading concept_embeddings from Firestore...');
  const snap = await db.collection('concept_embeddings').get();
  const docs: EmbeddingDoc[] = snap.docs
    .filter(d => d.data().embedding?.length)
    .map(d => ({ conceptId: d.id, embedding: d.data().embedding as number[] }));
  console.log(`   Loaded ${docs.length} concept embeddings.\n`);

  if (docs.length === 0) {
    console.error('❌ No embeddings found in Firestore. Run scripts/index-curriculum-embeddings.ts first.');
    process.exit(1);
  }

  // Evaluate each query
  let passed = 0;
  const rows: Array<{ id: string; query: string; top3: string[]; gold: string[]; hit: boolean }> = [];

  for (const q of queries) {
    try {
      const qVec = await embedQuery(q.query);
      // Compute similarity to all docs, take top-3
      const scored = docs
        .map(d => ({ id: d.conceptId, score: cosineSimilarity(qVec, d.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(d => d.id);

      const hit = q.goldConceptIds.some(gid => scored.includes(gid));
      if (hit) passed++;
      rows.push({ id: q.id, query: q.query.slice(0, 50), top3: scored, gold: q.goldConceptIds, hit });

      // Rate limiting: 10 req/sec
      await new Promise(r => setTimeout(r, 120));
    } catch (err) {
      console.error(`  ⚠️  ${q.id}: ${(err as Error).message}`);
      rows.push({ id: q.id, query: q.query.slice(0, 50), top3: [], gold: q.goldConceptIds, hit: false });
    }
  }

  // Print results table
  console.log('┌─────────────┬───────────────────────────────────────────────────┬──────┐');
  console.log('│ ID          │ Query (50 chars)                                  │ Hit? │');
  console.log('├─────────────┼───────────────────────────────────────────────────┼──────┤');
  for (const row of rows) {
    const q = row.query.padEnd(50).slice(0, 50);
    const hit = row.hit ? '✅' : '❌';
    console.log(`│ ${row.id.padEnd(11)} │ ${q} │  ${hit}  │`);
    if (!row.hit) {
      console.log(`│             │   gold:   ${row.gold.slice(0,2).join(', ').padEnd(44)} │      │`);
      console.log(`│             │   top-3:  ${row.top3.slice(0,2).join(', ').padEnd(44)} │      │`);
    }
  }
  console.log('└─────────────┴───────────────────────────────────────────────────┴──────┘');

  const recall = passed / queries.length;
  console.log(`\n📊 Recall@3: ${passed}/${queries.length} = ${(recall * 100).toFixed(1)}%`);
  console.log(`   Threshold: ${(threshold * 100).toFixed(0)}%`);

  if (recall >= threshold) {
    console.log(`\n✅ PASS — RAG recall meets quality gate.\n`);
    process.exit(0);
  } else {
    console.error(`\n❌ FAIL — Recall ${(recall * 100).toFixed(1)}% < threshold ${(threshold * 100).toFixed(0)}%`);
    console.error('   Run scripts/index-curriculum-embeddings.ts to re-index, then re-evaluate.\n');
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
