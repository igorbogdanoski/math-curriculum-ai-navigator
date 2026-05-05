import React, { useState, useRef, useMemo, useCallback } from 'react';

// ─── Math helpers ─────────────────────────────────────────────────────────────
type Pt = [number, number];

function dist(a: Pt, b: Pt): number {
  return Math.sqrt((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2);
}
function angleDeg(a: Pt, vertex: Pt, b: Pt): number {
  const ua = [a[0] - vertex[0], a[1] - vertex[1]];
  const ub = [b[0] - vertex[0], b[1] - vertex[1]];
  const dot = ua[0] * ub[0] + ua[1] * ub[1];
  const mag = Math.sqrt(ua[0] ** 2 + ua[1] ** 2) * Math.sqrt(ub[0] ** 2 + ub[1] ** 2);
  if (mag < 1e-9) return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180 / Math.PI;
}
function triArea(pts: Pt[]): number {
  const [A, B, C] = pts;
  return Math.abs((B[0] - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (B[1] - A[1])) / 2;
}
function foot(p: Pt, a: Pt, b: Pt): Pt {
  const ab = [b[0] - a[0], b[1] - a[1]];
  const ap = [p[0] - a[0], p[1] - a[1]];
  const denom = ab[0] ** 2 + ab[1] ** 2;
  if (denom < 1e-9) return a;
  const t = (ap[0] * ab[0] + ap[1] * ab[1]) / denom;
  return [a[0] + t * ab[0], a[1] + t * ab[1]];
}
function midpoint(a: Pt, b: Pt): Pt { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function fmtNum(n: number, dec = 1): string { return isFinite(n) ? n.toFixed(dec) : '—'; }

// ─── Shared curriculum badge ──────────────────────────────────────────────────
interface CurRef { primary?: string[]; gymnasium?: string[]; vocational?: string[]; }
function CurrBadges({ cur }: { cur: CurRef }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {cur.primary?.map(p => <span key={p} className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">МОН {p} одд.</span>)}
      {cur.gymnasium?.map(g => <span key={g} className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">Гимн. {g}</span>)}
      {cur.vocational?.map(v => <span key={v} className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">{v}</span>)}
    </div>
  );
}

// ─── Triangle Explorer ────────────────────────────────────────────────────────
const TRIANGLE_CUR: CurRef = {
  primary: ['V', 'VI', 'VII', 'VIII'],
  gymnasium: ['I год.'],
  vocational: ['Стручно I год.', 'Стручно II год.', 'Стручно III год.'],
};

const PRESETS: { name: string; pts: Pt[] }[] = [
  { name: 'Рамностран',  pts: [[200,300],[360,300],[280,162]] },
  { name: 'Правоаголен 3-4-5', pts: [[100,300],[220,300],[100,140]] },
  { name: 'Рамнокрак',   pts: [[200,300],[340,300],[270,150]] },
  { name: 'Тапоаголен',  pts: [[80,300],[380,300],[120,200]] },
];

type TriToggle = 'none' | 'heights' | 'medians' | 'bisectors';

function TriangleExplorer() {
  const [pts, setPts] = useState<Pt[]>([[200, 300], [360, 300], [280, 162]]);
  const [toggle, setToggle] = useState<TriToggle>('none');
  const dragging = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getSVGPt = useCallback((e: React.MouseEvent | React.TouchEvent): Pt => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = 420 / rect.width;
    const scaleY = 360 / rect.height;
    return [
      clamp((clientX - rect.left) * scaleX, 10, 410),
      clamp((clientY - rect.top) * scaleY, 10, 350),
    ];
  }, []);

  const onDown = useCallback((i: number) => (e: React.MouseEvent<SVGCircleElement>) => {
    dragging.current = i; e.preventDefault();
  }, []);
  const onTouchStart = useCallback((i: number) => (e: React.TouchEvent<SVGCircleElement>) => {
    dragging.current = i; e.preventDefault();
  }, []);
  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging.current === null) return;
    const p = getSVGPt(e);
    setPts(prev => prev.map((pt, i) => i === dragging.current ? p : pt) as Pt[]);
  }, [getSVGPt]);
  const onTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (dragging.current === null) return;
    const p = getSVGPt(e);
    setPts(prev => prev.map((pt, i) => i === dragging.current ? p : pt) as Pt[]);
    e.preventDefault();
  }, [getSVGPt]);
  const onUp = useCallback(() => { dragging.current = null; }, []);

  const [A, B, C] = pts;
  const sideA = dist(B, C);
  const sideB = dist(A, C);
  const sideC = dist(A, B);
  const angA = angleDeg(B, A, C);
  const angB = angleDeg(A, B, C);
  const angC = angleDeg(A, C, B);
  const perim = sideA + sideB + sideC;
  const areaVal = triArea(pts);
  const valid = sideA + sideB > sideC && sideB + sideC > sideA && sideA + sideC > sideB && areaVal > 1;

  const triangleType = useMemo(() => {
    if (!valid) return 'Невалиден триаголник';
    const maxAng = Math.max(angA, angB, angC);
    const shape = (Math.abs(sideA - sideB) < 2 && Math.abs(sideB - sideC) < 2) ? 'Рамностран'
      : (Math.abs(sideA - sideB) < 2 || Math.abs(sideB - sideC) < 2 || Math.abs(sideA - sideC) < 2) ? 'Рамнокрак'
      : 'Разностран';
    const angle = Math.abs(maxAng - 90) < 1.5 ? 'Правоаголен'
      : maxAng > 90 ? 'Тапоаголен' : 'Остроаголен';
    return `${angle} · ${shape}`;
  }, [angA, angB, angC, sideA, sideB, sideC, valid]);

  const ptsStr = `${A[0]},${A[1]} ${B[0]},${B[1]} ${C[0]},${C[1]}`;

  // Altitudes
  const footA = foot(A, B, C);
  const footB = foot(B, A, C);
  const footC = foot(C, A, B);
  // Medians
  const midA = midpoint(B, C);
  const midB = midpoint(A, C);
  const midC = midpoint(A, B);
  // Angle bisector endpoints (approximate — extend from vertex through incenter direction)
  const centroid: Pt = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];

  const TOGGLES: { id: TriToggle; label: string }[] = [
    { id: 'none',      label: 'Основно' },
    { id: 'heights',   label: 'Висини' },
    { id: 'medians',   label: 'Медијани' },
    { id: 'bisectors', label: 'Симетрали' },
  ];

  return (
    <div className="space-y-4">
      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button key={p.name} type="button" onClick={() => setPts(p.pts)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition">
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        {/* SVG Canvas */}
        <div className="space-y-2">
          <div className={`rounded-2xl border-2 overflow-hidden select-none cursor-crosshair ${valid ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-white' : 'border-red-300 bg-red-50'}`}>
            <svg ref={svgRef} viewBox="0 0 420 360" className="w-full touch-none"
              onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
              onTouchMove={onTouchMove} onTouchEnd={onUp}>
              {/* Grid */}
              {Array.from({ length: 7 }, (_, i) => (i + 1) * 60).map(x => (
                <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={360} stroke="#f1f5f9" strokeWidth={1} />
              ))}
              {Array.from({ length: 5 }, (_, i) => (i + 1) * 60).map(y => (
                <line key={`gy${y}`} x1={0} y1={y} x2={420} y2={y} stroke="#f1f5f9" strokeWidth={1} />
              ))}

              {/* Triangle fill */}
              {valid && <polygon points={ptsStr} fill="rgba(99,102,241,0.12)" stroke="none" />}

              {/* Toggle overlays */}
              {toggle === 'heights' && valid && (
                <>
                  {([[A, footA], [B, footB], [C, footC]] as [Pt, Pt][]).map(([v, f], i) => (
                    <g key={i}>
                      <line x1={v[0]} y1={v[1]} x2={f[0]} y2={f[1]} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" />
                      <circle cx={f[0]} cy={f[1]} r={3} fill="#f59e0b" opacity={0.7} />
                    </g>
                  ))}
                </>
              )}
              {toggle === 'medians' && valid && (
                <>
                  {([[A, midA], [B, midB], [C, midC]] as [Pt, Pt][]).map(([v, m], i) => (
                    <g key={i}>
                      <line x1={v[0]} y1={v[1]} x2={m[0]} y2={m[1]} stroke="#10b981" strokeWidth={1.5} strokeDasharray="5 3" />
                      <circle cx={m[0]} cy={m[1]} r={3} fill="#10b981" />
                    </g>
                  ))}
                  <circle cx={centroid[0]} cy={centroid[1]} r={5} fill="#10b981" stroke="white" strokeWidth={1.5} />
                </>
              )}
              {toggle === 'bisectors' && valid && (
                <>
                  {([A, B, C] as Pt[]).map((v, i) => (
                    <line key={i} x1={v[0]} y1={v[1]} x2={centroid[0]} y2={centroid[1]}
                      stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="5 3" />
                  ))}
                  <circle cx={centroid[0]} cy={centroid[1]} r={5} fill="#8b5cf6" stroke="white" strokeWidth={1.5} />
                </>
              )}

              {/* Triangle edges */}
              <polygon points={ptsStr} fill="none"
                stroke={valid ? '#6366f1' : '#ef4444'} strokeWidth={2.5} strokeLinejoin="round" />

              {/* Angle arcs */}
              {valid && [
                { v: A, ang: angA, color: '#ef4444' },
                { v: B, ang: angB, color: '#10b981' },
                { v: C, ang: angC, color: '#f59e0b' },
              ].map(({ v, ang, color }, i) => (
                <text key={i} x={v[0] + (i === 0 ? 10 : i === 1 ? -32 : 6)}
                  y={v[1] + (i < 2 ? -8 : 14)}
                  fontSize={10} fontWeight="bold" fill={color}>
                  {fmtNum(ang)}°
                </text>
              ))}

              {/* Side labels */}
              {valid && (
                <>
                  <text x={(B[0] + C[0]) / 2 + 8} y={(B[1] + C[1]) / 2} fontSize={10} fill="#6366f1" fontWeight="bold">a={fmtNum(sideA / 30)}</text>
                  <text x={(A[0] + C[0]) / 2 - 36} y={(A[1] + C[1]) / 2} fontSize={10} fill="#6366f1" fontWeight="bold">b={fmtNum(sideB / 30)}</text>
                  <text x={(A[0] + B[0]) / 2 - 12} y={(A[1] + B[1]) / 2 + 14} fontSize={10} fill="#6366f1" fontWeight="bold">c={fmtNum(sideC / 30)}</text>
                </>
              )}

              {/* Draggable vertices */}
              {(['A', 'B', 'C'] as const).map((label, i) => (
                <g key={label}>
                  <circle cx={pts[i][0]} cy={pts[i][1]} r={14} fill="transparent" style={{ cursor: 'grab' }}
                    onMouseDown={onDown(i)} onTouchStart={onTouchStart(i)} />
                  <circle cx={pts[i][0]} cy={pts[i][1]} r={7}
                    fill={['#ef4444', '#10b981', '#f59e0b'][i]} stroke="white" strokeWidth={2} style={{ pointerEvents: 'none' }} />
                  <text x={pts[i][0]} y={pts[i][1] - 10}
                    textAnchor="middle" fontSize={11} fontWeight="bold"
                    fill={['#ef4444', '#10b981', '#f59e0b'][i]} style={{ pointerEvents: 'none' }}>
                    {label}
                  </text>
                </g>
              ))}

              {!valid && (
                <text x={210} y={340} textAnchor="middle" fontSize={11} fill="#ef4444" fontWeight="bold">
                  Нееднаквост на триаголник не е задоволена!
                </text>
              )}
            </svg>
          </div>

          {/* Toggle buttons */}
          <div className="flex gap-1.5 flex-wrap">
            {TOGGLES.map(t => (
              <button key={t.id} type="button" onClick={() => setToggle(t.id)}
                className={`flex-1 min-w-[80px] px-2 py-1.5 text-xs font-bold rounded-lg border-2 transition ${toggle === t.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <div className={`rounded-xl p-3 border text-center ${valid ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs text-gray-500 font-semibold uppercase">Тип</p>
            <p className={`text-base font-extrabold mt-0.5 ${valid ? 'text-indigo-700' : 'text-red-600'}`}>{triangleType}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Страна a',    val: fmtNum(sideA / 30), unit: 'ед.', color: 'text-indigo-700' },
              { label: 'Страна b',    val: fmtNum(sideB / 30), unit: 'ед.', color: 'text-indigo-700' },
              { label: 'Страна c',    val: fmtNum(sideC / 30), unit: 'ед.', color: 'text-indigo-700' },
              { label: 'Периметар',  val: fmtNum(perim / 30), unit: 'ед.', color: 'text-emerald-700' },
              { label: 'Плоштина',   val: fmtNum(areaVal / 900), unit: 'ед²', color: 'text-amber-700' },
              { label: '∠A + ∠B + ∠C', val: fmtNum(angA + angB + angC, 0), unit: '°', color: 'text-rose-700' },
            ].map(({ label, val, unit, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-2.5 text-center">
                <p className="text-[10px] text-gray-400 font-semibold">{label}</p>
                <p className={`text-lg font-extrabold ${color}`}>{val} <span className="text-xs font-normal">{unit}</span></p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '∠A', val: fmtNum(angA, 1) + '°', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
              { label: '∠B', val: fmtNum(angB, 1) + '°', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
              { label: '∠C', val: fmtNum(angC, 1) + '°', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
            ].map(({ label, val, bg, text, border }) => (
              <div key={label} className={`rounded-xl border p-2.5 text-center ${bg} ${border}`}>
                <p className="text-[10px] text-gray-500 font-semibold">{label}</p>
                <p className={`text-xl font-extrabold ${text}`}>{val}</p>
              </div>
            ))}
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800">
            <strong>Теорема:</strong> Збирот на внатрешните агли на секој триаголник е <strong>180°</strong>.<br />
            <strong>Нееднаквост:</strong> a + b &gt; c · b + c &gt; a · a + c &gt; b
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Наставна програма</p>
            <CurrBadges cur={TRIANGLE_CUR} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pythagorean Theorem Lab ──────────────────────────────────────────────────
const PYTH_CUR: CurRef = {
  primary: ['VI', 'VII'],
  gymnasium: ['I год.'],
  vocational: ['Стручно I год.', 'Стручно II год.', 'Стручно III год.'],
};

const SPECIAL = [
  { label: '3-4-5', a: 3, b: 4 },
  { label: '5-12-13', a: 5, b: 12 },
  { label: '8-15-17', a: 8, b: 15 },
  { label: '6-8-10', a: 6, b: 8 },
];

function PythagoreanLab() {
  const [a, setA] = useState(3);
  const [b, setB] = useState(4);
  const [highlight, setHighlight] = useState<'a2' | 'b2' | 'c2' | null>(null);

  const c = Math.sqrt(a * a + b * b);
  const maxLeg = Math.max(a, b);
  // adaptive scale: ensures squares always fit in viewBox 0 0 460 410
  const sc = Math.min(25, 115 / maxLeg);

  // Layout: right angle A at (175, 250), leg a → right, leg b → up
  const ox = 175, oy = 250;
  const B: Pt = [ox + a * sc, oy];
  const C: Pt = [ox, oy - b * sc];

  // Square on a: extends downward
  const sqA = `${ox},${oy} ${B[0]},${oy} ${B[0]},${oy + a * sc} ${ox},${oy + a * sc}`;
  const sqACx = ox + a * sc / 2, sqACy = oy + a * sc / 2;

  // Square on b: extends left
  const sqB = `${ox},${oy} ${ox},${C[1]} ${ox - b * sc},${C[1]} ${ox - b * sc},${oy}`;
  const sqBCx = ox - b * sc / 2, sqBCy = oy - b * sc / 2;

  // Square on hypotenuse: outward perpendicular direction = (b/c, -a/c) * c*sc = (b*sc, -a*sc)
  const hv2: Pt = [C[0] + b * sc, C[1] - a * sc];
  const hv3: Pt = [B[0] + b * sc, B[1] - a * sc];
  const sqC = `${B[0]},${B[1]} ${C[0]},${C[1]} ${hv2[0]},${hv2[1]} ${hv3[0]},${hv3[1]}`;
  const sqCCx = (B[0] + C[0] + hv2[0] + hv3[0]) / 4;
  const sqCCy = (B[1] + C[1] + hv2[1] + hv3[1]) / 4;

  const markSize = Math.min(14, sc * 0.7);
  const rightAngle = `M${ox + markSize},${oy} L${ox + markSize},${oy - markSize} L${ox},${oy - markSize}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <div className="space-y-3">
          {/* a slider */}
          {[
            { label: 'Катета a', val: a, set: setA, color: '#3b82f6' },
            { label: 'Катета b', val: b, set: setB, color: '#10b981' },
          ].map(({ label, val, set, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs font-bold mb-1" style={{ color }}>
                <span>{label}</span><span>{val} ед.</span>
              </div>
              <input type="range" min={1} max={15} step={0.5} value={val}
                onChange={e => set(parseFloat(e.target.value))}
                className="w-full" aria-label={label}
                style={{ accentColor: color }} />
            </div>
          ))}

          {/* Special triangles */}
          <div className="flex flex-wrap gap-1.5">
            {SPECIAL.map(s => (
              <button key={s.label} type="button" onClick={() => { setA(s.a); setB(s.b); }}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition">
                {s.label}
              </button>
            ))}
          </div>

          {/* SVG */}
          <div className="rounded-2xl border-2 border-blue-200 bg-white overflow-hidden">
            <svg viewBox="0 0 460 410" className="w-full">
              {/* Squares */}
              <polygon points={sqA} fill={highlight === 'a2' ? '#3b82f6' : '#bfdbfe'}
                fillOpacity={0.7} stroke="#3b82f6" strokeWidth={1.5}
                onMouseEnter={() => setHighlight('a2')} onMouseLeave={() => setHighlight(null)}
                style={{ cursor: 'pointer' }} />
              <polygon points={sqB} fill={highlight === 'b2' ? '#10b981' : '#a7f3d0'}
                fillOpacity={0.7} stroke="#10b981" strokeWidth={1.5}
                onMouseEnter={() => setHighlight('b2')} onMouseLeave={() => setHighlight(null)}
                style={{ cursor: 'pointer' }} />
              <polygon points={sqC} fill={highlight === 'c2' ? '#f59e0b' : '#fde68a'}
                fillOpacity={0.7} stroke="#f59e0b" strokeWidth={1.5}
                onMouseEnter={() => setHighlight('c2')} onMouseLeave={() => setHighlight(null)}
                style={{ cursor: 'pointer' }} />

              {/* Square labels */}
              <text x={sqACx} y={sqACy} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.max(9, a * sc * 0.3)} fontWeight="bold" fill="#1d4ed8" style={{ pointerEvents: 'none' }}>
                a²={a * a}
              </text>
              <text x={sqBCx} y={sqBCy} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.max(9, b * sc * 0.3)} fontWeight="bold" fill="#065f46" style={{ pointerEvents: 'none' }}>
                b²={b * b}
              </text>
              <text x={sqCCx} y={sqCCy} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.max(9, c * sc * 0.2)} fontWeight="bold" fill="#92400e" style={{ pointerEvents: 'none' }}>
                c²={fmtNum(c * c, 1)}
              </text>

              {/* Triangle */}
              <polygon points={`${ox},${oy} ${B[0]},${B[1]} ${C[0]},${C[1]}`}
                fill="rgba(99,102,241,0.15)" stroke="#6366f1" strokeWidth={2.5} />
              {/* Right angle mark */}
              <path d={rightAngle} fill="none" stroke="#6366f1" strokeWidth={1.5} />

              {/* Leg labels */}
              <text x={(ox + B[0]) / 2} y={oy + 14} textAnchor="middle" fontSize={12} fill="#3b82f6" fontWeight="bold">a = {a}</text>
              <text x={ox - 20} y={(oy + C[1]) / 2} textAnchor="end" fontSize={12} fill="#10b981" fontWeight="bold">b = {b}</text>
              <text x={(B[0] + C[0]) / 2 + 12} y={(B[1] + C[1]) / 2 - 5} fontSize={12} fill="#d97706" fontWeight="bold">c = {fmtNum(c, 2)}</text>
            </svg>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <div className={`rounded-xl p-4 text-center border-2 transition-all ${highlight === 'a2' ? 'border-blue-500 bg-blue-50' : highlight === 'b2' ? 'border-emerald-500 bg-emerald-50' : highlight === 'c2' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
            <p className="text-sm font-bold text-gray-500">Питагорова теорема</p>
            <p className="text-2xl font-extrabold text-gray-800 mt-1 font-mono">a² + b² = c²</p>
            <p className="text-lg font-bold text-indigo-700 mt-2 font-mono">
              {a}² + {b}² = {fmtNum(c * c, 1)}
            </p>
            <p className="text-lg font-bold text-emerald-700 font-mono">
              {a * a} + {b * b} = {fmtNum(c * c, 1)} ✓
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'a (катета)', val: `${a} ед.`,         color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
              { label: 'b (катета)', val: `${b} ед.`,         color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: 'c (хипот.)', val: fmtNum(c, 3) + ' ед.', color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
            ].map(({ label, val, color, bg, border }) => (
              <div key={label} className={`rounded-xl border p-2.5 text-center ${bg} ${border}`}>
                <p className="text-[10px] text-gray-500 font-semibold">{label}</p>
                <p className={`text-base font-extrabold ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 space-y-1">
            <p><strong>Теорема:</strong> Во правоаголен триаголник, квадратот на хипотенузата е еднаков на збирот на квадратите на катетите.</p>
            <p className="font-mono font-bold">c² = a² + b²</p>
            <p><strong>Висина на правоаголен триаголник:</strong> h = (a·b)/c = {fmtNum((a * b) / c, 2)} ед.</p>
            <p><strong>Плоштина:</strong> P = (a·b)/2 = {fmtNum((a * b) / 2, 2)} ед²</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Наставна програма</p>
            <CurrBadges cur={PYTH_CUR} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Circle Explorer ──────────────────────────────────────────────────────────
const CIRCLE_CUR: CurRef = {
  primary: ['VI', 'VII', 'VIII'],
  gymnasium: ['I год.'],
  vocational: ['Стручно I год.', 'Стручно II год.', 'Стручно III год.'],
};

function CircleExplorer() {
  const [r, setR] = useState(3);
  const [sectorDeg, setSectorDeg] = useState(90);
  const [showChord, setShowChord] = useState(false);
  const [showTangent, setShowTangent] = useState(false);
  const [showInscribed, setShowInscribed] = useState(false);

  const cx = 200, cy = 185, scale = 38;
  const rPx = r * scale;
  const circumference = 2 * Math.PI * r;
  const areaCircle = Math.PI * r * r;
  const sectorRad = sectorDeg * Math.PI / 180;
  const arcLen = r * sectorRad;
  const sectorArea = 0.5 * r * r * sectorRad;

  // Sector path
  const sx = cx + rPx * Math.cos(-Math.PI / 2);
  const sy = cy + rPx * Math.sin(-Math.PI / 2);
  const ex = cx + rPx * Math.cos(-Math.PI / 2 + sectorRad);
  const ey = cy + rPx * Math.sin(-Math.PI / 2 + sectorRad);
  const largeArc = sectorDeg > 180 ? 1 : 0;
  const sectorPath = `M${cx},${cy} L${sx},${sy} A${rPx},${rPx} 0 ${largeArc} 1 ${ex},${ey} Z`;

  // Chord (across the sector angle)
  const chordEnd: Pt = [ex, ey];
  const chordStart: Pt = [sx, sy];
  const chordLen = dist(chordStart, chordEnd) / scale;

  // Inscribed angle point (on arc, halfway)
  const inscribedAngleRad = -Math.PI / 2 + sectorRad / 2 + Math.PI;
  const inscPt: Pt = [cx + rPx * Math.cos(inscribedAngleRad), cy + rPx * Math.sin(inscribedAngleRad)];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
        <div className="space-y-3">
          {/* r slider */}
          <div>
            <div className="flex justify-between text-xs font-bold text-rose-600 mb-1">
              <span>Полупречник r</span><span>{r} ед.</span>
            </div>
            <input type="range" min={1} max={5} step={0.25} value={r}
              onChange={e => setR(parseFloat(e.target.value))}
              className="w-full accent-rose-500" aria-label="полупречник" />
          </div>

          {/* Sector slider */}
          <div>
            <div className="flex justify-between text-xs font-bold text-amber-600 mb-1">
              <span>Агол на сектор θ</span><span>{sectorDeg}°</span>
            </div>
            <input type="range" min={10} max={350} step={5} value={sectorDeg}
              onChange={e => setSectorDeg(parseInt(e.target.value))}
              className="w-full accent-amber-500" aria-label="агол" />
          </div>

          {/* Toggles */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: 'Тетива (Chord)', state: showChord, set: setShowChord, color: 'emerald' },
              { label: 'Тангента', state: showTangent, set: setShowTangent, color: 'violet' },
              { label: 'Впишан агол', state: showInscribed, set: setShowInscribed, color: 'sky' },
            ].map(({ label, state, set, color }) => (
              <button key={label} type="button" onClick={() => set(s => !s)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition ${state ? `border-${color}-500 bg-${color}-50 text-${color}-700` : 'border-gray-200 text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* SVG */}
          <div className="rounded-2xl border-2 border-rose-200 bg-white overflow-hidden">
            <svg viewBox="0 0 400 370" className="w-full">
              {/* Sector fill */}
              <path d={sectorPath} fill="rgba(245,158,11,0.25)" stroke="#f59e0b" strokeWidth={1.5} />

              {/* Circle */}
              <circle cx={cx} cy={cy} r={rPx} fill="none" stroke="#f43f5e" strokeWidth={2.5} />

              {/* Diameter */}
              <line x1={cx - rPx} y1={cy} x2={cx + rPx} y2={cy} stroke="#f43f5e" strokeWidth={1} strokeDasharray="4 3" opacity={0.4} />

              {/* Radius line */}
              <line x1={cx} y1={cy} x2={sx} y2={sy} stroke="#f43f5e" strokeWidth={2} />
              <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="#f59e0b" strokeWidth={2} />

              {/* Center */}
              <circle cx={cx} cy={cy} r={4} fill="#f43f5e" />

              {/* Labels */}
              <text x={cx + rPx / 2 + 4} y={cy - 8} fontSize={11} fill="#f43f5e" fontWeight="bold">r = {r}</text>
              <text x={cx - rPx - 4} y={cy + 14} textAnchor="end" fontSize={11} fill="#f43f5e" fontWeight="bold">d = {2 * r}</text>

              {/* Chord */}
              {showChord && (
                <>
                  <line x1={chordStart[0]} y1={chordStart[1]} x2={chordEnd[0]} y2={chordEnd[1]} stroke="#10b981" strokeWidth={2} />
                  <text x={(chordStart[0] + chordEnd[0]) / 2 + 8} y={(chordStart[1] + chordEnd[1]) / 2}
                    fontSize={10} fill="#10b981" fontWeight="bold">хорда={fmtNum(chordLen, 2)}</text>
                </>
              )}

              {/* Tangent at sector start */}
              {showTangent && (
                <>
                  <line x1={sx - 50 * Math.sin(-Math.PI / 2)} y1={sy - 50 * Math.cos(-Math.PI / 2)}
                    x2={sx + 50 * Math.sin(-Math.PI / 2)} y2={sy + 50 * Math.cos(-Math.PI / 2)}
                    stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" />
                  <text x={sx + 5} y={sy - 14} fontSize={10} fill="#8b5cf6" fontWeight="bold">тангента</text>
                </>
              )}

              {/* Inscribed angle */}
              {showInscribed && sectorDeg < 340 && (
                <>
                  <line x1={inscPt[0]} y1={inscPt[1]} x2={chordStart[0]} y2={chordStart[1]} stroke="#0ea5e9" strokeWidth={1.5} />
                  <line x1={inscPt[0]} y1={inscPt[1]} x2={chordEnd[0]} y2={chordEnd[1]} stroke="#0ea5e9" strokeWidth={1.5} />
                  <circle cx={inscPt[0]} cy={inscPt[1]} r={5} fill="#0ea5e9" />
                  <text x={inscPt[0] + 8} y={inscPt[1] - 6} fontSize={10} fill="#0ea5e9" fontWeight="bold">
                    {fmtNum(sectorDeg / 2, 0)}° (½ θ)
                  </text>
                </>
              )}

              {/* Sector angle label */}
              <text x={cx + 16} y={cy + 16} fontSize={11} fill="#d97706" fontWeight="bold">θ={sectorDeg}°</text>
            </svg>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Полупречник r', val: `${r} ед.`,                color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200' },
              { label: 'Дијаметар d',  val: `${2 * r} ед.`,            color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200' },
              { label: 'Обиколка C',   val: fmtNum(circumference, 3) + ' ед.', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
              { label: 'Плоштина S',   val: fmtNum(areaCircle, 3) + ' ед²',   color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: 'Должина на лак', val: fmtNum(arcLen, 3) + ' ед.', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
              { label: 'Плоштина сектор', val: fmtNum(sectorArea, 3) + ' ед²', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
            ].map(({ label, val, color, bg, border }) => (
              <div key={label} className={`rounded-xl border p-2.5 text-center ${bg} ${border}`}>
                <p className="text-[10px] text-gray-500 font-semibold">{label}</p>
                <p className={`text-base font-extrabold ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-900 space-y-1">
            <p className="font-bold text-rose-700">Формули:</p>
            <p className="font-mono">C = 2πr = πd</p>
            <p className="font-mono">S = πr²</p>
            <p className="font-mono">l<sub>лак</sub> = r·θ (θ во радијани)</p>
            <p className="font-mono">S<sub>сектор</sub> = r²·θ/2 = r·l/2</p>
            <p className="font-bold mt-1">Теорема за впишан агол:</p>
            <p>Впишаниот агол е половина од централниот агол врз ист лак.</p>
          </div>

          {showInscribed && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-800">
              <strong>Централен агол:</strong> {sectorDeg}° &nbsp;→&nbsp;
              <strong>Впишан агол:</strong> {fmtNum(sectorDeg / 2, 1)}° (точно половина!)
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Наставна програма</p>
            <CurrBadges cur={CIRCLE_CUR} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Regular Polygons Explorer ────────────────────────────────────────────────
const POLYGON_CUR: CurRef = {
  primary: ['V', 'VI', 'VII', 'VIII'],
  gymnasium: ['I год.'],
  vocational: ['Стручно I год.', 'Стручно II год.'],
};

const POLYGON_NAMES: Record<number, string> = {
  3: 'Триаголник', 4: 'Четириаголник (Квадрат)', 5: 'Петаголник',
  6: 'Шестаголник', 7: 'Седумаголник', 8: 'Осумаголник',
  9: 'Девеотаголник', 10: 'Десетаголник', 11: 'Единаесетаголник', 12: 'Дванаесетаголник',
};

function PolygonsExplorer() {
  const [n, setN] = useState(6);
  const [sideLen, setSideLen] = useState(2);
  const [showAngles, setShowAngles] = useState(true);
  const [showApothem, setShowApothem] = useState(false);

  const interiorAngle = (n - 2) * 180 / n;
  const exteriorAngle = 360 / n;
  const sumAngles = (n - 2) * 180;
  const s = sideLen;
  const apothem = s / (2 * Math.tan(Math.PI / n));
  const perimeter = n * s;
  const area = (n * s * apothem) / 2;

  const cx = 200, cy = 190, R = 130;
  const verts: Pt[] = Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i / n) - Math.PI / 2;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a)];
  });
  const polyPts = verts.map(v => `${v[0].toFixed(1)},${v[1].toFixed(1)}`).join(' ');

  // Apothem: from center to midpoint of first edge
  const apothemEnd: Pt = [(verts[0][0] + verts[1][0]) / 2, (verts[0][1] + verts[1][1]) / 2];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
        <div className="space-y-3">
          {/* n slider */}
          <div>
            <div className="flex justify-between text-xs font-bold text-violet-600 mb-1">
              <span>Број на страни n</span>
              <span>{n} — {POLYGON_NAMES[n] ?? `${n}-аголник`}</span>
            </div>
            <input type="range" min={3} max={12} step={1} value={n}
              onChange={e => setN(parseInt(e.target.value))}
              className="w-full accent-violet-600" aria-label="број на страни" />
          </div>

          {/* Side length */}
          <div>
            <div className="flex justify-between text-xs font-bold text-teal-600 mb-1">
              <span>Должина на страна a</span><span>{sideLen} ед.</span>
            </div>
            <input type="range" min={0.5} max={5} step={0.25} value={sideLen}
              onChange={e => setSideLen(parseFloat(e.target.value))}
              className="w-full accent-teal-600" aria-label="должина" />
          </div>

          <div className="flex gap-2">
            {[
              { label: 'Агли', state: showAngles, set: setShowAngles },
              { label: 'Апотема', state: showApothem, set: setShowApothem },
            ].map(({ label, state, set }) => (
              <button key={label} type="button" onClick={() => set(s => !s)}
                className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition ${state ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-gray-200 text-gray-500'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* SVG */}
          <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white overflow-hidden">
            <svg viewBox="0 0 400 380" className="w-full">
              {/* Circle guide (dashed) */}
              <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e9d5ff" strokeWidth={1.5} strokeDasharray="4 3" />

              {/* Center */}
              <circle cx={cx} cy={cy} r={3} fill="#7c3aed" />

              {/* Radii (thin) */}
              {verts.map((v, i) => (
                <line key={i} x1={cx} y1={cy} x2={v[0]} y2={v[1]} stroke="#ddd6fe" strokeWidth={1} />
              ))}

              {/* Apothem */}
              {showApothem && (
                <>
                  <line x1={cx} y1={cy} x2={apothemEnd[0]} y2={apothemEnd[1]} stroke="#7c3aed" strokeWidth={2} />
                  <circle cx={apothemEnd[0]} cy={apothemEnd[1]} r={3} fill="#7c3aed" />
                  <text x={(cx + apothemEnd[0]) / 2 + 8} y={(cy + apothemEnd[1]) / 2}
                    fontSize={10} fill="#7c3aed" fontWeight="bold">a={fmtNum(apothem * (R / 130), 2)}</text>
                </>
              )}

              {/* Polygon */}
              <polygon points={polyPts} fill="rgba(124,58,237,0.15)" stroke="#7c3aed" strokeWidth={2.5} strokeLinejoin="round" />

              {/* Vertices */}
              {verts.map((v, i) => (
                <circle key={i} cx={v[0]} cy={v[1]} r={4} fill="#7c3aed" stroke="white" strokeWidth={1.5} />
              ))}

              {/* Angle labels at vertices */}
              {showAngles && verts.map((v, i) => {
                const dx = v[0] - cx, dy = v[1] - cy;
                const len = Math.sqrt(dx * dx + dy * dy);
                const nx = dx / len, ny = dy / len;
                return (
                  <text key={i} x={v[0] + nx * 16} y={v[1] + ny * 16}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={9} fill="#5b21b6" fontWeight="bold">
                    {fmtNum(interiorAngle, 0)}°
                  </text>
                );
              })}

              {/* n→∞ hint */}
              {n >= 10 && (
                <text x={cx} y={cy + R + 24} textAnchor="middle" fontSize={10} fill="#7c3aed" fontStyle="italic">
                  n→∞: правилниот многуаголник → кружница
                </text>
              )}
            </svg>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <div className="rounded-xl p-3 bg-violet-50 border border-violet-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase">Тело</p>
            <p className="text-lg font-extrabold text-violet-700">{POLYGON_NAMES[n] ?? `Правилен ${n}-аголник`}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Внатрешен агол', val: fmtNum(interiorAngle, 2) + '°', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
              { label: 'Надворешен агол', val: fmtNum(exteriorAngle, 2) + '°', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
              { label: 'Збир внатр. агли', val: sumAngles + '°', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
              { label: 'Апотема',          val: fmtNum(apothem, 3) + ' ед.', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
              { label: 'Периметар',        val: fmtNum(perimeter, 2) + ' ед.', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: 'Плоштина',         val: fmtNum(area, 3) + ' ед²', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
            ].map(({ label, val, color, bg, border }) => (
              <div key={label} className={`rounded-xl border p-2.5 text-center ${bg} ${border}`}>
                <p className="text-[10px] text-gray-500 font-semibold">{label}</p>
                <p className={`text-base font-extrabold ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-900 space-y-1">
            <p className="font-bold">Формули за правилен n-аголник:</p>
            <p className="font-mono">Внатрешен агол = (n−2)·180° / n</p>
            <p className="font-mono">Надворешен агол = 360° / n</p>
            <p className="font-mono">Збир внатрешни = (n−2)·180°</p>
            <p className="font-mono">Апотема a = s / (2·tan(π/n))</p>
            <p className="font-mono">Плоштина P = n·s·a / 2</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Наставна програма</p>
            <CurrBadges cur={POLYGON_CUR} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quadratic Function Explorer ─────────────────────────────────────────────
const QD_CUR: CurRef = {
  primary: ['VIII', 'IX', 'X'],
  gymnasium: ['I год.', 'II год.'],
  vocational: ['Стручно I год.', 'Стручно II год.'],
};
const QW = 420, QH = 360, Q_CX = 210, Q_CY = 200, Q_SC = 35;

function qToSVG(mx: number, my: number) {
  return { x: Q_CX + mx * Q_SC, y: Q_CY - my * Q_SC };
}

function QuadraticExplorer() {
  const [a, setA] = useState(1);
  const [b, setB] = useState(-2);
  const [c, setC] = useState(-3);

  const disc = b * b - 4 * a * c;
  const isLinear = Math.abs(a) < 0.01;
  const h = isLinear ? 0 : -b / (2 * a);
  const k = isLinear ? c : c - (b * b) / (4 * a);

  let x1: number | null = null, x2: number | null = null;
  if (!isLinear) {
    if (disc > 1e-9) {
      x1 = (-b + Math.sqrt(disc)) / (2 * a);
      x2 = (-b - Math.sqrt(disc)) / (2 * a);
    } else if (Math.abs(disc) <= 1e-9) {
      x1 = x2 = h;
    }
  }

  const parabolaPts = useMemo(() => {
    const pts: string[] = [];
    for (let xi = -6; xi <= 6.01; xi += 0.12) {
      const yi = a * xi * xi + b * xi + c;
      const p = qToSVG(xi, yi);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [a, b, c]);

  const vPt = qToSVG(h, k);
  const axisX = Q_CX + h * Q_SC;

  const sliders: { label: string; desc: string; val: number; set: (v: number) => void; min: number; max: number; step: number; color: string }[] = [
    { label: 'a', desc: 'насока/ширина', val: a, set: setA, min: -3, max: 3, step: 0.1,  color: '#6366f1' },
    { label: 'b', desc: 'поместување',   val: b, set: setB, min: -5, max: 5, step: 0.25, color: '#10b981' },
    { label: 'c', desc: 'y-пресек',      val: c, set: setC, min: -5, max: 5, step: 0.25, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <div className="space-y-3">
          {sliders.map(({ label, desc, val, set, min, max, step: s, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs font-bold mb-0.5" style={{ color }}>
                <span>Коефициент {label} <span className="font-normal text-gray-400">— {desc}</span></span>
                <span>{val.toFixed(2)}</span>
              </div>
              <input type="range" min={min} max={max} step={s} value={val}
                onChange={e => set(parseFloat(e.target.value))}
                className="w-full" style={{ accentColor: color }} aria-label={`коефициент ${label}`} />
            </div>
          ))}

          <div className="rounded-2xl border-2 border-indigo-200 bg-white overflow-hidden">
            <svg viewBox={`0 0 ${QW} ${QH}`} className="w-full">
              <defs><clipPath id="quad-clip"><rect x={0} y={0} width={QW} height={QH} /></clipPath></defs>

              {[-4,-3,-2,-1,0,1,2,3,4].map(g => {
                const gx = qToSVG(g, 0).x;
                const gy = qToSVG(0, g).y;
                return (
                  <g key={g}>
                    <line x1={gx} y1={0} x2={gx} y2={QH} stroke={g===0?'#9ca3af':'#f1f5f9'} strokeWidth={g===0?1.5:1}/>
                    <line x1={0} y1={gy} x2={QW} y2={gy} stroke={g===0?'#9ca3af':'#f1f5f9'} strokeWidth={g===0?1.5:1}/>
                    {g!==0 && <text x={Q_CX+4} y={gy+3} fontSize={9} fill="#cbd5e1">{g}</text>}
                    {g!==0 && <text x={gx} y={Q_CY+14} textAnchor="middle" fontSize={9} fill="#cbd5e1">{g}</text>}
                  </g>
                );
              })}

              {!isLinear && (
                <line x1={axisX} y1={0} x2={axisX} y2={QH}
                  stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="6 3" opacity={0.7} clipPath="url(#quad-clip)"/>
              )}

              <polyline points={parabolaPts} fill="none" stroke="#6366f1" strokeWidth={2.5}
                strokeLinejoin="round" clipPath="url(#quad-clip)"/>

              {!isLinear && (
                <g clipPath="url(#quad-clip)">
                  <circle cx={vPt.x} cy={vPt.y} r={6} fill="#f59e0b" stroke="white" strokeWidth={2}/>
                  <text x={vPt.x+9} y={vPt.y-5} fontSize={10} fill="#d97706" fontWeight="bold">
                    V({fmtNum(h,2)}, {fmtNum(k,2)})
                  </text>
                </g>
              )}

              {x1 !== null && (
                <circle cx={qToSVG(x1,0).x} cy={Q_CY} r={5} fill="#10b981" stroke="white" strokeWidth={2} clipPath="url(#quad-clip)"/>
              )}
              {x2 !== null && x2 !== x1 && (
                <circle cx={qToSVG(x2,0).x} cy={Q_CY} r={5} fill="#10b981" stroke="white" strokeWidth={2} clipPath="url(#quad-clip)"/>
              )}

              <circle cx={Q_CX} cy={qToSVG(0,c).y} r={4} fill="#f59e0b" stroke="white" strokeWidth={1.5} clipPath="url(#quad-clip)"/>

              <text x={8} y={16} fontSize={10} fill="#6366f1" fontWeight="bold">
                f(x) = {fmtNum(a,2)}x² + {fmtNum(b,2)}x + {fmtNum(c,2)}
              </text>
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <div className={`rounded-xl p-3 border-2 text-center ${disc>1e-9?'border-emerald-300 bg-emerald-50':Math.abs(disc)<=1e-9?'border-amber-300 bg-amber-50':'border-red-200 bg-red-50'}`}>
            <p className="text-[10px] text-gray-400 font-semibold uppercase">Дискриминанта Δ = b² − 4ac</p>
            <p className={`text-2xl font-extrabold mt-1 ${disc>1e-9?'text-emerald-700':Math.abs(disc)<=1e-9?'text-amber-700':'text-red-600'}`}>
              {fmtNum(disc,2)}
            </p>
            <p className={`text-xs font-semibold mt-0.5 ${disc>1e-9?'text-emerald-600':Math.abs(disc)<=1e-9?'text-amber-600':'text-red-500'}`}>
              {disc>1e-9 ? '2 реални корена' : Math.abs(disc)<=1e-9 ? '1 реален корен (двоен)' : 'Нема реални корени'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">Теме h (x)</p>
              <p className="text-base font-extrabold text-violet-700">{isLinear ? '—' : fmtNum(h,3)}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">Теме k (y)</p>
              <p className="text-base font-extrabold text-amber-700">{isLinear ? '—' : fmtNum(k,3)}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">Корен x₁</p>
              <p className="text-base font-extrabold text-emerald-700">{x1 !== null ? fmtNum(x1,3) : '—'}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">Корен x₂</p>
              <p className="text-base font-extrabold text-emerald-700">
                {x2 !== null && x2 !== x1 ? fmtNum(x2,3) : x1 !== null && x1 === x2 ? '= x₁' : '—'}
              </p>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800 space-y-1">
            <p className="font-bold">f(x) = ax² + bx + c</p>
            <p className="font-mono">Теме: h = −b/(2a),  k = c − b²/(4a)</p>
            <p className="font-mono">Δ = b² − 4ac</p>
            <p className="font-mono">Корени: x₁,₂ = (−b ± √Δ) / (2a)</p>
            <p className="mt-1">{a>0 ? '▲ Отворена нагоре (a > 0) — минимум' : a<0 ? '▽ Отворена надолу (a < 0) — максимум' : '— Линеарна (a ≈ 0)'}</p>
            <p>Оска на симетрија: x = {isLinear ? '—' : fmtNum(h,2)} (виолетова испрекината)</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Наставна програма</p>
            <CurrBadges cur={QD_CUR} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Absolute Value Lab ───────────────────────────────────────────────────────
const AV_CUR: CurRef = {
  primary: ['VII'],
  gymnasium: ['I год.'],
  vocational: ['Стручно I год.'],
};
const AV_W = 420, AV_H = 360, AV_CX = 210, AV_CY = 200, AV_SC = 35;

function avToSVG(mx: number, my: number) {
  return { x: AV_CX + mx * AV_SC, y: AV_CY - my * AV_SC };
}

function AbsoluteValueLab() {
  const [a, setA] = useState(1);
  const [h, setH] = useState(0);
  const [k, setK] = useState(0);

  const xOff = Math.abs(a) > 0.01 ? -k / a : null;
  const hasX = xOff !== null && xOff > -1e-9;
  const xi1 = h + (xOff ?? 0);
  const xi2 = h - (xOff ?? 0);
  const yInt = a * Math.abs(h) + k;

  const avPts = useMemo(() => {
    const pts: string[] = [];
    for (let xi = -7; xi <= 7.01; xi += 0.15) {
      const yi = a * Math.abs(xi - h) + k;
      const p = avToSVG(xi, yi);
      pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
    }
    return pts.join(' ');
  }, [a, h, k]);

  const vPt = avToSVG(h, k);
  const axisX = AV_CX + h * AV_SC;

  const avSliders: { label: string; desc: string; val: number; set: (v: number) => void; min: number; max: number; step: number; color: string }[] = [
    { label: 'a', desc: 'нагиб/насока',  val: a, set: setA, min: -3, max: 3, step: 0.1,  color: '#6366f1' },
    { label: 'h', desc: 'поместување x', val: h, set: setH, min: -4, max: 4, step: 0.25, color: '#10b981' },
    { label: 'k', desc: 'поместување y', val: k, set: setK, min: -4, max: 4, step: 0.25, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <div className="space-y-3">
          {avSliders.map(({ label, desc, val, set, min, max, step: s, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs font-bold mb-0.5" style={{ color }}>
                <span>Параметар {label} <span className="font-normal text-gray-400">— {desc}</span></span>
                <span>{val.toFixed(2)}</span>
              </div>
              <input type="range" min={min} max={max} step={s} value={val}
                onChange={e => set(parseFloat(e.target.value))}
                className="w-full" style={{ accentColor: color }} aria-label={`параметар ${label}`} />
            </div>
          ))}

          <div className="rounded-2xl border-2 border-emerald-200 bg-white overflow-hidden">
            <svg viewBox={`0 0 ${AV_W} ${AV_H}`} className="w-full">
              <defs><clipPath id="av-clip"><rect x={0} y={0} width={AV_W} height={AV_H} /></clipPath></defs>

              {[-5,-4,-3,-2,-1,0,1,2,3,4,5].map(g => {
                const gx = avToSVG(g, 0).x;
                const gy = avToSVG(0, g).y;
                return (
                  <g key={g}>
                    <line x1={gx} y1={0} x2={gx} y2={AV_H} stroke={g===0?'#9ca3af':'#f1f5f9'} strokeWidth={g===0?1.5:1}/>
                    <line x1={0} y1={gy} x2={AV_W} y2={gy} stroke={g===0?'#9ca3af':'#f1f5f9'} strokeWidth={g===0?1.5:1}/>
                    {g!==0 && <text x={AV_CX+4} y={gy+3} fontSize={9} fill="#cbd5e1">{g}</text>}
                    {g!==0 && <text x={gx} y={AV_CY+14} textAnchor="middle" fontSize={9} fill="#cbd5e1">{g}</text>}
                  </g>
                );
              })}

              <line x1={axisX} y1={0} x2={axisX} y2={AV_H}
                stroke="#10b981" strokeWidth={1.5} strokeDasharray="6 3" opacity={0.6} clipPath="url(#av-clip)"/>

              <polyline points={avPts} fill="none" stroke={a>=0?'#6366f1':'#ef4444'} strokeWidth={2.5}
                strokeLinejoin="round" clipPath="url(#av-clip)"/>

              <g clipPath="url(#av-clip)">
                <circle cx={vPt.x} cy={vPt.y} r={6} fill="#10b981" stroke="white" strokeWidth={2}/>
                <text x={vPt.x+9} y={vPt.y-5} fontSize={10} fill="#059669" fontWeight="bold">
                  V({fmtNum(h,2)}, {fmtNum(k,2)})
                </text>
              </g>

              {hasX && (
                <g clipPath="url(#av-clip)">
                  <circle cx={avToSVG(xi1,0).x} cy={AV_CY} r={5} fill="#f59e0b" stroke="white" strokeWidth={2}/>
                  {Math.abs(xi1-xi2) > 0.01 && (
                    <circle cx={avToSVG(xi2,0).x} cy={AV_CY} r={5} fill="#f59e0b" stroke="white" strokeWidth={2}/>
                  )}
                </g>
              )}

              <circle cx={AV_CX} cy={avToSVG(0,yInt).y} r={4} fill="#6366f1" stroke="white" strokeWidth={1.5} clipPath="url(#av-clip)"/>

              <text x={8} y={16} fontSize={10} fill="#6366f1" fontWeight="bold">
                f(x) = {fmtNum(a,2)}·|x − {fmtNum(h,2)}| + {fmtNum(k,2)}
              </text>
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200 text-center">
            <p className="text-xs text-gray-400 font-semibold">Функција</p>
            <p className="text-base font-extrabold text-emerald-700 font-mono">
              f(x) = {fmtNum(a,2)}·|x − {fmtNum(h,2)}| + {fmtNum(k,2)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">Теме V (Vertex)</p>
              <p className="text-base font-extrabold text-emerald-700">({fmtNum(h,2)}, {fmtNum(k,2)})</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">y-пресек f(0)</p>
              <p className="text-base font-extrabold text-amber-700">{fmtNum(yInt,3)}</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">Опсег (Range)</p>
              <p className="text-base font-extrabold text-indigo-700">
                {a > 0 ? `[${fmtNum(k,2)}, ∞)` : a < 0 ? `(−∞, ${fmtNum(k,2)}]` : `{${fmtNum(k,2)}}`}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">x-пресеци</p>
              <p className="text-sm font-extrabold text-rose-700">
                {hasX
                  ? (Math.abs(xi1-xi2) < 0.01 ? `x = ${fmtNum(xi1,2)}` : `${fmtNum(xi2,2)};  ${fmtNum(xi1,2)}`)
                  : 'Нема'}
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
            <p className="font-bold">f(x) = a·|x − h| + k</p>
            <p>• <strong>h</strong> = хоризонтална позиција на теме</p>
            <p>• <strong>k</strong> = вертикална позиција на теме</p>
            <p>• <strong>a &gt; 0</strong>: V-облик нагоре (минимум)&nbsp; <strong>a &lt; 0</strong>: ∧-облик надолу (максимум)</p>
            <p>• |a| го одредува стрмноста (нагибот на двете краци)</p>
            <p>• Оска на симетрија: x = h (зелена испрекината линија)</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Наставна програма</p>
            <CurrBadges cur={AV_CUR} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Quadrilaterals Explorer ──────────────────────────────────────────────────
const QUAD_CUR: CurRef = {
  primary: ['V', 'VI', 'VII'],
  gymnasium: ['I год.'],
  vocational: ['Стручно I год.', 'Стручно II год.'],
};

const QUAD_PRESETS: { name: string; pts: Pt[] }[] = [
  { name: 'Квадрат',      pts: [[150,260],[290,260],[290,120],[150,120]] },
  { name: 'Правоаголник', pts: [[90,270],[330,270],[330,155],[90,155]] },
  { name: 'Ромб',         pts: [[200,280],[310,185],[200,90],[90,185]] },
  { name: 'Паралелограм', pts: [[80,265],[280,265],[320,135],[120,135]] },
  { name: 'Трапез',       pts: [[100,265],[330,265],[270,130],[160,130]] },
  { name: 'Змеј (Kite)',  pts: [[200,285],[295,185],[200,75],[105,185]] },
];

type QuadToggle = 'none' | 'diagonals' | 'midpoints';

function areParallel2D(ux: number, uy: number, vx: number, vy: number, tol = 0.10): boolean {
  const cross = Math.abs(ux * vy - uy * vx);
  const mag = Math.sqrt(ux*ux + uy*uy) * Math.sqrt(vx*vx + vy*vy);
  return mag > 5 && cross / mag < tol;
}

function quadArea(pts: Pt[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1];
  }
  return Math.abs(area) / 2;
}

function detectQuadType(pts: Pt[]): string {
  const [A, B, C, D] = pts;
  const s = [dist(A,B), dist(B,C), dist(C,D), dist(D,A)];
  const ang = [angleDeg(D,A,B), angleDeg(A,B,C), angleDeg(B,C,D), angleDeg(C,D,A)];
  const eqS = (a: number, b: number) => Math.abs(a - b) / (Math.max(a, b) + 1e-6) < 0.06;
  const rightAng = (a: number) => Math.abs(a - 90) < 6;
  const allSidesEq = eqS(s[0],s[1]) && eqS(s[1],s[2]) && eqS(s[2],s[3]);
  const allRight = ang.every(rightAng);
  const oppSidesEq = eqS(s[0],s[2]) && eqS(s[1],s[3]);
  const abParDC = areParallel2D(B[0]-A[0], B[1]-A[1], C[0]-D[0], C[1]-D[1]);
  const bcParAD = areParallel2D(C[0]-B[0], C[1]-B[1], D[0]-A[0], D[1]-A[1]);
  const kite1 = eqS(s[0],s[3]) && eqS(s[1],s[2]);
  const kite2 = eqS(s[0],s[1]) && eqS(s[2],s[3]);
  if (allSidesEq && allRight) return 'Квадрат';
  if (allRight && oppSidesEq) return 'Правоаголник';
  if (allSidesEq) return 'Ромб';
  if (abParDC && bcParAD) return 'Паралелограм';
  if (abParDC || bcParAD) return 'Трапез';
  if (kite1 || kite2) return 'Змеј (Kite)';
  return 'Четириаголник';
}

const QUAD_TYPE_STYLE: Record<string, { border: string; bg: string; text: string; formula: string; desc: string }> = {
  'Квадрат':      { border: 'border-indigo-300', bg: 'bg-indigo-50',  text: 'text-indigo-700',  formula: 'P = 4a  ·  S = a²',            desc: '4 еднакви страни, 4 прави агли' },
  'Правоаголник': { border: 'border-blue-300',   bg: 'bg-blue-50',    text: 'text-blue-700',    formula: 'P = 2(a+b)  ·  S = a·b',        desc: 'Спротивни страни еднакви, 4 прави агли' },
  'Ромб':         { border: 'border-violet-300', bg: 'bg-violet-50',  text: 'text-violet-700',  formula: 'P = 4a  ·  S = d₁·d₂/2',       desc: '4 еднакви страни, дијагонали ⊥' },
  'Паралелограм': { border: 'border-emerald-300',bg: 'bg-emerald-50', text: 'text-emerald-700', formula: 'P = 2(a+b)  ·  S = a·h',        desc: 'Два пара паралелни спротивни страни' },
  'Трапез':       { border: 'border-amber-300',  bg: 'bg-amber-50',   text: 'text-amber-700',   formula: 'S = (a+c)·h/2',                 desc: 'Точно еден пар паралелни страни' },
  'Змеј (Kite)':  { border: 'border-rose-300',   bg: 'bg-rose-50',    text: 'text-rose-700',    formula: 'S = d₁·d₂/2',                  desc: 'Два пара соседни еднакви страни' },
  'Четириаголник':{ border: 'border-gray-300',   bg: 'bg-gray-50',    text: 'text-gray-700',    formula: 'S = Гаусова (Shoelace) формула', desc: 'Општ четириаголник · ∑агли = 360°' },
};

function QuadrilateralsExplorer() {
  const QSC = 40;
  const [pts, setPts] = useState<Pt[]>([[80,265],[280,265],[320,135],[120,135]]);
  const [toggle, setToggle] = useState<QuadToggle>('none');
  const dragging = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getSVGPt = useCallback((e: React.MouseEvent | React.TouchEvent): Pt => {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return [
      clamp((clientX - rect.left) * (420 / rect.width), 10, 410),
      clamp((clientY - rect.top) * (360 / rect.height), 10, 350),
    ];
  }, []);

  const onDown = useCallback((i: number) => (e: React.MouseEvent<SVGCircleElement>) => {
    dragging.current = i; e.preventDefault();
  }, []);
  const onTouchStart = useCallback((i: number) => (e: React.TouchEvent<SVGCircleElement>) => {
    dragging.current = i; e.preventDefault();
  }, []);
  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging.current === null) return;
    const p = getSVGPt(e);
    setPts(prev => prev.map((pt, i) => i === dragging.current ? p : pt) as Pt[]);
  }, [getSVGPt]);
  const onTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (dragging.current === null) return;
    const p = getSVGPt(e);
    setPts(prev => prev.map((pt, i) => i === dragging.current ? p : pt) as Pt[]);
    e.preventDefault();
  }, [getSVGPt]);
  const onUp = useCallback(() => { dragging.current = null; }, []);

  const [A, B, C, D] = pts;
  const sAB = dist(A,B), sBC = dist(B,C), sCD = dist(C,D), sDA = dist(D,A);
  const angA = angleDeg(D,A,B), angB = angleDeg(A,B,C), angC = angleDeg(B,C,D), angD = angleDeg(C,D,A);
  const dAC = dist(A,C), dBD = dist(B,D);
  const perim = sAB + sBC + sCD + sDA;
  const areaVal = quadArea(pts);
  const quadType = detectQuadType(pts);
  const sumAng = angA + angB + angC + angD;
  const midAB = midpoint(A,B), midBC = midpoint(B,C), midCD = midpoint(C,D), midDA = midpoint(D,A);
  const ptsStr = `${A[0]},${A[1]} ${B[0]},${B[1]} ${C[0]},${C[1]} ${D[0]},${D[1]}`;
  const vtC = ['#ef4444','#10b981','#3b82f6','#f59e0b'];
  const qStyle = QUAD_TYPE_STYLE[quadType] ?? QUAD_TYPE_STYLE['Четириаголник'];

  const QTOGGLES: { id: QuadToggle; label: string }[] = [
    { id: 'none', label: 'Основно' },
    { id: 'diagonals', label: 'Дијагонали' },
    { id: 'midpoints', label: 'Средишта' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {QUAD_PRESETS.map(p => (
          <button key={p.name} type="button" onClick={() => setPts(p.pts)}
            className="px-3 py-1.5 text-xs font-bold rounded-lg border-2 border-teal-200 text-teal-700 hover:bg-teal-50 transition">
            {p.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <div className="space-y-2">
          <div className="rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white overflow-hidden select-none cursor-crosshair">
            <svg ref={svgRef} viewBox="0 0 420 360" className="w-full touch-none"
              onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
              onTouchMove={onTouchMove} onTouchEnd={onUp}>
              {Array.from({ length: 7 }, (_, i) => (i+1)*60).map(x => (
                <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={360} stroke="#f0fdfa" strokeWidth={1} />
              ))}
              {Array.from({ length: 5 }, (_, i) => (i+1)*60).map(y => (
                <line key={`gy${y}`} x1={0} y1={y} x2={420} y2={y} stroke="#f0fdfa" strokeWidth={1} />
              ))}
              <polygon points={ptsStr} fill="rgba(20,184,166,0.12)" stroke="none" />

              {toggle === 'diagonals' && (
                <>
                  <line x1={A[0]} y1={A[1]} x2={C[0]} y2={C[1]} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="7 4" />
                  <line x1={B[0]} y1={B[1]} x2={D[0]} y2={D[1]} stroke="#f59e0b" strokeWidth={2} strokeDasharray="7 4" />
                  <circle cx={(A[0]+C[0])/2} cy={(A[1]+C[1])/2} r={4} fill="#8b5cf6" />
                  <circle cx={(B[0]+D[0])/2} cy={(B[1]+D[1])/2} r={4} fill="#f59e0b" />
                  <text x={(A[0]+C[0])/2+7} y={(A[1]+C[1])/2-4} fontSize={9} fill="#8b5cf6" fontWeight="bold">d₁={fmtNum(dAC/QSC)}</text>
                  <text x={(B[0]+D[0])/2+7} y={(B[1]+D[1])/2-4} fontSize={9} fill="#f59e0b" fontWeight="bold">d₂={fmtNum(dBD/QSC)}</text>
                </>
              )}
              {toggle === 'midpoints' && (
                <>
                  {[midAB, midBC, midCD, midDA].map((m, i) => (
                    <circle key={i} cx={m[0]} cy={m[1]} r={5} fill="#6366f1" stroke="white" strokeWidth={1.5} />
                  ))}
                  <polygon
                    points={`${midAB[0]},${midAB[1]} ${midBC[0]},${midBC[1]} ${midCD[0]},${midCD[1]} ${midDA[0]},${midDA[1]}`}
                    fill="rgba(99,102,241,0.18)" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" />
                </>
              )}

              <polygon points={ptsStr} fill="none" stroke="#14b8a6" strokeWidth={2.5} strokeLinejoin="round" />

              {[
                { v: A, ang: angA, c: vtC[0], dx: -22, dy: 15 },
                { v: B, ang: angB, c: vtC[1], dx: 7,   dy: 15 },
                { v: C, ang: angC, c: vtC[2], dx: 7,   dy: -8 },
                { v: D, ang: angD, c: vtC[3], dx: -27, dy: -8 },
              ].map(({ v, ang, c, dx, dy }, i) => (
                <text key={i} x={v[0]+dx} y={v[1]+dy} fontSize={9} fontWeight="bold" fill={c}>{fmtNum(ang,0)}°</text>
              ))}

              <text x={(A[0]+B[0])/2} y={(A[1]+B[1])/2+14} textAnchor="middle" fontSize={9} fill="#14b8a6" fontWeight="bold">a={fmtNum(sAB/QSC)}</text>
              <text x={(B[0]+C[0])/2+10} y={(B[1]+C[1])/2+4} textAnchor="start"  fontSize={9} fill="#14b8a6" fontWeight="bold">b={fmtNum(sBC/QSC)}</text>
              <text x={(C[0]+D[0])/2} y={(C[1]+D[1])/2-8}  textAnchor="middle" fontSize={9} fill="#14b8a6" fontWeight="bold">c={fmtNum(sCD/QSC)}</text>
              <text x={(D[0]+A[0])/2-10} y={(D[1]+A[1])/2+4} textAnchor="end"  fontSize={9} fill="#14b8a6" fontWeight="bold">d={fmtNum(sDA/QSC)}</text>

              {(['A','B','C','D'] as const).map((label, i) => (
                <g key={label}>
                  <circle cx={pts[i][0]} cy={pts[i][1]} r={14} fill="transparent" style={{ cursor: 'grab' }}
                    onMouseDown={onDown(i)} onTouchStart={onTouchStart(i)} />
                  <circle cx={pts[i][0]} cy={pts[i][1]} r={7} fill={vtC[i]} stroke="white" strokeWidth={2} style={{ pointerEvents: 'none' }} />
                  <text x={pts[i][0]} y={pts[i][1]-11} textAnchor="middle" fontSize={11} fontWeight="bold"
                    fill={vtC[i]} style={{ pointerEvents: 'none' }}>{label}</text>
                </g>
              ))}
            </svg>
          </div>

          <div className="flex gap-1.5 flex-wrap">
            {QTOGGLES.map(t => (
              <button key={t.id} type="button" onClick={() => setToggle(t.id)}
                className={`flex-1 min-w-[80px] px-2 py-1.5 text-xs font-bold rounded-lg border-2 transition ${toggle === t.id ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-gray-200 text-gray-500 hover:border-teal-300'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div className={`rounded-xl p-3 border-2 text-center ${qStyle.border} ${qStyle.bg}`}>
            <p className="text-xs text-gray-500 font-semibold uppercase">Тип</p>
            <p className={`text-xl font-extrabold ${qStyle.text} mt-0.5`}>{quadType}</p>
            <p className={`text-xs ${qStyle.text} opacity-80 mt-0.5`}>{qStyle.desc}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Страна a (AB)', val: fmtNum(sAB/QSC) + ' ед.', bg: 'bg-red-50',     border: 'border-red-200',    color: 'text-red-700'    },
              { label: 'Страна b (BC)', val: fmtNum(sBC/QSC) + ' ед.', bg: 'bg-green-50',   border: 'border-green-200',  color: 'text-green-700'  },
              { label: 'Страна c (CD)', val: fmtNum(sCD/QSC) + ' ед.', bg: 'bg-blue-50',    border: 'border-blue-200',   color: 'text-blue-700'   },
              { label: 'Страна d (DA)', val: fmtNum(sDA/QSC) + ' ед.', bg: 'bg-amber-50',   border: 'border-amber-200',  color: 'text-amber-700'  },
              { label: 'Периметар',     val: fmtNum(perim/QSC) + ' ед.', bg: 'bg-teal-50',  border: 'border-teal-200',   color: 'text-teal-700'   },
              { label: 'Плоштина',      val: fmtNum(areaVal/QSC/QSC) + ' ед²', bg: 'bg-violet-50', border: 'border-violet-200', color: 'text-violet-700' },
            ].map(({ label, val, bg, border, color }) => (
              <div key={label} className={`rounded-xl border p-2.5 text-center ${bg} ${border}`}>
                <p className="text-[10px] text-gray-500 font-semibold">{label}</p>
                <p className={`text-base font-extrabold ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '∠A', val: fmtNum(angA,0)+'°', bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-200'   },
              { label: '∠B', val: fmtNum(angB,0)+'°', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
              { label: '∠C', val: fmtNum(angC,0)+'°', bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200'  },
              { label: '∠D', val: fmtNum(angD,0)+'°', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
            ].map(({ label, val, bg, text, border }) => (
              <div key={label} className={`rounded-xl border p-2.5 text-center ${bg} ${border}`}>
                <p className="text-[10px] text-gray-500 font-semibold">{label}</p>
                <p className={`text-xl font-extrabold ${text}`}>{val}</p>
              </div>
            ))}
          </div>

          <div className={`rounded-xl border p-2.5 text-center ${Math.abs(sumAng - 360) < 4 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-[10px] text-gray-400 font-semibold">∠A + ∠B + ∠C + ∠D</p>
            <p className={`text-lg font-extrabold ${Math.abs(sumAng - 360) < 4 ? 'text-green-700' : 'text-red-600'}`}>
              {fmtNum(sumAng,0)}°{Math.abs(sumAng - 360) < 4 ? ' = 360° ✓' : ' ≠ 360°'}
            </p>
          </div>

          <div className="bg-teal-50 border border-teal-100 rounded-xl p-3 text-xs text-teal-900 space-y-1">
            <p className="font-bold">Формула ({quadType}):</p>
            <p className="font-mono">{qStyle.formula}</p>
            <p className="mt-1"><strong>Теорема:</strong> Збирот на внатрешните агли на секој четириаголник = <strong>360°</strong></p>
            {toggle === 'midpoints' && (
              <p className="text-indigo-700 font-semibold mt-1">Вариньонова теорема: Средиштата на страните на секој четириаголник секогаш формираат паралелограм!</p>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Наставна програма</p>
            <CurrBadges cur={QUAD_CUR} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
type Geo2DTab = 'triangle' | 'pythagoras' | 'circle' | 'polygons' | 'quadratic' | 'absvalue' | 'quads';

export function Geometry2DLab() {
  const [tab, setTab] = useState<Geo2DTab>('triangle');

  const TABS: { id: Geo2DTab; label: string; color: string }[] = [
    { id: 'triangle',  label: '△ Триаголник',        color: 'indigo'  },
    { id: 'pythagoras',label: '² Питагорова теорема', color: 'blue'    },
    { id: 'circle',    label: '○ Кружница',           color: 'rose'    },
    { id: 'polygons',  label: '⬡ Многуаголници',      color: 'violet'  },
    { id: 'quads',     label: '▱ Четириаголници',     color: 'teal'    },
    { id: 'quadratic', label: '∪ Квадратна ф-ја',    color: 'indigo'  },
    { id: 'absvalue',  label: '|x| Апс. вредност',   color: 'emerald' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${tab === t.id ? `border-${t.color}-500 bg-${t.color}-50 text-${t.color}-700` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'triangle'   && <TriangleExplorer />}
      {tab === 'pythagoras' && <PythagoreanLab />}
      {tab === 'circle'     && <CircleExplorer />}
      {tab === 'polygons'   && <PolygonsExplorer />}
      {tab === 'quads'      && <QuadrilateralsExplorer />}
      {tab === 'quadratic'  && <QuadraticExplorer />}
      {tab === 'absvalue'   && <AbsoluteValueLab />}
    </div>
  );
}
