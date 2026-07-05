import { logger } from '../utils/logger';
import { Topic, Concept } from '../types';
import { collection, getDocs, query, limit, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Dynamic import of callEmbeddingProxy breaks circular dep:
//   gemini/core (imports ragService dynamically) ↔ ragService (needs embed proxy)
async function embedQuery(text: string): Promise<number[]> {
  const { callEmbeddingProxy } = await import('./gemini/core');
  // RETRIEVAL_QUERY + 768 dims matches the indexing script (RETRIEVAL_DOCUMENT + 768 dims)
  return callEmbeddingProxy(text, undefined, 'RETRIEVAL_QUERY', 768);
}

const SIMILARITY_THRESHOLD = 0.7;
// v2: gemini-embedding-2 vectors (768-dim, task-typed) replace v1 text-embedding-004 vectors
const CACHE_KEY = 'rag_concept_embeddings_v2';
const CACHE_TTL_MS = 30 * 60 * 1000;
const THRESHOLD_OVERRIDE_KEY = 'VITE_VECTOR_RAG_THRESHOLD';
const SCENARIO_SLOT_RATIO_OVERRIDE_KEY = 'VITE_VECTOR_RAG_SCENARIO_SLOTS';
const LATENCY_RING_SIZE = 50;

interface ConceptEmbeddingDoc {
  vector: number[];
  text: string;
  source?: string;
  grade?: number | null;
}

interface EmbeddingCache {
  ts: number;
  data: { id: string; vector: number[]; text: string; source?: string; grade?: number | null }[];
}

export interface ScoredEmbedding {
  conceptId: string;
  context: string;
  similarity: number;
  source?: string;
  grade?: number | null;
}

// Fraction of topK reserved for scenario_bank hits by default (0.4 × topK=5 → 2 slots).
// Expressed as a ratio rather than an absolute count so it scales automatically if a
// caller passes a different topK, instead of silently under/over-reserving. Not
// empirically tuned against real usage (no click-through data exists yet) — it's a
// principled default, not a measured optimum. Override at runtime without a redeploy via
// `localStorage.setItem('VITE_VECTOR_RAG_SCENARIO_SLOTS', '3')` (interpreted as an
// absolute slot count, capped to topK) once real usage signal is available to tune it.
const SCENARIO_SLOT_RESERVE_RATIO = 0.4;

/**
 * Resolves how many of `topK` results are reserved for scenario_bank hits. Always at
 * least 1 (when topK > 0) so scenario examples are never entirely excluded by rounding.
 */
export function getScenarioSlotReserve(topK: number): number {
  if (topK <= 0) return 0;
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SCENARIO_SLOT_RATIO_OVERRIDE_KEY);
      if (raw != null) {
        const n = Number(raw);
        if (Number.isFinite(n) && n >= 0) return Math.min(Math.round(n), topK);
      }
    }
  } catch { /* ignore — fall through to default */ }
  return Math.min(Math.max(1, Math.round(topK * SCENARIO_SLOT_RESERVE_RATIO)), topK);
}

/**
 * Merges curriculum and scenario_bank hits with reserved slots. Without this, broad
 * topic-title queries are dominated by the curriculum pool (one embedding per concept,
 * far outnumbering scenario_bank entries) and scenario examples rarely make top-K even
 * when they score above the similarity threshold. Reserves slots (see
 * getScenarioSlotReserve) for the highest-scoring scenario_bank hits (grade-filtered
 * when gradeLevel is known — a grade-9 query shouldn't surface a grade-6 lesson
 * scenario), then fills the remaining slots with the highest-scoring curriculum hits.
 */
export function federatedRank(
  scored: ScoredEmbedding[],
  topK: number,
  gradeLevel?: number,
): ScoredEmbedding[] {
  const scenarioPool = scored
    .filter(r => r.source === 'scenario_bank')
    .filter(r => gradeLevel == null || r.grade == null || r.grade === gradeLevel)
    .sort((a, b) => b.similarity - a.similarity);

  const curriculumPool = scored
    .filter(r => r.source !== 'scenario_bank')
    .sort((a, b) => b.similarity - a.similarity);

  const scenarioTake = scenarioPool.slice(0, getScenarioSlotReserve(topK));
  const curriculumTake = curriculumPool.slice(0, topK - scenarioTake.length);

  return [...scenarioTake, ...curriculumTake].sort((a, b) => b.similarity - a.similarity);
}

interface LatencySample {
  embedMs: number;
  fetchMs: number;
  totalMs: number;
  docs: number;
  hits: number;
  ts: number;
}

const latencyRing: LatencySample[] = [];

function pushLatency(sample: LatencySample): void {
  latencyRing.push(sample);
  if (latencyRing.length > LATENCY_RING_SIZE) {
    latencyRing.splice(0, latencyRing.length - LATENCY_RING_SIZE);
  }
}

function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] * (1 - (pos - lo)) + sorted[hi] * (pos - lo);
}

/**
 * Resolve effective similarity threshold. Allows in-app tuning via
 * `localStorage.setItem('VITE_VECTOR_RAG_THRESHOLD', '0.65')` without redeploy.
 * Falls back to the compile-time default of 0.7 on any parse failure.
 */
export function getEffectiveSimilarityThreshold(): number {
  try {
    if (typeof localStorage === 'undefined') return SIMILARITY_THRESHOLD;
    const raw = localStorage.getItem(THRESHOLD_OVERRIDE_KEY);
    if (!raw) return SIMILARITY_THRESHOLD;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 1) return SIMILARITY_THRESHOLD;
    return n;
  } catch {
    return SIMILARITY_THRESHOLD;
  }
}

export interface RagStats {
  count: number;
  embedP50: number;
  embedP95: number;
  fetchP50: number;
  fetchP95: number;
  totalP50: number;
  totalP95: number;
  avgHits: number;
  avgDocs: number;
}

/** In-memory latency stats from the last 50 vector RAG searches. */
export function getRagStats(): RagStats {
  const embeds = latencyRing.map(s => s.embedMs);
  const fetches = latencyRing.map(s => s.fetchMs);
  const totals = latencyRing.map(s => s.totalMs);
  const hits = latencyRing.map(s => s.hits);
  const docs = latencyRing.map(s => s.docs);
  const avg = (arr: number[]) => (arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length);
  return {
    count: latencyRing.length,
    embedP50: quantile(embeds, 0.5),
    embedP95: quantile(embeds, 0.95),
    fetchP50: quantile(fetches, 0.5),
    fetchP95: quantile(fetches, 0.95),
    totalP50: quantile(totals, 0.5),
    totalP95: quantile(totals, 0.95),
    avgHits: avg(hits),
    avgDocs: avg(docs),
  };
}

/** Reset latency ring — used by tests. */
export function _resetRagStatsForTests(): void {
  latencyRing.length = 0;
}

export function cosineSimilarity(v1: number[], v2: number[]): number {
  if (v1.length !== v2.length || v1.length === 0) return 0;
  let dot = 0, mag1 = 0, mag2 = 0;
  for (let i = 0; i < v1.length; i++) {
    dot  += v1[i] * v2[i];
    mag1 += v1[i] * v1[i];
    mag2 += v2[i] * v2[i];
  }
  const denom = Math.sqrt(mag1) * Math.sqrt(mag2);
  return denom === 0 ? 0 : dot / denom;
}

class RagService {
  private async getCurriculumData() {
    const { fullCurriculumData } = await import('../data/curriculum');
    return fullCurriculumData;
  }

  private getCache(): EmbeddingCache['data'] | null {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const cached: EmbeddingCache = JSON.parse(raw);
      if (Date.now() - cached.ts > CACHE_TTL_MS) {
        sessionStorage.removeItem(CACHE_KEY);
        return null;
      }
      return cached.data;
    } catch { return null; }
  }

  private setCache(data: EmbeddingCache['data']): void {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch { /* storage full — silent */ }
  }

  /** Force-clear the in-session embedding cache (admin / settings panel). */
  public clearCache(): void {
    try { sessionStorage.removeItem(CACHE_KEY); } catch { /* noop */ }
  }

  /**
   * Fetches concept_embeddings in two parts and merges them, rather than one flat
   * limit(500) query. Curriculum-concept docs (scripts/index-curriculum-embeddings.ts)
   * never set a `source` field at all; scenario docs (functions/src/index.ts's
   * onScenarioPublishedEmbed) always set source: 'scenario_bank'. A flat query with no
   * orderBy has no guarantee scenario docs survive the cap once the collection grows —
   * which ones get cut off is arbitrary. The dedicated scenario query below reserves a
   * fixed budget for them regardless of how large the curriculum-concept side grows.
   */
  private async fetchConceptEmbeddings(): Promise<EmbeddingCache['data']> {
    const cached = this.getCache();
    if (cached) return cached;

    const mapDocs = (docs: { id: string; data: () => unknown }[]) => docs.map(d => {
      const doc = d.data() as ConceptEmbeddingDoc;
      return { id: d.id, vector: doc.vector, text: doc.text, source: doc.source, grade: doc.grade ?? null };
    });

    const [generalSnap, scenarioSnap] = await Promise.all([
      getDocs(query(collection(db, 'concept_embeddings'), limit(500))),
      getDocs(query(collection(db, 'concept_embeddings'), where('source', '==', 'scenario_bank'), limit(300))),
    ]);

    const merged = new Map<string, EmbeddingCache['data'][number]>();
    for (const item of mapDocs(generalSnap.docs)) merged.set(item.id, item);
    for (const item of mapDocs(scenarioSnap.docs)) merged.set(item.id, item);

    const data = [...merged.values()];
    this.setCache(data);
    return data;
  }

  /**
   * Semantic vector search over concept_embeddings (Firestore).
   * Returns [] when feature flag VITE_ENABLE_VECTOR_RAG is not set.
   * Gracefully returns [] on any error so AI generation continues unaffected.
   * `gradeLevel`, when known, grade-filters scenario_bank hits (see federatedRank).
   */
  public async searchSimilarContext(
    queryText: string,
    topK = 5,
    gradeLevel?: number,
  ): Promise<{ context: string; similarity: number; conceptId?: string }[]> {
    if (localStorage.getItem('VITE_ENABLE_VECTOR_RAG') !== 'true') return [];

    try {
      const t0 = Date.now();
      const queryVector = await embedQuery(queryText);
      const tEmbed = Date.now();
      const embeddings = await this.fetchConceptEmbeddings();
      const tFetch = Date.now();
      const threshold = getEffectiveSimilarityThreshold();

      const scored: ScoredEmbedding[] = embeddings
        .map(item => ({
          context: item.text,
          conceptId: item.id,
          similarity: cosineSimilarity(queryVector, item.vector),
          source: item.source,
          grade: item.grade,
        }))
        .filter(r => r.similarity > threshold);

      const results = federatedRank(scored, topK, gradeLevel)
        .map(({ context, conceptId, similarity }) => ({ context, conceptId, similarity }));

      pushLatency({
        embedMs: tEmbed - t0,
        fetchMs: tFetch - tEmbed,
        totalMs: tFetch - t0,
        docs: embeddings.length,
        hits: results.length,
        ts: tFetch,
      });

      logger.debug(
        `[AI1 Vector RAG] embed=${tEmbed - t0}ms fetch=${tFetch - tEmbed}ms total=${tFetch - t0}ms` +
        ` docs=${embeddings.length} hits=${results.length} threshold=${threshold}`,
      );
      return results;
    } catch (error) {
      logger.error('RAG vector search error:', error);
      return [];
    }
  }

  /**
   * Retrieves the official requirements for a specific concept to be used as context.
   */
  public async getConceptContext(gradeLevel: number, conceptId: string): Promise<string> {
    const fullCurriculumData = await this.getCurriculumData();
    const gradeData = fullCurriculumData.curriculumData.grades.find((g) => g.level === gradeLevel);
    if (!gradeData) {
      // Fallback: search secondary curriculum (grades 10–13)
      const { secondaryCurricula } = await import('../data/secondaryCurriculum');
      for (const mod of secondaryCurricula) {
        for (const secGrade of mod.curriculum.grades) {
          for (const topic of secGrade.topics) {
            const concept = topic.concepts.find((c) => c.id === conceptId);
            if (concept) return this.formatConceptRAG(secGrade.title, topic.title, concept);
          }
        }
      }
      return '';
    }

    for (const topic of gradeData.topics) {
      const concept = topic.concepts.find((c) => c.id === conceptId);
      if (concept) {
        return this.formatConceptRAG(gradeData.title, topic.title, concept);
      }
    }
    return '';
  }

  /**
   * Retrieves the official requirements for an entire topic.
   * For grade 8, enriches with official MoE 2025 subtopic data from grade8Official.ts.
   */
  public async getTopicContext(gradeLevel: number, topicId: string): Promise<string> {
    const fullCurriculumData = await this.getCurriculumData();
    const gradeData = fullCurriculumData.curriculumData.grades.find((g) => g.level === gradeLevel);
    if (!gradeData) {
      // Fallback: search secondary curriculum (grades 10–13)
      const { secondaryCurricula } = await import('../data/secondaryCurriculum');
      for (const mod of secondaryCurricula) {
        for (const secGrade of mod.curriculum.grades) {
          const topic = secGrade.topics.find((t) => t.id === topicId);
          if (topic) return this.formatTopicRAG(secGrade.title, topic);
        }
      }
      return '';
    }

    const topic = gradeData.topics.find((t) => t.id === topicId);
    if (!topic) return '';

    let context = this.formatTopicRAG(gradeData.title, topic);

    // Enrich with official MoE 2025 curriculum data when available
    if (gradeLevel === 8) {
      const { getOfficialTopicEnrichment } = await import('../data/official/grade8Official');
      const enrichment = getOfficialTopicEnrichment(topicId);
      if (enrichment) context += enrichment;
    } else if (gradeLevel === 6) {
      const { getOfficialTopicEnrichment } = await import('../data/official/grade6Official');
      const enrichment = getOfficialTopicEnrichment(topicId);
      if (enrichment) context += enrichment;
    } else if (gradeLevel === 7) {
      const { getOfficialTopicEnrichment } = await import('../data/official/grade7Official');
      const enrichment = getOfficialTopicEnrichment(topicId);
      if (enrichment) context += enrichment;
    }

    return context;
  }

  private formatConceptRAG(gradeTitle: string, topicTitle: string, concept: Concept): string {
    let rag = `\n--- ОФИЦИЈАЛНА ПРОГРАМА НА БИРО ЗА РАЗВОЈ НА ОБРАЗОВАНИЕТО (БРО) ---\n`;
    rag += `Одделение: ${gradeTitle}\n`;
    rag += `Тема: ${topicTitle}\n`;
    rag += `Лекција / Наставна Единица: ${concept.title}\n`;
    if (concept.description) rag += `Опис според БРО: ${concept.description}\n`;

    if (concept.content && concept.content.length > 0) {
      rag += `\nСодржина која мора да се опфати:\n`;
      concept.content.forEach((item) => (rag += `- ${item}\n`));
    }

    if (concept.assessmentStandards && concept.assessmentStandards.length > 0) {
      rag += `\nСтандарди за оценување:\n`;
      concept.assessmentStandards.forEach((item) => (rag += `- ${item}\n`));
    }

    if (concept.localContextExamples && concept.localContextExamples.length > 0) {
      rag += '\nЛОКАЛЕН КОНТЕКСТ (ЗАДОЛЖИТЕЛНО ЗА ПРИМЕРИТЕ):\n';
      rag += 'При креирање на текстуални задачи или примери од секојдневниот живот, користи ги следниве елементи кои се блиски на учениците во Македонија:\n';
      concept.localContextExamples.forEach((item) => (rag += '- ' + item + '\n'));
    } else {
      rag += '\nЛОКАЛЕН КОНТЕКСТ (ЗАДОЛЖИТЕЛНО ЗА ПРИМЕРИТЕ):\n';
      rag += 'При креирање на проблеми или примери, секогаш користи македонски контекст: валута Денари (МКД), македонски градови (Скопје, Битола, Охрид, итн.), традиционални македонски имиња и типични локални сценарија. Забрането е користење на долари, евра или американски/британски контексти.\n';
    }

    rag += `\nНАПОМЕНА ЗА AI МОДЕЛОТ: Строго придржувај се до овие стандарди. Не додавај концепти или тежина на задачи кои не се во овие БРО граници.\n--- КРАЈ НА ОФИЦИЈАЛНА ПРОГРАМА ---\n`;

    return rag;
  }

  private formatTopicRAG(gradeTitle: string, topic: Topic): string {
    let rag = `\n--- ОФИЦИЈАЛНА ПРОГРАМА НА БИРО ЗА РАЗВОЈ НА ОБРАЗОВАНИЕТО (БРО) ---\n`;
    rag += `Одделение: ${gradeTitle}\n`;
    rag += `Тема: ${topic.title}\n`;
    rag += `Опис на тема: ${topic.description}\n`;
    rag += `Сугерирани часови: ${topic.suggestedHours}\n`;

    rag += `\nЛекции кои припаѓаат во оваа тема:\n`;
    topic.concepts.forEach((concept) => {
      rag += `- ${concept.title}\n`;
    });

    rag += `\nНАПОМЕНА ЗА AI МОДЕЛОТ: Организирај ја програмата стриктно според овие лекции и сугерираните часови. Не измислувај непостоечки лекции.\n--- КРАЈ НА ОФИЦИЈАЛНА ПРОГРАМА ---\n`;
    return rag;
  }
}

export const ragService = new RagService();
export { SIMILARITY_THRESHOLD, CACHE_KEY, CACHE_TTL_MS };

// ── Scenario Bank Semantic Search ─────────────────────────────────────────────

const SCENARIO_EMBED_CACHE_KEY = 'scenario_bank_embeddings_v1';
const SCENARIO_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
// Max entries to embed per search call (limits API calls for uncached entries)
const SCENARIO_BATCH_LIMIT = 10;
// Minimum similarity score to include an entry in results
const SCENARIO_SIMILARITY_THRESHOLD = 0.25;

interface ScenarioEmbeddingCache {
  ts: number;
  data: Record<string, number[]>; // entryId → 768-dim vector
}

function getScenarioEmbeddingCache(): Record<string, number[]> {
  try {
    const raw = sessionStorage.getItem(SCENARIO_EMBED_CACHE_KEY);
    if (!raw) return {};
    const parsed: ScenarioEmbeddingCache = JSON.parse(raw);
    if (Date.now() - parsed.ts > SCENARIO_CACHE_TTL_MS) {
      sessionStorage.removeItem(SCENARIO_EMBED_CACHE_KEY);
      return {};
    }
    return parsed.data;
  } catch { return {}; }
}

function saveScenarioEmbeddingCache(data: Record<string, number[]>): void {
  try {
    sessionStorage.setItem(SCENARIO_EMBED_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* storage full — silent */ }
}

async function embedDocument(text: string): Promise<number[]> {
  const { callEmbeddingProxy } = await import('./gemini/core');
  return callEmbeddingProxy(text, undefined, 'RETRIEVAL_DOCUMENT', 768);
}

export interface ScenarioSearchEntry {
  id: string;
  title: string;
  topicTitle: string;
  objectives: string[];
}

export interface ScenarioSearchResult {
  id: string;
  similarity: number;
}

/**
 * Semantic search over a loaded set of ScenarioBank entries.
 *
 * Algorithm:
 *  1. Embed the query with RETRIEVAL_QUERY (1 API call).
 *  2. For each entry: use cached 768-dim vector if available; embed with
 *     RETRIEVAL_DOCUMENT for at most SCENARIO_BATCH_LIMIT uncached entries.
 *  3. Rank by cosine similarity and return entries above threshold.
 *
 * Returns null when the feature is disabled (VITE_ENABLE_VECTOR_RAG !== 'true')
 * or on any network/embedding error, so callers can fall back to text search.
 *
 * Feature flag: localStorage key `VITE_ENABLE_VECTOR_RAG` must equal `'true'`.
 */
export async function searchScenarioBankSemantic(
  query: string,
  entries: ScenarioSearchEntry[],
): Promise<ScenarioSearchResult[] | null> {
  if (localStorage.getItem('VITE_ENABLE_VECTOR_RAG') !== 'true') return null;
  if (!query.trim() || entries.length === 0) return null;

  try {
    const queryVector = await embedQuery(query);
    const cache = getScenarioEmbeddingCache();
    const results: ScenarioSearchResult[] = [];
    const uncached: ScenarioSearchEntry[] = [];

    for (const entry of entries) {
      const cached = cache[entry.id];
      if (cached) {
        results.push({ id: entry.id, similarity: cosineSimilarity(queryVector, cached) });
      } else {
        uncached.push(entry);
      }
    }

    const toEmbed = uncached.slice(0, SCENARIO_BATCH_LIMIT);
    for (const entry of toEmbed) {
      const text = [entry.title, entry.topicTitle, ...entry.objectives].join(' ');
      const vector = await embedDocument(text);
      cache[entry.id] = vector;
      results.push({ id: entry.id, similarity: cosineSimilarity(queryVector, vector) });
    }

    saveScenarioEmbeddingCache(cache);

    return results
      .filter(r => r.similarity > SCENARIO_SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity);
  } catch {
    return null;
  }
}
