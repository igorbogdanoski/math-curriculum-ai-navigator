// Pure math utilities for Place Value / Dienes blocks lab

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

export interface GradeConfig {
  label: string;
  max: number;
  showThousands: boolean;
  showHundreds: boolean;
  description: string;
}

export const GRADE_CONFIGS: Record<GradeRange, GradeConfig> = {
  g1: { label: 'I–II одд.', max: 99,   showThousands: false, showHundreds: false, description: 'Единици и десетици (0–99)' },
  g2: { label: 'III–IV одд.', max: 999,  showThousands: false, showHundreds: true,  description: 'Единици, десетици и стотици (0–999)' },
  g3: { label: 'V–VI одд.',  max: 9999, showThousands: true,  showHundreds: true,  description: 'Илјадарки, стотики, десетици, единици (0–9999)' },
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
