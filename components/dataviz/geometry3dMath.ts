// Pure math utilities, types, and solid data for Geometry3DLab
export type Vec3 = [number, number, number];

export function rotateX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
}
export function rotateY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
}
export function project(v: Vec3, cx: number, cy: number, scale: number) {
  return { x: cx + v[0] * scale, y: cy - v[1] * scale };
}
export function faceAvgZ(face: number[], verts: Vec3[]): number {
  return face.reduce((s, i) => s + verts[i][2], 0) / face.length;
}
export function faceNormal(face: number[], verts: Vec3[]): Vec3 {
  const a = verts[face[0]], b = verts[face[1]], c = verts[face[2]];
  const u: Vec3 = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
  const w: Vec3 = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
  const n: Vec3 = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
  const len = Math.sqrt(n[0]**2 + n[1]**2 + n[2]**2);
  return len < 1e-9 ? [0, 0, 1] : [n[0]/len, n[1]/len, n[2]/len];
}
export const LIGHT: Vec3 = [0.577, 0.577, 0.577];
export function lightness(n: Vec3): number {
  return 0.3 + 0.7 * Math.max(0, n[0]*LIGHT[0] + n[1]*LIGHT[1] + n[2]*LIGHT[2]);
}
export function facesToEdges(faces: number[][]): [number, number][] {
  const set = new Set<string>();
  const edges: [number, number][] = [];
  for (const f of faces) {
    for (let i = 0; i < f.length; i++) {
      const a = f[i], b = f[(i+1) % f.length];
      const k = `${Math.min(a,b)}-${Math.max(a,b)}`;
      if (!set.has(k)) { set.add(k); edges.push([Math.min(a,b), Math.max(a,b)]); }
    }
  }
  return edges;
}

// ─── Procedural generators ────────────────────────────────────────────────────
export function makePrismVerts(n: number): Vec3[] {
  const v: Vec3[] = [];
  for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n - Math.PI/2; v.push([Math.cos(a), Math.sin(a), 1]); }
  for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n - Math.PI/2; v.push([Math.cos(a), Math.sin(a), -1]); }
  return v;
}
export function makePrismFaces(n: number): number[][] {
  const f: number[][] = [];
  f.push(Array.from({length: n}, (_, i) => i));
  f.push(Array.from({length: n}, (_, i) => n + (n-1-i)));
  for (let i = 0; i < n; i++) { const j = (i+1)%n; f.push([i, j, n+j, n+i]); }
  return f;
}
export function makeAntiprismVerts(n: number): Vec3[] {
  const v: Vec3[] = [];
  for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n - Math.PI/2; v.push([Math.cos(a), Math.sin(a), 1]); }
  for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n - Math.PI/2 + Math.PI/n; v.push([Math.cos(a), Math.sin(a), -1]); }
  return v;
}
export function makeAntiprismFaces(n: number): number[][] {
  const f: number[][] = [];
  f.push(Array.from({length: n}, (_, i) => i));
  f.push(Array.from({length: n}, (_, i) => n+i));
  for (let i = 0; i < n; i++) { const j = (i+1)%n; f.push([i, j, n+i]); f.push([j, n+j, n+i]); }
  return f;
}
export function makePyramidVerts(n: number): Vec3[] {
  const v: Vec3[] = [];
  for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n - Math.PI/2; v.push([Math.cos(a), Math.sin(a), -0.6]); }
  v.push([0, 0, 1.2]);
  return v;
}
export function makePyramidFaces(n: number): number[][] {
  const f: number[][] = [Array.from({length: n}, (_, i) => n-1-i)];
  for (let i = 0; i < n; i++) { const j = (i+1)%n; f.push([i, j, n]); }
  return f;
}

// ─── Solid definitions ────────────────────────────────────────────────────────
export interface CurriculumRef {
  primary?: string[];
  gymnasium?: string[];
  vocational?: string[];
}
export interface SolidDef {
  id: string; name: string; nameEn: string;
  category: 'platonic' | 'archimedean' | 'prism' | 'antiprism' | 'pyramid';
  vertices: Vec3[]; faces: number[][]; edges: [number,number][];
  V: number; E: number; F: number;
  volumeFormula: string; surfaceFormula: string;
  funFact: string; curriculum: CurriculumRef;
}
function makeSolid(
  id: string, name: string, nameEn: string,
  cat: SolidDef['category'], verts: Vec3[], faces: number[][],
  vf: string, sf: string, fun: string, cur: CurriculumRef
): SolidDef {
  const edges = facesToEdges(faces);
  return { id, name, nameEn, category: cat, vertices: verts, faces, edges,
    V: verts.length, E: edges.length, F: faces.length,
    volumeFormula: vf, surfaceFormula: sf, funFact: fun, curriculum: cur };
}

const φ = (1 + Math.sqrt(5)) / 2;

const TETRA_V: Vec3[] = [[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
const TETRA_F = [[0,2,1],[0,1,3],[0,3,2],[1,2,3]];

const CUBE_V: Vec3[] = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const CUBE_F = [[0,3,2,1],[4,5,6,7],[0,1,5,4],[2,3,7,6],[0,4,7,3],[1,2,6,5]];

const OCTA_V: Vec3[] = [[0,0,1],[1,0,0],[0,1,0],[-1,0,0],[0,-1,0],[0,0,-1]];
const OCTA_F = [[0,1,2],[0,2,3],[0,3,4],[0,4,1],[5,2,1],[5,3,2],[5,4,3],[5,1,4]];

const DODECA_V: Vec3[] = [
  [1,1,1],[1,1,-1],[1,-1,1],[1,-1,-1],[-1,1,1],[-1,1,-1],[-1,-1,1],[-1,-1,-1],
  [0,1/φ,φ],[0,1/φ,-φ],[0,-1/φ,φ],[0,-1/φ,-φ],
  [1/φ,φ,0],[1/φ,-φ,0],[-1/φ,φ,0],[-1/φ,-φ,0],
  [φ,0,1/φ],[φ,0,-1/φ],[-φ,0,1/φ],[-φ,0,-1/φ]
];
const DODECA_F = [
  [0,8,10,2,16],[0,16,17,1,12],[0,12,14,4,8],
  [1,17,3,11,9],[1,9,5,14,12],[2,10,6,15,13],
  [2,13,3,17,16],[3,13,15,7,11],[4,14,5,19,18],
  [4,18,6,10,8],[5,9,11,7,19],[6,18,19,7,15]
];

const ICOSA_V: Vec3[] = [
  [0,1,φ],[0,-1,φ],[0,1,-φ],[0,-1,-φ],
  [1,φ,0],[-1,φ,0],[1,-φ,0],[-1,-φ,0],
  [φ,0,1],[-φ,0,1],[φ,0,-1],[-φ,0,-1]
];
const ICOSA_F = [
  [0,1,8],[0,8,4],[0,4,5],[0,5,9],[0,9,1],
  [1,6,8],[8,6,10],[8,10,4],[4,10,2],[4,2,5],
  [5,2,11],[5,11,9],[9,11,7],[9,7,1],[1,7,6],
  [3,6,7],[3,10,6],[3,2,10],[3,11,2],[3,7,11]
];

// Cuboctahedron: midpoints of cube edges
const CUBOCT_V: Vec3[] = [
  [1,1,0],[1,-1,0],[-1,1,0],[-1,-1,0],
  [1,0,1],[1,0,-1],[-1,0,1],[-1,0,-1],
  [0,1,1],[0,1,-1],[0,-1,1],[0,-1,-1]
];
const CUBOCT_F = [
  [4,8,6,10],[5,11,7,9],[0,4,1,5],[2,6,3,7],[0,8,2,9],[1,10,3,11],
  [0,8,4],[0,5,9],[1,4,10],[1,11,5],[2,8,6],[2,9,7],[3,10,6],[3,7,11]
];

// Truncated tetrahedron (12V, 18E, 8F)
const TT_V: Vec3[] = [
  [1,1/3,1/3],[1/3,1,1/3],[1/3,1/3,1],
  [1,-1/3,-1/3],[1/3,-1,-1/3],[1/3,-1/3,-1],
  [-1/3,1,-1/3],[-1,1/3,-1/3],[-1/3,1/3,-1],
  [-1/3,-1/3,1],[-1,-1/3,1/3],[-1/3,-1,1/3]
];
const TT_F = [
  [0,1,2],[3,4,5],[6,7,8],[9,10,11],
  [0,3,5,8,6,1],[1,6,7,10,9,2],[2,9,11,4,3,0],[4,11,10,7,8,5]
];

// Rhombicuboctahedron (24V)
function makeRCO(): { verts: Vec3[]; faces: number[][] } {
  const v: Vec3[] = [];
  const s = 1, t = 1 + Math.SQRT2;
  const perms: [number,number,number][] = [
    [s,s,t],[s,t,s],[t,s,s],
    [s,s,-t],[s,-t,s],[-t,s,s],
    [-s,s,t],[-s,t,s],[t,-s,s],
    [-s,s,-t],[-s,-t,s],[t,s,-s],
    [s,-s,t],[s,t,-s],[-t,-s,s],
    [s,-s,-t],[s,-t,-s],[-t,s,-s],
    [-s,-s,t],[-s,t,-s],[t,-s,-s],
    [-s,-s,-t],[-s,-t,-s],[-t,-s,-s]
  ];
  for (const p of perms) v.push([p[0]/t, p[1]/t, p[2]/t]);
  // simplified face list for wireframe display
  const faces: number[][] = [];
  return { verts: v, faces };
}

export const SOLIDS: SolidDef[] = [
  // ── Platonic ─────────────────────────────────────────────────────────────
  makeSolid('tetra','Тетраедар','Tetrahedron','platonic', TETRA_V, TETRA_F,
    'V = a³√2/12', 'S = a²√3',
    'Тетраедарот е облик на молекулата на метан CH₄.',
    { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.'] }),

  makeSolid('cube','Куба (Хексаедар)','Cube','platonic', CUBE_V, CUBE_F,
    'V = a³', 'S = 6a²',
    'Кујнска шеќерна коцка, коцка за игра — 6 квадратни лица.',
    { primary:['VII','VIII'], gymnasium:['I година'], vocational:['Стручно I год.'] }),

  makeSolid('octa','Октаедар','Octahedron','platonic', OCTA_V, OCTA_F,
    'V = a³√2/3', 'S = 2a²√3',
    'Диjамантот кристализира во октаедарска структура.',
    { primary:['VII','IX'], gymnasium:['I година'], vocational:['Стручно I год.'] }),

  makeSolid('dodeca','Додекаедар','Dodecahedron','platonic', DODECA_V, DODECA_F,
    'V = (15+7√5)a³/4', 'S = 3√(25+10√5)a²',
    '12 петоаголни лица — симбол на вселената кај Платон.',
    { primary:['IX'], gymnasium:['II година'], vocational:['Стручно II год.'] }),

  makeSolid('icosa','Икосаедар','Icosahedron','platonic', ICOSA_V, ICOSA_F,
    'V = 5(3+√5)a³/12', 'S = 5√3·a²',
    '20 триаголни лица — вируси (adenovirus) имаат икосаедарска форма.',
    { primary:['IX'], gymnasium:['II година'], vocational:['Стручно II год.'] }),

  // ── Archimedean ───────────────────────────────────────────────────────────
  makeSolid('cuboct','Кубоктаедар','Cuboctahedron','archimedean', CUBOCT_V, CUBOCT_F,
    'V = 5√2·a³/3', 'S = (6+2√3)a²',
    'Дуален на ромбискиот додекаедар. Среќаваме го во молекулите на металите.',
    { gymnasium:['II година','XI изборен'], vocational:['Стручно II год.'] }),

  makeSolid('trunctetra','Скратен тетраедар','Truncated Tetrahedron','archimedean', TT_V, TT_F,
    'V = 23√2·a³/12', 'S = 7√3·a²',
    'Образуван со скратување на врвовите на тетраедарот — 4 триаголни + 4 хексагонални лица.',
    { gymnasium:['II година','XI изборен'], vocational:['Стручно II год.'] }),

  // ── Prisms ────────────────────────────────────────────────────────────────
  makeSolid('triprism','Триаголна призма','Triangular Prism','prism',
    makePrismVerts(3), makePrismFaces(3),
    'V = (√3/4)a²·h', 'S = 3ah + (√3/2)a²',
    'Призмата Toblerone чоколадо е триаголна призма!',
    { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.','Стручно III год.'] }),

  makeSolid('quadprism','Четириаголна призма','Quadrilateral Prism','prism',
    makePrismVerts(4), makePrismFaces(4),
    'V = a²·h', 'S = 4ah + 2a²',
    'Секоја кутија (тетрапак, кутија за жито) е четириаголна призма.',
    { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.','Стручно III год.'] }),

  makeSolid('pentprism','Петоаголна призма','Pentagonal Prism','prism',
    makePrismVerts(5), makePrismFaces(5),
    'V = (5/4)√(5+2√5)a²h', 'S = 5ah + (5/2)√(5+2√5)a²',
    'Форма на оловката — заострена петоаголна призма.',
    { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.'] }),

  makeSolid('hexprism','Шестаголна призма','Hexagonal Prism','prism',
    makePrismVerts(6), makePrismFaces(6),
    'V = (3√3/2)a²·h', 'S = 6ah + 3√3a²',
    'Пчелните ќелии се шестаголни призми — оптимален пакување на простор.',
    { primary:['VII','VIII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.','Стручно III год.'] }),

  makeSolid('octprism','Осмоаголна призма','Octagonal Prism','prism',
    makePrismVerts(8), makePrismFaces(8),
    'V = 2(1+√2)a²h', 'S = 8ah + 4(1+√2)a²',
    'Основата на Кулата Eifel е осмоаголна призма.',
    { gymnasium:['I година'], vocational:['Стручно I год.'] }),

  // ── Antiprisms ────────────────────────────────────────────────────────────
  makeSolid('triantiprism','Триаголна антипризма (Октаедар)','Triangular Antiprism','antiprism',
    makeAntiprismVerts(3), makeAntiprismFaces(3),
    'V = a³√2/3', 'S = 2a²√3',
    'Триаголната антипризма е всушност правилниот октаедар!',
    { primary:['VII','IX'], gymnasium:['I година','XI изборен'] }),

  makeSolid('squareantiprism','Четириаголна антипризма','Square Antiprism','antiprism',
    makeAntiprismVerts(4), makeAntiprismFaces(4),
    'V ≈ 1.84·a³', 'S ≈ (2+2√3)a²',
    'Антипризмите се среќаваат во кристалографијата — структури на молибден.',
    { gymnasium:['I година','XI изборен'], vocational:['Стручно I год.'] }),

  makeSolid('pentantiprism','Петоаголна антипризма','Pentagonal Antiprism','antiprism',
    makeAntiprismVerts(5), makeAntiprismFaces(5),
    'V ≈ 2.73·a³', 'S ≈ (2.5+5·sin72°)a²',
    'Молекулата феросен (Fe(C₅H₅)₂) има структура на петоаголна антипризма.',
    { gymnasium:['II година','XI изборен'], vocational:['Стручно II год.'] }),

  // ── Pyramids ──────────────────────────────────────────────────────────────
  makeSolid('sqpyramid','Четириаголна пирамида','Square Pyramid','pyramid',
    makePyramidVerts(4), makePyramidFaces(4),
    'V = a²h/3', 'S = a² + 2al',
    'Египетските пирамиди се четириаголни пирамиди — Кеопс е највисоката.',
    { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.','Стручно III год.'] }),

  makeSolid('pentpyramid','Петоаголна пирамида','Pentagonal Pyramid','pyramid',
    makePyramidVerts(5), makePyramidFaces(5),
    'V = (5/6)·tan54°·a²h', 'S = (5/2)al + (5/4)√(5+2√5)a²',
    'Половина икосаедар е петоаголна пирамида — 5 триаголни лица.',
    { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.'] }),

  makeSolid('hexpyramid','Шестаголна пирамида','Hexagonal Pyramid','pyramid',
    makePyramidVerts(6), makePyramidFaces(6),
    'V = (√3/2)a²h', 'S = 3al + (3√3/2)a²',
    'Кристалите на лед можат да формираат шестаголни пирамидални форми.',
    { primary:['VII','VIII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.'] }),
];

// ─── Cone cross-sections (real cone-plane intersection) ────────────────────────
// Cone half-angle α — derived from the unit cone drawn in the side-view (base r=1, height=2)
export const CONE_K = 0.5; // = tan(α)
export const CONE_ALPHA = Math.atan(CONE_K);
export const CONE_ALPHA_DEG = CONE_ALPHA * 180 / Math.PI;
// θ is measured from the horizontal (perpendicular-to-axis) plane, so the plane
// turns parallel to a generator — the parabola boundary — at 90°−α, not at α.
export const CONE_CRITICAL_THETA_DEG = 90 - CONE_ALPHA_DEG;

export interface ConeCrossSection {
  type: 'point' | 'circle' | 'ellipse' | 'parabola' | 'hyperbola';
  name: string;
  area: number;
  perim: number;
  r: number;
  a: number;
  b: number;
  p: number;
}

const CS_POINT: ConeCrossSection = { type: 'point', name: 'Точка (врв)', area: 0, perim: 0, r: 0, a: 0, b: 0, p: 0 };

/**
 * Real cone-plane intersection: apex at origin, cone x²+y²=k²z², cutting plane
 * through z0 (along the axis, derived from h) tilted by thetaDeg. Eccentricity
 * e = sinθ/sinα (α = atan(k)) decides circle/ellipse/parabola/hyperbola —
 * see the closed-form derivation via the plane's (u,v) basis and completing
 * the square, matching θ<α → ellipse, θ=α → parabola, θ>α → hyperbola.
 */
export function computeConeCrossSection(h: number, thetaDeg: number, k: number = CONE_K): ConeCrossSection {
  const thetaRad = thetaDeg * Math.PI / 180;
  const z0 = 1 - h; // depth from apex along axis (0=apex, 2=base)
  const cosT = Math.cos(thetaRad), sinT = Math.sin(thetaRad);
  const Bc = cosT * cosT - k * k * sinT * sinT;
  const Cc = -2 * k * k * z0 * sinT;
  const Dc = -k * k * z0 * z0;

  if (Math.abs(Bc) < 1e-4) {
    const p = Math.abs(Cc) > 1e-9 ? Math.abs(Cc) / 4 : 0;
    if (p < 0.01) return CS_POINT;
    return { type: 'parabola', name: `Парабола (p = ${p.toFixed(3)})`, area: 0, perim: 0, r: 0, a: 0, b: 0, p };
  }

  const E = (Cc * Cc) / (4 * Bc) - Dc;
  if (Bc > 0) {
    if (E <= 1e-4) return CS_POINT;
    const a = Math.sqrt(E), b = Math.sqrt(E / Bc);
    if (a < 0.02 || b < 0.02) return CS_POINT;
    const area = Math.PI * a * b;
    const perim = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    if (Math.abs(a - b) < 1e-3) {
      return { type: 'circle', name: `Круг (r = ${a.toFixed(3)})`, area, perim, r: a, a, b, p: 0 };
    }
    return { type: 'ellipse', name: `Елипса (a=${a.toFixed(3)}, b=${b.toFixed(3)})`, area, perim, r: 0, a, b, p: 0 };
  }

  const Bh = -Bc, absE = Math.abs(E);
  if (absE <= 1e-4) return { ...CS_POINT, name: 'Две прави (низ врвот)' };
  const a = E > 0 ? Math.sqrt(absE) : Math.sqrt(absE / Bh);
  const b = E > 0 ? Math.sqrt(absE / Bh) : Math.sqrt(absE);
  return { type: 'hyperbola', name: `Хипербола (a=${a.toFixed(3)}, b=${b.toFixed(3)})`, area: 0, perim: 0, r: 0, a, b, p: 0 };
}

// ─── Duality ───────────────────────────────────────────────────────────────────
export const DUAL_MAP: Record<string, string> = {
  cube: 'octa', octa: 'cube',
  dodeca: 'icosa', icosa: 'dodeca',
  tetra: 'tetra',
  triprism: 'triantiprism', triantiprism: 'triprism',
  quadprism: 'squareantiprism', squareantiprism: 'quadprism',
};

// ─── Category config ──────────────────────────────────────────────────────────
export const CAT_CONFIG = {
  platonic:   { label: 'Платонски',   bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-300',  rgb: '99,102,241'  },
  archimedean:{ label: 'Архимедски',  bg: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-300',  rgb: '139,92,246'  },
  prism:      { label: 'Призми',      bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', rgb: '16,185,129'  },
  antiprism:  { label: 'Антипризми',  bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-300',    rgb: '20,184,166'  },
  pyramid:    { label: 'Пирамиди',    bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   rgb: '245,158,11'  },
};