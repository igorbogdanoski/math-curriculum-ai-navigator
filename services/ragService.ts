import { logger } from '../utils/logger';
import { Topic, Concept } from '../types';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Dynamic import of callEmbeddingProxy breaks circular dep:
//   gemini/core (imports ragService dynamically) ↔ ragService (needs embed proxy)
async function embedQuery(text: string): Promise<number[]> {
  const { callEmbeddingProxy } = await import('./gemini/core');
  return callEmbeddingProxy(text);
}

const SIMILARITY_THRESHOLD = 0.7;
const CACHE_KEY = 'rag_concept_embeddings_v1';
const CACHE_TTL_MS = 30 * 60 * 1000;
const THRESHOLD_OVERRIDE_KEY = 'VITE_VECTOR_RAG_THRESHOLD';
const LATENCY_RING_SIZE = 50;

interface ConceptEmbeddingDoc {
  vector: number[];
  text: string;
}

interface EmbeddingCache {
  ts: number;
  data: { id: string; vector: number[]; text: string }[];
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

  private async fetchConceptEmbeddings(): Promise<EmbeddingCache['data']> {
    const cached = this.getCache();
    if (cached) return cached;

    const snap = await getDocs(collection(db, 'concept_embeddings'));
    const data = snap.docs.map(d => {
      const doc = d.data() as ConceptEmbeddingDoc;
      return { id: d.id, vector: doc.vector, text: doc.text };
    });
    this.setCache(data);
    return data;
  }

  /**
   * Semantic vector search over concept_embeddings (Firestore).
   * Returns [] when feature flag VITE_ENABLE_VECTOR_RAG is not set.
   * Gracefully returns [] on any error so AI generation continues unaffected.
   */
  public async searchSimilarContext(
    queryText: string,
    topK = 5,
  ): Promise<{ context: string; similarity: number; conceptId?: string }[]> {
    if (localStorage.getItem('VITE_ENABLE_VECTOR_RAG') !== 'true') return [];

    try {
      const t0 = Date.now();
      const queryVector = await embedQuery(queryText);
      const tEmbed = Date.now();
      const embeddings = await this.fetchConceptEmbeddings();
      const tFetch = Date.now();
      const threshold = getEffectiveSimilarityThreshold();

      const results = embeddings
        .map(item => ({
          context: item.text,
          conceptId: item.id,
          similarity: cosineSimilarity(queryVector, item.vector),
        }))
        .filter(r => r.similarity > threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

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

    return this.formatTopicRAG(gradeData.title, topic);
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
