/**
 * S38-E2 — Extraction Integration Layer
 *
 * Converts an `ExtractedContentBundle` (+ optional `ExtractedWebTask[]` from
 * `visionContracts`) into ready-to-consume payloads for the rest of the app:
 *
 *   • Quiz generation prompt         (hooks/useGeneratorActions, InteractiveQuizPlayer)
 *   • Assignment draft               (assignments/AssignmentEditor)
 *   • Flashcards                     (SM-2 spaced-repetition deck)
 *   • Library material draft         (saveToLibrary)
 *   • Annual plan linkage hints      (planner → "Add extracted content")
 *   • Concept mapping hint           (extractionConceptMap)
 *
 * All functions are pure & unit-testable — no React, no Firebase.
 */

import type { ExtractedContentBundle } from './extractionBundle';
import { inferDokForBundle } from './extractionBundle';

// ─── Re-exported minimal shapes (avoid circular imports on heavy modules) ───

/** Shape matching `ExtractedWebTask` in services/gemini/visionContracts.ts. */
export interface ExtractedTaskLike {
  title: string;
  statement: string;
  latexStatement?: string;
  difficulty: 'basic' | 'intermediate' | 'advanced';
  topicMk: string;
  imagenPrompt?: string;
  dokLevel?: 1 | 2 | 3 | 4;
}

// ─── QUIZ ────────────────────────────────────────────────────────────────────

export interface QuizPromptOptions {
  targetCount?: number;
  gradeLevel?: number;
  difficulty?: 'basic' | 'intermediate' | 'advanced' | 'mixed';
  language?: 'mk' | 'en';
  additionalInstructions?: string;
}

/**
 * Build a Gemini prompt that asks the model to produce quiz questions derived
 * from the extracted bundle + tasks. The prompt is deterministic; consumers
 * pair it with `responseMimeType: 'application/json'`.
 */
export function extractionToQuizPrompt(
  bundle: ExtractedContentBundle,
  tasks: readonly ExtractedTaskLike[] = [],
  options: QuizPromptOptions = {},
): string {
  const lang = options.language ?? 'mk';
  const targetCount = Math.min(Math.max(options.targetCount ?? 5, 1), 20);
  const difficulty = options.difficulty ?? 'mixed';
  const grade = options.gradeLevel ?? 8;
  const dok = inferDokForBundle(bundle);

  const formulaBlock = bundle.formulas.slice(0, 8).map((f) => `  • ${f}`).join('\n') || '  (none)';
  const theoryBlock = bundle.theories.slice(0, 8).map((t) => `  • ${t}`).join('\n') || '  (none)';
  const taskBlock = [
    ...bundle.tasks.slice(0, 6).map((t) => `  • ${t}`),
    ...tasks.slice(0, 6).map((t) => `  • [${t.difficulty}] ${t.statement}`),
  ].join('\n') || '  (none)';

  const extra = options.additionalInstructions
    ? `\nAdditional teacher instructions: ${options.additionalInstructions}`
    : '';

  return `You are generating a ${targetCount}-question quiz (${lang === 'mk' ? 'Macedonian' : 'English'}) for grade ${grade} from extracted source material.
Requested difficulty: ${difficulty}. Target DoK emphasis: ${dok}.

Source formulas:
${formulaBlock}

Source theory/definitions:
${theoryBlock}

Source tasks/examples:
${taskBlock}
${extra}

Return ONLY a JSON object:
{
  "questions": [
    {
      "type": "mc" | "open",
      "questionText": "${lang === 'mk' ? 'Во Македонски јазик' : 'In English'}, math wrapped in $...$",
      "choices": { "А": "...", "Б": "...", "В": "...", "Г": "..." },
      "correctAnswer": "А",
      "dokLevel": 1|2|3|4,
      "conceptHint": "short topic label"
    }
  ]
}

Rules:
- At least ${Math.ceil(targetCount / 2)} questions must come directly from the source material above.
- ${difficulty === 'mixed' ? 'Mix difficulties across questions.' : `All questions must be ${difficulty}.`}
- Use Cyrillic choice keys (А Б В Г) for MC questions; omit "choices" for open-ended.
- Wrap ALL math in LaTeX ($inline$ or $$display$$).`;
}

// ─── ASSIGNMENT ──────────────────────────────────────────────────────────────

export interface AssignmentDraft {
  title: string;
  description: string;
  dokLevel: 1 | 2 | 3 | 4;
  gradeLevel: number;
  topics: string[];
  tasks: ExtractedTaskLike[];
  sourceSummary: string;
}

export function extractionToAssignmentDraft(
  bundle: ExtractedContentBundle,
  tasks: readonly ExtractedTaskLike[],
  options: { gradeLevel?: number; titleSeed?: string } = {},
): AssignmentDraft {
  const dok = inferDokForBundle(bundle);
  const topics = Array.from(new Set(tasks.map((t) => t.topicMk).filter(Boolean)));
  const title = (options.titleSeed && options.titleSeed.trim())
    || (topics[0] ? `${topics[0]} — вежби` : 'Извадени задачи од материјал');
  const sourceSummary = [
    bundle.theories.slice(0, 3).join(' · '),
    bundle.formulas.slice(0, 3).join(' · '),
  ].filter(Boolean).join(' | ').slice(0, 300);

  return {
    title,
    description: `Автоматски генериран сет од ${tasks.length || bundle.tasks.length} задачи извлечени од изворниот материјал.`,
    dokLevel: dok,
    gradeLevel: options.gradeLevel ?? 8,
    topics,
    tasks: tasks.slice(0, 25),
    sourceSummary,
  };
}

// ─── FLASHCARDS ──────────────────────────────────────────────────────────────

export interface ExtractionFlashcard {
  id: string;
  front: string;
  back: string;
  kind: 'formula' | 'theory' | 'task';
  dokLevel?: 1 | 2 | 3 | 4;
}

function cardId(prefix: string, idx: number, text: string): string {
  const slug = text.replace(/[^A-Za-zА-Шаа-ш0-9]/g, '').slice(0, 16).toLowerCase();
  return `${prefix}-${idx}-${slug}`;
}

function splitTheoryCard(line: string): { front: string; back: string } | null {
  // Try to split around the first ":" or "—" to make "term : definition" cards.
  const sep = line.search(/[:\u2014\u2013]/);
  if (sep > 2 && sep < line.length - 3) {
    const front = line.slice(0, sep).trim().replace(/\.$/, '');
    const back = line.slice(sep + 1).trim();
    if (front.length >= 2 && back.length >= 4) return { front, back };
  }
  return null;
}

export function extractionToFlashcards(
  bundle: ExtractedContentBundle,
  options: { maxCards?: number } = {},
): ExtractionFlashcard[] {
  const max = options.maxCards ?? 20;
  const cards: ExtractionFlashcard[] = [];
  const dok = inferDokForBundle(bundle);

  bundle.theories.slice(0, max).forEach((line, i) => {
    const split = splitTheoryCard(line);
    cards.push({
      id: cardId('t', i, line),
      kind: 'theory',
      front: split?.front ?? 'Објасни:',
      back: split?.back ?? line,
      dokLevel: 1,
    });
  });

  bundle.formulas.slice(0, max - cards.length).forEach((formula, i) => {
    cards.push({
      id: cardId('f', i, formula),
      kind: 'formula',
      front: 'Препознај ја формулата:',
      back: formula,
      dokLevel: 1,
    });
  });

  bundle.tasks.slice(0, max - cards.length).forEach((task, i) => {
    cards.push({
      id: cardId('q', i, task),
      kind: 'task',
      front: task,
      back: 'Реши и покажи постапка.',
      dokLevel: dok >= 3 ? 3 : 2,
    });
  });

  return cards.slice(0, max);
}

// ─── LIBRARY ─────────────────────────────────────────────────────────────────

export interface LibraryDraft {
  title: string;
  type: 'extracted-material';
  body: string;
  formulas: string[];
  topics: string[];
  dokLevel: 1 | 2 | 3 | 4;
}

export function extractionToLibraryDraft(
  bundle: ExtractedContentBundle,
  tasks: readonly ExtractedTaskLike[] = [],
  options: { title?: string } = {},
): LibraryDraft {
  const topics = Array.from(new Set(tasks.map((t) => t.topicMk).filter(Boolean)));
  const title = options.title || (topics[0] ? `Извадок — ${topics[0]}` : 'Извлечен материјал');
  const body = [
    bundle.theories.length ? `Теорија/дефиниции:\n${bundle.theories.map((t) => `• ${t}`).join('\n')}` : '',
    bundle.formulas.length ? `Формули:\n${bundle.formulas.map((f) => `• ${f}`).join('\n')}` : '',
    bundle.tasks.length ? `Задачи:\n${bundle.tasks.map((t) => `• ${t}`).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');

  return {
    title,
    type: 'extracted-material',
    body,
    formulas: bundle.formulas.slice(0, 16),
    topics,
    dokLevel: inferDokForBundle(bundle),
  };
}

// ─── ANNUAL PLAN HINT ────────────────────────────────────────────────────────

export interface AnnualPlanLinkHint {
  suggestedTopicMk?: string;
  suggestedDok: 1 | 2 | 3 | 4;
  rationale: string;
  confidence: number;
}

export function extractionToAnnualPlanHint(
  bundle: ExtractedContentBundle,
  tasks: readonly ExtractedTaskLike[] = [],
): AnnualPlanLinkHint {
  const topicCounts = new Map<string, number>();
  tasks.forEach((t) => {
    if (!t.topicMk) return;
    topicCounts.set(t.topicMk, (topicCounts.get(t.topicMk) ?? 0) + 1);
  });
  let bestTopic: string | undefined;
  let bestCount = 0;
  topicCounts.forEach((c, k) => { if (c > bestCount) { bestCount = c; bestTopic = k; } });

  const totalSignals = bundle.formulas.length + bundle.theories.length + bundle.tasks.length;
  const confidence = Math.min(1, (bestCount * 0.25) + (totalSignals * 0.05));

  return {
    suggestedTopicMk: bestTopic,
    suggestedDok: inferDokForBundle(bundle),
    rationale: bestTopic
      ? `Доминантна тема во ${bestCount} задачи: ${bestTopic}.`
      : 'Недоволен сигнал за тема — рачно определи ја темата во планерот.',
    confidence: Number(confidence.toFixed(2)),
  };
}

// ─── CONCEPT-MAPPING KEYWORDS ─────────────────────────────────────────────────

/**
 * Flattens a bundle into a single lower-case string suitable for feeding into
 * `inferConceptIdsFromExtraction(concepts, text)` in `extractionConceptMap`.
 */
export function extractionToConceptMatchText(bundle: ExtractedContentBundle): string {
  return [
    ...bundle.formulas,
    ...bundle.theories,
    ...bundle.tasks,
    bundle.rawSnippet,
  ].join(' ').toLowerCase();
}
