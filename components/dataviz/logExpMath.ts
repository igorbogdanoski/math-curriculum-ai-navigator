import { type LabExEntry, type LabExercise, shufflePool } from '../../types/labTypes';

const LOGEXP_POOL1: LabExEntry[] = [
  { question: 'log₂(8) = ?', type: 'numeric', correctAnswer: '3', hint: '2^? = 8 → 2³ = 8', explanation: 'log₂(8) = 3', difficulty: 1, curriculumRef: 'Гимн. X' },
  { question: 'ln(e) = ?', type: 'numeric', correctAnswer: '1', hint: 'ln(e) = log_e(e) = 1 по дефиниција', explanation: 'ln(e) = 1', difficulty: 1, curriculumRef: 'Гимн. X' },
  { question: 'log₁₀(100) = ?', type: 'numeric', correctAnswer: '2', hint: '10² = 100', explanation: 'log₁₀(100) = 2', difficulty: 1, curriculumRef: 'Гимн. X' },
  { question: 'log_b(1) = ?', type: 'numeric', correctAnswer: '0', hint: 'b⁰ = 1 за секоја база', explanation: 'log_b(1) = 0', difficulty: 1, curriculumRef: 'Гимн. X' },
  { question: 'log(a·b) = ?', type: 'multiple_choice', options: ['log(a)+log(b)', 'log(a)·log(b)', 'log(a)−log(b)', 'log(a+b)'],
    correctAnswer: 'log(a)+log(b)', hint: 'Логаритам на производ = збир на логаритми.', explanation: 'log(a·b) = log(a) + log(b)', difficulty: 1, curriculumRef: 'Гимн. X' },
  { question: 'e⁰ = ?', type: 'numeric', correctAnswer: '1', hint: 'Секоја основа на степен 0 е 1.', explanation: 'e⁰ = 1', difficulty: 1, curriculumRef: 'Гимн. X' },
];

const LOGEXP_POOL2: LabExEntry[] = [
  { question: 'ln(e³) = ?', type: 'numeric', correctAnswer: '3', hint: 'ln(eⁿ) = n', explanation: 'ln(e³) = 3', difficulty: 2, curriculumRef: 'Гимн. X' },
  { question: 'log(a/b) = ?', type: 'multiple_choice', options: ['log(a)−log(b)', 'log(a)+log(b)', 'log(a)/log(b)', 'log(a·b)'],
    correctAnswer: 'log(a)−log(b)', hint: 'Логаритам на количник = разлика.', explanation: 'log(a/b) = log(a) − log(b)', difficulty: 2, curriculumRef: 'Гимн. X' },
  { question: 'log(aⁿ) = ?', type: 'multiple_choice', options: ['n·log(a)', 'log(a)ⁿ', 'log(n·a)', 'n+log(a)'],
    correctAnswer: 'n·log(a)', hint: 'Логаритам на степен: log(aⁿ) = n·log(a)', explanation: 'log(aⁿ) = n·log(a)', difficulty: 2, curriculumRef: 'Гимн. X' },
  { question: 'd/dx(ln x) = ?', type: 'multiple_choice', options: ['1/x', 'ln x', 'x', '1/ln x'],
    correctAnswer: '1/x', hint: 'Основен извод на ln.', explanation: 'd/dx(ln x) = 1/x', difficulty: 2, curriculumRef: 'Гимн. XI' },
  { question: 'e^(ln x) = ?', type: 'fill_blank', correctAnswer: 'x', hint: 'e и ln се меѓусебни инверзи.', explanation: 'e^(ln x) = x', difficulty: 2, curriculumRef: 'Гимн. X' },
  { question: 'log₂(32) = ?', type: 'numeric', correctAnswer: '5', hint: '2⁵ = 32', explanation: 'log₂(32) = 5', difficulty: 2, curriculumRef: 'Гимн. X' },
];

const LOGEXP_POOL3: LabExEntry[] = [
  { question: 'Промена на база: log_b(x) = log(x) / ?', type: 'multiple_choice', options: ['log(b)', 'ln(b)', 'log(x)', 'b'],
    correctAnswer: 'log(b)', hint: 'Теорема за промена на база: log_b(x) = log(x)/log(b)', explanation: 'log_b(x) = log(x)/log(b)', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'd/dx(bˣ) = ?', type: 'multiple_choice', options: ['bˣ·ln(b)', 'bˣ', 'x·bˣ⁻¹', 'ln(b)'],
    correctAnswer: 'bˣ·ln(b)', hint: 'd/dx(bˣ) = bˣ·ln(b)', explanation: 'd/dx(bˣ) = bˣ·ln(b)', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: '∫(1/x)dx = ?', type: 'multiple_choice', options: ['ln|x| + C', '1/x + C', 'x + C', 'ln(x+1) + C'],
    correctAnswer: 'ln|x| + C', hint: 'Антидеривација на 1/x.', explanation: '∫(1/x)dx = ln|x| + C', difficulty: 3, curriculumRef: 'Гимн. XII' },
  { question: 'A = Pe^(rt): P=100, r=0.1, t=1. A ≈ ?', type: 'multiple_choice', options: ['110.52', '100.10', '105.00', '121.00'],
    correctAnswer: '110.52', hint: 'A = 100·e^0.1 ≈ 110.52', explanation: 'A = 100·e^0.1 ≈ 110.52', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'Shannon entropy (p₁=p₂=0.5): H = ?', type: 'numeric', correctAnswer: '1',
    hint: 'H = −(0.5·log₂0.5 + 0.5·log₂0.5) = 1', explanation: 'H = 1 bit', difficulty: 3, curriculumRef: 'Гимн. XII' },
  { question: 'log₃(1/27) = ?', type: 'numeric', correctAnswer: '-3', hint: '3^(−3) = 1/27', explanation: 'log₃(3^(−3)) = −3', difficulty: 3, curriculumRef: 'Гимн. X' },
];

export function generateLogExpSet(difficulty: 1 | 2 | 3, count = 6): LabExercise[] {
  const pool = difficulty === 1 ? LOGEXP_POOL1 : difficulty === 2 ? LOGEXP_POOL2 : LOGEXP_POOL3;
  return shufflePool(pool).slice(0, count).map((e, i) => ({ id: `logexp-${difficulty}-${i}`, ...e }));
}
