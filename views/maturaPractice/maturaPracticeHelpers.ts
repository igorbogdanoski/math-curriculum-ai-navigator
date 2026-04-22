import type { MaturaQuestion, MaturaExamMeta } from '../../services/firestoreService.matura';
import type { MaturaChoice } from '../../types';

export interface PracticeItem extends MaturaQuestion {
  examLabel: string;
}

export interface AIGrade {
  score: number;
  maxScore: number;
  feedback: string;
  correct?: boolean;
  comment?: string;
}

export interface QuestionState {
  mcPick?: string;
  answer?: string;
  aiGrade?: AIGrade;
  grading?: boolean;
  selfChecks?: boolean[];
  aiDesc?: string;
  aiGradeP3?: AIGrade;
  gradingP3?: boolean;
  aiError?: string;
  submitted: boolean;
  skipped?: boolean;
}

export type Phase = 'setup' | 'practice' | 'results';

export interface SetupConfig {
  langs: ('mk' | 'al')[];
  sessions: ('june' | 'august')[];
  topics: string[];
  parts: number[];
  dokLevels: number[];
  doShuffle: boolean;
  maxQ: number;
}

export interface RecoveryPrefill {
  topicArea?: string | null;
  dokLevels?: number[];
  maxQ?: number;
  sourceConceptId?: string;
  sourceConceptTitle?: string;
  missionDay?: number;
}

export const SESSION_LABELS: Record<string, string> = { june: 'Јуни', august: 'Август', march: 'Март' };
export const LANG_FLAGS: Record<string, string> = { mk: '🇲🇰 МК', al: '🇦🇱 АЛ', tr: '🇹🇷 ТР' };

export function examDisplayLabel(e: MaturaExamMeta): string {
  return `${SESSION_LABELS[e.session] ?? e.session} ${e.year} ${LANG_FLAGS[e.language] ?? e.language.toUpperCase()}`;
}

export const CHOICES: MaturaChoice[] = ['А', 'Б', 'В', 'Г'];

export const TOPIC_LABELS: Record<string, string> = {
  algebra: 'Алгебра', analiza: 'Анализа', geometrija: 'Геометрија',
  trigonometrija: 'Тригонометрија', 'matrici-vektori': 'Матрици/Вектори',
  broevi: 'Броеви', statistika: 'Статистика', kombinatorika: 'Комбинаторика',
};

export const TOPIC_COLORS: Record<string, string> = {
  algebra: 'bg-blue-100 text-blue-800 border-blue-200',
  analiza: 'bg-purple-100 text-purple-800 border-purple-200',
  geometrija: 'bg-green-100 text-green-800 border-green-200',
  trigonometrija: 'bg-orange-100 text-orange-800 border-orange-200',
  'matrici-vektori': 'bg-teal-100 text-teal-800 border-teal-200',
  broevi: 'bg-gray-100 text-gray-700 border-gray-200',
  statistika: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  kombinatorika: 'bg-pink-100 text-pink-800 border-pink-200',
};

export function isOpen(q: MaturaQuestion): boolean {
  if (q.questionType === 'open') return true;
  if (q.questionType === 'mc') return false;
  return !q.choices || Object.keys(q.choices).length === 0;
}

export function safeParseJSON(text: string): any {
  try { const m = text.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; }
  catch { return null; }
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
