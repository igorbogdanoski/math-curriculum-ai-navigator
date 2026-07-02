// ─── Types ────────────────────────────────────────────────────────────────────
export type TileKind = 'x2' | 'x' | '1';
export type TileSign = 1 | -1;

export interface Tile {
  id: string;
  kind: TileKind;
  sign: TileSign;
  x: number;
  y: number;
}

// ─── Visual config ─────────────────────────────────────────────────────────────
export const TILE_CONFIG: Record<TileKind, { w: number; h: number; label: string }> = {
  x2: { w: 64, h: 64, label: 'x²' },
  x:  { w: 64, h: 24, label: 'x'  },
  '1': { w: 24, h: 24, label: '1' },
};

export const TILE_COLOR: Record<TileKind, Record<TileSign, string>> = {
  x2:  { 1: 'bg-blue-500 border-blue-700 text-white',    [-1]: 'bg-red-400 border-red-600 text-white'    },
  x:   { 1: 'bg-emerald-500 border-emerald-700 text-white', [-1]: 'bg-pink-400 border-pink-600 text-white' },
  '1': { 1: 'bg-amber-400 border-amber-600 text-gray-900', [-1]: 'bg-gray-400 border-gray-600 text-white' },
};

// ─── Preset expressions ────────────────────────────────────────────────────────
export interface Preset {
  label: string;
  latex: string;
  gradeHint?: string;
  tiles: { kind: TileKind; sign: TileSign; count: number }[];
}

export const PRESETS: Preset[] = [
  // ─── 6-то одделение — линеарни изрази ────────────────────────────────────
  {
    label: '2x+4',
    latex: '2x+4',
    gradeHint: '6. одд.',
    tiles: [
      { kind: 'x',  sign: 1, count: 2 },
      { kind: '1',  sign: 1, count: 4 },
    ],
  },
  {
    label: '3x+6',
    latex: '3x+6',
    gradeHint: '6. одд.',
    tiles: [
      { kind: 'x',  sign: 1, count: 3 },
      { kind: '1',  sign: 1, count: 6 },
    ],
  },
  {
    label: 'x+3',
    latex: 'x+3',
    gradeHint: '6. одд.',
    tiles: [
      { kind: 'x',  sign: 1, count: 1 },
      { kind: '1',  sign: 1, count: 3 },
    ],
  },
  // ─── 7-мо одделение — уводна квадратна ──────────────────────────────────
  {
    label: 'x²+3x+2',
    latex: 'x^2+3x+2',
    gradeHint: '7. одд.',
    tiles: [
      { kind: 'x2', sign: 1, count: 1 },
      { kind: 'x',  sign: 1, count: 3 },
      { kind: '1',  sign: 1, count: 2 },
    ],
  },
  {
    label: 'x²+5x+6',
    latex: 'x^2+5x+6',
    gradeHint: '7. одд.',
    tiles: [
      { kind: 'x2', sign: 1, count: 1 },
      { kind: 'x',  sign: 1, count: 5 },
      { kind: '1',  sign: 1, count: 6 },
    ],
  },
  {
    label: 'x²-x-2',
    latex: 'x^2-x-2',
    gradeHint: '7. одд.',
    tiles: [
      { kind: 'x2', sign: 1,  count: 1 },
      { kind: 'x',  sign: -1, count: 1 },
      { kind: '1',  sign: -1, count: 2 },
    ],
  },
  // ─── 8-мо одделение — факторизација ──────────────────────────────────────
  {
    label: 'x²-4',
    latex: 'x^2-4',
    gradeHint: '8. одд.',
    tiles: [
      { kind: 'x2', sign: 1,  count: 1 },
      { kind: '1',  sign: -1, count: 4 },
    ],
  },
  {
    label: 'x²+4x+4',
    latex: 'x^2+4x+4',
    gradeHint: '8. одд.',
    tiles: [
      { kind: 'x2', sign: 1, count: 1 },
      { kind: 'x',  sign: 1, count: 4 },
      { kind: '1',  sign: 1, count: 4 },
    ],
  },
  {
    label: 'x²-6x+9',
    latex: 'x^2-6x+9',
    gradeHint: '8. одд.',
    tiles: [
      { kind: 'x2', sign: 1,  count: 1 },
      { kind: 'x',  sign: -1, count: 6 },
      { kind: '1',  sign: 1,  count: 9 },
    ],
  },
  // ─── 9-то одделение / Средно — сложена факторизација ─────────────────────
  {
    label: '2x²+5x+3',
    latex: '2x^2+5x+3',
    gradeHint: '9. одд.+',
    tiles: [
      { kind: 'x2', sign: 1, count: 2 },
      { kind: 'x',  sign: 1, count: 5 },
      { kind: '1',  sign: 1, count: 3 },
    ],
  },
  {
    label: 'x²-2x-3',
    latex: 'x^2-2x-3',
    gradeHint: '9. одд.',
    tiles: [
      { kind: 'x2', sign: 1,  count: 1 },
      { kind: 'x',  sign: -1, count: 2 },
      { kind: '1',  sign: -1, count: 3 },
    ],
  },
  {
    label: 'x²+6x+9',
    latex: 'x^2+6x+9',
    gradeHint: '9. одд. (потполен квадрат)',
    tiles: [
      { kind: 'x2', sign: 1, count: 1 },
      { kind: 'x',  sign: 1, count: 6 },
      { kind: '1',  sign: 1, count: 9 },
    ],
  },
  {
    label: 'x²-9',
    latex: 'x^2-9',
    gradeHint: '9–10. одд. (разлика на квадрати)',
    tiles: [
      { kind: 'x2', sign: 1,  count: 1 },
      { kind: '1',  sign: -1, count: 9 },
    ],
  },
  {
    label: '3x²+6x+3',
    latex: '3x^2+6x+3',
    gradeHint: '10. одд. (заеднички фактор)',
    tiles: [
      { kind: 'x2', sign: 1, count: 3 },
      { kind: 'x',  sign: 1, count: 6 },
      { kind: '1',  sign: 1, count: 3 },
    ],
  },
];

// ─── Balance mode presets ──────────────────────────────────────────────────────
export interface BalancePreset {
  label: string;
  gradeHint: string;
  challenge: string;  // What to explain to the student
  left: { kind: TileKind; sign: TileSign; count: number }[];
  right: { kind: TileKind; sign: TileSign; count: number }[];
}

export const BALANCE_PRESETS: BalancePreset[] = [
  {
    label: 'x+x+2 = 2x+2',
    gradeHint: '6. одд.',
    challenge: 'Сподели ги плочките на десната страна за да го провериш: x + x + 2 = 2x + 2',
    left:  [{ kind: 'x', sign: 1, count: 2 }, { kind: '1', sign: 1, count: 2 }],
    right: [{ kind: 'x', sign: 1, count: 2 }, { kind: '1', sign: 1, count: 2 }],
  },
  {
    label: '2x+4 = 2(x+2)',
    gradeHint: '6–7. одд.',
    challenge: 'Лева: 2x+4. Десна: додај плочки за 2(x+2). Тежиниот треба да биде еднаков.',
    left:  [{ kind: 'x', sign: 1, count: 2 }, { kind: '1', sign: 1, count: 4 }],
    right: [],
  },
  {
    label: 'x²+3x+2 = (x+1)(x+2)',
    gradeHint: '7–8. одд.',
    challenge: 'Лева: x²+3x+2. Десна: додај плочки за истиот израз (или наредете ги во правоаголник).',
    left:  [{ kind: 'x2', sign: 1, count: 1 }, { kind: 'x', sign: 1, count: 3 }, { kind: '1', sign: 1, count: 2 }],
    right: [],
  },
  {
    label: 'x²-4 = (x-2)(x+2)',
    gradeHint: '8–9. одд.',
    challenge: 'Лева: x²-4 (разлика на квадрати). Балансирај ја десната страна.',
    left:  [{ kind: 'x2', sign: 1, count: 1 }, { kind: '1', sign: -1, count: 4 }],
    right: [],
  },
  {
    label: 'x²+4x+4 = (x+2)²',
    gradeHint: '8–9. одд. (потполен квадрат)',
    challenge: 'Лева: x²+4x+4 = (x+2)². Репродуцирај го истиот израз на десната страна.',
    left:  [{ kind: 'x2', sign: 1, count: 1 }, { kind: 'x', sign: 1, count: 4 }, { kind: '1', sign: 1, count: 4 }],
    right: [],
  },
];

// ─── Expression builder ────────────────────────────────────────────────────────
export function buildExpression(tiles: Tile[]): string {
  const counts: Record<string, number> = { x2: 0, x: 0, '1': 0 };
  for (const t of tiles) counts[t.kind] = (counts[t.kind] ?? 0) + t.sign;
  const parts: string[] = [];
  if (counts.x2 !== 0) parts.push(counts.x2 === 1 ? 'x^2' : counts.x2 === -1 ? '-x^2' : `${counts.x2}x^2`);
  if (counts.x  !== 0) parts.push(counts.x  === 1 ? 'x'   : counts.x  === -1 ? '-x'   : `${counts.x}x`);
  if (counts['1'] !== 0) parts.push(String(counts['1']));
  if (parts.length === 0) return '0';
  return parts.join(' + ').replace(/\+ -/g, '- ');
}

// ─── Layout helpers ────────────────────────────────────────────────────────────
export const CANVAS_W = 500;
export const CANVAS_H = 280;

export const BASE_Y: Record<TileKind, number> = { x2: 10, x: 90, '1': 160 };

export function layoutTiles(specs: { kind: TileKind; sign: TileSign; count: number }[]): Tile[] {
  let uid = 0;
  const result: Tile[] = [];
  const posCounters: Record<string, number> = {};
  for (const { kind, sign, count } of specs) {
    const key = `${kind}_${sign}`;
    if (posCounters[key] === undefined) posCounters[key] = 0;
    const cfg = TILE_CONFIG[kind];
    for (let i = 0; i < count; i++) {
      const n = posCounters[key]++;
      const col = n % 6;
      const row = Math.floor(n / 6);
      result.push({
        id: `preset_${uid++}`,
        kind, sign,
        x: 10 + col * (cfg.w + 6),
        y: BASE_Y[kind] + row * (cfg.h + 6),
      });
    }
  }
  return result;
}

// ─── Undo helpers ──────────────────────────────────────────────────────────────
export const UNDO_MAX = 20;

// ─── ID counter ───────────────────────────────────────────────────────────────
export let _uid = 0;
export const nextUid = () => `t${++_uid}`;

// ─── Coefficient extractor (for balance comparison) ────────────────────────────
export function tileCoefficients(tiles: Tile[]): { x2: number; x: number; c: number } {
  let x2 = 0, x = 0, c = 0;
  for (const t of tiles) {
    if (t.kind === 'x2') x2 += t.sign;
    else if (t.kind === 'x') x += t.sign;
    else c += t.sign;
  }
  return { x2, x, c };
}

export function isBalanced(left: Tile[], right: Tile[]): boolean {
  const l = tileCoefficients(left);
  const r = tileCoefficients(right);
  return l.x2 === r.x2 && l.x === r.x && l.c === r.c;
}