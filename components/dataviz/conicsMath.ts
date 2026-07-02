import { type LabExEntry, type LabExercise, shufflePool } from '../../types/labTypes';

const CONIC_POOL1: LabExEntry[] = [
  { question: 'Елипса (x/5)² + (y/3)² = 1: a = ?', type: 'numeric', correctAnswer: '5',
    hint: 'a е под x, па a = √25 = 5', explanation: 'a = 5 (полуглавна оска)', difficulty: 1, curriculumRef: 'Гимн. XI' },
  { question: 'Парабола y = 3(x−2)² + 1: теме?', type: 'multiple_choice',
    options: ['(2, 1)', '(3, 1)', '(2, 3)', '(−2, 1)'], correctAnswer: '(2, 1)',
    hint: 'Во y = a(x−h)²+k, теме е (h, k)', explanation: 'Теме = (2, 1)', difficulty: 1, curriculumRef: 'МОН IX' },
  { question: 'Круг е елипса со ексцентрицитет е = ?', type: 'numeric', correctAnswer: '0',
    hint: 'Кај круг a = b → c = 0 → e = c/a = 0', explanation: 'e = 0 за круг', difficulty: 1, curriculumRef: 'Гимн. XI' },
  { question: 'Асимптоти на (x/a)² − (y/b)² = 1: y = ±?', type: 'multiple_choice',
    options: ['(b/a)x', '(a/b)x', 'ax', 'bx'], correctAnswer: '(b/a)x',
    hint: 'Асимптоти: y = ±(b/a)x', explanation: 'y = ±(b/a)x', difficulty: 1, curriculumRef: 'Гимн. XI' },
  { question: 'Елипса a=5, b=3: c = √(a²−b²) = ?', type: 'numeric', correctAnswer: '4',
    hint: 'c = √(25−9) = √16 = 4', explanation: 'c = 4', difficulty: 1, curriculumRef: 'Гимн. XI' },
  { question: 'Парабола y = ax² + bx + c со a > 0 се отвора...?', type: 'multiple_choice',
    options: ['Нагоре', 'Надолу', 'Лево', 'Десно'], correctAnswer: 'Нагоре',
    hint: 'a > 0 → парабола се отвора нагоре', explanation: 'Позитивен a → нагоре', difficulty: 1, curriculumRef: 'МОН IX' },
];

const CONIC_POOL2: LabExEntry[] = [
  { question: 'Елипса a=5, b=4: c=3. e = c/a = ?', type: 'numeric', correctAnswer: '0.6',
    hint: 'e = c/a = 3/5 = 0.6', explanation: 'e = 0.6', difficulty: 2, curriculumRef: 'Гимн. XI' },
  { question: 'Хипербола (x/4)²−(y/3)²=1: c = ?', type: 'numeric', correctAnswer: '5',
    hint: 'c = √(a²+b²) = √(16+9) = 5', explanation: 'c = √25 = 5', difficulty: 2, curriculumRef: 'Гимн. XI' },
  { question: 'Парабола y = (1/8)x²: фокус на (0, ?) — каде p ако 4p=8', type: 'numeric', correctAnswer: '2',
    hint: '4p = 8 → p = 2; фокус (0, 2)', explanation: 'p = 2', difficulty: 2, curriculumRef: 'Гимн. XI' },
  { question: 'Дискриминанта B²−4AC < 0 (B=0) → конусен пресек?', type: 'multiple_choice',
    options: ['Елипса', 'Хипербола', 'Парабола', 'Права'], correctAnswer: 'Елипса',
    hint: 'B²−4AC < 0 → елипса (или круг)', explanation: 'B²−4AC < 0 ↔ елипса', difficulty: 2, curriculumRef: 'Гимн. XI' },
  { question: 'Ексцентрицитет на хипербола е секогаш > ?', type: 'numeric', correctAnswer: '1',
    hint: 'Кај хипербола c > a → e = c/a > 1', explanation: 'e > 1 за хипербола', difficulty: 2, curriculumRef: 'Гимн. XI' },
  { question: 'Елипса a=13, b=5: c = ?', type: 'numeric', correctAnswer: '12',
    hint: 'c = √(169−25) = √144 = 12', explanation: 'c = 12', difficulty: 2, curriculumRef: 'Гимн. XI' },
];

const CONIC_POOL3: LabExEntry[] = [
  { question: '9x²+16y²=144 → x²/a²+y²/b²=1. a = ?', type: 'numeric', correctAnswer: '4',
    hint: 'Дели со 144: x²/16 + y²/9 = 1 → a = 4', explanation: 'a = √16 = 4', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'За елиминирање xy-член: cot(2θ) = ?', type: 'multiple_choice',
    options: ['(A−C)/B', 'B/(A−C)', 'A/C', '(A+C)/B'], correctAnswer: '(A−C)/B',
    hint: 'Формула за агол на ротација: cot(2θ) = (A−C)/B', explanation: 'cot(2θ) = (A−C)/B', difficulty: 3, curriculumRef: 'Гимн. XII' },
  { question: 'Параметарска форма на елипса: x=a·cos(t), y = ?', type: 'multiple_choice',
    options: ['b·sin(t)', 'b·cos(t)', 'a·sin(t)', 'sin(t)'], correctAnswer: 'b·sin(t)',
    hint: 'x=a cos t, y=b sin t задоволуваат (x/a)²+(y/b)²=1', explanation: 'y = b·sin(t)', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'Хипербола (x/3)²−(y/4)²=1: e = c/a ≈ ?', type: 'multiple_choice',
    options: ['1.67', '1.33', '2.00', '0.75'], correctAnswer: '1.67',
    hint: 'c = √(9+16) = 5, e = 5/3 ≈ 1.67', explanation: 'e = 5/3 ≈ 1.67', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'B²−4AC = 0 → конусен пресек?', type: 'multiple_choice',
    options: ['Парабола', 'Елипса', 'Хипербола', 'Круг'], correctAnswer: 'Парабола',
    hint: 'B²−4AC = 0 ↔ парабола', explanation: 'B²−4AC = 0 → парабола', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'Фокуси на x²/25 + y²/9 = 1: c = ?', type: 'numeric', correctAnswer: '4',
    hint: 'c = √(25−9) = √16 = 4; фокуси на (±4, 0)', explanation: 'c = 4', difficulty: 3, curriculumRef: 'Гимн. XI' },
];

export function generateConicSet(difficulty: 1 | 2 | 3, count = 6): LabExercise[] {
  const pool = difficulty === 1 ? CONIC_POOL1 : difficulty === 2 ? CONIC_POOL2 : CONIC_POOL3;
  return shufflePool(pool).slice(0, count).map((e, i) => ({ id: `conic-${difficulty}-${i}`, ...e }));
}
