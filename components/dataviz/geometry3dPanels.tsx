import React, { useState } from 'react';
import { type CurriculumRef, SOLIDS, CAT_CONFIG, CONE_CRITICAL_THETA_DEG, computeConeCrossSection } from './geometry3dMath';
import { useLanguage } from '../../i18n/LanguageContext';

// ─── Shared: CurriculumBadges ─────────────────────────────────────────────────
export function CurriculumBadges({ cur }: { cur: CurriculumRef }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {cur.primary?.map(p => (
        <span key={p} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">{t('dataviz.geo3dPanels.curricMon').replace('{p}', p)}</span>
      ))}
      {cur.gymnasium?.map(g => (
        <span key={g} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">{t('dataviz.geo3dPanels.curricGym').replace('{g}', g)}</span>
      ))}
      {cur.vocational?.map(v => (
        <span key={v} className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">{v}</span>
      ))}
    </div>
  );
}

// ─── NetsExplorer ─────────────────────────────────────────────────────────────
interface NetFace { points: string; color: string; label: string; textX: number; textY: number; }
interface NetDef { id: string; name: string; faces: NetFace[]; viewBox: string; curriculum: CurriculumRef; }

// name/label fields hold i18n keys (not literal text) — see DuggaQuestionEditor's Q_TYPES/TEST_TYPES convention
const NETS: NetDef[] = [
  {
    id: 'cube', name: 'dataviz.geo3dPanels.netCube',
    viewBox: '0 0 280 230',
    curriculum: { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.','Стручно III год.'] },
    faces: [
      { points: '95,10 155,10 155,65 95,65',   color: '#818cf8', label: 'dataviz.geo3dPanels.faceTop',    textX:125, textY:41 },
      { points: '35,70 95,70 95,125 35,125',   color: '#34d399', label: 'dataviz.geo3dPanels.faceLeft',    textX: 65, textY:101 },
      { points: '95,70 155,70 155,125 95,125', color: '#60a5fa', label: 'dataviz.geo3dPanels.faceFront',  textX:125, textY:101 },
      { points: '155,70 215,70 215,125 155,125',color:'#f472b6', label: 'dataviz.geo3dPanels.faceRight',   textX:185, textY:101 },
      { points: '215,70 275,70 275,125 215,125',color:'#fb923c', label: 'dataviz.geo3dPanels.faceBack',   textX:245, textY:101 },
      { points: '95,130 155,130 155,185 95,185',color:'#facc15', label: 'dataviz.geo3dPanels.faceBottom',    textX:125, textY:161 },
    ],
  },
  {
    id: 'tetra', name: 'dataviz.geo3dPanels.netTetra',
    viewBox: '0 0 320 260',
    curriculum: { primary:['VII','IX'], gymnasium:['I година'], vocational:['Стручно I год.'] },
    faces: [
      { points: '160,84 120,153 200,153', color: '#f97316', label: 'dataviz.geo3dPanels.faceBase',   textX:160, textY:135 },
      { points: '160,84 120,153 80,84',   color: '#60a5fa', label: 'dataviz.geo3dPanels.faceN2',textX:120, textY:110 },
      { points: '160,84 200,153 240,84',  color: '#34d399', label: 'dataviz.geo3dPanels.faceN3',textX:200, textY:110 },
      { points: '120,153 200,153 160,222',color: '#f472b6', label: 'dataviz.geo3dPanels.faceN4',textX:160, textY:180 },
    ],
  },
  {
    id: 'sqpyramid', name: 'dataviz.geo3dPanels.netSqPyramid',
    viewBox: '0 0 320 300',
    curriculum: { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.','Стручно III год.'] },
    faces: [
      { points: '120,110 200,110 200,190 120,190', color: '#fbbf24', label: 'dataviz.geo3dPanels.faceBaseAlt',  textX:160, textY:153 },
      { points: '120,110 200,110 160,50',           color: '#60a5fa', label: 'dataviz.geo3dPanels.faceN1',  textX:160, textY: 97 },
      { points: '200,110 200,190 265,150',          color: '#34d399', label: 'dataviz.geo3dPanels.faceN2',  textX:228, textY:153 },
      { points: '120,190 200,190 160,250',          color: '#f472b6', label: 'dataviz.geo3dPanels.faceN3',  textX:160, textY:215 },
      { points: '120,110 120,190 55,150',           color: '#f97316', label: 'dataviz.geo3dPanels.faceN4',  textX: 92, textY:153 },
    ],
  },
  {
    id: 'triprism', name: 'dataviz.geo3dPanels.netTriPrism',
    viewBox: '0 0 310 200',
    curriculum: { primary:['VII'], gymnasium:['I година'], vocational:['Стручно I год.','Стручно II год.','Стручно III год.'] },
    faces: [
      { points: '30,65 100,65 100,130 30,130',  color: '#60a5fa', label: 'dataviz.geo3dPanels.faceSide1', textX: 65, textY:101 },
      { points: '100,65 170,65 170,130 100,130',color: '#34d399', label: 'dataviz.geo3dPanels.faceSide2', textX:135, textY:101 },
      { points: '170,65 240,65 240,130 170,130',color: '#f97316', label: 'dataviz.geo3dPanels.faceSide3', textX:205, textY:101 },
      { points: '30,65 100,65 65,15',            color: '#818cf8', label: 'dataviz.geo3dPanels.faceBase1',   textX: 65, textY: 52 },
      { points: '30,130 100,130 65,180',         color: '#f472b6', label: 'dataviz.geo3dPanels.faceBase2',   textX: 65, textY:152 },
    ],
  },
  {
    id: 'octa', name: 'dataviz.geo3dPanels.netOcta',
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

export function NetsExplorer() {
  const { t } = useLanguage();
  const [selId, setSelId] = useState('cube');
  const [showLabels, setShowLabels] = useState(true);
  const net = NETS.find(n => n.id === selId) ?? NETS[0];

  function printNet() {
    const vef = NET_VEF[net.id] ?? { V: 0, E: 0, F: 0 };
    const netName = t(net.name);
    const svgFaces = net.faces.map(face =>
      `<polygon points="${face.points}" fill="${face.color}" fill-opacity="0.8" stroke="white" stroke-width="2.5"/>` +
      `<text x="${face.textX}" y="${face.textY}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="bold" fill="white">${t(face.label)}</text>`
    ).join('');
    const euler = vef.V - vef.E + vef.F;
    const html =
      `<!DOCTYPE html><html lang="mk"><head><meta charset="UTF-8"><title>${netName}</title><style>` +
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
      `<h1>${netName}</h1>` +
      `<div class="sub">${t('dataviz.geo3dPanels.printCutInstr')}</div>` +
      `<svg viewBox="${net.viewBox}">${svgFaces}</svg>` +
      `<div class="instr"><h2>${t('dataviz.geo3dPanels.printAssemblyTitle')}</h2><ol>` +
      `<li>${t('dataviz.geo3dPanels.printStep1')}</li>` +
      `<li>${t('dataviz.geo3dPanels.printStep2')}</li>` +
      `<li>${t('dataviz.geo3dPanels.printStep3')}</li>` +
      `<li>${t('dataviz.geo3dPanels.printStep4')}</li>` +
      `<li>${t('dataviz.geo3dPanels.printStep5')}</li>` +
      `</ol></div>` +
      `<div class="euler"><h3>${t('dataviz.geo3dPanels.printEulerTitle')}</h3>` +
      `<div class="vef">` +
      `<div class="vi"><div class="vn">${vef.V}</div><div class="vl">${t('dataviz.geo3dPanels.printVertices')}</div></div>` +
      `<div class="op">&minus;</div>` +
      `<div class="vi"><div class="vn">${vef.E}</div><div class="vl">${t('dataviz.geo3dPanels.printEdges')}</div></div>` +
      `<div class="op">+</div>` +
      `<div class="vi"><div class="vn">${vef.F}</div><div class="vl">${t('dataviz.geo3dPanels.printFaces')}</div></div>` +
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
          <span className="font-bold">{t('dataviz.geo3dLab.monProgramTitle')}</span> {t('dataviz.geo3dPanels.monProgramNets')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {NETS.map(n => (
          <button key={n.id} type="button" onClick={() => setSelId(n.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition ${selId === n.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-500 hover:border-emerald-300'}`}>
            {t(n.name).split('—')[0].trim()}
          </button>
        ))}
        <button type="button" onClick={() => setShowLabels(l => !l)}
          className={`ml-auto px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition ${showLabels ? 'border-gray-400 bg-gray-100 text-gray-700' : 'border-gray-200 text-gray-400'}`}>
          {showLabels ? t('dataviz.geo3dPanels.hideLabels') : t('dataviz.geo3dPanels.showLabelsBtn')}
        </button>
        <button type="button" onClick={printNet}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-blue-400 bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
          {t('dataviz.geo3dPanels.printNet')}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden p-2">
        <p className="text-xs font-bold text-gray-500 text-center mb-2">{t(net.name)}</p>
        <svg viewBox={net.viewBox} className="w-full" style={{ maxHeight: 260 }}>
          {net.faces.map((face, i) => (
            <g key={i}>
              <polygon points={face.points} fill={face.color} fillOpacity={0.75} stroke="white" strokeWidth={2} />
              {showLabels && (
                <text x={face.textX} y={face.textY} textAnchor="middle" dominantBaseline="middle"
                  fontSize={10} fontWeight="bold" fill="white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {t(face.label)}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('dataviz.linalgLab.curriculum')}</p>
        <CurriculumBadges cur={net.curriculum} />
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-800">
        <strong>{t('dataviz.geo3dPanels.activityTitle')}</strong> {t('dataviz.geo3dPanels.activityBody')}
      </div>
    </div>
  );
}

// ─── CrossSections ────────────────────────────────────────────────────────────
type CSolid = 'sphere' | 'cube' | 'pyramid' | 'cone' | 'cylinder';

// name fields hold i18n keys (not literal text) — see DuggaQuestionEditor's Q_TYPES/TEST_TYPES convention
const CS_SOLID_LIST: { id: CSolid; name: string; color: string }[] = [
  { id: 'sphere',   name: 'dataviz.geo3dPanels.csSphere',    color: 'indigo'  },
  { id: 'cube',     name: 'dataviz.geo3dPanels.csCube',     color: 'emerald' },
  { id: 'pyramid',  name: 'dataviz.geo3dPanels.csPyramid', color: 'amber'   },
  { id: 'cone',     name: 'dataviz.geo3dPanels.csCone',    color: 'rose'    },
  { id: 'cylinder', name: 'dataviz.geo3dPanels.csCylinder', color: 'teal'    },
];

const CS_FILL: Record<CSolid, string> = {
  sphere: 'rgba(99,102,241,0.18)', cube: 'rgba(16,185,129,0.18)',
  pyramid: 'rgba(245,158,11,0.18)', cone: 'rgba(244,63,94,0.18)', cylinder: 'rgba(20,184,166,0.18)',
};
const CS_STROKE: Record<CSolid, string> = {
  sphere: '#6366f1', cube: '#10b981', pyramid: '#f59e0b', cone: '#f43f5e', cylinder: '#14b8a6',
};

export function CrossSections() {
  const { t } = useLanguage();
  const [solid, setSolid] = useState<CSolid>('sphere');
  const [h, setH] = useState(0);
  const [theta, setTheta] = useState(0); // tilt angle of the cutting plane (cone only)

  const SV = 180, sv_cx = 90, sv_cy = 90, sv_r = 70;
  const planeY = sv_cy - h * sv_r;
  const CS_W = 200, cs_cx = 100, cs_cy = 100, cs_sc = 55;

  let csName = '', csArea = 0, csPerim = 0;
  let csType: 'circle' | 'square' | 'point' | 'ellipse' | 'parabola' | 'hyperbola' = 'circle';
  let csR = 0, csSide = 0, csA = 0, csB = 0, csP = 0;

  switch (solid) {
    case 'sphere':
      csR = Math.sqrt(Math.max(0, 1 - h * h));
      csName = t('dataviz.geo3dPanels.circleLabel').replace('{r}', csR.toFixed(3));
      csArea = Math.PI * csR * csR; csPerim = 2 * Math.PI * csR; csType = 'circle';
      break;
    case 'cube':
      csSide = 2;
      csName = t('dataviz.geo3dPanels.squareLabel');
      csArea = 4; csPerim = 8; csType = 'square';
      break;
    case 'pyramid':
      csSide = Math.max(0, 1 - h);
      csName = csSide < 0.02 ? t('dataviz.geo3dPanels.pointLabel') : t('dataviz.geo3dPanels.squareSideLabel').replace('{s}', csSide.toFixed(3));
      csArea = csSide * csSide; csPerim = 4 * csSide; csType = csSide < 0.02 ? 'point' : 'square';
      break;
    case 'cone': {
      const cs = computeConeCrossSection(h, theta);
      csName = cs.name; csArea = cs.area; csPerim = cs.perim;
      csType = cs.type; csR = cs.r; csA = cs.a; csB = cs.b; csP = cs.p;
      break;
    }
    case 'cylinder':
      csR = 1;
      csName = t('dataviz.geo3dPanels.circleR1Label');
      csArea = Math.PI; csPerim = 2 * Math.PI; csType = 'circle';
      break;
  }

  // Schematic path data for cone-only conics that aren't a plain circle
  const conicScale = Math.min(cs_sc, 75 / Math.max(csA, csB, 0.3));
  let parabolaPath = '';
  if (csType === 'parabola') {
    const U = 1.3, p = Math.max(csP, 0.05);
    const vAtU = (U * U) / (4 * p);
    const pScale = Math.min(cs_sc, 70 / Math.max(U, vAtU, 0.5));
    const pts: string[] = [];
    for (let u = -U; u <= U + 1e-9; u += 0.05) {
      const v = (u * u) / (4 * p);
      pts.push(`${(cs_cx + u * pScale).toFixed(1)},${(cs_cy - 30 + v * pScale).toFixed(1)}`);
    }
    parabolaPath = `M${pts.join(' L')}`;
  }
  let hypPath1 = '', hypPath2 = '';
  if (csType === 'hyperbola') {
    const V = 1.2;
    const pts1: string[] = [], pts2: string[] = [];
    for (let v = -V; v <= V + 1e-9; v += 0.05) {
      const u = csA * Math.sqrt(1 + (v / Math.max(csB, 0.001)) ** 2);
      pts1.push(`${(cs_cx + u * conicScale).toFixed(1)},${(cs_cy - v * conicScale).toFixed(1)}`);
      pts2.push(`${(cs_cx - u * conicScale).toFixed(1)},${(cs_cy - v * conicScale).toFixed(1)}`);
    }
    hypPath1 = `M${pts1.join(' L')}`;
    hypPath2 = `M${pts2.join(' L')}`;
  }

  const fill = CS_FILL[solid], stroke = CS_STROKE[solid];

  return (
    <div className="space-y-4">
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3">
        <p className="text-xs text-sky-800">
          <span className="font-bold">{t('dataviz.geo3dLab.monProgramTitle')}</span> {t('dataviz.geo3dPanels.monProgramCross')}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {CS_SOLID_LIST.map(({ id, name, color }) => (
          <button key={id} type="button" onClick={() => setSolid(id)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition ${solid===id ? `border-${color}-500 bg-${color}-50 text-${color}-700` : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {t(name)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-500 w-28">{t('dataviz.geo3dPanels.heightH')}</label>
        <input type="range" min={-0.99} max={0.99} step={0.01} value={h}
          onChange={e => setH(parseFloat(e.target.value))}
          className="flex-1 accent-sky-600" aria-label={t('dataviz.geo3dPanels.heightAria')} />
        <span className="text-xs font-bold text-sky-700 w-14 text-right">{h.toFixed(2)}</span>
      </div>

      {solid === 'cone' && (
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold text-gray-500 w-28">{t('dataviz.geo3dPanels.planeAngle')}</label>
            <input type="range" min={0} max={75} step={1} value={theta}
              onChange={e => setTheta(parseFloat(e.target.value))}
              className="flex-1 accent-violet-600" aria-label={t('dataviz.geo3dPanels.planeAngleAria')} />
            <span className="text-xs font-bold text-violet-700 w-14 text-right">{theta.toFixed(0)}°</span>
          </div>
          <p className="text-[10px] text-gray-400 pl-[7.5rem]">
            {t('dataviz.geo3dPanels.criticalAngleNote').replace('{deg}', CONE_CRITICAL_THETA_DEG.toFixed(1))}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold text-gray-500 mb-1 text-center">{t('dataviz.geo3dPanels.sideViewLabel')}</p>
          <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
            <svg viewBox={`0 0 ${SV} ${SV}`} className="w-full" style={{ maxHeight: 190 }}>
              {solid === 'sphere' && <circle cx={sv_cx} cy={sv_cy} r={sv_r} fill={fill} stroke={stroke} strokeWidth={2}/>}
              {(solid === 'cube' || solid === 'cylinder') && (
                <rect x={sv_cx-sv_r} y={sv_cy-sv_r} width={sv_r*2} height={sv_r*2} fill={fill} stroke={stroke} strokeWidth={2}/>
              )}
              {(solid === 'pyramid' || solid === 'cone') && (
                <polygon points={`${sv_cx},${sv_cy-sv_r} ${sv_cx-sv_r},${sv_cy+sv_r} ${sv_cx+sv_r},${sv_cy+sv_r}`} fill={fill} stroke={stroke} strokeWidth={2}/>
              )}
              {solid === 'cone' && theta > 0 ? (() => {
                const thetaRad = theta * Math.PI / 180, L = sv_r + 10;
                const dx = L * Math.cos(thetaRad), dy = L * Math.sin(thetaRad);
                return (
                  <line x1={sv_cx-dx} y1={planeY-dy} x2={sv_cx+dx} y2={planeY+dy} stroke="#7c3aed" strokeWidth={2.5}/>
                );
              })() : (
                <line x1={sv_cx-sv_r-10} y1={planeY} x2={sv_cx+sv_r+10} y2={planeY} stroke="#0ea5e9" strokeWidth={2.5}/>
              )}
              <circle cx={sv_cx+sv_r+12} cy={planeY} r={4} fill="#0ea5e9"/>
              <text x={sv_cx-sv_r-6} y={sv_cy-sv_r+3} fontSize={8} fill="#9ca3af" textAnchor="end">+1</text>
              <text x={sv_cx-sv_r-6} y={sv_cy+sv_r+3} fontSize={8} fill="#9ca3af" textAnchor="end">−1</text>
              <text x={sv_cx-sv_r-6} y={planeY+3} fontSize={9} fill="#0ea5e9" textAnchor="end" fontWeight="bold">h</text>
            </svg>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 mb-1 text-center">{t('dataviz.geo3dPanels.resultShapeLabel')}</p>
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
              {csType === 'ellipse' && (
                <ellipse cx={cs_cx} cy={cs_cy} rx={csA * conicScale} ry={csB * conicScale} fill={fill} stroke={stroke} strokeWidth={2.5}/>
              )}
              {csType === 'parabola' && (
                <path d={parabolaPath} fill="none" stroke={stroke} strokeWidth={2.5}/>
              )}
              {csType === 'hyperbola' && (
                <>
                  <path d={hypPath1} fill="none" stroke={stroke} strokeWidth={2.5}/>
                  <path d={hypPath2} fill="none" stroke={stroke} strokeWidth={2.5}/>
                </>
              )}
              {csType === 'point' && <circle cx={cs_cx} cy={cs_cy} r={5} fill={stroke}/>}
              <text x={cs_cx} y={CS_W-8} textAnchor="middle" fontSize={10} fill="#64748b" fontWeight="bold">{csName}</text>
            </svg>
          </div>
        </div>
      </div>

      {(csType === 'circle' || csType === 'square' || csType === 'ellipse') ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-3 text-center bg-sky-50 border border-sky-200">
            <p className="text-[10px] text-gray-400 font-semibold">{t('dataviz.geo3dPanels.crossSectionArea')}</p>
            <p className="text-lg font-extrabold text-sky-700">{csArea.toFixed(4)} {t('dataviz.geo3dPanels.unitSq')}</p>
          </div>
          <div className="rounded-xl p-3 text-center bg-sky-50 border border-sky-200">
            <p className="text-[10px] text-gray-400 font-semibold">{csType === 'square' ? t('dataviz.geo3dPanels.perimeterLabel') : t('dataviz.geo3dPanels.circumferenceLabel')}</p>
            <p className="text-lg font-extrabold text-sky-700">{csPerim.toFixed(4)} {t('dataviz.geo3dPanels.unit')}</p>
          </div>
        </div>
      ) : csType === 'parabola' ? (
        <div className="rounded-xl p-3 text-center bg-sky-50 border border-sky-200">
          <p className="text-[10px] text-gray-400 font-semibold">{t('dataviz.geo3dPanels.parabolaParam')}</p>
          <p className="text-lg font-extrabold text-sky-700">p = {csP.toFixed(4)} {t('dataviz.geo3dPanels.unit')}</p>
        </div>
      ) : csType === 'hyperbola' ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-3 text-center bg-sky-50 border border-sky-200">
            <p className="text-[10px] text-gray-400 font-semibold">{t('dataviz.geo3dPanels.semiAxisA')}</p>
            <p className="text-lg font-extrabold text-sky-700">{csA.toFixed(4)} {t('dataviz.geo3dPanels.unit')}</p>
          </div>
          <div className="rounded-xl p-3 text-center bg-sky-50 border border-sky-200">
            <p className="text-[10px] text-gray-400 font-semibold">{t('dataviz.geo3dPanels.semiAxisB')}</p>
            <p className="text-lg font-extrabold text-sky-700">{csB.toFixed(4)} {t('dataviz.geo3dPanels.unit')}</p>
          </div>
        </div>
      ) : null}

      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-900 space-y-1">
        <p className="font-bold">{t('dataviz.geo3dPanels.conicSectionsTitle')}</p>
        <p dangerouslySetInnerHTML={{ __html: t('dataviz.geo3dPanels.conicSectionsLine1') }} />
        <p dangerouslySetInnerHTML={{ __html: t('dataviz.geo3dPanels.conicSectionsLine2') }} />
        <p>{t('dataviz.geo3dPanels.conicSectionsLine3')}</p>
      </div>

      {solid === 'cone' && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs text-violet-900">
          <strong>{t('dataviz.geo3dPanels.conicLinkTitle')}</strong><br/>
          {t('dataviz.geo3dPanels.conicLinkBody')}{' '}
          <a href="#/data-viz?tab=conic" className="underline font-bold ml-1">{t('dataviz.geo3dPanels.conicLinkCta')}</a>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{t('dataviz.linalgLab.curriculum')}</p>
        <div className="flex flex-wrap gap-1">
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">{t('dataviz.geo3dPanels.curricMon').replace('{p}', 'VII')}</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">{t('dataviz.geo3dPanels.curricMon').replace('{p}', 'VIII')}</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">{t('dataviz.geo3dPanels.curricMon').replace('{p}', 'IX')}</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">{t('dataviz.geo3dPanels.gymYear2')}</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 text-purple-700">{t('dataviz.geo3dPanels.gymYear11Elective')}</span>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-100 text-orange-700">{t('dataviz.linalgLab.vocYear1')}</span>
        </div>
      </div>
    </div>
  );
}

// Re-export SOLIDS/CAT_CONFIG for the main orchestrator
export { SOLIDS, CAT_CONFIG };
