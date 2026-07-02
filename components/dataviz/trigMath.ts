// Pure math utilities and data for TrigonometryLab

export interface CurriculumRef {
  primary?: string[];
  gymnasium?: string[];
  vocational?: string[];
}

export const TRIG_CURRICULUM: CurriculumRef = {
  primary: ['7', '8', '9'],
  gymnasium: ['X', 'XI'],
  vocational: ['Стручно X'],
};

// ── Angle conversions ─────────────────────────────────────────────────────────

export const toRad = (deg: number): number => (deg * Math.PI) / 180;
export const toDeg = (rad: number): number => (rad * 180) / Math.PI;

export function radLabel(rad: number): string {
  const pi = Math.PI;
  const fracs: [number, string][] = [
    [0, '0'],
    [pi / 6, 'π/6'],
    [pi / 4, 'π/4'],
    [pi / 3, 'π/3'],
    [pi / 2, 'π/2'],
    [(2 * pi) / 3, '2π/3'],
    [(3 * pi) / 4, '3π/4'],
    [(5 * pi) / 6, '5π/6'],
    [pi, 'π'],
    [(7 * pi) / 6, '7π/6'],
    [(5 * pi) / 4, '5π/4'],
    [(4 * pi) / 3, '4π/3'],
    [(3 * pi) / 2, '3π/2'],
    [(5 * pi) / 3, '5π/3'],
    [(7 * pi) / 4, '7π/4'],
    [(11 * pi) / 6, '11π/6'],
    [2 * pi, '2π'],
  ];
  const norm = ((rad % (2 * pi)) + 2 * pi) % (2 * pi);
  for (const [val, label] of fracs) {
    if (Math.abs(norm - val) < 0.01) return label;
  }
  return `${(norm / pi).toFixed(2)}π`;
}

// ── Unit circle ───────────────────────────────────────────────────────────────

export interface UnitCirclePoint {
  sin: number;
  cos: number;
  tan: number | null; // null when undefined (cos == 0)
  deg: number;
  rad: number;
  quadrant: 1 | 2 | 3 | 4;
  x: number; // cx + cos * r
  y: number; // cy - sin * r (SVG coords)
}

export function unitCirclePoint(deg: number, cx: number, cy: number, r: number): UnitCirclePoint {
  const rad = toRad(deg);
  const sinV = Math.sin(rad);
  const cosV = Math.cos(rad);
  const tanV = Math.abs(cosV) < 1e-9 ? null : sinV / cosV;
  const q = deg >= 0 && deg < 90 ? 1 : deg < 180 ? 2 : deg < 270 ? 3 : 4;
  return {
    sin: sinV,
    cos: cosV,
    tan: tanV,
    deg: ((deg % 360) + 360) % 360,
    rad,
    quadrant: q as 1 | 2 | 3 | 4,
    x: cx + cosV * r,
    y: cy - sinV * r,
  };
}

export const QUADRANT_LABELS: Record<1 | 2 | 3 | 4, { label: string; signs: string; color: string }> = {
  1: { label: 'I квадрант', signs: 'sin+, cos+, tan+', color: '#16a34a' },
  2: { label: 'II квадрант', signs: 'sin+, cos−, tan−', color: '#2563eb' },
  3: { label: 'III квадрант', signs: 'sin−, cos−, tan+', color: '#dc2626' },
  4: { label: 'IV квадрант', signs: 'sin−, cos+, tan−', color: '#9333ea' },
};

export const SPECIAL_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];

// ── Wave generation ───────────────────────────────────────────────────────────

export function sinWave(x: number, A: number, B: number, C: number, D: number): number {
  return A * Math.sin(B * x + C) + D;
}
export function cosWave(x: number, A: number, B: number, C: number, D: number): number {
  return A * Math.cos(B * x + C) + D;
}
export function tanWave(x: number, A: number, B: number, C: number, D: number): number | null {
  const t = A * Math.tan(B * x + C) + D;
  return isFinite(t) ? t : null;
}

export function generateWavePoints(
  fn: 'sin' | 'cos' | 'tan',
  A: number, B: number, C: number, D: number,
  xMin: number, xMax: number,
  steps = 400,
): Array<{ x: number; y: number | null }> {
  const pts: Array<{ x: number; y: number | null }> = [];
  const dx = (xMax - xMin) / steps;
  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * dx;
    let y: number | null;
    if (fn === 'sin') y = sinWave(x, A, B, C, D);
    else if (fn === 'cos') y = cosWave(x, A, B, C, D);
    else y = tanWave(x, A, B, C, D);
    pts.push({ x, y });
  }
  return pts;
}

export function period(B: number): number {
  return (2 * Math.PI) / Math.abs(B);
}

// ── Trig identities ───────────────────────────────────────────────────────────

export interface TrigIdentity {
  id: string;
  name: string;
  latex: string;
  verify: (deg: number) => { lhs: number; rhs: number };
}

const fmt = (n: number) => parseFloat(n.toFixed(6));

export const TRIG_IDENTITIES: TrigIdentity[] = [
  {
    id: 'pythag',
    name: 'Питагорова тригонометриска',
    latex: 'sin²θ + cos²θ = 1',
    verify: (deg) => {
      const r = toRad(deg);
      return { lhs: fmt(Math.sin(r) ** 2 + Math.cos(r) ** 2), rhs: 1 };
    },
  },
  {
    id: 'double_sin',
    name: 'Двоен агол (sin)',
    latex: 'sin(2θ) = 2·sin θ·cos θ',
    verify: (deg) => {
      const r = toRad(deg);
      return { lhs: fmt(Math.sin(2 * r)), rhs: fmt(2 * Math.sin(r) * Math.cos(r)) };
    },
  },
  {
    id: 'double_cos',
    name: 'Двоен агол (cos)',
    latex: 'cos(2θ) = cos²θ − sin²θ',
    verify: (deg) => {
      const r = toRad(deg);
      return { lhs: fmt(Math.cos(2 * r)), rhs: fmt(Math.cos(r) ** 2 - Math.sin(r) ** 2) };
    },
  },
  {
    id: 'tan_def',
    name: 'Дефиниција на тангенс',
    latex: 'tan θ = sin θ / cos θ',
    verify: (deg) => {
      const r = toRad(deg);
      const cosV = Math.cos(r);
      if (Math.abs(cosV) < 1e-9) return { lhs: NaN, rhs: NaN };
      return { lhs: fmt(Math.tan(r)), rhs: fmt(Math.sin(r) / cosV) };
    },
  },
  {
    id: 'sum_sin',
    name: 'Сума на агли (sin)',
    latex: 'sin(α+β) = sin α·cos β + cos α·sin β',
    verify: (deg) => {
      const a = toRad(deg), b = toRad(30);
      return {
        lhs: fmt(Math.sin(a + b)),
        rhs: fmt(Math.sin(a) * Math.cos(b) + Math.cos(a) * Math.sin(b)),
      };
    },
  },
  {
    id: 'pythag_tan',
    name: 'Питагорова (tan)',
    latex: '1 + tan²θ = sec²θ',
    verify: (deg) => {
      const r = toRad(deg);
      const cosV = Math.cos(r);
      if (Math.abs(cosV) < 1e-9) return { lhs: NaN, rhs: NaN };
      return { lhs: fmt(1 + Math.tan(r) ** 2), rhs: fmt(1 / cosV ** 2) };
    },
  },
];
