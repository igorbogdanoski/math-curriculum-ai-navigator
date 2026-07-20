import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  type Vec3, type CurriculumRef,
  rotateX, rotateY, project, faceAvgZ, faceNormal, lightness, facesToEdges,
  makePrismVerts, makePrismFaces, makePyramidVerts, makePyramidFaces,
} from './geometry3dMath';
import { CurriculumBadges } from './geometry3dPanels';
import { useLanguage } from '../../i18n/LanguageContext';

// ─── RoundSolidsPanel (Сфера · Конус · Цилиндар) ──────────────────────────────
type RoundKind = 'sphere' | 'cone' | 'cylinder';

// label fields hold i18n keys (not literal text) — see DuggaQuestionEditor's Q_TYPES/TEST_TYPES convention
const ROUND_CONFIG: Record<RoundKind, { label: string; color: string; hex: string }> = {
  sphere:   { label: 'dataviz.geo3dSolid.roundSphere',     color: 'sky',     hex: '#0ea5e9' },
  cone:     { label: 'dataviz.geo3dSolid.roundCone',     color: 'amber',   hex: '#f59e0b' },
  cylinder: { label: 'dataviz.geo3dSolid.roundCylinder',  color: 'emerald', hex: '#10b981' },
};

// values hold i18n keys (not literal text)
const ROUND_FACTS: Record<RoundKind, string> = {
  sphere: 'dataviz.geo3dSolid.factSphere',
  cone: 'dataviz.geo3dSolid.factCone',
  cylinder: 'dataviz.geo3dSolid.factCylinder',
};

const ROUND_CURRICULUM: Record<RoundKind, CurriculumRef> = {
  sphere:   { primary: ['IX'], gymnasium: ['I година'], vocational: ['Стручно I год.'] },
  cone:     { primary: ['IX'], gymnasium: ['I година'], vocational: ['Стручно I год.'] },
  cylinder: { primary: ['IX'], gymnasium: ['I година'], vocational: ['Стручно I год.', 'Стручно II год.'] },
};

export function RoundSolidsPanel() {
  const { t } = useLanguage();
  const [kind, setKind] = useState<RoundKind>('sphere');
  const [r, setR] = useState(3);
  const [h, setH] = useState(4);

  const l = Math.sqrt(r * r + h * h);
  let volume = 0, surface = 0, volFormula = '', surfFormula = '';
  switch (kind) {
    case 'sphere':
      volume = (4 / 3) * Math.PI * r ** 3;
      surface = 4 * Math.PI * r ** 2;
      volFormula = 'V = (4/3)πr³'; surfFormula = 'S = 4πr²';
      break;
    case 'cone':
      volume = (1 / 3) * Math.PI * r * r * h;
      surface = Math.PI * r * (r + l);
      volFormula = 'V = (1/3)πr²h'; surfFormula = 'S = πr(r + l)';
      break;
    case 'cylinder':
      volume = Math.PI * r * r * h;
      surface = 2 * Math.PI * r * (r + h);
      volFormula = 'V = πr²h'; surfFormula = 'S = 2πr(r + h)';
      break;
  }

  const cfg = ROUND_CONFIG[kind];
  const W = 220, cx = 110, cy = 110;
  const maxDim = kind === 'sphere' ? r : Math.max(r, h);
  const scale = 85 / Math.max(maxDim, 1);
  const rs = r * scale, hs = h * scale;

  return (
    <div className="space-y-4">
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
        <p className="text-xs text-sky-800">
          <span className="font-bold">{t('dataviz.geo3dLab.monProgramTitle')}</span> {t('dataviz.geo3dSolid.monProgramRound')}
        </p>
      </div>

      <div className="flex gap-2">
        {(Object.keys(ROUND_CONFIG) as RoundKind[]).map(k => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={`flex-1 px-3 py-2 text-sm font-bold rounded-xl border-2 transition ${
              kind === k
                ? `border-${cfg.color}-500 bg-${cfg.color}-50 text-${cfg.color}-700`
                : 'border-gray-200 text-gray-500 hover:border-gray-300'
            }`}>
            {t(ROUND_CONFIG[k].label)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold text-gray-500 mb-1 text-center">{t('dataviz.geo3dSolid.sideProfile')}</p>
          <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
            <svg viewBox={`0 0 ${W} ${W}`} className="w-full" style={{ maxHeight: 220 }}>
              {kind === 'sphere' && (
                <circle cx={cx} cy={cy} r={rs} fill={`${cfg.hex}22`} stroke={cfg.hex} strokeWidth={2.5} />
              )}
              {kind === 'cone' && (
                <polygon
                  points={`${cx},${cy - hs / 2} ${cx - rs},${cy + hs / 2} ${cx + rs},${cy + hs / 2}`}
                  fill={`${cfg.hex}22`} stroke={cfg.hex} strokeWidth={2.5} />
              )}
              {kind === 'cylinder' && (
                <>
                  <rect x={cx - rs} y={cy - hs / 2} width={rs * 2} height={hs} fill={`${cfg.hex}22`} stroke={cfg.hex} strokeWidth={2.5} />
                  <ellipse cx={cx} cy={cy - hs / 2} rx={rs} ry={rs * 0.22} fill={`${cfg.hex}33`} stroke={cfg.hex} strokeWidth={1.5} />
                  <ellipse cx={cx} cy={cy + hs / 2} rx={rs} ry={rs * 0.22} fill={`${cfg.hex}33`} stroke={cfg.hex} strokeWidth={1.5} />
                </>
              )}
              {/* r dimension line */}
              <line x1={cx} y1={cy} x2={cx + rs} y2={kind === 'sphere' ? cy : cy + hs / 2} stroke="#64748b" strokeWidth={1} strokeDasharray="3,2" />
              <text x={cx + rs / 2} y={(kind === 'sphere' ? cy : cy + hs / 2) - 4} fontSize={10} fill="#334155" fontWeight="bold" textAnchor="middle">r</text>
              {/* h dimension line (cone/cylinder only) */}
              {kind !== 'sphere' && (
                <>
                  <line x1={cx + rs + 14} y1={cy - hs / 2} x2={cx + rs + 14} y2={cy + hs / 2} stroke="#64748b" strokeWidth={1} />
                  <text x={cx + rs + 20} y={cy + 3} fontSize={10} fill="#334155" fontWeight="bold">h</text>
                </>
              )}
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex flex-col text-xs font-semibold text-gray-600">
            {t('dataviz.geo3dSolid.radiusR').replace('{r}', r.toFixed(1))}
            <input type="range" min={1} max={6} step={0.1} value={r}
              onChange={e => setR(+e.target.value)} className={`mt-1 accent-${cfg.color}-600`} />
          </label>
          {kind !== 'sphere' && (
            <label className="flex flex-col text-xs font-semibold text-gray-600">
              {t('dataviz.geo3dSolid.heightHUnit').replace('{h}', h.toFixed(1))}
              <input type="range" min={1} max={8} step={0.1} value={h}
                onChange={e => setH(+e.target.value)} className={`mt-1 accent-${cfg.color}-600`} />
            </label>
          )}
          {kind === 'cone' && (
            <p className="text-xs text-gray-500">{t('dataviz.geo3dSolid.slantHeightL')} <strong className="text-gray-700">{l.toFixed(3)}</strong> {t('dataviz.geo3dPanels.unit')}.</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className={`rounded-xl border-2 p-3 text-center bg-${cfg.color}-50 border-${cfg.color}-200`}>
              <p className={`text-xl font-black text-${cfg.color}-700`}>{volume.toFixed(3)}</p>
              <p className="text-xs font-bold text-gray-600">{t('dataviz.geo3dLab.volume')}</p>
              <p className={`text-[11px] font-semibold mt-1 text-${cfg.color}-700`}>{volFormula}</p>
            </div>
            <div className={`rounded-xl border-2 p-3 text-center bg-${cfg.color}-50 border-${cfg.color}-200`}>
              <p className={`text-xl font-black text-${cfg.color}-700`}>{surface.toFixed(3)}</p>
              <p className="text-xs font-bold text-gray-600">{t('dataviz.geo3dLab.surfaceArea')}</p>
              <p className={`text-[11px] font-semibold mt-1 text-${cfg.color}-700`}>{surfFormula}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
        <p className="text-xs text-amber-800"><span className="font-bold">{t('dataviz.geo3dLab.didYouKnow')}</span> {t(ROUND_FACTS[kind])}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('dataviz.linalgLab.curriculum')}</p>
        <CurriculumBadges cur={ROUND_CURRICULUM[kind]} />
      </div>
    </div>
  );
}

// ─── PrismPyramidCalculator ───────────────────────────────────────────────────
export function PrismPyramidCalculator() {
  const { t } = useLanguage();
  const [kind, setKind] = useState<'prism' | 'pyramid'>('prism');
  const [n, setN] = useState(4);
  const [h, setH] = useState(2.0);
  const [R, setR] = useState(1.5);
  const [angX, setAngX] = useState(0.45);
  const [angY, setAngY] = useState(-0.4);
  const [autoSpin, setAutoSpin] = useState(false);
  const dragRef  = useRef<{ x: number; y: number } | null>(null);
  const touchRef = useRef<{ x: number; y: number } | null>(null);
  const svgRef   = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!autoSpin) return;
    let raf: number;
    const tick = () => {
      setAngY(a => a + 0.008);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoSpin]);

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
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          {(['prism', 'pyramid'] as const).map(k => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`px-4 py-2 text-sm font-bold transition ${
                kind === k
                  ? (k === 'prism' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white')
                  : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}>
              {k === 'prism' ? t('dataviz.geo3dSolid.tabPrism') : t('dataviz.geo3dSolid.tabPyramid')}
            </button>
          ))}
        </div>

        <label className="flex flex-col text-xs font-semibold text-gray-600 min-w-[130px]">
          {t('dataviz.geo3dSolid.sidesN').replace('{n}', String(n))}
          <input type="range" min={3} max={12} step={1} value={n}
            onChange={e => setN(+e.target.value)} className="mt-1 accent-emerald-600" />
        </label>

        <label className="flex flex-col text-xs font-semibold text-gray-600 min-w-[130px]">
          {t('dataviz.geo3dSolid.heightHUnit').replace('{h}', h.toFixed(1))}
          <input type="range" min={0.5} max={5.0} step={0.1} value={h}
            onChange={e => setH(+e.target.value)} className="mt-1 accent-emerald-600" />
        </label>

        <label className="flex flex-col text-xs font-semibold text-gray-600 min-w-[130px]">
          {t('dataviz.geo3dSolid.radiusRUpper').replace('{r}', R.toFixed(1))}
          <input type="range" min={0.5} max={3.0} step={0.1} value={R}
            onChange={e => setR(+e.target.value)} className="mt-1 accent-emerald-600" />
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[380px_1fr] gap-5">
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
              <text x={190} y={372} textAnchor="middle" fontSize={10} fill="#9ca3af">{t('dataviz.geo3dLab.dragToRotate')}</text>
            </svg>
          </div>
          <div className="flex gap-2">
            <button type="button"
              onClick={() => { setAngX(0.45); setAngY(-0.4); }}
              className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              {t('dataviz.geo3dSolid.resetView2')}
            </button>
            <button type="button" onClick={() => setAutoSpin(s => !s)}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${autoSpin ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {autoSpin ? t('dataviz.geo3dLab.pauseSpin') : t('dataviz.geo3dLab.rotateBtn')}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`rounded-xl border-2 p-4 ${catBg} ${catBdr}`}>
            <p className={`text-lg font-black ${catTxt}`}>
              {kind === 'prism'
                ? t('dataviz.geo3dSolid.regularNPrism').replace('{n}', String(n))
                : t('dataviz.geo3dSolid.regularNPyramid').replace('{n}', String(n))}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {kind === 'prism'
                ? t('dataviz.geo3dSolid.prismDesc').replace('{n}', String(n)).replace('{n}', String(n))
                : t('dataviz.geo3dSolid.pyramidDesc').replace('{n}', String(n)).replace('{n}', String(n))}
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {([[t('dataviz.geo3dPanels.printVertices'), V_n], [t('dataviz.geo3dPanels.printEdges'), E_n], [t('dataviz.geo3dPanels.printFaces'), F_n]] as [string, number][]).map(([label, val]) => (
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

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">{t('dataviz.geo3dSolid.measurements')}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">{t('dataviz.geo3dSolid.sideS')}</span>
                <span className="font-bold text-gray-800">{s.toFixed(3)} {t('dataviz.geo3dPanels.unit')}.</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">{t('dataviz.geo3dSolid.apothemLabel')}</span>
                <span className="font-bold text-gray-800">{apothem.toFixed(3)} {t('dataviz.geo3dPanels.unit')}.</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-500">{t('dataviz.geo3dSolid.baseB')}</span>
                <span className="font-bold text-gray-800">{B.toFixed(3)} {t('dataviz.geo3dPanels.unitSq')}</span>
              </div>
              {kind === 'pyramid' && (
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500">{t('dataviz.geo3dSolid.slantL')}</span>
                  <span className="font-bold text-gray-800">{slantH.toFixed(3)} {t('dataviz.geo3dPanels.unit')}.</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl border-2 p-4 text-center ${catBg} ${catBdr}`}>
              <p className={`text-2xl font-black ${catTxt}`}>{vol.toFixed(3)}</p>
              <p className="text-xs font-bold text-gray-600">{t('dataviz.geo3dLab.volume')}</p>
              <p className={`text-[11px] font-semibold mt-1 ${catTxt}`}>
                {kind === 'prism' ? 'V = B · h' : 'V = B · h / 3'}
              </p>
            </div>
            <div className={`rounded-xl border-2 p-4 text-center ${catBg} ${catBdr}`}>
              <p className={`text-2xl font-black ${catTxt}`}>{sa.toFixed(3)}</p>
              <p className="text-xs font-bold text-gray-600">{t('dataviz.geo3dLab.surfaceArea')}</p>
              <p className={`text-[11px] font-semibold mt-1 ${catTxt}`}>
                {kind === 'prism' ? 'S = n·s·h + 2B' : 'S = n·s·l/2 + B'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('dataviz.linalgLab.curriculum')}</p>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">{t('dataviz.geo3dPanels.curricMon').replace('{p}', 'VII')}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">{t('dataviz.geo3dPanels.curricMon').replace('{p}', 'VIII')}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">{t('dataviz.linalgLab.gymYear1')}</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">{t('dataviz.geo3dSolid.vocYear1to3')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
