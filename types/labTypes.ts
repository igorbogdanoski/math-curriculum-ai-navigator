// ─── Lab exercise types — shared across all AI labs ───────────────────────────

export interface LabExercise {
  id: string;
  question: string;
  type: 'multiple_choice' | 'numeric' | 'fill_blank' | 'ordering';
  options?: string[];       // multiple_choice only
  correctAnswer: string;    // normalized value for comparison
  hint: string;             // directs without revealing the answer
  explanation: string;      // shown after answering
  difficulty: 1 | 2 | 3;   // 1=basic, 2=medium, 3=advanced
  curriculumRef: string;    // "МОН VII одд." / "Гимн. I год."
}

/** Shared alias for pool entries before id is assigned */
export type LabExEntry = Omit<LabExercise, 'id'>;

/** Fisher-Yates shuffle — vary exercise order on retry */
export function shufflePool<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Answer normalization ──────────────────────────────────────────────────────

/** Normalize common math representations so comparison is robust. */
function normalizeString(s: string): string {
  return s
    .trim()
    .toLowerCase()
    // √3/2 → sqrt(3)/2 and vice-versa
    .replace(/√(\d+)/g, 'sqrt($1)')
    // remove trailing .0
    .replace(/\.0+$/, '')
    // collapse whitespace
    .replace(/\s+/g, ' ');
}

/**
 * Returns true when the student's answer matches the correct answer.
 * Handles numeric (±0.01 tolerance), multiple-choice, and fill-blank.
 */
export function normalizeLabAnswer(userRaw: string, correctRaw: string): boolean {
  const user    = normalizeString(userRaw);
  const correct = normalizeString(correctRaw);

  // Exact string match after normalization
  if (user === correct) return true;

  // Numeric tolerance match
  const u = parseFloat(user.replace(',', '.'));
  const c = parseFloat(correct.replace(',', '.'));
  if (!isNaN(u) && !isNaN(c)) {
    return Math.abs(u - c) < 0.01;
  }

  return false;
}
