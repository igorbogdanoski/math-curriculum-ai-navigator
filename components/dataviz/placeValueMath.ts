// Pure math utilities for Place Value / Dienes blocks lab
import type { LabExercise } from '../../types/labTypes';

export interface Decomposition {
  thousands: number;
  hundreds: number;
  tens: number;
  ones: number;
}

export function decomposeNumber(n: number): Decomposition {
  const clamped = Math.max(0, Math.min(9999, Math.floor(n)));
  return {
    thousands: Math.floor(clamped / 1000),
    hundreds:  Math.floor((clamped % 1000) / 100),
    tens:      Math.floor((clamped % 100) / 10),
    ones:      clamped % 10,
  };
}

export function recompose(d: Decomposition): number {
  return d.thousands * 1000 + d.hundreds * 100 + d.tens * 10 + d.ones;
}

export function toExpandedForm(n: number): string {
  const { thousands, hundreds, tens, ones } = decomposeNumber(n);
  const parts: string[] = [];
  if (thousands) parts.push(`${thousands * 1000}`);
  if (hundreds)  parts.push(`${hundreds * 100}`);
  if (tens)      parts.push(`${tens * 10}`);
  if (ones)      parts.push(`${ones}`);
  return parts.length ? parts.join(' + ') : '0';
}

// Macedonian number words for 1-19
const MK_ONES = ['', 'еден', 'два', 'три', 'четири', 'пет', 'шест', 'седум', 'осум', 'девет',
  'десет', 'единаесет', 'дванаесет', 'тринаесет', 'четиринаесет', 'петнаесет',
  'шеснаесет', 'седумнаесет', 'осумнаесет', 'деветнаесет'];
const MK_TENS = ['', '', 'дваесет', 'триесет', 'четириесет', 'педесет',
  'шеесет', 'седумдесет', 'осумдесет', 'деведесет'];
const MK_HUNDREDS = ['', 'сто', 'двесте', 'триста', 'четиристотини', 'петстотини',
  'шестотини', 'седумстотини', 'осумстотини', 'деветстотини'];

export function toWordFormMK(n: number): string {
  if (n === 0) return 'нула';
  const { thousands, hundreds, tens, ones } = decomposeNumber(n);
  const parts: string[] = [];

  if (thousands === 1) parts.push('илјада');
  else if (thousands === 2) parts.push('две илјади');
  else if (thousands > 2) parts.push(`${MK_ONES[thousands]} илјади`);

  if (hundreds) parts.push(MK_HUNDREDS[hundreds]);

  const tensOnes = tens * 10 + ones;
  if (tensOnes < 20) {
    if (tensOnes) parts.push(MK_ONES[tensOnes]);
  } else {
    const t = MK_TENS[tens];
    const o = ones ? MK_ONES[ones] : '';
    parts.push(o ? `${t} и ${o}` : t);
  }

  return parts.join(' ');
}

export type GradeRange = 'g1' | 'g2' | 'g3';

// 2026-07-19 (Wave 8.4, audit_2026_07_18_full_app_review): `label`/`description` used to be
// baked-in MK strings here — moved to i18n keys (built in PlaceValueLab.tsx's gradeLabel()/
// gradeDescription() helpers) so this data constant doesn't hardcode a UI language.
export interface GradeConfig {
  max: number;
  showThousands: boolean;
  showHundreds: boolean;
}

export const GRADE_CONFIGS: Record<GradeRange, GradeConfig> = {
  g1: { max: 99,   showThousands: false, showHundreds: false },
  g2: { max: 999,  showThousands: false, showHundreds: true },
  g3: { max: 9999, showThousands: true,  showHundreds: true },
};

export function randomNumber(grade: GradeRange): number {
  const max = GRADE_CONFIGS[grade].max;
  // Weighted: ensure blocks from each active place value appear
  const r = Math.random();
  if (r < 0.2) return Math.floor(Math.random() * 10) + 1;                 // ones only
  if (r < 0.5) return Math.floor(Math.random() * (max * 0.9)) + 10;       // mix
  return Math.floor(Math.random() * max) + 1;
}

/** Layout helper: how many rows of blocks to display (keeps SVG tidy). */
export function blockRows(count: number, perRow: number): number[][] {
  const rows: number[][] = [];
  let remaining = count;
  while (remaining > 0) {
    const take = Math.min(remaining, perRow);
    rows.push(Array(take).fill(0));
    remaining -= take;
  }
  return rows;
}

// ─── Lab exercise generator ───────────────────────────────────────────────────

function pvRand(lo: number, hi: number) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

/** Generates a set of place-value exercises for use with useLabSession. */
export function generatePlaceValueSet(
  grade: GradeRange,
  difficulty: 1 | 2 | 3,
  count = 6,
): LabExercise[] {
  const cfg = GRADE_CONFIGS[grade];
  const gLabel = grade === 'g1' ? 'I–II' : grade === 'g2' ? 'III–IV' : 'V–VI';
  const cur = `МОН ${gLabel} одд.`;
  const exs: LabExercise[] = [];

  for (let i = 0; i < count; i++) {
    const n = randomNumber(grade);
    const d = decomposeNumber(n);
    const id = `pv-${grade}-${difficulty}-${i}`;

    if (difficulty === 1) {
      // Describe blocks in words → multiple-choice (visual in parent)
      const parts: string[] = [];
      if (cfg.showThousands && d.thousands) parts.push(`${d.thousands} илјадарки`);
      if (cfg.showHundreds  && d.hundreds)  parts.push(`${d.hundreds} стотки`);
      if (d.tens) parts.push(`${d.tens} десетици`);
      parts.push(`${d.ones} единици`);

      const pool = new Set([n]);
      for (const delta of [10, -10, 1, -1, 100, -100]) {
        if (pool.size >= 4) break;
        const c = n + delta;
        if (c > 0 && c <= cfg.max) pool.add(c);
      }
      while (pool.size < 4) pool.add(pvRand(1, cfg.max));

      exs.push({
        id,
        question: `Блоковите прикажуваат: ${parts.join(', ')}. Кој број е ова?`,
        type: 'multiple_choice',
        options: [...pool].sort((a, b) => a - b).map(String),
        correctAnswer: String(n),
        hint: `Собери: ${toExpandedForm(n)}`,
        explanation: `${parts.join(' + ')} = ${n}`,
        difficulty: 1,
        curriculumRef: cur,
      });
    } else if (difficulty === 2) {
      // Extract digit from a specific place value
      type PK = 'ones' | 'tens' | 'hundreds' | 'thousands';
      const avail: Array<{ k: PK; mk: string }> = [
        { k: 'ones', mk: 'единици' },
        { k: 'tens', mk: 'десетици' },
      ];
      if (cfg.showHundreds)  avail.push({ k: 'hundreds',  mk: 'стотки'    });
      if (cfg.showThousands) avail.push({ k: 'thousands', mk: 'илјадарки' });
      const pl = avail[pvRand(0, avail.length - 1)];
      const digit = d[pl.k];

      exs.push({
        id,
        question: `Колку ${pl.mk} има во бројот ${n}?`,
        type: 'numeric',
        correctAnswer: String(digit),
        hint: `Разложи: ${toExpandedForm(n)}`,
        explanation: `${n} = ${toExpandedForm(n)}. Бројот на ${pl.mk} е ${digit}.`,
        difficulty: 2,
        curriculumRef: cur,
      });
    } else {
      // Read expanded form → write number
      const exp = toExpandedForm(n);
      exs.push({
        id,
        question: `${exp} = ?`,
        type: 'numeric',
        correctAnswer: String(n),
        hint: `Собери ги деловите: ${exp}`,
        explanation: `${exp} = ${n}`,
        difficulty: 3,
        curriculumRef: cur,
      });
    }
  }
  return exs;
}
