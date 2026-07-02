import React, { useState, useRef, useMemo, useCallback } from 'react';
import { type Vec3, type CurriculumRef, type SolidDef, rotateX, rotateY, project, faceAvgZ, faceNormal, LIGHT, lightness, facesToEdges, SOLIDS, CAT_CONFIG, makePrismVerts, makePrismFaces, makePyramidVerts, makePyramidFaces } from './geometry3dMath';

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

const NET_VEF: Record<string, { V: number; E: number; F: number }> = {
  cube:      { V: 8, E: 12, F: 6 },
  tetra:     { V: 4, E: 6,  F: 4 },
  sqpyramid: { V: 5, E: 8,  F: 5 },
  triprism:  { V: 6, E: 9,  F: 5 },
  octa:      { V: 6, E: 12, F: 8 },
};

function NetsExplorer() {
  const [selId, setSelId] = useState('cube');
  const [showLabels, setShowLabels] = useState(true);
  const net = NETS.find(n => n.id === selId) ?? NETS[0];

  function printNet() {
    const vef = NET_VEF[net.id] ?? { V: 0, E: 0, F: 0 };
    const svgFaces = net.faces.map(face =>
      `<polygon points="${face.points}" fill="${face.color}" fill-opacity="0.8" stroke="white" stroke-width="2.5"/>` +
      `<text x="${face.textX}" y="${face.textY}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="bold" fill="white">${face.label}</text>`
    ).join('');
    const euler = vef.V - vef.E + vef.F;
    const html =
      `<!DOCTYPE html><html lang="mk"><head><meta charset="UTF-8"><title>${net.name}</title><style>` +
      `@page{size:A4 portrait;margin:15mm}*{box-sizing:border-box}` +
      `body{font-family:Arial,Helvetica,sans-serif;color:#1a1a2e;margin:0}` +
      `h1{font-size:20px;text-align:center;margin:0 0 4px;color:#1e3a8a}` +
      `.sub{text-align:center;font-size:12px;color:#64748b;margin-bottom:14px}` +
      `svg{display:block;margin:0 auto;width:100%;max-width:460px}` +
      `.instr{margin-top:18px;border:2px dashed #3b82f6;border-radius:8px;padding:12px}` +
      `.instr h2{font-size:14px;color:#1d4ed8;margin:0 0 6px}` +
      `.instr ol{margin:0;padding-left:18px;font-size:12px;line-height:1.8}` +
      `.euler{margin-top:14px;background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:10px;text-align:center}` +
      `.euler h3{font-size:13px;color:#92400e;margin:0 0 6px}` +
      `.vef{display:flex;justify-content:center;align-items:center;gap:16px;margin-top:6px}` +
      `.vi{text-align:center}.vn{font-size:24px;font-weight:bold;color:#1e3a8a}.vl{font-size:10px;color:#64748b}` +
      `.op{font-size:20px;color:#6b7280}.res{font-size:13px;margin-top:8px;color:#92400e}` +
      `@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}` +
      `</style></head><body>` +
      `<h1>${net.name}</h1>` +
      `<div class="sub">✂️ Исечи по надворешниот контур &nbsp;·&nbsp; 📐 Свиткај по внатрешните линии &nbsp;·&nbsp; 🖊️ Залепи</div>` +
      `<svg viewBox="${net.viewBox}">${svgFaces}</svg>` +
      `<div class="instr"><h2>📋 Упатство за склопување:</h2><ol>` +
      `<li>Испечати ја оваа страница (A4 · без скалирање — <strong>„Actual size" / 100%</strong>)</li>` +
      `<li>Исечи ја мрежата по <strong>надворешниот контур</strong></li>` +
      `<li>Свиткај нагоре по секоја <strong>внатрешна линија</strong> помеѓу лицата</li>` +
      `<li>Залепи ги лицата со лепак или двострана лента</li>` +
      `<li>Провери ја добиената форма — знаете ли ги сите нејзини особини?</li>` +
      `</ol></div>` +
      `<div class="euler"><h3>Ојлерова формула: <em>V &minus; E + F = 2</em></h3>` +
      `<div class="vef">` +
      `<div class="vi"><div class="vn">${vef.V}</div><div class="vl">Темиња (V)</div></div>` +
      `<div class="op">&minus;</div>` +
      `<div class="vi"><div class="vn">${vef.E}</div><div class="vl">Рабови (E)</div></div>` +
      `<div class="op">+</div>` +
      `<div class="vi"><div class="vn">${vef.F}</div><div class="vl">Лица (F)</div></div>` +
      `<div class="op">=</div>` +
      `<div class="vi"><div class="vn">${euler}</div><div class="vl">✓</div></div>` +
      `</div><div class="res">${vef.V} &minus; ${vef.E} + ${vef.F} = ${euler} ✓</div></div>` +
      `<script>window.onload=function(){setTimeout(function(){window.print()},300)}<` + `/script>` +
      `</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); }
  }

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
        <button type="button" onClick={printNet}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
          🖨️ Печати мрежа
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

// ─── Prism / Pyramid Calculator ───────────────────────────────────────────────
function PrismPyramidCalculator() {
  const [kind, setKind] = useState<'prism' | 'pyramid'>('prism');
  const [n, setN] = useState(4);
  const [h, setH] = useState(2.0);
  const [R, setR] = useState(1.5);
  const [angX, setAngX] = useState(0.45);
  const [angY, setAngY] = useState(-0.4);
  const dragRef  = useRef<{ x: number; y: number } | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const svgRef   = useRef<SVGSVGElement>(null);

  const CX = 190, CY = 190;
  const SCALE = useMemo(() => Math.min(62, Math.floor(115 / Math.max(R, h * 0.5 + 0.4))), [R, h]);

  const scaledVerts = useMemo<Vec3[]>(() => {
    if (kind === 'prism') {
      return makePrismVerts(n).map(v => [v[0] * R, v[1] * R, v[2] * (h / 2)] as Vec3);
    } else {
      return makePyramidVerts(n).map(v => {
        const zNew = (v[2] + 0.6) / 1.8 * h - h / 2;
        return [v[0] * R, v[1] * R, zNew] as Vec3;
      });
    }
  }, [kind, n, h, R]);

  const faces = useMemo(() => kind === 'prism' ? makePrismFaces(n) : makePyramidFaces(n), [kind, n]);
  const edges = useMemo(() => facesToEdges(faces), [faces]);

  const { sortedFaces, projVerts } = useMemo(() => {
    const rotated = scaledVerts.map(v => rotateX(rotateY(v, angY), angX));
    const sf = [...faces]
      .map((f, i) => ({ f, i, z: faceAvgZ(f, rotated), norm: faceNormal(f, rotated) }))
      .sort((a, b) => a.z - b.z);
    const pv = rotated.map(v => project(v, CX, CY, SCALE));
    return { sortedFaces: sf, projVerts: pv };
  }, [scaledVerts, faces, angX, angY, SCALE]);

  const s       = 2 * R * Math.sin(Math.PI / n);
  const apothem = R * Math.cos(Math.PI / n);
  const B       = 0.5 * n * R * R * Math.sin(2 * Math.PI / n);
  const slantH  = Math.sqrt(h * h + apothem * apothem);
  const vol     = kind === 'prism' ? B * h : B * h / 3;
  const sa      = kind === 'prism' ? n * s * h + 2 * B : n * s * slantH / 2 + B;

  const V_n  = scaledVerts.length;
  const E_n  = edges.length;
  const F_n  = faces.length;
  const euler = V_n - E_n + F_n;

  const rgb    = kind === 'prism' ? '16,185,129' : '245,158,11';
  const [cr, cg, cb] = rgb.split(',').map(Number);
  const catBg  = kind === 'prism' ? 'bg-emerald-50'      : 'bg-amber-50';
  const catBdr = kind === 'prism' ? 'border-emerald-200'  : 'border-amber-200';
  const catTxt = kind === 'prism' ? 'text-emerald-700'    : 'text-amber-700';

  const onMouseDown  = useCallback((e: React.MouseEvent)  => { dragRef.current  = { x: e.clientX, y: e.clientY }; }, []);
  const onMouseMove  = useCallback((e: React.MouseEvent)  => {
    if (!dragRef.current) return;
    setAngY(a => a + (e.clientX - dragRef.current!.x) * 0.013);
    setAngX(a => a + (e.clientY - dragRef.current!.y) * 0.013);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseUp    = useCallback(() => { dragRef.current = null; }, []);
  const onTouchStart = useCallback((e: React.TouchEvent)  => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);
  const onTouchMove  = useCallback((e: React.TouchEvent)  => {
    if (!touchRef.current) return;
    const t = e.touches[0];
    setAngY(a => a + (t.clientX - touchRef.current!.x) * 0.013);
    setAngX(a => a + (t.clientY - touchRef.current!.y) * 0.013);
    touchRef.current = { x: t.clientX, y: t.clientY };
  }, []);
  const onTouchEnd   = useCallback(() => { touchRef.current = null; }, []);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          {(['prism', 'pyramid'] as const).map(k => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`px-4 py-2 text-sm font-bold transition ${
                kind === k
                  ? (k === 'prism' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white')
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}>
              {k === 'prism' ? '⬡ Призма' : '△ Пирамида'}
            </button>
          ))}
        </div>

        <label className="flex flex-col text-xs font-semibold text-gray-600 min-w-[130px]">
          Страни n = {n}
          <input type="range" min={3} max={12} step={1} value={n}
            onChange={e => setN(+e.target.value)} className="mt-1 accent-emerald-600" />
        </label>

        <label className="flex flex-col text-xs font-semibold text-gray-600 min-w-[130px]">
          Висина h = {h.toFixed(1)} ед.
          <input type="range" min={0.5} max={5.0} step={0.1} value={h}
            onChange={e => setH(+e.target.value)} className="mt-1 accent-emerald-600" />
        </label>

        <label className="flex flex-col text-xs font-semibold text-gray-600 min-w-[130px]">
          Полупречник R = {R.toFixed(1)} ед.
          <input type="range" min={0.5} max={3.0} step={0.1} value={R}
            onChange={e => setR(+e.target.value)} className="mt-1 accent-emerald-600" />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-5">
        {/* 3D Canvas */}
        <div className="space-y-2">
          <div className={`rounded-2xl border-2 ${catBdr} overflow-hidden bg-gradient-to-br from-slate-50 to-white cursor-grab active:cursor-grabbing select-none`}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
            <svg ref={svgRef} viewBox="0 0 380 380" className="w-full max-h-[380px]">
              {sortedFaces.map(({ f, i, norm }) => {
                const pts  = f.map(vi => `${projVerts[vi].x.toFixed(1)},${projVerts[vi].y.toFixed(1)}`).join(' ');
                const L    = lightness(norm);
                const fill = `rgba(${Math.round(cr*L)},${Math.round(cg*L)},${Math.round(cb*L)},0.88)`;
                return <polygon key={i} points={pts} fill={fill} stroke="white" strokeWidth={0.8} strokeOpacity={0.7} />;
              })}
              {edges.map(([a, b], i) => (
                <line key={i}
                  x1={projVerts[a].x.toFixed(1)} y1={projVerts[a].y.toFixed(1)}
                  x2={projVerts[b].x.toFixed(1)} y2={projVerts[b].y.toFixed(1)}
                  stroke={`rgb(${rgb})`} strokeWidth={1.2} opacity={0.4} />
              ))}
              <text x={190} y={372} textAnchor="middle" fontSize={10} fill="#9ca3af">↕↔ влечи за ротација</text>
            </svg>
          </div>
          <button type="button"
            onClick={() => { setAngX(0.45); setAngY(-0.4); }}
            className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            Ресетирај поглед
          </button>
        </div>

        {/* Stats */}
        <div className="space-y-4">
          {/* Name */}
          <div className={`rounded-xl border-2 p-4 ${catBg} ${catBdr}`}>
            <p className={`text-lg font-black ${catTxt}`}>
              {kind === 'prism'
                ? `Правилна ${n}-страна призма`
                : `Правилна ${n}-страна пирамида`}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {kind === 'prism'
                ? `Два правилни ${n}-аголни основи · ${n} правоаголни бочни лица`
                : `Правилна ${n}-аголна основа · ${n} триаголни бочни лица · 1 врв`}
            </p>
          </div>

          {/* V / E / F / Euler */}
          <div className="grid grid-cols-4 gap-2">
            {([['Темиња (V)', V_n], ['Рабови (E)', E_n], ['Лица (F)', F_n]] as [string, number][]).map(([label, val]) => (
              <div key={label} className="rounded-xl bg-gray-50 border border-gray-200 p-2.5 text-center">
                <p className="text-xl font-black text-gray-800">{val}</p>
                <p className="text-[10px] font-bold text-gray-500 leading-tight">{label}</p>
              </div>
            ))}
            <div className={`rounded-xl border p-2.5 text-center ${euler === 2 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-xl font-black ${euler === 2 ? 'text-green-700' : 'text-red-700'}`}>= {euler}</p>
              <p className={`text-[10px] font-bold leading-tight ${euler === 2 ? 'text-green-600' : 'text-red-600'}`}>
                V−E+F {euler === 2 ? '✓' : '✗'}
              </p>
            </div>
          </div>

          {/* Measurements */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Мерки</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Страна s:</span>
                <span className="font-bold text-gray-800">{s.toFixed(3)} ед.</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Апотема:</span>
                <span className="font-bold text-gray-800">{apothem.toFixed(3)} ед.</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">Основа B:</span>
                <span className="font-bold text-gray-800">{B.toFixed(3)} ед²</span>
              </div>
              {kind === 'pyramid' && (
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">Изводница l:</span>
                  <span className="font-bold text-gray-800">{slantH.toFixed(3)} ед.</span>
                </div>
              )}
            </div>
          </div>

          {/* Volume + Surface */}
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl border-2 p-4 text-center ${catBg} ${catBdr}`}>
              <p className={`text-2xl font-black ${catTxt}`}>{vol.toFixed(3)}</p>
              <p className="text-xs font-bold text-gray-600">Волумен</p>
              <p className={`text-[11px] font-semibold mt-1 ${catTxt}`}>
                {kind === 'prism' ? 'V = B · h' : 'V = B · h / 3'}
              </p>
            </div>
            <div className={`rounded-xl border-2 p-4 text-center ${catBg} ${catBdr}`}>
              <p className={`text-2xl font-black ${catTxt}`}>{sa.toFixed(3)}</p>
              <p className="text-xs font-bold text-gray-600">Површина</p>
              <p className={`text-[11px] font-semibold mt-1 ${catTxt}`}>
                {kind === 'prism' ? 'S = n·s·h + 2B' : 'S = n·s·l/2 + B'}
              </p>
            </div>
          </div>

          {/* Curriculum */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Наставна програма</p>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН VII одд.</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН VIII одд.</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">Гимн. I год.</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">Стручно I–III год.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
type GeoTab = 'explorer' | 'plans' | 'nets' | 'cross' | 'prispyram';

export function Geometry3DLab() {
  const [tab, setTab] = useState<GeoTab>('explorer');

  const TABS: { id: GeoTab; label: string }[] = [
    { id: 'explorer',  label: '🧊 Истражувач на полиедри' },
    { id: 'plans',     label: '📐 Планови и проекции' },
    { id: 'nets',      label: '📄 Мрежи (Nets)' },
    { id: 'cross',     label: '✂️ Пресечни рамнини' },
    { id: 'prispyram', label: '⬡ Призма / Пирамида' },
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

      {tab === 'explorer'  && <PolyhedraExplorer />}
      {tab === 'plans'     && <PlansElevations />}
      {tab === 'nets'      && <NetsExplorer />}
      {tab === 'cross'     && <CrossSections />}
      {tab === 'prispyram' && <PrismPyramidCalculator />}
    </div>
  );
}
