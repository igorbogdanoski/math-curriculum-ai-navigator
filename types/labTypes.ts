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

/** Maps a pool's raw curriculumRef string to a human-readable teaching-unit label. */
export const CURRICULUM_STANDARD_MAP: Record<string, string> = {
  'МОН V–VI одд.':        'Броеви и делливост — V–VI одделение',
  'МОН VI–VII одд.':      'Низи и прогресии — VI–VII одделение',
  'МОН VII':              'Простори фигури — VII одделение',
  'МОН VII одд.':         'Простори фигури — VII одделение',
  'МОН VII–VIII':         'Веројатност — VII–VIII одделение',
  'МОН VII–IX одд.':      'Триаголник и агли — VII–IX одделение',
  'МОН VIII':             'Статистика — VIII одделение',
  'МОН VIII–IX':          'Веројатност — VIII–IX одделение',
  'МОН VIII–IX одд.':     'Тригонометриски однос — VIII–IX одделение',
  'МОН IX':               'Простори фигури и стереометрија — IX одделение',
  'МОН IX одд.':          'Теорија на броеви — IX одделение',
  'МОН IX / Гимн.':       'Матрици — IX одд. / Гимназија',
  'МОН IX одд. / Гимн. X':'Тригонометриски функции — IX одд. / Гимн. X',
  'Гимназија':            'Веројатност и комбинаторика — Гимназија',
  'Гимн. I год.':         'Стереометрија — Гимназија I година',
  'Гимн. II год.':        'Пресеци и конусни пресеци — Гимназија II година',
  'Гимн. X':              'Логаритми и експоненцијални функции — Гимназија X',
  'Гимн. X–XI':           'Тригонометриски идентитети — Гимназија X–XI',
  'Гимн. XI':             'Диференцијално и интегрално сметање — Гимназија XI',
  'Гимн. XI изборен':     'Изборна геометрија — Гимназија XI изборен',
  'Гимн. XII':            'Интеграли и примени — Гимназија XII',
};

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
