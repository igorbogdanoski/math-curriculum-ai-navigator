import type { KahootQuestion } from '../../services/geminiService';

export const SESSION_KEY = 'kahoot_tasks';
export const AUTO_LAUNCH_KEY = 'kahoot_auto_launch';

export const TIMER_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: 'Без тајмер', value: undefined },
  { label: '10 сек', value: 10 },
  { label: '20 сек', value: 20 },
  { label: '30 сек', value: 30 },
  { label: '45 сек', value: 45 },
  { label: '60 сек', value: 60 },
];

export const DIFF_COLORS: Record<string, string> = {
  basic: 'bg-green-100 text-green-700 border-green-200',
  intermediate: 'bg-amber-100 text-amber-700 border-amber-200',
  advanced: 'bg-red-100 text-red-700 border-red-200',
};

export type Step = 'source' | 'generating' | 'editing';
export type Source = 'tasks' | 'document' | 'prompt';

export function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type || 'application/pdf' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function makeBlankQuestion(): KahootQuestion {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    difficulty: 'intermediate',
    dokLevel: 2,
  };
}
