import React, { useState, useRef, useMemo, useCallback } from 'react';

// ─── Math helpers ─────────────────────────────────────────────────────────────
type Vec3 = [number, number, number];

function rotateX(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
}
function rotateY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
}
function project(v: Vec3, cx: number, cy: number, scale: number) {
  return { x: cx + v[0] * scale, y: cy - v[1] * scale };
}
function faceAvgZ(face: number[], verts: Vec3[]): number {
  return face.reduce((s, i) => s + verts[i][2], 0) / face.length;
}
function faceNormal(face: number[], verts: Vec3[]): Vec3 {
  const a = verts[face[0]], b = verts[face[1]], c = verts[face[2]];
  const u: Vec3 = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
  const w: Vec3 = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
  const n: Vec3 = [u[1]*w[2]-u[2]*w[1], u[2]*w[0]-u[0]*w[2], u[0]*w[1]-u[1]*w[0]];
  const len = Math.sqrt(n[0]**2 + n[1]**2 + n[2]**2);
  return len < 1e-9 ? [0, 0, 1] : [n[0]/len, n[1]/len, n[2]/len];
}
const LIGHT: Vec3 = [0.577, 0.577, 0.577];
function lightness(n: Vec3): number {
  return 0.3 + 0.7 * Math.max(0, n[0]*LIGHT[0] + n[1]*LIGHT[1] + n[2]*LIGHT[2]);
}
function facesToEdges(faces: number[][]): [number, number][] {
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
function makePrismVerts(n: number): Vec3[] {
  const v: Vec3[] = [];
  for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n - Math.PI/2; v.push([Math.cos(a), Math.sin(a), 1]); }
  for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n - Math.PI/2; v.push([Math.cos(a), Math.sin(a), -1]); }
  return v;
}
function makePrismFaces(n: number): number[][] {
  const f: number[][] = [];
  f.push(Array.from({length: n}, (_, i) => i));
  f.push(Array.from({length: n}, (_, i) => n + (n-1-i)));
  for (let i = 0; i < n; i++) { const j = (i+1)%n; f.push([i, j, n+j, n+i]); }
  return f;
}
function makeAntiprismVerts(n: number): Vec3[] {
  const v: Vec3[] = [];
  for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n - Math.PI/2; v.push([Math.cos(a), Math.sin(a), 1]); }
  for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n - Math.PI/2 + Math.PI/n; v.push([Math.cos(a), Math.sin(a), -1]); }
  return v;
}
function makeAntiprismFaces(n: number): number[][] {
  const f: number[][] = [];
  f.push(Array.from({length: n}, (_, i) => i));
  f.push(Array.from({length: n}, (_, i) => n+i));
  for (let i = 0; i < n; i++) { const j = (i+1)%n; f.push([i, j, n+i]); f.push([j, n+j, n+i]); }
  return f;
}
function makePyramidVerts(n: number): Vec3[] {
  const v: Vec3[] = [];
  for (let i = 0; i < n; i++) { const a = 2*Math.PI*i/n - Math.PI/2; v.push([Math.cos(a), Math.sin(a), -0.6]); }
  v.push([0, 0, 1.2]);
  return v;
}
function makePyramidFaces(n: number): number[][] {
  const f: number[][] = [Array.from({length: n}, (_, i) => n-1-i)];
  for (let i = 0; i < n; i++) { const j = (i+1)%n; f.push([i, j, n]); }
  return f;
}

// ─── Solid definitions ────────────────────────────────────────────────────────
interface CurriculumRef {
  primary?: string[];
  gymnasium?: string[];
  vocational?: string[];
}
interface SolidDef {
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

const SOLIDS: SolidDef[] = [
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

// ─── Category config ──────────────────────────────────────────────────────────
const CAT_CONFIG = {
  platonic:   { label: 'Платонски',   bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-300',  rgb: '99,102,241'  },
  archimedean:{ label: 'Архимедски',  bg: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-300',  rgb: '139,92,246'  },
  prism:      { label: 'Призми',      bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', rgb: '16,185,129'  },
  antiprism:  { label: 'Антипризми',  bg: 'bg-teal-100',    text: 'text-teal-700',    border: 'border-teal-300',    rgb: '20,184,166'  },
  pyramid:    { label: 'Пирамиди',    bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   rgb: '245,158,11'  },
};

// ─── Curriculum badge ─────────────────────────────────────────────────────────
function CurriculumBadges({ cur }: { cur: CurriculumRef }) {
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {cur.primary?.map(p => (
        <span key={p} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН {p} одд.</span>
      ))}
      {cur.gymnasium?.map(g => (
        <span key={g} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">Гимн. {g}</span>
      ))}
      {cur.vocational?.map(v => (
        <span key={v} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">{v}</span>
      ))}
    </div>
  );
}

// ─── PolyhedraExplorer ────────────────────────────────────────────────────────
type Category = 'all' | SolidDef['category'];

function PolyhedraExplorer() {
  const [cat, setCat]   = useState<Category>('all');
  const [selId, setSelId] = useState('cube');
  const [angleX, setAngleX] = useState(0.5);
  const [angleY, setAngleY] = useState(-0.4);
  const [showWire, setShowWire] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const svgRef  = useRef<SVGSVGElement>(null);

  const solid = SOLIDS.find(s => s.id === selId) ?? SOLIDS[0];
  const filtered = cat === 'all' ? SOLIDS : SOLIDS.filter(s => s.category === cat);

  const onMouseDown = useCallback((e: React.MouseEvent) => { dragRef.current = { x: e.clientX, y: e.clientY }; }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x, dy = e.clientY - dragRef.current.y;
    setAngleY(a => a + dx * 0.012); setAngleX(a => a + dy * 0.012);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);
  const onTouchStart = useCallback((e: React.TouchEvent) => { dragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, []);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current) return;
    const dx = e.touches[0].clientX - dragRef.current.x, dy = e.touches[0].clientY - dragRef.current.y;
    setAngleY(a => a + dx * 0.012); setAngleX(a => a + dy * 0.012);
    dragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    e.preventDefault();
  }, []);

  const { projVerts, sortedFaces } = useMemo(() => {
    const rotated = solid.vertices.map(v => rotateY(rotateX(v, angleX), angleY));
    const cx = 160, cy = 155, scale = 110;
    const projVerts = rotated.map(v => project(v, cx, cy, scale));
    const sortedFaces = [...solid.faces]
      .map((f, i) => ({ f, i, z: faceAvgZ(f, rotated), norm: faceNormal(f, rotated) }))
      .sort((a, b) => a.z - b.z);
    return { projVerts, sortedFaces, rotated };
  }, [solid, angleX, angleY]);

  const catCfg = CAT_CONFIG[solid.category];
  const euler = solid.V - solid.E + solid.F;

  const CATS: { id: Category; label: string }[] = [
    { id: 'all',        label: 'Сите' },
    { id: 'platonic',   label: 'Платонски' },
    { id: 'archimedean',label: 'Архимедски' },
    { id: 'prism',      label: 'Призми' },
    { id: 'antiprism',  label: 'Антипризми' },
    { id: 'pyramid',    label: 'Пирамиди' },
  ];

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex gap-1.5 flex-wrap">
        {CATS.map(c => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${cat === c.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Solid selector grid */}
      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
        {filtered.map(s => {
          const cc = CAT_CONFIG[s.category];
          return (
            <button key={s.id} type="button" onClick={() => setSelId(s.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${selId === s.id ? `${cc.bg} ${cc.text} ${cc.border} border-2` : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
              {s.name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* 3D Canvas */}
        <div className="space-y-2">
          <div className={`rounded-2xl border-2 ${catCfg.border} overflow-hidden bg-gradient-to-br from-slate-50 to-white cursor-grab active:cursor-grabbing select-none`}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}>
            <svg ref={svgRef} viewBox="0 0 320 310" className="w-full" style={{ maxHeight: 310 }}>
              {/* Faces */}
              {sortedFaces.map(({ f, i, norm }) => {
                const pts = f.map(vi => `${projVerts[vi].x.toFixed(1)},${projVerts[vi].y.toFixed(1)}`).join(' ');
                const L = lightness(norm);
                const [r,g,b] = catCfg.rgb.split(',').map(Number);
                const fill = showWire ? 'none' : `rgba(${Math.round(r*L)},${Math.round(g*L)},${Math.round(b*L)},0.85)`;
                return <polygon key={i} points={pts} fill={fill} stroke="white" strokeWidth={showWire ? 1 : 0.8} strokeOpacity={0.6} />;
              })}
              {/* Edges (always shown in wireframe mode) */}
              {showWire && solid.edges.map(([a, b], i) => (
                <line key={i} x1={projVerts[a].x} y1={projVerts[a].y} x2={projVerts[b].x} y2={projVerts[b].y}
                  stroke={`rgb(${catCfg.rgb})`} strokeWidth={1.5} />
              ))}
              {/* Hint */}
              <text x={160} y={298} textAnchor="middle" fontSize={10} fill="#9ca3af">↕↔ влечи за ротација</text>
            </svg>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAngleX(0.5); setAngleY(-0.4); }}
              className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              Ресетирај
            </button>
            <button type="button" onClick={() => setShowWire(w => !w)}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${showWire ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {showWire ? 'Жичен модел ✓' : 'Жичен модел'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <div className={`rounded-xl p-3 border ${catCfg.border} ${catCfg.bg}`}>
            <p className={`text-xs font-bold uppercase tracking-wide ${catCfg.text} mb-0.5`}>{catCfg.label}</p>
            <h3 className="text-lg font-extrabold text-gray-800">{solid.name}</h3>
            <p className="text-xs text-gray-500 italic">{solid.nameEn}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Темиња V', val: solid.V, color: 'text-indigo-700' },
              { label: 'Рабови E', val: solid.E, color: 'text-emerald-700' },
              { label: 'Лица F',   val: solid.F, color: 'text-amber-700' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                <p className="text-[10px] text-gray-400 font-semibold uppercase">{label}</p>
                <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          <div className={`rounded-xl border p-3 text-center ${euler === 2 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs font-semibold text-gray-500">Ојлерова формула</p>
            <p className={`text-base font-extrabold ${euler === 2 ? 'text-green-700' : 'text-red-600'}`}>
              V − E + F = {solid.V} − {solid.E} + {solid.F} = <span className="text-xl">{euler}</span>
              {euler === 2 ? ' ✓' : ' ✗'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Волумен</p>
              <p className="text-sm font-bold text-gray-700 mt-0.5 font-mono">{solid.volumeFormula}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] text-gray-400 font-semibold uppercase">Плоштина</p>
              <p className="text-sm font-bold text-gray-700 mt-0.5 font-mono">{solid.surfaceFormula}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs text-amber-800"><span className="font-bold">Знаеш ли?</span> {solid.funFact}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Наставна програма</p>
            <CurriculumBadges cur={solid.curriculum} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PlansElevations ──────────────────────────────────────────────────────────
function PlansElevations() {
  const [selId, setSelId] = useState('cube');
  const [angleY, setAngleY] = useState(0);
  const solid = SOLIDS.find(s => s.id === selId) ?? SOLIDS[0];

  const rotatedVerts = useMemo(() =>
    solid.vertices.map(v => rotateY(v, angleY)),
    [solid, angleY]
  );

  function ProjectionPanel({ title, note, proj }: {
    title: string; note: string;
    proj: (v: Vec3) => { x: number; y: number };
  }) {
    const pts = rotatedVerts.map(proj);
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const margin = 0.4;
    const xMin = Math.min(...xs)-margin, xMax = Math.max(...xs)+margin;
    const yMin = Math.min(...ys)-margin, yMax = Math.max(...ys)+margin;
    const W = 160, H = 160;
    const scaleX = W * 0.8 / (xMax - xMin || 1);
    const scaleY = H * 0.8 / (yMax - yMin || 1);
    const sc = Math.min(scaleX, scaleY);
    const cx = W/2 - ((xMin+xMax)/2)*sc;
    const cy = H/2 + ((yMin+yMax)/2)*sc;

    return (
      <div className="flex flex-col items-center gap-1">
        <p className="text-xs font-bold text-gray-600">{title}</p>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
            <rect x={0} y={0} width={W} height={H} fill="#f9fafb" />
            {/* axis lines */}
            <line x1={W/2} y1={4} x2={W/2} y2={H-4} stroke="#e5e7eb" strokeWidth={1} />
            <line x1={4} y1={H/2} x2={W-4} y2={H/2} stroke="#e5e7eb" strokeWidth={1} />
            {/* edges */}
            {solid.edges.map(([a, b], i) => {
              const pa = pts[a], pb = pts[b];
              return (
                <line key={i}
                  x1={cx + pa.x*sc} y1={cy - pa.y*sc}
                  x2={cx + pb.x*sc} y2={cy - pb.y*sc}
                  stroke="#4f46e5" strokeWidth={1.8} strokeLinecap="round" />
              );
            })}
            {/* vertices */}
            {pts.map((p, i) => (
              <circle key={i} cx={cx + p.x*sc} cy={cy - p.y*sc} r={2.5} fill="#6366f1" />
            ))}
          </svg>
        </div>
        <p className="text-[10px] text-gray-400">{note}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
        <p className="text-xs text-purple-800">
          <span className="font-bold">МОН програма:</span> Планови и елевации — VII–IX одделение (МОН) ·
          Нацртна геометрија — Гимназија XI изборен · Стручни насоки (градежништво, машинство)
        </p>
      </div>

      {/* Solid selector */}
      <div className="flex flex-wrap gap-1.5">
        {SOLIDS.map(s => {
          const cc = CAT_CONFIG[s.category];
          return (
            <button key={s.id} type="button" onClick={() => setSelId(s.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${selId === s.id ? `${cc.bg} ${cc.text} ${cc.border} border-2` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              {s.name}
            </button>
          );
        })}
      </div>

      {/* Rotation slider */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-500 w-28">Ротација Y-оска</label>
        <input type="range" min={-Math.PI} max={Math.PI} step={0.05} value={angleY}
          onChange={e => setAngleY(parseFloat(e.target.value))}
          className="flex-1 accent-indigo-600" aria-label="ротација" />
        <span className="text-xs font-bold text-indigo-700 w-14 text-right">{(angleY * 180 / Math.PI).toFixed(0)}°</span>
      </div>

      {/* Three projection panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ProjectionPanel title="Поглед одпред (Front)" note="проекција XY · гледаме од +Z"
          proj={v => ({ x: v[0], y: v[1] })} />
        <ProjectionPanel title="Поглед одстрана (Side)" note="проекција ZY · гледаме од +X"
          proj={v => ({ x: v[2], y: v[1] })} />
        <ProjectionPanel title="Поглед одозгора (Top / Plan)" note="проекција XZ · гледаме од +Y"
          proj={v => ({ x: v[0], y: -v[2] })} />
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800">
        <strong>Принцип:</strong> Секој поглед го испушта едниот координатен правец.
        Front гледа кон XY, Side кон ZY, Top кон XZ (план).
        Во нацртната геометрија ова е основа на ортогоналното проектирање.
      </div>
    </div>
  );
}

// ─── NetsExplorer ─────────────────────────────────────────────────────────────
interface NetFace { points: string; color: string; label: string; textX: number; textY: number; }
interface NetDef { id: string; name: string; faces: NetFace[]; viewBox: string; curriculum: CurriculumRef; }

const NETS: NetDef[] = [
  {
    id: 'cube', name: 'Куба — Мрежа (крст)',
    viewBox: '0 0 280 230',
    curriculum: { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.','Стручно III год.'] },
    faces: [
      { points: '95,10 155,10 155,65 95,65',   color: '#818cf8', label: 'Горе',    textX:125, textY:41 },
      { points: '35,70 95,70 95,125 35,125',   color: '#34d399', label: 'Лево',    textX: 65, textY:101 },
      { points: '95,70 155,70 155,125 95,125', color: '#60a5fa', label: 'Предна',  textX:125, textY:101 },
      { points: '155,70 215,70 215,125 155,125',color:'#f472b6', label: 'Десно',   textX:185, textY:101 },
      { points: '215,70 275,70 275,125 215,125',color:'#fb923c', label: 'Задна',   textX:245, textY:101 },
      { points: '95,130 155,130 155,185 95,185',color:'#facc15', label: 'Долу',    textX:125, textY:161 },
    ],
  },
  {
    id: 'tetra', name: 'Тетраедар — Мрежа',
    viewBox: '0 0 320 260',
    curriculum: { primary:['VII','IX'], gymnasium:['I година'], vocational:['Стручно I год.'] },
    faces: [
      { points: '160,84 120,153 200,153', color: '#f97316', label: 'Дно',   textX:160, textY:135 },
      { points: '160,84 120,153 80,84',   color: '#60a5fa', label: 'Лице 2',textX:120, textY:110 },
      { points: '160,84 200,153 240,84',  color: '#34d399', label: 'Лице 3',textX:200, textY:110 },
      { points: '120,153 200,153 160,222',color: '#f472b6', label: 'Лице 4',textX:160, textY:180 },
    ],
  },
  {
    id: 'sqpyramid', name: 'Четириаголна пирамида — Мрежа',
    viewBox: '0 0 320 300',
    curriculum: { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.','Стручно III год.'] },
    faces: [
      { points: '120,110 200,110 200,190 120,190', color: '#fbbf24', label: 'Основа',  textX:160, textY:153 },
      { points: '120,110 200,110 160,50',           color: '#60a5fa', label: 'Лице 1',  textX:160, textY: 97 },
      { points: '200,110 200,190 265,150',          color: '#34d399', label: 'Лице 2',  textX:228, textY:153 },
      { points: '120,190 200,190 160,250',          color: '#f472b6', label: 'Лице 3',  textX:160, textY:215 },
      { points: '120,110 120,190 55,150',           color: '#f97316', label: 'Лице 4',  textX: 92, textY:153 },
    ],
  },
  {
    id: 'triprism', name: 'Триаголна призма — Мрежа',
    viewBox: '0 0 310 200',
    curriculum: { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.','Стручно III год.'] },
    faces: [
      { points: '30,65 100,65 100,130 30,130',  color: '#60a5fa', label: 'Страна 1', textX: 65, textY:101 },
      { points: '100,65 170,65 170,130 100,130',color: '#34d399', label: 'Страна 2', textX:135, textY:101 },
      { points: '170,65 240,65 240,130 170,130',color: '#f97316', label: 'Страна 3', textX:205, textY:101 },
      { points: '30,65 100,65 65,15',            color: '#818cf8', label: 'База 1',   textX: 65, textY: 52 },
      { points: '30,130 100,130 65,180',         color: '#f472b6', label: 'База 2',   textX: 65, textY:152 },
    ],
  },
  {
    id: 'octa', name: 'Октаедар — Мрежа',
    viewBox: '0 0 340 110',
    curriculum: { primary:['VII','IX'], gymnasium:['I година','XI изборен'], vocational:['Стручно I год.'] },
    faces: [
      { points: '10,90 55,90 32,18',   color: '#818cf8', label: 'F1', textX: 32, textY:68 },
      { points: '55,90 32,18 78,18',   color: '#60a5fa', label: 'F2', textX: 55, textY:50 },
      { points: '55,90 100,90 78,18',  color: '#34d399', label: 'F3', textX: 78, textY:68 },
      { points: '100,90 78,18 123,18', color: '#f97316', label: 'F4', textX:100, textY:50 },
      { points: '100,90 145,90 123,18',color: '#f472b6', label: 'F5', textX:123, textY:68 },
      { points: '145,90 123,18 168,18',color: '#fbbf24', label: 'F6', textX:145, textY:50 },
      { points: '145,90 190,90 168,18',color: '#a78bfa', label: 'F7', textX:168, textY:68 },
      { points: '190,90 168,18 213,18',color: '#fb7185', label: 'F8', textX:190, textY:50 },
    ],
  },
];

function NetsExplorer() {
  const [selId, setSelId] = useState('cube');
  const [showLabels, setShowLabels] = useState(true);
  const net = NETS.find(n => n.id === selId) ?? NETS[0];

  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
        <p className="text-xs text-emerald-800">
          <span className="font-bold">МОН програма:</span> Мрежи на геометриски тела — VII одделение ·
          Стручни насоки (изработка на модели) · Гимназија I година.
          Секоја боја претставува едно лице на телото.
        </p>
      </div>

      {/* Solid selector */}
      <div className="flex flex-wrap gap-2">
        {NETS.map(n => (
          <button key={n.id} type="button" onClick={() => setSelId(n.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition ${selId === n.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300'}`}>
            {n.name.split('—')[0].trim()}
          </button>
        ))}
        <button type="button" onClick={() => setShowLabels(l => !l)}
          className={`ml-auto px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition ${showLabels ? 'border-gray-400 bg-gray-100 text-gray-700' : 'border-gray-200 text-gray-400'}`}>
          {showLabels ? 'Скриј ознаки' : 'Прикажи ознаки'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden p-2">
        <p className="text-xs font-bold text-gray-500 text-center mb-2">{net.name}</p>
        <svg viewBox={net.viewBox} className="w-full" style={{ maxHeight: 260 }}>
          {net.faces.map((face, i) => (
            <g key={i}>
              <polygon points={face.points} fill={face.color} fillOpacity={0.75} stroke="white" strokeWidth={2} />
              {showLabels && (
                <text x={face.textX} y={face.textY} textAnchor="middle" dominantBaseline="middle"
                  fontSize={10} fontWeight="bold" fill="white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {face.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Наставна програма</p>
        <CurriculumBadges cur={net.curriculum} />
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800">
        <strong>Активност:</strong> Отпечати ја мрежата, исечи и склопи 3D модел.
        Провери: колку лица, рабови и темиња има склопеното тело? Дали важи V−E+F=2?
      </div>
    </div>
  );
}

// ─── CrossSections ────────────────────────────────────────────────────────────
type CSolid = 'sphere' | 'cube' | 'pyramid' | 'cone' | 'cylinder';

const CS_SOLID_LIST: { id: CSolid; name: string; color: string }[] = [
  { id: 'sphere',   name: 'Сфера',    color: 'indigo'  },
  { id: 'cube',     name: 'Куба',     color: 'emerald' },
  { id: 'pyramid',  name: 'Пирамида', color: 'amber'   },
  { id: 'cone',     name: 'Конус',    color: 'rose'    },
  { id: 'cylinder', name: 'Цилиндар', color: 'teal'    },
];

const CS_FILL: Record<CSolid, string> = {
  sphere: 'rgba(99,102,241,0.18)', cube: 'rgba(16,185,129,0.18)',
  pyramid: 'rgba(245,158,11,0.18)', cone: 'rgba(244,63,94,0.18)', cylinder: 'rgba(20,184,166,0.18)',
};
const CS_STROKE: Record<CSolid, string> = {
  sphere: '#6366f1', cube: '#10b981', pyramid: '#f59e0b', cone: '#f43f5e', cylinder: '#14b8a6',
};

function CrossSections() {
  const [solid, setSolid] = useState<CSolid>('sphere');
  const [h, setH] = useState(0);

  const SV = 180, sv_cx = 90, sv_cy = 90, sv_r = 70;
  const planeY = sv_cy - h * sv_r;
  const CS_W = 200, cs_cx = 100, cs_cy = 100, cs_sc = 55;

  let csName = '', csArea = 0, csPerim = 0;
  let csType: 'circle' | 'square' | 'point' = 'circle';
  let csR = 0, csSide = 0;

  switch (solid) {
    case 'sphere':
      csR = Math.sqrt(Math.max(0, 1 - h * h));
      csName = `Круг (r = ${csR.toFixed(3)})`;
      csArea = Math.PI * csR * csR; csPerim = 2 * Math.PI * csR; csType = 'circle';
      break;
    case 'cube':
      csSide = 2;
      csName = 'Квадрат (страна = 2)';
      csArea = 4; csPerim = 8; csType = 'square';
      break;
    case 'pyramid':
      csSide = Math.max(0, 1 - h);
      csName = csSide < 0.02 ? 'Точка (теме)' : `Квадрат (стр. = ${csSide.toFixed(3)})`;
      csArea = csSide * csSide; csPerim = 4 * csSide; csType = csSide < 0.02 ? 'point' : 'square';
      break;
    case 'cone':
      csR = Math.max(0, (1 - h) / 2);
      csName = csR < 0.02 ? 'Точка (теме)' : `Круг (r = ${csR.toFixed(3)})`;
      csArea = Math.PI * csR * csR; csPerim = 2 * Math.PI * csR; csType = csR < 0.02 ? 'point' : 'circle';
      break;
    case 'cylinder':
      csR = 1;
      csName = 'Круг (r = 1)';
      csArea = Math.PI; csPerim = 2 * Math.PI; csType = 'circle';
      break;
  }

  const fill = CS_FILL[solid], stroke = CS_STROKE[solid];

  return (
    <div className="space-y-4">
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
        <p className="text-xs text-sky-800">
          <span className="font-bold">МОН програма:</span> Пресечни рамнини — VII–IX одд. ·
          Конични пресеци — Гимн. II год. / XI изборен · Техничко цртање (стручни насоки).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CS_SOLID_LIST.map(({ id, name, color }) => (
          <button key={id} type="button" onClick={() => setSolid(id)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition ${solid===id ? `border-${color}-500 bg-${color}-50 text-${color}-700` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-500 w-28">Висина h</label>
        <input type="range" min={-0.99} max={0.99} step={0.01} value={h}
          onChange={e => setH(parseFloat(e.target.value))}
          className="flex-1 accent-sky-600" aria-label="висина на пресек" />
        <span className="text-xs font-bold text-sky-700 w-14 text-right">{h.toFixed(2)}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold text-gray-500 mb-1 text-center">Странски изглед + пресечна рамнина</p>
          <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
            <svg viewBox={`0 0 ${SV} ${SV}`} className="w-full" style={{ maxHeight: 190 }}>
              {solid === 'sphere' && (
                <circle cx={sv_cx} cy={sv_cy} r={sv_r} fill={fill} stroke={stroke} strokeWidth={2}/>
              )}
              {(solid === 'cube' || solid === 'cylinder') && (
                <rect x={sv_cx-sv_r} y={sv_cy-sv_r} width={sv_r*2} height={sv_r*2} fill={fill} stroke={stroke} strokeWidth={2}/>
              )}
              {(solid === 'pyramid' || solid === 'cone') && (
                <polygon points={`${sv_cx},${sv_cy-sv_r} ${sv_cx-sv_r},${sv_cy+sv_r} ${sv_cx+sv_r},${sv_cy+sv_r}`} fill={fill} stroke={stroke} strokeWidth={2}/>
              )}
              <line x1={sv_cx-sv_r-10} y1={planeY} x2={sv_cx+sv_r+10} y2={planeY} stroke="#0ea5e9" strokeWidth={2.5}/>
              <circle cx={sv_cx+sv_r+12} cy={planeY} r={4} fill="#0ea5e9"/>
              <text x={sv_cx-sv_r-6} y={sv_cy-sv_r+3} fontSize={8} fill="#9ca3af" textAnchor="end">+1</text>
              <text x={sv_cx-sv_r-6} y={sv_cy+sv_r+3} fontSize={8} fill="#9ca3af" textAnchor="end">−1</text>
              <text x={sv_cx-sv_r-6} y={planeY+3} fontSize={9} fill="#0ea5e9" textAnchor="end" fontWeight="bold">h</text>
            </svg>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 mb-1 text-center">Добиен пресек (поглед одзгора)</p>
          <div className="bg-white rounded-2xl border-2 border-sky-200 overflow-hidden">
            <svg viewBox={`0 0 ${CS_W} ${CS_W}`} className="w-full" style={{ maxHeight: 190 }}>
              <line x1={cs_cx} y1={10} x2={cs_cx} y2={CS_W-10} stroke="#f1f5f9" strokeWidth={1}/>
              <line x1={10} y1={cs_cy} x2={CS_W-10} y2={cs_cy} stroke="#f1f5f9" strokeWidth={1}/>
              {csType === 'circle' && csR > 0 && (
                <circle cx={cs_cx} cy={cs_cy} r={csR * cs_sc} fill={fill} stroke={stroke} strokeWidth={2.5}/>
              )}
              {csType === 'square' && csSide > 0 && (
                <rect
                  x={cs_cx - (csSide/2)*cs_sc} y={cs_cy - (csSide/2)*cs_sc}
                  width={csSide*cs_sc} height={csSide*cs_sc}
                  fill={fill} stroke={stroke} strokeWidth={2.5}/>
              )}
              {csType === 'point' && <circle cx={cs_cx} cy={cs_cy} r={5} fill={stroke}/>}
              <text x={cs_cx} y={CS_W-8} textAnchor="middle" fontSize={10} fill="#64748b" fontWeight="bold">{csName}</text>
            </svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl p-3 text-center bg-sky-50 border border-sky-200">
          <p className="text-[10px] text-gray-400 font-semibold">Плоштина на пресек</p>
          <p className="text-lg font-extrabold text-sky-700">{csArea.toFixed(4)} ед²</p>
        </div>
        <div className="rounded-xl p-3 text-center bg-sky-50 border border-sky-200">
          <p className="text-[10px] text-gray-400 font-semibold">{csType === 'circle' ? 'Обиколка' : 'Периметар'}</p>
          <p className="text-lg font-extrabold text-sky-700">{csPerim.toFixed(4)} ед</p>
        </div>
      </div>

      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-900 space-y-1">
        <p className="font-bold">Конични пресеци (Conic Sections):</p>
        <p>Хоризонтална рамнина + Конус → <strong>Круг</strong> · Накосена → <strong>Елипса</strong></p>
        <p>Паралелна на страна → <strong>Парабола</strong> · Вертикална → <strong>Хипербола</strong></p>
        <p>Основата на планетарните орбити (Кеплер, 1609) и аналитичката геометрија!</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Наставна програма</p>
        <div className="flex flex-wrap gap-1">
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН VII одд.</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН VIII одд.</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН IX одд.</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">Гимн. II год.</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">Гимн. XI избор.</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">Стручно I год.</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
type GeoTab = 'explorer' | 'plans' | 'nets' | 'cross';

export function Geometry3DLab() {
  const [tab, setTab] = useState<GeoTab>('explorer');

  const TABS: { id: GeoTab; label: string }[] = [
    { id: 'explorer', label: '🧊 Истражувач на полиедри' },
    { id: 'plans',    label: '📐 Планови и проекции' },
    { id: 'nets',     label: '📄 Мрежи (Nets)' },
    { id: 'cross',    label: '✂️ Пресечни рамнини' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${tab === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'explorer' && <PolyhedraExplorer />}
      {tab === 'plans'    && <PlansElevations />}
      {tab === 'nets'     && <NetsExplorer />}
      {tab === 'cross'    && <CrossSections />}
    </div>
  );
}
