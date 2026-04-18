/**
 * services/gemini/ragService.ts
 * Few-shot RAG for assessment generation.
 *
 * Fetches real examples from:
 *   1. matura_questions  — curated national exam questions (by topicArea)
 *   2. cached_ai_materials — previously generated assessments (by conceptId)
 *
 * Returns a formatted Macedonian prompt section injected into generateAssessment().
 * Non-blocking: returns '' on any Firestore error so generation always proceeds.
 */

import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { CACHE_COLLECTION } from './core';

// ─── Topic area mapping ────────────────────────────────────────────────────────

const TOPIC_TO_MATURA_AREA: Record<string, string> = {
  // Primary topic IDs → matura topicArea values
  algebra: 'algebra',
  algebr: 'algebra',
  lineq: 'algebra',
  quadr: 'algebra',
  polynomials: 'algebra',
  expressions: 'algebra',
  inequalities: 'algebra',
  systems: 'algebra',
  functions: 'analiza',
  analiza: 'analiza',
  limits: 'analiza',
  derivatives: 'analiza',
  integrals: 'analiza',
  sequences: 'analiza',
  geom: 'geometrija',
  geometry: 'geometrija',
  geometrija: 'geometrija',
  triangles: 'geometrija',
  circles: 'geometrija',
  vectors: 'matrici-vektori',
  matrices: 'matrici-vektori',
  trig: 'trigonometrija',
  trigonometry: 'trigonometrija',
  trigonometrija: 'trigonometrija',
  stat: 'statistika',
  statistics: 'statistika',
  probability: 'kombinatorika',
  kombinatorika: 'kombinatorika',
  combinatorics: 'kombinatorika',
  numbers: 'broevi',
  broevi: 'broevi',
  sets: 'broevi',
};

function topicIdToMaturaArea(topicId?: string): string | null {
  if (!topicId) return null;
  const lower = topicId.toLowerCase();
  for (const [key, area] of Object.entries(TOPIC_TO_MATURA_AREA)) {
    if (lower.includes(key)) return area;
  }
  return null;
}

// ─── Matura examples ──────────────────────────────────────────────────────────

interface MaturaQuestionDoc {
  questionText?: string;
  choices?: Record<string, string> | null;
  correctAnswer?: string;
  topicArea?: string;
  dokLevel?: number;
}

async function fetchMaturaExamples(topicArea: string, gradeLevel: number): Promise<string> {
  // Only inject matura examples for secondary school grades
  if (gradeLevel < 7) return '';
  try {
    const q = query(
      collection(db, 'matura_questions'),
      where('topicArea', '==', topicArea),
      where('questionType', '==', 'mc'),
      orderBy('dokLevel', 'desc'),
      limit(3),
    );
    const snap = await getDocs(q);
    if (snap.empty) return '';

    const examples = snap.docs
      .map(d => d.data() as MaturaQuestionDoc)
      .filter(d => d.questionText && d.correctAnswer)
      .map(d => {
        const choicesStr = d.choices
          ? Object.entries(d.choices).map(([k, v]) => `  ${k}) ${v}`).join('\n')
          : '';
        return `• ${d.questionText}${choicesStr ? '\n' + choicesStr : ''}\n  Точен одговор: ${d.correctAnswer}`;
      });

    if (!examples.length) return '';
    return `\n\n--- ПРИМЕРИ ОД МАТУРА (${topicArea}) ---\nСледниве примери се реални матурски прашања за оваа тематска област. Калибрирај ги твоите прашања на слично ниво на тежина и стил:\n${examples.join('\n\n')}`;
  } catch {
    return '';
  }
}

// ─── Cached assessment examples ───────────────────────────────────────────────

interface CachedAssessmentDoc {
  content?: {
    questions?: Array<{
      question?: string;
      answer?: string;
      type?: string;
      dokLevel?: number;
    }>;
  };
}

async function fetchCachedExamples(conceptId: string): Promise<string> {
  try {
    const q = query(
      collection(db, CACHE_COLLECTION),
      where('conceptId', '==', conceptId),
      where('type', '==', 'assessment'),
      orderBy('createdAt', 'desc'),
      limit(4),
    );
    const snap = await getDocs(q);
    if (snap.empty) return '';

    const examples: string[] = [];
    for (const d of snap.docs) {
      const data = d.data() as CachedAssessmentDoc;
      const questions = data.content?.questions;
      if (!Array.isArray(questions)) continue;
      const mcQuestions = questions
        .filter(q => q.question && q.answer && (q.type === 'multiple-choice' || !q.type))
        .slice(0, 2);
      for (const q of mcQuestions) {
        examples.push(`• ${q.question}\n  Одговор: ${q.answer}`);
      }
      if (examples.length >= 4) break;
    }

    if (!examples.length) return '';
    return `\n\n--- ПРЕТХОДНО ГЕНЕРИРАНИ ПРИМЕРИ (conceptId: ${conceptId}) ---\nСледниве примери биле генерирани за ист концепт. Избегни дупликати; создади нови со слична сложеност:\n${examples.join('\n\n')}`;
  } catch {
    return '';
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches few-shot examples from matura_questions + cached_ai_materials.
 * Returns a formatted Macedonian prompt section, or '' if nothing useful found.
 * Never throws — always returns a string.
 */
export async function fetchFewShotExamples(
  conceptId: string,
  gradeLevel: number,
  topicId?: string,
): Promise<string> {
  try {
    const maturaArea = topicIdToMaturaArea(topicId) ?? topicIdToMaturaArea(conceptId);

    const [maturaPart, cachedPart] = await Promise.all([
      maturaArea ? fetchMaturaExamples(maturaArea, gradeLevel) : Promise.resolve(''),
      conceptId !== 'gen' ? fetchCachedExamples(conceptId) : Promise.resolve(''),
    ]);

    // Matura examples preferred — include both if present, matura first
    const combined = (maturaPart + cachedPart).trim();
    return combined ? `\n${combined}` : '';
  } catch {
    return '';
  }
}
