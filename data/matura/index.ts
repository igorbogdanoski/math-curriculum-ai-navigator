/**
 * Матурски тестови (ДИМ — Државна испитна матура)
 *
 * Оваа датотека ќе биде пополнета со официјалните тестови откако
 * PDF материјалите ќе бидат обработени со Gemini Files API.
 *
 * Водич за интеграција: docs/MATURA_PDF_GUIDE.md
 */

import type { MaturaExam, SecondaryTrack } from '../../types';

// ── Demo / Primer тест (ќе биде заменет со реални ДИМ тестови) ───────────────
export const DEMO_EXAM: MaturaExam = {
  id: 'demo-gymnasium-2024',
  year: 2024,
  track: 'gymnasium',
  gradeLevel: 12,
  title: 'Демо тест — Гимназиско XII',
  durationMinutes: 90,
  questions: [
    {
      id: 'demo-q1',
      questionNumber: 1,
      questionText: 'Ако f(x) = 2sin(x) + cos(2x), колкав е f\'(π/2)?',
      choices: { А: '−2', Б: '0', В: '2', Г: '4' },
      correctAnswer: 'А',
      topic: 'Деривати',
      bloomLevel: 'Apply',
      points: 2,
    },
    {
      id: 'demo-q2',
      questionNumber: 2,
      questionText: 'Збирот на бесконечната геометриска низа: 1 + 1/3 + 1/9 + … е:',
      choices: { А: '1/2', Б: '3/2', В: '2', Г: '3' },
      correctAnswer: 'Б',
      topic: 'Низи и редови',
      bloomLevel: 'Apply',
      points: 2,
    },
    {
      id: 'demo-q3',
      questionNumber: 3,
      questionText: 'Интегралот ∫₀¹ 3x² dx е рамен на:',
      choices: { А: '0', Б: '1', В: '3', Г: '1/3' },
      correctAnswer: 'Б',
      topic: 'Интеграли',
      bloomLevel: 'Apply',
      points: 2,
    },
    {
      id: 'demo-q4',
      questionNumber: 4,
      questionText: 'Бројот на комбинации C(7,3) е еднаков на:',
      choices: { А: '21', Б: '35', В: '42', Г: '210' },
      correctAnswer: 'Б',
      topic: 'Комбинаторика',
      bloomLevel: 'Remember',
      points: 1,
    },
    {
      id: 'demo-q5',
      questionNumber: 5,
      questionText: 'Комплексниот број z = 3 + 4i има апсолутна вредност:',
      choices: { А: '3', Б: '4', В: '5', Г: '7' },
      correctAnswer: 'В',
      topic: 'Комплексни броеви',
      bloomLevel: 'Remember',
      points: 1,
    },
    {
      id: 'demo-q6',
      questionNumber: 6,
      questionText: 'Функцијата f(x) = x³ − 3x има локален минимум во точката:',
      choices: { А: 'x = −1', Б: 'x = 0', В: 'x = 1', Г: 'x = 3' },
      correctAnswer: 'В',
      topic: 'Деривати',
      bloomLevel: 'Analyze',
      points: 2,
    },
    {
      id: 'demo-q7',
      questionNumber: 7,
      questionText: 'Вредноста на log₂(64) е:',
      choices: { А: '4', Б: '5', В: '6', Г: '8' },
      correctAnswer: 'В',
      topic: 'Логаритми',
      bloomLevel: 'Remember',
      points: 1,
    },
    {
      id: 'demo-q8',
      questionNumber: 8,
      questionText: 'Периодот на функцијата f(x) = sin(3x) е:',
      choices: { А: 'π/3', Б: '2π/3', В: 'π', Г: '2π' },
      correctAnswer: 'Б',
      topic: 'Тригонометрија',
      bloomLevel: 'Remember',
      points: 1,
    },
    {
      id: 'demo-q9',
      questionNumber: 9,
      questionText: 'Граничната вредност lim(x→0) (sin x / x) е:',
      choices: { А: '0', Б: '1/2', В: '1', Г: 'не постои' },
      correctAnswer: 'В',
      topic: 'Граници',
      bloomLevel: 'Remember',
      points: 2,
    },
    {
      id: 'demo-q10',
      questionNumber: 10,
      questionText: 'Нормалниот вектор на рамнината 2x − y + 3z = 5 е:',
      choices: {
        А: '(2, −1, 3)',
        Б: '(1, −1, 3)',
        В: '(2, 1, 3)',
        Г: '(−2, 1, −3)',
      },
      correctAnswer: 'А',
      topic: 'Аналитичка геометрија',
      bloomLevel: 'Remember',
      points: 1,
    },
  ],
};

// ── Сите достапни испити ──────────────────────────────────────────────────────
export const maturaExams: MaturaExam[] = [
  DEMO_EXAM,
  // Реалните ДИМ тестови ќе бидат додадени тука по PDF екстракција
];

/** Врати ги сите испити за даден track, сортирани по година (нов→стар) */
export function getExamsByTrack(track: SecondaryTrack): MaturaExam[] {
  return maturaExams
    .filter((e) => e.track === track)
    .sort((a, b) => b.year - a.year);
}

/** Достапни години за selector */
export const MATURA_YEARS = Array.from(
  { length: 2024 - 2015 + 1 },
  (_, i) => 2024 - i,
);
