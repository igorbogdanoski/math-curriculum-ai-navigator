import React, { useState, useMemo } from 'react';

import { type Pt, type CurRef, dist, fmtNum, CurrBadges } from './geometry2dUtils';
import { TriangleExplorer, QuadraticExplorer, QuadrilateralsExplorer } from './Geometry2DExplorers';
import { useLanguage } from '../../i18n/LanguageContext';
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
  const { t } = useLanguage();
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
            { label: t('dataviz.geo2dLab.legA'), val: a, set: setA, color: '#3b82f6' },
            { label: t('dataviz.geo2dLab.legB'), val: b, set: setB, color: '#10b981' },
          ].map(({ label, val, set, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs font-bold mb-1" style={{ color }}>
                <span>{label}</span><span>{val} {t('dataviz.geo3dPanels.unit')}.</span>
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
            <p className="text-sm font-bold text-gray-500">{t('dataviz.geo2dLab.pythTheorem')}</p>
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
              { label: t('dataviz.geo2dLab.legALabel'), val: `${a} ${t('dataviz.geo3dPanels.unit')}.`,         color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
              { label: t('dataviz.geo2dLab.legBLabel'), val: `${b} ${t('dataviz.geo3dPanels.unit')}.`,         color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: t('dataviz.geo2dLab.hypLabel'), val: fmtNum(c, 3) + ' ' + t('dataviz.geo3dPanels.unit') + '.', color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
            ].map(({ label, val, color, bg, border }) => (
              <div key={label} className={`rounded-xl border p-2.5 text-center ${bg} ${border}`}>
                <p className="text-[10px] text-gray-500 font-semibold">{label}</p>
                <p className={`text-base font-extrabold ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-800 space-y-1">
            <p><strong>{t('dataviz.geo2dLab.theoremLabel')}</strong> {t('dataviz.geo2dLab.theoremBody')}</p>
            <p className="font-mono font-bold">c² = a² + b²</p>
            <p><strong>{t('dataviz.geo2dLab.heightRightTriangle')}</strong> h = (a·b)/c = {fmtNum((a * b) / c, 2)} {t('dataviz.geo3dPanels.unit')}.</p>
            <p><strong>{t('dataviz.geo2dLab.areaColonLabel')}</strong> P = (a·b)/2 = {fmtNum((a * b) / 2, 2)} {t('dataviz.geo3dPanels.unitSq')}</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">{t('dataviz.linalgLab.curriculum')}</p>
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
  const { t } = useLanguage();
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
              <span>{t('dataviz.geo2dLab.radiusR2')}</span><span>{r} {t('dataviz.geo3dPanels.unit')}.</span>
            </div>
            <input type="range" min={1} max={5} step={0.25} value={r}
              onChange={e => setR(parseFloat(e.target.value))}
              className="w-full accent-rose-500" aria-label={t('dataviz.geo2dLab.radiusR2')} />
          </div>

          {/* Sector slider */}
          <div>
            <div className="flex justify-between text-xs font-bold text-amber-600 mb-1">
              <span>{t('dataviz.geo2dLab.sectorAngle')}</span><span>{sectorDeg}°</span>
            </div>
            <input type="range" min={10} max={350} step={5} value={sectorDeg}
              onChange={e => setSectorDeg(parseInt(e.target.value))}
              className="w-full accent-amber-500" aria-label={t('dataviz.geo2dLab.sectorAngle')} />
          </div>

          {/* Toggles */}
          <div className="flex gap-2 flex-wrap">
            {[
              { label: t('dataviz.geo2dLab.chordLabel'), state: showChord, set: setShowChord, color: 'emerald' },
              { label: t('dataviz.geo2dLab.tangentLabel'), state: showTangent, set: setShowTangent, color: 'violet' },
              { label: t('dataviz.geo2dLab.inscribedAngleLabel'), state: showInscribed, set: setShowInscribed, color: 'sky' },
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
                    fontSize={10} fill="#10b981" fontWeight="bold">{t('dataviz.geo2dLab.chordEq')}{fmtNum(chordLen, 2)}</text>
                </>
              )}

              {/* Tangent at sector start */}
              {showTangent && (
                <>
                  <line x1={sx - 50 * Math.sin(-Math.PI / 2)} y1={sy - 50 * Math.cos(-Math.PI / 2)}
                    x2={sx + 50 * Math.sin(-Math.PI / 2)} y2={sy + 50 * Math.cos(-Math.PI / 2)}
                    stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" />
                  <text x={sx + 5} y={sy - 14} fontSize={10} fill="#8b5cf6" fontWeight="bold">{t('dataviz.geo2dLab.tangentSvgLabel')}</text>
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
              { label: t('dataviz.geo2dLab.radiusR2'), val: `${r} ${t('dataviz.geo3dPanels.unit')}.`,                color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200' },
              { label: t('dataviz.geo2dLab.diameterD'),  val: `${2 * r} ${t('dataviz.geo3dPanels.unit')}.`,            color: 'text-rose-700',   bg: 'bg-rose-50',   border: 'border-rose-200' },
              { label: t('dataviz.geo2dLab.circumferenceC'),   val: fmtNum(circumference, 3) + ' ' + t('dataviz.geo3dPanels.unit') + '.', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
              { label: t('dataviz.geo2dLab.areaS'),   val: fmtNum(areaCircle, 3) + ' ' + t('dataviz.geo3dPanels.unitSq'),   color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: t('dataviz.geo2dLab.arcLength'), val: fmtNum(arcLen, 3) + ' ' + t('dataviz.geo3dPanels.unit') + '.', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
              { label: t('dataviz.geo2dLab.sectorArea'), val: fmtNum(sectorArea, 3) + ' ' + t('dataviz.geo3dPanels.unitSq'), color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
            ].map(({ label, val, color, bg, border }) => (
              <div key={label} className={`rounded-xl border p-2.5 text-center ${bg} ${border}`}>
                <p className="text-[10px] text-gray-500 font-semibold">{label}</p>
                <p className={`text-base font-extrabold ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-900 space-y-1">
            <p className="font-bold text-rose-700">{t('dataviz.geo2dLab.formulasLabel')}</p>
            <p className="font-mono">C = 2πr = πd</p>
            <p className="font-mono">S = πr²</p>
            <p className="font-mono">l<sub>лак</sub> = r·θ (θ во радијани)</p>
            <p className="font-mono">S<sub>сектор</sub> = r²·θ/2 = r·l/2</p>
            <p className="font-bold mt-1">{t('dataviz.geo2dLab.inscribedAngleTheorem')}</p>
            <p>{t('dataviz.geo2dLab.inscribedAngleBody')}</p>
          </div>

          {showInscribed && (
            <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-xs text-sky-800">
              <strong>{t('dataviz.geo2dLab.centralAngleLabel')}</strong> {sectorDeg}° &nbsp;→&nbsp;
              <strong>{t('dataviz.geo2dLab.inscribedAngleLabel')}:</strong> {fmtNum(sectorDeg / 2, 1)}° {t('dataviz.geo2dLab.exactlyHalf')}
            </div>
          )}

          <div className="bg-white border border-gray-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">{t('dataviz.linalgLab.curriculum')}</p>
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

// values hold i18n keys (not literal text)
const POLYGON_NAMES: Record<number, string> = {
  3: 'dataviz.geo2dLab.polyName3', 4: 'dataviz.geo2dLab.polyName4', 5: 'dataviz.geo2dLab.polyName5',
  6: 'dataviz.geo2dLab.polyName6', 7: 'dataviz.geo2dLab.polyName7', 8: 'dataviz.geo2dLab.polyName8',
  9: 'dataviz.geo2dLab.polyName9', 10: 'dataviz.geo2dLab.polyName10', 11: 'dataviz.geo2dLab.polyName11', 12: 'dataviz.geo2dLab.polyName12',
};

function PolygonsExplorer() {
  const { t } = useLanguage();
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
              <span>{t('dataviz.geo2dLab.numSidesN')}</span>
              <span>{n} — {POLYGON_NAMES[n] ? t(POLYGON_NAMES[n]) : t('dataviz.geo2dLab.polyNGeneric').replace('{n}', String(n))}</span>
            </div>
            <input type="range" min={3} max={12} step={1} value={n}
              onChange={e => setN(parseInt(e.target.value))}
              className="w-full accent-violet-600" aria-label={t('dataviz.geo2dLab.numSidesN')} />
          </div>

          {/* Side length */}
          <div>
            <div className="flex justify-between text-xs font-bold text-teal-600 mb-1">
              <span>{t('dataviz.geo2dLab.sideLengthA')}</span><span>{sideLen} {t('dataviz.geo3dPanels.unit')}.</span>
            </div>
            <input type="range" min={0.5} max={5} step={0.25} value={sideLen}
              onChange={e => setSideLen(parseFloat(e.target.value))}
              className="w-full accent-teal-600" aria-label={t('dataviz.geo2dLab.sideLengthA')} />
          </div>

          <div className="flex gap-2">
            {[
              { label: t('dataviz.geo2dLab.anglesLabel'), state: showAngles, set: setShowAngles },
              { label: t('dataviz.geo2dLab.apothemLabel2'), state: showApothem, set: setShowApothem },
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
                  {t('dataviz.geo2dLab.nInfinityHint')}
                </text>
              )}
            </svg>
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-3">
          <div className="rounded-xl p-3 bg-violet-50 border border-violet-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase">{t('dataviz.geo2dLab.shapeLabel')}</p>
            <p className="text-lg font-extrabold text-violet-700">{POLYGON_NAMES[n] ? t(POLYGON_NAMES[n]) : t('dataviz.geo2dLab.regularNGon').replace('{n}', String(n))}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: t('dataviz.geo2dLab.interiorAngle'), val: fmtNum(interiorAngle, 2) + '°', color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
              { label: t('dataviz.geo2dLab.exteriorAngle'), val: fmtNum(exteriorAngle, 2) + '°', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
              { label: t('dataviz.geo2dLab.sumInteriorShort'), val: sumAngles + '°', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
              { label: t('dataviz.geo2dLab.apothemLabel2'),          val: fmtNum(apothem, 3) + ' ' + t('dataviz.geo3dPanels.unit') + '.', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
              { label: t('dataviz.geo3dPanels.perimeterLabel'),        val: fmtNum(perimeter, 2) + ' ' + t('dataviz.geo3dPanels.unit') + '.', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
              { label: t('dataviz.geo2dLab.areaLabel'),         val: fmtNum(area, 3) + ' ' + t('dataviz.geo3dPanels.unitSq'), color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
            ].map(({ label, val, color, bg, border }) => (
              <div key={label} className={`rounded-xl border p-2.5 text-center ${bg} ${border}`}>
                <p className="text-[10px] text-gray-500 font-semibold">{label}</p>
                <p className={`text-base font-extrabold ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-900 space-y-1">
            <p className="font-bold">{t('dataviz.geo2dLab.polyFormulasTitle')}</p>
            <p className="font-mono">{t('dataviz.geo2dLab.polyFormula1')}</p>
            <p className="font-mono">{t('dataviz.geo2dLab.polyFormula2')}</p>
            <p className="font-mono">{t('dataviz.geo2dLab.polyFormula3')}</p>
            <p className="font-mono">{t('dataviz.geo2dLab.polyFormula4')}</p>
            <p className="font-mono">{t('dataviz.geo2dLab.polyFormula5')}</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">{t('dataviz.linalgLab.curriculum')}</p>
            <CurrBadges cur={POLYGON_CUR} />
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const { t } = useLanguage();
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
    { label: 'a', desc: t('dataviz.geo2dLab.avDescA'),  val: a, set: setA, min: -3, max: 3, step: 0.1,  color: '#6366f1' },
    { label: 'h', desc: t('dataviz.geo2dLab.avDescH'), val: h, set: setH, min: -4, max: 4, step: 0.25, color: '#10b981' },
    { label: 'k', desc: t('dataviz.geo2dLab.avDescK'), val: k, set: setK, min: -4, max: 4, step: 0.25, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <div className="space-y-3">
          {avSliders.map(({ label, desc, val, set, min, max, step: s, color }) => (
            <div key={label}>
              <div className="flex justify-between text-xs font-bold mb-0.5" style={{ color }}>
                <span>{t('dataviz.geo2dLab.paramLabel').replace('{label}', label)} <span className="font-normal text-gray-400">— {desc}</span></span>
                <span>{val.toFixed(2)}</span>
              </div>
              <input type="range" min={min} max={max} step={s} value={val}
                onChange={e => set(parseFloat(e.target.value))}
                className="w-full" style={{ accentColor: color }} aria-label={t('dataviz.geo2dLab.paramAria').replace('{label}', label)} />
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
            <p className="text-xs text-gray-400 font-semibold">{t('dataviz.geo2dLab.functionLabel')}</p>
            <p className="text-base font-extrabold text-emerald-700 font-mono">
              f(x) = {fmtNum(a,2)}·|x − {fmtNum(h,2)}| + {fmtNum(k,2)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">{t('dataviz.geo2dLab.vertexVLabel')}</p>
              <p className="text-base font-extrabold text-emerald-700">({fmtNum(h,2)}, {fmtNum(k,2)})</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">{t('dataviz.geo2dLab.yInterceptLabel')}</p>
              <p className="text-base font-extrabold text-amber-700">{fmtNum(yInt,3)}</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">{t('dataviz.geo2dLab.rangeLabel')}</p>
              <p className="text-base font-extrabold text-indigo-700">
                {a > 0 ? `[${fmtNum(k,2)}, ∞)` : a < 0 ? `(−∞, ${fmtNum(k,2)}]` : `{${fmtNum(k,2)}}`}
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">{t('dataviz.geo2dLab.xInterceptsLabel')}</p>
              <p className="text-sm font-extrabold text-rose-700">
                {hasX
                  ? (Math.abs(xi1-xi2) < 0.01 ? `x = ${fmtNum(xi1,2)}` : `${fmtNum(xi2,2)};  ${fmtNum(xi1,2)}`)
                  : t('dataviz.geo2dLab.noneLabel')}
              </p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-900 space-y-1">
            <p className="font-bold">f(x) = a·|x − h| + k</p>
            <p>• {t('dataviz.geo2dLab.avBullet1')}</p>
            <p>• {t('dataviz.geo2dLab.avBullet2')}</p>
            <p>• {t('dataviz.geo2dLab.avBullet3')}</p>
            <p>• {t('dataviz.geo2dLab.avBullet4')}</p>
            <p>• {t('dataviz.geo2dLab.avBullet5')}</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase">{t('dataviz.linalgLab.curriculum')}</p>
            <CurrBadges cur={AV_CUR} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
type Geo2DTab = 'triangle' | 'pythagoras' | 'circle' | 'polygons' | 'quadratic' | 'absvalue' | 'quads';

export function Geometry2DLab() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<Geo2DTab>('triangle');

  const TABS: { id: Geo2DTab; label: string; color: string }[] = [
    { id: 'triangle',  label: t('dataviz.geo2dLab.tabTriangle'),        color: 'indigo'  },
    { id: 'pythagoras',label: t('dataviz.geo2dLab.tabPythagoras'), color: 'blue'    },
    { id: 'circle',    label: t('dataviz.geo2dLab.tabCircle'),           color: 'rose'    },
    { id: 'polygons',  label: t('dataviz.geo2dLab.tabPolygons'),      color: 'violet'  },
    { id: 'quads',     label: t('dataviz.geo2dLab.tabQuads'),     color: 'teal'    },
    { id: 'quadratic', label: t('dataviz.geo2dLab.tabQuadratic'),    color: 'indigo'  },
    { id: 'absvalue',  label: t('dataviz.geo2dLab.tabAbsValue'),   color: 'emerald' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tb => (
          <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${tab === tb.id ? `border-${tb.color}-500 bg-${tb.color}-50 text-${tb.color}-700` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {tb.label}
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
