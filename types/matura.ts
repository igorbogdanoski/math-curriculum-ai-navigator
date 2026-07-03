import type { SecondaryTrack } from './curriculum';

// ─── Матура / ДИМ Симулација ─────────────────────────────────────────────────

export type MaturaChoice = 'А' | 'Б' | 'В' | 'Г';
export type MaturaLanguage = 'mk' | 'al' | 'tr';
export type MaturaSession = 'june' | 'august' | 'demo' | 'ucilisna';
export type MaturaTopicArea =
  | 'algebra' | 'analiza' | 'geometrija' | 'statistika'
  | 'kombinatorika' | 'trigonometrija' | 'matrici-vektori' | 'broevi' | 'logika';

/**
 * questionType:
 *   'mc'   — multiple-choice (choices А/Б/В/Г, correctAnswer is a single letter)
 *   'open' — free-response (no choices; correctAnswer is the model answer text/LaTeX;
 *             student submits written or photo solution)
 *
 * ДИМ Гимназија структура (30 прашања):
 *   Дел 1: Q1-Q15, 1 поен, MC
 *   Дел 2: Q16-Q20, 2 поени, отворени
 *   Дел 3: Q21-Q30, 3-5 поени, отворени
 */
export type MaturaQuestionType = 'mc' | 'open';

export interface MaturaCurriculumRefs {
  secondaryTrack?: SecondaryTrack;
  gradeIds?: string[];
  topicIds?: string[];
  conceptIds?: string[];
  standardIds?: string[];
  objectiveKeywords?: string[];
  activityKeywords?: string[];
  source?: 'manual' | 'derived';
  confidence?: 'high' | 'medium' | 'low';
}

export interface MaturaQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  questionType?: MaturaQuestionType;      // 'mc' | 'open' — defaults to 'mc' if absent
  choices?: Partial<Record<MaturaChoice, string>> | null; // null/empty for open questions
  correctAnswer: string;                  // MC: 'А'|'Б'|'В'|'Г'; open: model answer text/LaTeX
  topic: string;
  bloomLevel?: string;
  points: number;
  // Legacy single image — kept for backward compat with existing demo data
  imageUrl?: string;

  // Extended fields (ДИЦ import pipeline, S17)
  part?: 1 | 2 | 3;                      // кој дел
  topicArea?: MaturaTopicArea;            // тематска област
  conceptIds?: string[];                  // врска со gymnasium.ts концепти
  imageUrls?: string[];                   // Firebase Storage URLs (може повеќе)
  hasImage?: boolean;
  imageDescription?: string | null;       // accessibility alt-text
  dokLevel?: 1 | 2 | 3 | 4;
  questionGroupId?: string;               // поврзува МК+АЛ+ТР верзии
  successRatePercent?: number;            // агрегирано од matura_results
  aiSolution?: string;                    // Gemini чекор-по-чекор (cached)
  solutionImageUrl?: string;              // илустрација кон решението (PNG)
  hints?: string[];                       // [hint1, hint2, full solution]
  // Open-ended student submission (matura_submissions collection)
  rubric?: MaturaRubricItem[];            // точки по чекор за отворени задачи
  curriculumRefs?: MaturaCurriculumRefs;  // bridge to curriculum/explore/graph/planner ecosystem
}

/** Грубрика за оценување отворени задачи */
export interface MaturaRubricItem {
  step: string;                           // опис на чекор (LaTeX ok)
  points: number;                         // поени за тој чекор
  hint?: string;                          // совет ако ученикот заглави
}

export interface MaturaExam {
  id: string;
  year: number;
  track: SecondaryTrack;
  gradeLevel: number;
  title?: string;
  durationMinutes: number;
  questions: MaturaQuestion[];

  // Extended fields (S17)
  session?: MaturaSession;
  language?: MaturaLanguage;
  languages?: MaturaLanguage[];
  hasOfficialKey?: boolean;
  importedAt?: string;
}

export interface MaturaResult {
  examId: string;
  completedAt: string;
  answers: Record<string, string>;        // questionNumber → answer (letter for MC, text for open)
  score: number;
  totalPoints: number;
  durationSeconds: number;
}

/** Student submission for an open-ended matura question */
export interface MaturaSubmission {
  id?: string;
  examId: string;
  questionId: string;
  questionNumber: number;
  studentId: string;
  submittedAt: string;
  submissionType: 'photo' | 'latex' | 'typed';
  imageUrl?: string;                      // Firebase Storage URL (photo submission)
  latexAnswer?: string;                   // typed LaTeX answer
  typedAnswer?: string;                   // plain text answer
  aiScore?: number;                       // Gemini evaluation vs rubric
  aiComment?: string;                     // per-step feedback
  manualScore?: number;                   // teacher override
  maxPoints: number;
}

// ─── Matura Student Profile ────────────────────────────────────────────────────

export type MaturaTrack = 'gymnasium' | 'vocational4';

export interface StudentMaturaProfile {
  uid: string;
  name: string;
  email?: string;
  photoURL?: string;
  track: MaturaTrack;
  examDate: string;
  createdAt: string;
  weakTopics: string[];
  practiceStats: {
    correct: number;
    total: number;
    byTopic: Record<string, { correct: number; total: number }>;
  };
  simulationCount: number;
  bestSimulationScore: number;
  streak: { count: number; lastDate: string };
  isPremium?: boolean;
}
