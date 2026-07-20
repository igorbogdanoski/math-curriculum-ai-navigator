import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { type Vec3, rotateX, rotateY, project, faceAvgZ, faceNormal, lightness, DUAL_MAP } from './geometry3dMath';
import { CurriculumBadges, NetsExplorer, CrossSections, SOLIDS, CAT_CONFIG } from './geometry3dPanels';
import { PrismPyramidCalculator, RoundSolidsPanel } from './geometry3dSolidPanels';
import { generateGeo3DSet } from './geometry3dExerciseMath';
import { useLabSession } from '../../hooks/useLabSession';
import { useLabDifficulty } from '../../hooks/useLabDifficulty';
import { LabExercisePanel } from '../labs/LabExercisePanel';
import { useLanguage } from '../../i18n/LanguageContext';

// ─── PolyhedraExplorer ────────────────────────────────────────────────────────
type Category = 'all' | 'platonic' | 'archimedean' | 'prism' | 'antiprism' | 'pyramid';

function PolyhedraExplorer() {
  const { t } = useLanguage();
  const [cat, setCat]   = useState<Category>('all');
  const [selId, setSelId] = useState('cube');
  const [angleX, setAngleX] = useState(0.5);
  const [angleY, setAngleY] = useState(-0.4);
  const [showWire, setShowWire] = useState(false);
  const [autoSpin, setAutoSpin] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const svgRef  = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!autoSpin) return;
    let raf: number;
    const tick = () => {
      setAngleY(a => a + 0.008);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [autoSpin]);

  const solid = SOLIDS.find(s => s.id === selId) ?? SOLIDS[0];
  const filtered = cat === 'all' ? SOLIDS : SOLIDS.filter(s => s.category === cat);
  const dualId = DUAL_MAP[solid.id];
  const dualSolid = dualId ? SOLIDS.find(s => s.id === dualId) : undefined;

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
    const pv = rotated.map(v => project(v, cx, cy, scale));
    const sf = [...solid.faces]
      .map((f, i) => ({ f, i, z: faceAvgZ(f, rotated), norm: faceNormal(f, rotated) }))
      .sort((a, b) => a.z - b.z);
    return { projVerts: pv, sortedFaces: sf };
  }, [solid, angleX, angleY]);

  const catCfg = CAT_CONFIG[solid.category];
  const euler = solid.V - solid.E + solid.F;

  const CATS: { id: Category; label: string }[] = [
    { id: 'all',         label: t('dataviz.geo3dLab.catAll') },
    { id: 'platonic',    label: t('dataviz.geo3dLab.catPlatonic') },
    { id: 'archimedean', label: t('dataviz.geo3dLab.catArchimedean') },
    { id: 'prism',       label: t('dataviz.geo3dLab.catPrism') },
    { id: 'antiprism',   label: t('dataviz.geo3dLab.catAntiprism') },
    { id: 'pyramid',     label: t('dataviz.geo3dLab.catPyramid') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {CATS.map(c => (
          <button key={c.id} type="button" onClick={() => setCat(c.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${cat === c.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
            {c.label}
          </button>
        ))}
      </div>

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
        <div className="space-y-2">
          <div className={`rounded-2xl border-2 ${catCfg.border} overflow-hidden bg-gradient-to-br from-slate-50 to-white cursor-grab active:cursor-grabbing select-none`}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onMouseUp}>
            <svg ref={svgRef} viewBox="0 0 320 310" className="w-full" style={{ maxHeight: 310 }}>
              {sortedFaces.map(({ f, i, norm }) => {
                const pts = f.map(vi => `${projVerts[vi].x.toFixed(1)},${projVerts[vi].y.toFixed(1)}`).join(' ');
                const L = lightness(norm);
                const [r,g,b] = catCfg.rgb.split(',').map(Number);
                const fill = showWire ? 'none' : `rgba(${Math.round(r*L)},${Math.round(g*L)},${Math.round(b*L)},0.85)`;
                return <polygon key={i} points={pts} fill={fill} stroke="white" strokeWidth={showWire ? 1 : 0.8} strokeOpacity={0.6} />;
              })}
              {showWire && solid.edges.map(([a, b], i) => (
                <line key={i} x1={projVerts[a].x} y1={projVerts[a].y} x2={projVerts[b].x} y2={projVerts[b].y}
                  stroke={`rgb(${catCfg.rgb})`} strokeWidth={1.5} />
              ))}
              <text x={160} y={298} textAnchor="middle" fontSize={10} fill="#9ca3af">{t('dataviz.geo3dLab.dragToRotate')}</text>
            </svg>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setAngleX(0.5); setAngleY(-0.4); }}
              className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              {t('dataviz.geo3dLab.resetView')}
            </button>
            <button type="button" onClick={() => setAutoSpin(s => !s)}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${autoSpin ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {autoSpin ? t('dataviz.geo3dLab.pauseSpin') : t('dataviz.geo3dLab.rotateBtn')}
            </button>
            <button type="button" onClick={() => setShowWire(w => !w)}
              className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${showWire ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {showWire ? t('dataviz.geo3dLab.wireframeOn') : t('dataviz.geo3dLab.wireframeOff')}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div className={`rounded-xl p-3 border ${catCfg.border} ${catCfg.bg}`}>
            <p className={`text-xs font-bold uppercase tracking-wide ${catCfg.text} mb-0.5`}>{catCfg.label}</p>
            <h3 className="text-lg font-extrabold text-gray-800">{solid.name}</h3>
            <p className="text-xs text-gray-500 italic">{solid.nameEn}</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([[t('dataviz.geo3dLab.vertices'), solid.V, 'text-indigo-700'], [t('dataviz.geo3dLab.edges'), solid.E, 'text-emerald-700'], [t('dataviz.geo3dLab.faces'), solid.F, 'text-amber-700']] as [string, number, string][]).map(([label, val, color]) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                <p className="text-[10px] text-gray-400 font-semibold uppercase">{label}</p>
                <p className={`text-2xl font-extrabold ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          {dualSolid && (
            <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] text-gray-400 font-semibold uppercase">{t('dataviz.geo3dLab.dualOf')}</p>
                <p className="text-sm font-bold text-gray-700">
                  {dualSolid.id === solid.id ? `${dualSolid.name} ${t('dataviz.geo3dLab.selfDual')}` : dualSolid.name}
                </p>
              </div>
              <button type="button" onClick={() => setSelId(dualSolid.id)}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold hover:bg-indigo-100 transition whitespace-nowrap">
                {t('dataviz.geo3dLab.showDual')}
              </button>
            </div>
          )}

          <div className={`rounded-xl border p-3 text-center ${euler === 2 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs font-semibold text-gray-500">{t('dataviz.geo3dLab.eulerFormula')}</p>
            <p className={`text-base font-extrabold ${euler === 2 ? 'text-green-700' : 'text-red-600'}`}>
              V − E + F = {solid.V} − {solid.E} + {solid.F} = <span className="text-xl">{euler}</span>
              {euler === 2 ? ' ✓' : ' ✗'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] text-gray-400 font-semibold uppercase">{t('dataviz.geo3dLab.volume')}</p>
              <p className="text-sm font-bold text-gray-700 mt-0.5 font-mono">{solid.volumeFormula}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-[10px] text-gray-400 font-semibold uppercase">{t('dataviz.geo3dLab.surfaceArea')}</p>
              <p className="text-sm font-bold text-gray-700 mt-0.5 font-mono">{solid.surfaceFormula}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
            <p className="text-xs text-amber-800"><span className="font-bold">{t('dataviz.geo3dLab.didYouKnow')}</span> {solid.funFact}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('dataviz.linalgLab.curriculum')}</p>
            <CurriculumBadges cur={solid.curriculum} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PlansElevations ──────────────────────────────────────────────────────────
function PlansElevations() {
  const { t } = useLanguage();
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
            <line x1={W/2} y1={4} x2={W/2} y2={H-4} stroke="#e5e7eb" strokeWidth={1} />
            <line x1={4} y1={H/2} x2={W-4} y2={H/2} stroke="#e5e7eb" strokeWidth={1} />
            {solid.edges.map(([a, b], i) => {
              const pa = pts[a], pb = pts[b];
              return (
                <line key={i}
                  x1={cx + pa.x*sc} y1={cy - pa.y*sc}
                  x2={cx + pb.x*sc} y2={cy - pb.y*sc}
                  stroke="#4f46e5" strokeWidth={1.8} strokeLinecap="round" />
              );
            })}
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
          <span className="font-bold">{t('dataviz.geo3dLab.monProgramTitle')}</span> {t('dataviz.geo3dLab.monProgramBody')}
        </p>
      </div>

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

      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-500 w-28">{t('dataviz.geo3dLab.rotationYAxis')}</label>
        <input type="range" min={-Math.PI} max={Math.PI} step={0.05} value={angleY}
          onChange={e => setAngleY(parseFloat(e.target.value))}
          className="flex-1 accent-indigo-600" aria-label={t('dataviz.geo3dLab.rotationAria')} />
        <span className="text-xs font-bold text-indigo-700 w-14 text-right">{(angleY * 180 / Math.PI).toFixed(0)}°</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ProjectionPanel title={t('dataviz.geo3dLab.viewFront')} note={t('dataviz.geo3dLab.noteXY')}
          proj={v => ({ x: v[0], y: v[1] })} />
        <ProjectionPanel title={t('dataviz.geo3dLab.viewSide')} note={t('dataviz.geo3dLab.noteZY')}
          proj={v => ({ x: v[2], y: v[1] })} />
        <ProjectionPanel title={t('dataviz.geo3dLab.viewTop')} note={t('dataviz.geo3dLab.noteXZ')}
          proj={v => ({ x: v[0], y: -v[2] })} />
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800">
        <strong>{t('dataviz.geo3dLab.principleTitle')}</strong> {t('dataviz.geo3dLab.principleBody')}
      </div>
    </div>
  );
}

// ─── Geo3DExercisesTab ─────────────────────────────────────────────────────────
function Geo3DExercisesTab() {
  const session = useLabSession('geometry-3d', '3D Геометрија');
  const [difficulty, setDifficulty] = useLabDifficulty('geometry-3d');
  const { loadExercises } = session;
  const loadSet = useCallback((d?: 1 | 2 | 3) => {
    const level = d ?? difficulty;
    if (d !== undefined) setDifficulty(d);
    loadExercises(generateGeo3DSet(level));
  }, [difficulty, loadExercises]);
  return <LabExercisePanel session={session} onNewSet={loadSet} difficulty={difficulty} onDifficultyChange={setDifficulty} />;
}

// ─── Main export ──────────────────────────────────────────────────────────────
type GeoTab = 'explorer' | 'plans' | 'nets' | 'cross' | 'prispyram' | 'rounded' | 'exercises';

export function Geometry3DLab() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<GeoTab>('explorer');

  const TABS: { id: GeoTab; label: string }[] = [
    { id: 'explorer',  label: t('dataviz.geo3dLab.tabExplorer') },
    { id: 'plans',     label: t('dataviz.geo3dLab.tabPlans') },
    { id: 'nets',      label: t('dataviz.geo3dLab.tabNets') },
    { id: 'cross',     label: t('dataviz.geo3dLab.tabCross') },
    { id: 'prispyram', label: t('dataviz.geo3dLab.tabPrisPyram') },
    { id: 'rounded',   label: t('dataviz.geo3dLab.tabRounded') },
    { id: 'exercises', label: t('dataviz.geo3dLab.tabExercises') },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-2 flex-wrap">
        {TABS.map(tb => (
          <button key={tb.id} type="button" onClick={() => setTab(tb.id)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${tab === tb.id ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'explorer'  && <PolyhedraExplorer />}
      {tab === 'plans'     && <PlansElevations />}
      {tab === 'nets'      && <NetsExplorer />}
      {tab === 'cross'     && <CrossSections />}
      {tab === 'prispyram' && <PrismPyramidCalculator />}
      {tab === 'rounded'   && <RoundSolidsPanel />}
      {tab === 'exercises' && <Geo3DExercisesTab />}
    </div>
  );
}
