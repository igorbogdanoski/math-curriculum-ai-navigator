// Pure math utilities and data for TrigonometryLab
import type { LabExercise } from '../../types/labTypes';

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

// ─── Exact values lookup for special angles ───────────────────────────────────

interface ExactVal { sin: string; cos: string; tan: string | null }

const EXACT: Record<number, ExactVal> = {
  0:   { sin: '0',      cos: '1',      tan: '0'       },
  30:  { sin: '1/2',   cos: '√3/2',  tan: '√3/3'   },
  45:  { sin: '√2/2',  cos: '√2/2',  tan: '1'       },
  60:  { sin: '√3/2',  cos: '1/2',   tan: '√3'      },
  90:  { sin: '1',      cos: '0',      tan: null       },
  120: { sin: '√3/2',  cos: '-1/2',  tan: '-√3'     },
  135: { sin: '√2/2',  cos: '-√2/2', tan: '-1'      },
  150: { sin: '1/2',   cos: '-√3/2', tan: '-√3/3'  },
  180: { sin: '0',      cos: '-1',     tan: '0'       },
  270: { sin: '-1',     cos: '0',      tan: null       },
};

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

// ─── Lab exercise generator ───────────────────────────────────────────────────

function tgRand(lo: number, hi: number) {
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

const EXACT_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180] as const;
type ExactDeg = typeof EXACT_ANGLES[number];

/** Generates trigonometry exercises for use with useLabSession. */
export function generateTrigSet(difficulty: 1 | 2 | 3, count = 6): LabExercise[] {
  const exs: LabExercise[] = [];

  for (let i = 0; i < count; i++) {
    const id = `trig-${difficulty}-${i}`;
    const qType = i % 3;

    if (difficulty === 1) {
      if (qType === 0) {
        // sin(special angle) — multiple choice
        const angles: ExactDeg[] = [0, 30, 45, 60, 90];
        const deg = angles[tgRand(0, angles.length - 1)];
        const ev = EXACT[deg];
        const distractors = ['0', '1/2', '√2/2', '√3/2', '1'].filter(v => v !== ev.sin);
        const opts = [ev.sin, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5);
        exs.push({
          id,
          question: `sin(${deg}°) = ?`,
          type: 'multiple_choice',
          options: opts,
          correctAnswer: ev.sin,
          hint: `Запомни: sin(30°)=1/2, sin(45°)=√2/2, sin(60°)=√3/2, sin(90°)=1.`,
          explanation: `sin(${deg}°) = ${ev.sin}`,
          difficulty: 1, curriculumRef: 'МОН VII–IX одд.',
        });
      } else if (qType === 1) {
        // cos(special angle) — multiple choice
        const angles: ExactDeg[] = [0, 30, 45, 60, 90];
        const deg = angles[tgRand(0, angles.length - 1)];
        const ev = EXACT[deg];
        const distractors = ['0', '1/2', '√2/2', '√3/2', '1'].filter(v => v !== ev.cos);
        const opts = [ev.cos, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5);
        exs.push({
          id,
          question: `cos(${deg}°) = ?`,
          type: 'multiple_choice',
          options: opts,
          correctAnswer: ev.cos,
          hint: `Запомни: cos(60°)=1/2, cos(45°)=√2/2, cos(30°)=√3/2, cos(0°)=1.`,
          explanation: `cos(${deg}°) = ${ev.cos}`,
          difficulty: 1, curriculumRef: 'МОН VII–IX одд.',
        });
      } else {
        // Quadrant of angle
        const angle = SPECIAL_ANGLES[tgRand(1, SPECIAL_ANGLES.length - 2)];
        const q = angle < 90 ? 'I' : angle < 180 ? 'II' : angle < 270 ? 'III' : 'IV';
        exs.push({
          id,
          question: `Во кој квадрант е аголот ${angle}°?`,
          type: 'multiple_choice',
          options: ['I', 'II', 'III', 'IV'],
          correctAnswer: q,
          hint: `I: 0°–90°, II: 90°–180°, III: 180°–270°, IV: 270°–360°.`,
          explanation: `${angle}° е во ${q} квадрант.`,
          difficulty: 1, curriculumRef: 'МОН VIII–IX одд.',
        });
      }
    } else if (difficulty === 2) {
      if (qType === 0) {
        // tan(special angle) — multiple choice (avoid undefined)
        const angles: ExactDeg[] = [0, 30, 45, 60];
        const deg = angles[tgRand(0, angles.length - 1)];
        const ev = EXACT[deg];
        const tanVal = ev.tan!;
        const distractors = ['0', '1', '√3', '√3/3', '-1'].filter(v => v !== tanVal);
        const opts = [tanVal, ...distractors.slice(0, 3)].sort(() => Math.random() - 0.5);
        exs.push({
          id,
          question: `tan(${deg}°) = ?`,
          type: 'multiple_choice',
          options: opts,
          correctAnswer: tanVal,
          hint: `tan(θ) = sin(θ)/cos(θ). sin(${deg}°)=${ev.sin}, cos(${deg}°)=${ev.cos}.`,
          explanation: `tan(${deg}°) = ${ev.sin} / ${ev.cos} = ${tanVal}`,
          difficulty: 2, curriculumRef: 'МОН VIII–IX одд.',
        });
      } else if (qType === 1) {
        // Pythagorean identity at a specific angle
        const deg = SPECIAL_ANGLES[tgRand(0, SPECIAL_ANGLES.length - 1)];
        const r = toRad(deg);
        const lhs = parseFloat((Math.sin(r) ** 2 + Math.cos(r) ** 2).toFixed(4));
        exs.push({
          id,
          question: `sin²(${deg}°) + cos²(${deg}°) = ?`,
          type: 'multiple_choice',
          options: ['1', '0', '2', '-1'],
          correctAnswer: '1',
          hint: `Питагоровиот тригонометриски идентитет важи за секој агол θ.`,
          explanation: `sin²(θ) + cos²(θ) = 1 за секое θ. Вредноста е ${lhs} ≈ 1.`,
          difficulty: 2, curriculumRef: 'МОН IX одд. / Гимн. X',
        });
      } else {
        // Period of A·sin(Bx)
        const B = [1, 2, 3, 4][tgRand(0, 3)];
        const A = tgRand(1, 4);
        const periodLabel = B === 1 ? '2π' : B === 2 ? 'π' : B === 3 ? '2π/3' : 'π/2';
        const opts = ['2π', 'π', '2π/3', 'π/2', '4π'].sort(() => Math.random() - 0.5).slice(0, 4);
        if (!opts.includes(periodLabel)) opts[0] = periodLabel;
        exs.push({
          id,
          question: `Периодот на ${A > 1 ? `${A}·` : ''}sin(${B > 1 ? `${B}x` : 'x'}) е ?`,
          type: 'multiple_choice',
          options: [...new Set(opts)],
          correctAnswer: periodLabel,
          hint: `T = 2π / |B|. Тука B = ${B}.`,
          explanation: `T = 2π / ${B} = ${periodLabel}. Амплитудата (${A}) не го менува периодот.`,
          difficulty: 2, curriculumRef: 'Гимн. X–XI',
        });
      }
    } else {
      // difficulty 3
      if (qType === 0) {
        // Double angle: sin(2·deg) = 2·sin(deg)·cos(deg) — compute numerically
        const angles: ExactDeg[] = [30, 45, 60];
        const deg = angles[tgRand(0, angles.length - 1)];
        const ev = EXACT[deg];
        const dbl = EXACT[(deg * 2) as ExactDeg];
        const result = dbl ? dbl.sin : `${(2 * Math.sin(toRad(deg)) * Math.cos(toRad(deg))).toFixed(3)}`;
        exs.push({
          id,
          question: `sin(2×${deg}°) = 2·sin(${deg}°)·cos(${deg}°). Колку е тоа?`,
          type: 'multiple_choice',
          options: ['0', '1/2', '√2/2', '√3/2', '1'].sort(() => Math.random() - 0.5).slice(0, 4),
          correctAnswer: result,
          hint: `sin(${deg}°)=${ev.sin}, cos(${deg}°)=${ev.cos}. Множи.`,
          explanation: `2·${ev.sin}·${ev.cos} = sin(${deg * 2}°) = ${result}`,
          difficulty: 3, curriculumRef: 'Гимн. XI',
        });
      } else if (qType === 1) {
        // cos(90°+deg) sign rule
        const deg = [30, 45, 60][tgRand(0, 2)];
        const res = EXACT[(90 + deg) as ExactDeg];
        const correct = res ? res.cos : `-${EXACT[deg as ExactDeg].sin}`;
        exs.push({
          id,
          question: `cos(90°+${deg}°) = ?`,
          type: 'multiple_choice',
          options: [
            `-${EXACT[deg as ExactDeg].sin}`,
            EXACT[deg as ExactDeg].sin,
            EXACT[deg as ExactDeg].cos,
            `-${EXACT[deg as ExactDeg].cos}`,
          ].filter((o, idx, a) => a.indexOf(o) === idx).sort(() => Math.random() - 0.5),
          correctAnswer: correct,
          hint: `cos(90°+θ) = −sin(θ). Тука θ = ${deg}°.`,
          explanation: `cos(90°+${deg}°) = −sin(${deg}°) = −${EXACT[deg as ExactDeg].sin} = ${correct}`,
          difficulty: 3, curriculumRef: 'Гимн. X–XI',
        });
      } else {
        // Amplitude of A·sin(Bx+C) + D
        const A = tgRand(2, 5);
        const B = tgRand(1, 3);
        const C = [0, 30, 45][tgRand(0, 2)];
        exs.push({
          id,
          question: `Амплитудата на ${A}·sin(${B}x${C ? `+${C}` : ''}) е ?`,
          type: 'numeric',
          correctAnswer: String(A),
          hint: `Амплитуда = |A|. Параметрите B и C не ја менуваат амплитудата.`,
          explanation: `Амплитудата е |A| = ${A}.`,
          difficulty: 3, curriculumRef: 'Гимн. X–XI',
        });
      }
    }
  }
  return exs;
}
