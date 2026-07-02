// Pure math for CalculusLab exercises
import type { LabExercise } from '../../types/labTypes';

type ExEntry = Omit<LabExercise, 'id'>;

const POOL1: ExEntry[] = [
  { question: 'd/dx(x²) = ?', type: 'multiple_choice', options: ['2x', 'x', 'x²', '2'],
    correctAnswer: '2x', hint: 'Правило на потенцирање: d/dx(xⁿ) = n·xⁿ⁻¹', explanation: 'd/dx(x²) = 2x', difficulty: 1, curriculumRef: 'Гимн. XI' },
  { question: 'd/dx(x³) = ?', type: 'multiple_choice', options: ['3x²', '2x', 'x³', '3x'],
    correctAnswer: '3x²', hint: 'n=3: d/dx(x³) = 3·x²', explanation: 'd/dx(x³) = 3x²', difficulty: 1, curriculumRef: 'Гимн. XI' },
  { question: 'd/dx(sin x) = ?', type: 'multiple_choice', options: ['cos x', '-sin x', '-cos x', 'sin x'],
    correctAnswer: 'cos x', hint: 'Основен тригонометриски извод.', explanation: 'd/dx(sin x) = cos x', difficulty: 1, curriculumRef: 'Гимн. XI' },
  { question: 'd/dx(cos x) = ?', type: 'multiple_choice', options: ['-sin x', 'cos x', 'sin x', '-cos x'],
    correctAnswer: '-sin x', hint: 'Основен тригонометриски извод.', explanation: 'd/dx(cos x) = -sin x', difficulty: 1, curriculumRef: 'Гимн. XI' },
  { question: 'd/dx(eˣ) = ?', type: 'multiple_choice', options: ['eˣ', 'eˣ⁻¹', 'x·eˣ', '1/eˣ'],
    correctAnswer: 'eˣ', hint: 'Карактеристика: d/dx(eˣ) = eˣ', explanation: 'd/dx(eˣ) = eˣ', difficulty: 1, curriculumRef: 'Гимн. XI' },
  { question: 'd/dx(ln x) = ?', type: 'multiple_choice', options: ['1/x', 'x', 'ln x', '1/ln x'],
    correctAnswer: '1/x', hint: 'd/dx(ln x) = 1/x', explanation: 'd/dx(ln x) = 1/x', difficulty: 1, curriculumRef: 'Гимн. XI' },
];

const POOL2: ExEntry[] = [
  { question: 'f(x) = x². Колку е f\'(3)?', type: 'numeric', correctAnswer: '6',
    hint: "f'(x) = 2x; f'(3) = 6", explanation: "f'(x)=2x → f'(3)=6", difficulty: 2, curriculumRef: 'Гимн. XI' },
  { question: 'lim (x→0) sin(x)/x = ?', type: 'numeric', correctAnswer: '1',
    hint: 'Основна тригонометриска граница.', explanation: 'lim(x→0) sin(x)/x = 1', difficulty: 2, curriculumRef: 'Гимн. XI' },
  { question: 'd/dx(3x²) = ?', type: 'multiple_choice', options: ['6x', '3x', '6', '6x²'],
    correctAnswer: '6x', hint: 'Константа: d/dx(c·xⁿ) = c·n·xⁿ⁻¹ = 3·2x', explanation: 'd/dx(3x²) = 6x', difficulty: 2, curriculumRef: 'Гимн. XI' },
  { question: 'f(x) = x³. Колку е f\'(2)?', type: 'numeric', correctAnswer: '12',
    hint: "f'(x) = 3x²; f'(2) = 3·4", explanation: "f'(2) = 3·4 = 12", difficulty: 2, curriculumRef: 'Гимн. XI' },
  { question: 'lim (x→0) (eˣ−1)/x = ?', type: 'numeric', correctAnswer: '1',
    hint: 'Граница преку дефиниција на e.', explanation: 'lim(x→0)(eˣ−1)/x = 1', difficulty: 2, curriculumRef: 'Гимн. XI' },
  { question: 'd/dx(x² + 5) = ?', type: 'multiple_choice', options: ['2x', 'x²+5', '2x+5', '2'],
    correctAnswer: '2x', hint: "d/dx(5)=0; d/dx(x²)=2x", explanation: "d/dx(x²+5) = 2x", difficulty: 2, curriculumRef: 'Гимн. XI' },
];

const POOL3: ExEntry[] = [
  { question: '∫ x dx = ?', type: 'multiple_choice', options: ['x²/2 + C', 'x² + C', '2x + C', '1/x + C'],
    correctAnswer: 'x²/2 + C', hint: '∫xⁿdx = xⁿ⁺¹/(n+1) + C', explanation: '∫ x dx = x²/2 + C', difficulty: 3, curriculumRef: 'Гимн. XII' },
  { question: '∫ sin(x) dx = ?', type: 'multiple_choice', options: ['-cos(x) + C', 'cos(x) + C', 'sin(x) + C', '-sin(x) + C'],
    correctAnswer: '-cos(x) + C', hint: 'Антидеривацијата на sin = -cos.', explanation: '∫ sin(x) dx = -cos(x) + C', difficulty: 3, curriculumRef: 'Гимн. XII' },
  { question: '∫ eˣ dx = ?', type: 'multiple_choice', options: ['eˣ + C', 'eˣ⁻¹ + C', 'x·eˣ + C', 'ln(x) + C'],
    correctAnswer: 'eˣ + C', hint: 'Антидеривацијата на eˣ е самиот eˣ.', explanation: '∫ eˣ dx = eˣ + C', difficulty: 3, curriculumRef: 'Гимн. XII' },
  { question: 'f(x) = x³. Колку е f\'\'(x)?', type: 'multiple_choice', options: ['6x', '3x²', '6', '3x'],
    correctAnswer: '6x', hint: "f'=3x²; f''=6x", explanation: "f''(x³) = 6x", difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'f(x) = x² + 3x. Колку е f\'(1)?', type: 'numeric', correctAnswer: '5',
    hint: "f'(x) = 2x+3; f'(1) = 5", explanation: "f'(x)=2x+3 → f'(1)=5", difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'lim (x→∞) 1/x = ?', type: 'numeric', correctAnswer: '0',
    hint: '1/x → 0 кога x → ∞', explanation: 'lim(x→∞) 1/x = 0', difficulty: 3, curriculumRef: 'Гимн. XI' },
];

export function generateCalculusSet(difficulty: 1 | 2 | 3, count = 6): LabExercise[] {
  const pool = difficulty === 1 ? POOL1 : difficulty === 2 ? POOL2 : POOL3;
  return Array.from({ length: count }, (_, i) => ({ id: `calc-${difficulty}-${i}`, ...pool[i % pool.length] }));
}
