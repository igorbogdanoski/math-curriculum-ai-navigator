// ─── Matrix helpers ───────────────────────────────────────────────────────────
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
