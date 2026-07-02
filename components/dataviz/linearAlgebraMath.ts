// ─── Matrix helpers ───────────────────────────────────────────────────────────
import type { LabExercise } from '../../types/labTypes';

export type Mat2 = [[number, number], [number, number]];
export type Mat3 = [[number,number,number],[number,number,number],[number,number,number]];

export const COLS_2_3: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-3' };
export const COLS_N: Record<number, string> = {
  1:'grid-cols-1', 2:'grid-cols-2', 3:'grid-cols-3',
  4:'grid-cols-4', 5:'grid-cols-5', 6:'grid-cols-6',
};

export function det2(m: Mat2) { return m[0][0]*m[1][1] - m[0][1]*m[1][0]; }
export function det3(m: Mat3) {
  return (
    m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])
   -m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])
   +m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0])
  );
}

export function inv2(m: Mat2): Mat2 | null {
  const d = det2(m);
  if (Math.abs(d) < 1e-10) return null;
  return [[m[1][1]/d, -m[0][1]/d], [-m[1][0]/d, m[0][0]/d]];
}

export function mul2(a: Mat2, b: Mat2): Mat2 {
  return [
    [a[0][0]*b[0][0]+a[0][1]*b[1][0], a[0][0]*b[0][1]+a[0][1]*b[1][1]],
    [a[1][0]*b[0][0]+a[1][1]*b[1][0], a[1][0]*b[0][1]+a[1][1]*b[1][1]],
  ];
}

export function add2(a: Mat2, b: Mat2): Mat2 {
  return [[a[0][0]+b[0][0], a[0][1]+b[0][1]], [a[1][0]+b[1][0], a[1][1]+b[1][1]]];
}

export function transpose2(m: Mat2): Mat2 { return [[m[0][0],m[1][0]],[m[0][1],m[1][1]]]; }

export function mul3(a: Mat3, b: Mat3): Mat3 {
  const r = (ri: number, ci: number) =>
    a[ri][0]*b[0][ci] + a[ri][1]*b[1][ci] + a[ri][2]*b[2][ci];
  return [[r(0,0),r(0,1),r(0,2)],[r(1,0),r(1,1),r(1,2)],[r(2,0),r(2,1),r(2,2)]];
}

export function fmt(v: number): string {
  if (!isFinite(v)) return '—';
  const r = Math.round(v * 1000) / 1000;
  return r.toString();
}

export const EMPTY2: Mat2 = [[1,0],[0,1]];
export const EMPTY3: Mat3 = [[1,0,0],[0,1,0],[0,0,1]];

// ─── Lab exercise generator ───────────────────────────────────────────────────

function laRand(lo: number, hi: number) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

export function generateLinearAlgebraSet(difficulty: 1 | 2 | 3, count = 6): LabExercise[] {
  const exs: LabExercise[] = [];
  for (let i = 0; i < count; i++) {
    const id = `la-${difficulty}-${i}`;
    const qt = i % 3;

    if (difficulty === 1) {
      if (qt === 0) {
        const a = laRand(1, 4), b = laRand(0, 3), c = laRand(0, 3), d = laRand(1, 4);
        const det = a * d - b * c;
        exs.push({ id, question: `det([[${a},${b}],[${c},${d}]]) = ?`,
          type: 'numeric', correctAnswer: String(det),
          hint: `det = a·d − b·c = ${a}·${d} − ${b}·${c}`,
          explanation: `det = ${a * d} − ${b * c} = ${det}`,
          difficulty: 1, curriculumRef: 'Гимн. XI' });
      } else if (qt === 1) {
        const a = laRand(1, 5), b = laRand(1, 5), c = laRand(1, 5), d = laRand(1, 5);
        const dot = a * c + b * d;
        exs.push({ id, question: `Скаларен производ [${a}, ${b}] · [${c}, ${d}] = ?`,
          type: 'numeric', correctAnswer: String(dot),
          hint: `[a,b]·[c,d] = a·c + b·d = ${a}·${c} + ${b}·${d}`,
          explanation: `= ${a * c} + ${b * d} = ${dot}`,
          difficulty: 1, curriculumRef: 'Гимн. XI' });
      } else {
        const a = laRand(1, 4), b = laRand(0, 3), c = laRand(0, 3), d = laRand(1, 4);
        const detVal = a * d - b * c;
        const inv = detVal !== 0;
        exs.push({ id, question: `Дали [[${a},${b}],[${c},${d}]] е обратлива матрица?`,
          type: 'multiple_choice', options: ['Да (det ≠ 0)', 'Не (det = 0)'],
          correctAnswer: inv ? 'Да (det ≠ 0)' : 'Не (det = 0)',
          hint: `Пресметај det = ${a}·${d} − ${b}·${c} = ${detVal}. Ако det ≠ 0 → обратлива.`,
          explanation: `det = ${detVal}. ${inv ? 'det ≠ 0 → обратлива.' : 'det = 0 → необратлива.'}`,
          difficulty: 1, curriculumRef: 'Гимн. XI' });
      }
    } else if (difficulty === 2) {
      if (qt === 0) {
        const a = laRand(2, 6), b = laRand(1, 5), c = laRand(1, 5), d = laRand(2, 6);
        const det = a * d - b * c;
        exs.push({ id, question: `det([[${a},${b}],[${c},${d}]]) = ?`,
          type: 'numeric', correctAnswer: String(det),
          hint: `det = ${a}·${d} − ${b}·${c}`,
          explanation: `det = ${a * d} − ${b * c} = ${det}`,
          difficulty: 2, curriculumRef: 'Гимн. XI' });
      } else if (qt === 1) {
        const triples: [number, number, number][] = [[3,4,5],[5,12,13],[8,15,17],[6,8,10]];
        const tr = triples[laRand(0, triples.length - 1)];
        const [vx, vy, mag] = tr;
        exs.push({ id, question: `|[${vx}, ${vy}]| = ? (должина на вектор)`,
          type: 'numeric', correctAnswer: String(mag),
          hint: `|v| = √(${vx}² + ${vy}²) = √(${vx*vx} + ${vy*vy}) = √${vx*vx+vy*vy}`,
          explanation: `|v| = √${vx*vx+vy*vy} = ${mag}`,
          difficulty: 2, curriculumRef: 'Гимн. XI' });
      } else {
        const a = laRand(2, 6), x0 = laRand(1, 5);
        const b = a * x0;
        exs.push({ id, question: `Систем: ${a}x = ${b}. Колку е x?`,
          type: 'numeric', correctAnswer: String(x0),
          hint: `x = ${b} / ${a}`,
          explanation: `x = ${b} / ${a} = ${x0}`,
          difficulty: 2, curriculumRef: 'МОН IX / Гимн.' });
      }
    } else {
      if (qt === 0) {
        const cases = [
          { m: [[1,0,0],[0,1,0],[0,0,1]], d: 1 },
          { m: [[2,0,0],[0,3,0],[0,0,4]], d: 24 },
          { m: [[1,2,0],[0,1,0],[0,0,1]], d: 1 },
          { m: [[2,1,0],[1,3,0],[0,0,2]], d: 10 },
        ];
        const c = cases[laRand(0, cases.length - 1)];
        exs.push({ id,
          question: `det([${c.m.map(r => '['+r.join(',')+']').join(',')}]) = ?`,
          type: 'numeric', correctAnswer: String(c.d),
          hint: 'Разложи по прв ред (Лапласов развој).',
          explanation: `det = ${c.d}`,
          difficulty: 3, curriculumRef: 'Гимн. XI' });
      } else if (qt === 1) {
        exs.push({ id, question: 'Сопствените вредности на единечната матрица I₂×₂ се?',
          type: 'multiple_choice', options: ['Само 1', 'Само 0', '0 и 1', 'Зависи'],
          correctAnswer: 'Само 1',
          hint: 'I·v = v = 1·v → λ=1 за секој вектор v.',
          explanation: 'За I: Iv=v=1·v → сите сопствени вредности се 1.',
          difficulty: 3, curriculumRef: 'Гимн. XI' });
      } else {
        exs.push({ id, question: 'Дали [1,0] и [0,1] се линеарно независни?',
          type: 'multiple_choice', options: ['Да', 'Не', 'Зависи'],
          correctAnswer: 'Да',
          hint: 'a·[1,0] + b·[0,1] = [0,0] само ако a=b=0.',
          explanation: '[1,0] и [0,1] — стандардна база → линеарно независни.',
          difficulty: 3, curriculumRef: 'Гимн. XI' });
      }
    }
  }
  return exs;
}
