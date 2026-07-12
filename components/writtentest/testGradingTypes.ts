export interface TestQuestion {
  id: string;
  text: string;
  points: number;
  correctAnswer: string;
}

export interface GradeResult {
  questionId: string;
  earnedPoints: number;
  maxPoints: number;
  feedback: string;
  misconception?: string;
  correctionHint?: string;
  confidence?: number;
}

export interface StudentSubmission {
  id: string;
  name: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  results?: GradeResult[];
}

export interface HeatmapEntry {
  questionId: string;
  questionText: string;
  maxPoints: number;
  avgEarned: number;
  successRate: number;  // 0–1
  misconceptions: string[];
}

export type Mode = 'single' | 'batch';

export const DEFAULT_QUESTIONS: TestQuestion[] = [
  { id: '1', text: '', points: 10, correctAnswer: '' },
  { id: '2', text: '', points: 10, correctAnswer: '' },
  { id: '3', text: '', points: 10, correctAnswer: '' },
];

export function heatColor(rate: number): string {
  if (rate >= 0.8) return 'bg-green-500';
  if (rate >= 0.6) return 'bg-lime-400';
  if (rate >= 0.4) return 'bg-amber-400';
  if (rate >= 0.2) return 'bg-orange-500';
  return 'bg-red-500';
}

export function mkGrade(pct: number) {
  if (pct >= 90) return { grade: '5', label: 'Одличен', color: 'text-green-600' };
  if (pct >= 75) return { grade: '4', label: 'Многу добар', color: 'text-blue-600' };
  if (pct >= 60) return { grade: '3', label: 'Добар', color: 'text-yellow-600' };
  if (pct >= 50) return { grade: '2', label: 'Доволен', color: 'text-orange-600' };
  return { grade: '1', label: 'Незадоволителен', color: 'text-red-600' };
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
