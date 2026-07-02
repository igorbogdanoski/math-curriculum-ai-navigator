// Pure math for SecondaryStatsLab exercises
import type { LabExercise } from '../../types/labTypes';

type ExEntry = Omit<LabExercise, 'id'>;

const POOL1: ExEntry[] = [
  { question: 'Средна вредност на: 2, 4, 6, 8, 10 = ?', type: 'numeric', correctAnswer: '6',
    hint: 'Средна = збир / n = 30 / 5', explanation: '(2+4+6+8+10)/5 = 30/5 = 6', difficulty: 1, curriculumRef: 'МОН IX' },
  { question: 'Медиана на: 3, 1, 5, 2, 4 = ?', type: 'numeric', correctAnswer: '3',
    hint: 'Подреди: 1,2,3,4,5 → средниот елемент = 3', explanation: 'Подредено: 1,2,3,4,5 → медиана = 3', difficulty: 1, curriculumRef: 'МОН IX' },
  { question: 'Мода на: 3, 7, 3, 8, 3, 9 = ?', type: 'numeric', correctAnswer: '3',
    hint: 'Мода е вредноста со најголема фреквенција.', explanation: '3 се јавува 3 пати → мода = 3', difficulty: 1, curriculumRef: 'МОН VIII' },
  { question: 'Опсег (range) на: 5, 11, 2, 8, 14 = ?', type: 'numeric', correctAnswer: '12',
    hint: 'Опсег = максимум − минимум', explanation: 'Опсег = 14 − 2 = 12', difficulty: 1, curriculumRef: 'МОН IX' },
  { question: "P(A) + P(A') = ?", type: 'numeric', correctAnswer: '1',
    hint: 'Настанот и неговиот комплемент образуваат сигурен настан.', explanation: "P(A) + P(A') = 1", difficulty: 1, curriculumRef: 'МОН VIII' },
  { question: 'Ако P(A)=0.3 и P(B)=0.5 (независни), P(A∩B) = ?', type: 'numeric', correctAnswer: '0.15',
    hint: 'За независни: P(A∩B) = P(A)·P(B)', explanation: '0.3 × 0.5 = 0.15', difficulty: 1, curriculumRef: 'МОН IX' },
];

const POOL2: ExEntry[] = [
  { question: 'μ=70, σ=10, X=80. Z-score = ?', type: 'numeric', correctAnswer: '1',
    hint: 'Z = (X − μ) / σ = (80−70)/10', explanation: 'Z = (80−70)/10 = 1', difficulty: 2, curriculumRef: 'Гимн. X' },
  { question: 'μ=50, σ=5, X=40. Z-score = ?', type: 'numeric', correctAnswer: '-2',
    hint: 'Z = (X − μ) / σ = (40−50)/5', explanation: 'Z = (40−50)/5 = -2', difficulty: 2, curriculumRef: 'Гимн. X' },
  { question: 'Binomial B(4, 0.5). Очекувана вредност E[X] = ?', type: 'numeric', correctAnswer: '2',
    hint: 'E[X] = n·p = 4·0.5', explanation: 'E[X] = n·p = 4 × 0.5 = 2', difficulty: 2, curriculumRef: 'Гимн. X' },
  { question: 'Нормален закон: P(μ−σ < X < μ+σ) ≈ ?', type: 'multiple_choice',
    options: ['68%', '95%', '99.7%', '50%'], correctAnswer: '68%',
    hint: 'Правило 68-95-99.7: 1σ опфаќа 68%.', explanation: '~68% паѓаат во ±1σ', difficulty: 2, curriculumRef: 'Гимн. X' },
  { question: 'Pearson r: перфектна позитивна корелација = ?', type: 'numeric', correctAnswer: '1',
    hint: 'r = +1 значи перфектна позитивна линеарна врска.', explanation: 'r = 1', difficulty: 2, curriculumRef: 'Гимн. X' },
  { question: 'Биномна расп. B(10, 0.3): σ = √(np(1−p)) ≈ ?', type: 'multiple_choice',
    options: ['1.45', '2.10', '3.00', '0.30'], correctAnswer: '1.45',
    hint: 'σ = √(10·0.3·0.7) = √2.1 ≈ 1.45', explanation: 'σ = √2.1 ≈ 1.45', difficulty: 2, curriculumRef: 'Гимн. X' },
];

const POOL3: ExEntry[] = [
  { question: 'P(A|B) = ?', type: 'multiple_choice',
    options: ['P(A∩B)/P(B)', 'P(A)·P(B)', 'P(B)/P(A)', 'P(A∪B)'], correctAnswer: 'P(A∩B)/P(B)',
    hint: 'Дефиниција на условна веројатност.', explanation: 'P(A|B) = P(A∩B)/P(B)', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'Теорема на Баjс: P(H|E) = P(E|H)·P(H) / ?', type: 'multiple_choice',
    options: ['P(E)', 'P(H)', 'P(E|H)', '1'], correctAnswer: 'P(E)',
    hint: 'Баjсовата теорема нормализира со вкупна веројатност P(E).', explanation: 'P(H|E) = P(E|H)·P(H) / P(E)', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'OLS slope: m = Σ(xᵢ−x̄)(yᵢ−ȳ) / ?', type: 'multiple_choice',
    options: ['Σ(xᵢ−x̄)²', 'Σ(yᵢ−ȳ)²', 'n', 'σ²'], correctAnswer: 'Σ(xᵢ−x̄)²',
    hint: 'Формула за наклон во OLS линеарна регресија.', explanation: 'm = Σ(xᵢ−x̄)(yᵢ−ȳ) / Σ(xᵢ−x̄)²', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'Chi-squared H₀ се отфрла кога χ² е...?', type: 'multiple_choice',
    options: ['> критична вредност', '< критична вредност', '= 0', '= 1'], correctAnswer: '> критична вредност',
    hint: 'Поголем χ² → поголема девијација; p < α.', explanation: 'Кога χ² > χ²_critical, ја отфрламе H₀.', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'Стандардна грешка на средна вредност: SE = σ / ?', type: 'multiple_choice',
    options: ['√n', 'n', 'n²', 'σ'], correctAnswer: '√n',
    hint: 'SE = σ/√n — колку поголем примерок, толку помала грешка.', explanation: 'SE = σ/√n', difficulty: 3, curriculumRef: 'Гимн. XI' },
  { question: 'Варијанса σ² на: 2, 4, 6 (μ=4) = ?', type: 'multiple_choice',
    options: ['2.67', '4.00', '1.63', '8.00'], correctAnswer: '2.67',
    hint: 'σ² = Σ(xᵢ−μ)²/n = (4+0+4)/3', explanation: 'σ² = 8/3 ≈ 2.67', difficulty: 3, curriculumRef: 'Гимн. X' },
];

export function generateStatsSet(difficulty: 1 | 2 | 3, count = 6): LabExercise[] {
  const pool = difficulty === 1 ? POOL1 : difficulty === 2 ? POOL2 : POOL3;
  return Array.from({ length: count }, (_, i) => ({ id: `stats-${difficulty}-${i}`, ...pool[i % pool.length] }));
}
