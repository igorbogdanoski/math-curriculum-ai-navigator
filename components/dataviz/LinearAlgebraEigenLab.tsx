import React, { useState, useMemo, useEffect, useRef } from 'react';
import { type Mat2, type Mat3, fmt, det2, det3, mul3 } from './linearAlgebraMath';
import { MatrixInput } from './LinearAlgebraInputs';
// ─── S62-H2: Eigenvalue / Eigenvector Lab ────────────────────────────────────

function normV2(v: [number, number]): [number, number] {
  const n = Math.sqrt(v[0]*v[0] + v[1]*v[1]);
  return n > 1e-12 ? [v[0]/n, v[1]/n] as [number,number] : [1, 0] as [number,number];
}
function cross3(a: number[], b: number[]): [number,number,number] {
  return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}
function normV3(v: [number,number,number]): [number,number,number] {
  const n = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
  return n > 1e-12 ? [v[0]/n,v[1]/n,v[2]/n] as [number,number,number] : [1,0,0] as [number,number,number];
}

type Eigen2R =
  | { kind: 'real'; l: [number,number]; v: [[number,number],[number,number]] }
  | { kind: 'complex'; re: number; im: number };

function computeEigen2(m: Mat2): Eigen2R {
  const tr = m[0][0]+m[1][1], dt = det2(m);
  const disc = tr*tr - 4*dt;
  if (disc < -1e-8) return { kind: 'complex', re: tr/2, im: Math.sqrt(-disc)/2 };
  const sq = Math.sqrt(Math.max(0, disc));
  const l1 = (tr+sq)/2, l2 = (tr-sq)/2;
  const evec = (lam: number): [number,number] => {
    const b = m[0][1], c = m[1][0];
    let vx: number, vy: number;
    if (Math.abs(b) > 1e-9)      { vx = b; vy = lam - m[0][0]; }
    else if (Math.abs(c) > 1e-9) { vx = lam - m[1][1]; vy = c; }
    else                          { vx = 1; vy = 0; }
    return normV2([vx, vy]);
  };
  return {
    kind: 'real',
    l: [l1, l2] as [number,number],
    v: [evec(l1), evec(l2)] as [[number,number],[number,number]],
  };
}

function qrStep3(A: Mat3): Mat3 {
  const col = (j: number) => [A[0][j], A[1][j], A[2][j]];
  const qs: number[][] = [];
  const R: number[][] = [[0,0,0],[0,0,0],[0,0,0]];
  for (let j = 0; j < 3; j++) {
    let v = col(j);
    for (let i = 0; i < j; i++) {
      const rij = v[0]*qs[i][0]+v[1]*qs[i][1]+v[2]*qs[i][2];
      R[i][j] = rij;
      v = v.map((x, k) => x - rij*qs[i][k]);
    }
    const nrm = Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
    R[j][j] = nrm;
    qs.push(nrm > 1e-12 ? v.map(x => x/nrm) : [+(j===0),+(j===1),+(j===2)]);
  }
  const Q: Mat3 = [
    [qs[0][0],qs[1][0],qs[2][0]],
    [qs[0][1],qs[1][1],qs[2][1]],
    [qs[0][2],qs[1][2],qs[2][2]],
  ];
  return mul3(R as Mat3, Q);
}

function eigenvalues3(m: Mat3): [number,number,number] {
  let Ak: Mat3 = m.map(r => [...r]) as Mat3;
  for (let i = 0; i < 80; i++) Ak = qrStep3(Ak);
  return [Ak[0][0], Ak[1][1], Ak[2][2]];
}

function eigenvec3(m: Mat3, lam: number): [number,number,number] {
  const B = m.map((row, i) => row.map((v, j) => v - (i===j ? lam : 0)));
  let best: [number,number,number] = [1,0,0];
  let bestN = 0;
  for (let i = 0; i < 3; i++) for (let j = i+1; j < 3; j++) {
    const cp = cross3(B[i], B[j]);
    const n = Math.sqrt(cp[0]*cp[0]+cp[1]*cp[1]+cp[2]*cp[2]);
    if (n > bestN) { best = cp; bestN = n; }
  }
  return normV3(best);
}

const ELW = 380, ELH = 290, ELCX = 190, ELCY = 145, ELSC = 45;
function elVec(x: number, y: number) { return { sx: ELCX+x*ELSC, sy: ELCY-y*ELSC }; }

function EigenArrow({ vx, vy, color, label, dashed = false }: {
  vx: number; vy: number; color: string; label: string; dashed?: boolean;
}) {
  const { sx, sy } = elVec(vx, vy);
  const len = Math.sqrt(vx*vx+vy*vy)*ELSC;
  if (len < 3) return null;
  const mid = `em${color.slice(1)}${label.replace(/[^a-z0-9]/gi, '_')}`;
  return (
    <g>
      <defs>
        <marker id={mid} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={color} />
        </marker>
      </defs>
      <line x1={ELCX} y1={ELCY} x2={sx} y2={sy}
        stroke={color} strokeWidth={dashed ? 1.5 : 2.5}
        strokeDasharray={dashed ? '5 3' : undefined}
        markerEnd={`url(#${mid})`}
      />
      <text x={sx+5} y={sy-4} fontSize={11} fill={color} fontWeight="bold">{label}</text>
    </g>
  );
}

const E2_PRESETS: { label: string; mat: Mat2 }[] = [
  { label: 'Скалирање 2,3',  mat: [[2,0],[0,3]] },
  { label: 'Симетрична',      mat: [[3,1],[1,3]] },
  { label: 'Смолкнување',     mat: [[1,1],[0,1]] },
  { label: 'Ротација 45°',   mat: [[Math.cos(Math.PI/4),-Math.sin(Math.PI/4)],[Math.sin(Math.PI/4),Math.cos(Math.PI/4)]] },
  { label: 'Рефлексија',      mat: [[-1,0],[0,1]] },
];

const E3_PRESETS: { label: string; mat: Mat3 }[] = [
  { label: 'Дијагонална',    mat: [[1,0,0],[0,2,0],[0,0,3]] },
  { label: 'Симетрична',     mat: [[4,1,2],[1,3,0],[2,0,2]] },
  { label: 'Горна триаголна', mat: [[2,1,0],[0,3,1],[0,0,4]] },
];

const MORPH_PERIOD = 2800;

export function EigenLab() {
  const [sz, setSz] = useState<2|3>(2);
  const [m2, setM2] = useState<Mat2>([[3,1],[1,3]]);
  const [m3, setM3] = useState<Mat3>([[4,1,2],[1,3,0],[2,0,2]]);
  const [p2, setP2] = useState(1);
  const [p3, setP3] = useState(1);

  // Animation state: t ∈ [0,1] morphs unit circle → A·circle
  const [playing, setPlaying] = useState(false);
  const [animT, setAnimT] = useState(1);
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const step = (ts: number) => {
      if (t0Ref.current === null) t0Ref.current = ts - animT * MORPH_PERIOD;
      const elapsed = (ts - t0Ref.current) % (MORPH_PERIOD * 2);
      const t = elapsed <= MORPH_PERIOD ? elapsed / MORPH_PERIOD : 2 - elapsed / MORPH_PERIOD;
      setAnimT(t);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Morphed image points: M(t) = (1-t)·I + t·A  applied to unit circle
  const morphPts = useMemo(() => {
    const pts: {sx: number; sy: number}[] = [];
    for (let k = 0; k <= 64; k++) {
      const th = (k / 64) * 2 * Math.PI;
      const cx = Math.cos(th), cy = Math.sin(th);
      const ax = m2[0][0] * cx + m2[0][1] * cy;
      const ay = m2[1][0] * cx + m2[1][1] * cy;
      const px = (1 - animT) * cx + animT * ax;
      const py = (1 - animT) * cy + animT * ay;
      const { sx, sy } = elVec(px, py);
      pts.push({ sx, sy });
    }
    return pts;
  }, [m2, animT]);

  const e2 = useMemo(() => computeEigen2(m2), [m2]);
  const tr2 = m2[0][0]+m2[1][1], dt2 = det2(m2);

  const e3 = useMemo(() => {
    try {
      const lams = eigenvalues3(m3);
      return { lams, vecs: lams.map(l => eigenvec3(m3, l)) };
    } catch { return null; }
  }, [m3]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {([2,3] as const).map(s => (
          <button key={s} type="button" onClick={() => setSz(s)}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold border-2 transition ${sz===s?'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700':'border-gray-200 text-gray-500 hover:border-fuchsia-300'}`}>
            {s}×{s} матрица
          </button>
        ))}
      </div>

      {sz === 2 && (
        <div className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {E2_PRESETS.map((p, i) => (
              <button key={i} type="button" onClick={() => { setM2(p.mat); setP2(i); }}
                className={`text-xs px-2.5 py-1 rounded-lg border-2 font-semibold transition ${p2===i?'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700':'border-gray-200 text-gray-500 hover:border-fuchsia-300'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-6 flex-wrap items-start">
            <MatrixInput value={m2} onChange={m => setM2(m as Mat2)} size={2} label="Матрица A" color="fuchsia" />
            <div className="space-y-2 min-w-[180px]">
              <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-3 text-xs">
                <p className="font-bold text-fuchsia-600 mb-1">Карактеристичен полином</p>
                <p className="font-mono">λ² − {fmt(tr2)}λ + {fmt(dt2)} = 0</p>
                <p className="text-gray-400 mt-0.5">Δ = {fmt(tr2*tr2 - 4*dt2)}</p>
              </div>
              {e2.kind === 'real' ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {e2.l.map((lam, i) => (
                    <div key={i} className={`rounded-xl border p-2 text-xs text-center ${i===0?'bg-indigo-50 border-indigo-200':'bg-rose-50 border-rose-200'}`}>
                      <p className={`font-bold ${i===0?'text-indigo-600':'text-rose-600'}`}>
                        {i===0?'λ₁':'λ₂'} = {fmt(lam)}
                      </p>
                      <p className="font-mono text-gray-500 text-[10px] mt-0.5">
                        ({fmt(e2.v[i][0])}, {fmt(e2.v[i][1])})
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs">
                  <p className="font-bold text-amber-600">Комплексни λ</p>
                  <p className="font-mono mt-0.5">{fmt(e2.re)} ± {fmt(e2.im)}i</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Animation toolbar */}
            <div className="flex items-center gap-3 px-3 pt-2.5 pb-1">
              <button
                type="button"
                onClick={() => { setPlaying(p => !p); t0Ref.current = null; }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border-2 transition ${playing ? 'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700' : 'border-gray-200 text-gray-500 hover:border-fuchsia-300'}`}
              >
                {playing ? '⏸ Паузирај' : '▶ Анимирај трансформација'}
              </button>
              <input
                type="range" min={0} max={1} step={0.01}
                value={animT}
                aria-label="Морф параметар t (0 = единична кружница, 1 = трансформирана)"
                onChange={e => { setPlaying(false); setAnimT(parseFloat(e.target.value)); }}
                className="flex-1 accent-fuchsia-500"
              />
              <span className="text-[10px] font-mono text-gray-400 w-10 text-right">t={animT.toFixed(2)}</span>
            </div>
            <svg viewBox={`0 0 ${ELW} ${ELH}`} className="w-full max-h-[270px]">
              {[-3,-2,-1,0,1,2,3].map(g => {
                const { sx } = elVec(g,0); const { sy } = elVec(0,g);
                return (
                  <g key={g}>
                    <line x1={sx} y1={0} x2={sx} y2={ELH} stroke={g===0?'#9ca3af':'#f1f5f9'} strokeWidth={g===0?1.5:0.8}/>
                    <line x1={0} y1={sy} x2={ELW} y2={sy} stroke={g===0?'#9ca3af':'#f1f5f9'} strokeWidth={g===0?1.5:0.8}/>
                    {g!==0&&<text x={ELCX+4} y={sy+3} fontSize={9} fill="#d1d5db">{g}</text>}
                    {g!==0&&<text x={sx} y={ELCY+14} textAnchor="middle" fontSize={9} fill="#d1d5db">{g}</text>}
                  </g>
                );
              })}
              {/* Ghost unit circle */}
              <circle cx={ELCX} cy={ELCY} r={ELSC} fill="none" stroke="#e2e8f0" strokeWidth={animT > 0.05 ? 1 : 1.5} strokeDasharray="4 2"/>
              {/* Morphed circle/ellipse */}
              {morphPts.length > 1 && (
                <path
                  d={morphPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`).join(' ') + ' Z'}
                  fill="#14b8a6" fillOpacity={0.12} stroke="#14b8a6" strokeWidth={2}
                />
              )}
              {/* Eigenvectors: solid = unit vᵢ, dashed = interpolated to λᵢvᵢ */}
              {e2.kind === 'real' && (
                <>
                  <EigenArrow vx={e2.v[0][0]} vy={e2.v[0][1]} color="#6366f1" label="v₁"/>
                  <EigenArrow vx={e2.v[1][0]} vy={e2.v[1][1]} color="#f43f5e" label="v₂"/>
                  <EigenArrow
                    vx={((1 - animT) + animT * e2.l[0]) * e2.v[0][0]}
                    vy={((1 - animT) + animT * e2.l[0]) * e2.v[0][1]}
                    color="#6366f1" label="λ₁v₁" dashed
                  />
                  <EigenArrow
                    vx={((1 - animT) + animT * e2.l[1]) * e2.v[1][0]}
                    vy={((1 - animT) + animT * e2.l[1]) * e2.v[1][1]}
                    color="#f43f5e" label="λ₂v₂" dashed
                  />
                </>
              )}
              <circle cx={ELCX} cy={ELCY} r={3} fill="#374151"/>
            </svg>
          </div>
          <div className="flex flex-wrap gap-3 text-[11px]">
            <span className="flex items-center gap-1 text-gray-400">
              <span className="inline-block w-5 border-b border-dashed border-gray-300"/>единична кружница (t=0)
            </span>
            <span className="flex items-center gap-1 text-teal-600">
              <span className="inline-block w-5 border-b-2 border-teal-500"/>M(t)·кружница → A·кружница (t=1)
            </span>
            <span className="flex items-center gap-1 text-indigo-600">
              <span className="inline-block w-5 border-b-2 border-indigo-500"/>v₁ → λ₁v₁
            </span>
            <span className="flex items-center gap-1 text-rose-600">
              <span className="inline-block w-5 border-b-2 border-rose-500"/>v₂ → λ₂v₂
            </span>
          </div>
        </div>
      )}

      {sz === 3 && (
        <div className="space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            {E3_PRESETS.map((p, i) => (
              <button key={i} type="button" onClick={() => { setM3(p.mat); setP3(i); }}
                className={`text-xs px-2.5 py-1 rounded-lg border-2 font-semibold transition ${p3===i?'border-fuchsia-500 bg-fuchsia-50 text-fuchsia-700':'border-gray-200 text-gray-500 hover:border-fuchsia-300'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <MatrixInput value={m3} onChange={m => setM3(m as Mat3)} size={3} label="Матрица A" color="fuchsia" />
          {e3 && (
            <div className="space-y-2">
              <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-xl p-3">
                <p className="text-xs font-bold text-fuchsia-600 mb-2">Сопствени вредности (QR-итерација, 80 чекори)</p>
                <div className="grid grid-cols-3 gap-2">
                  {e3.lams.map((lam, i) => (
                    <div key={i} className="bg-white border border-fuchsia-200 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-gray-400">{['λ₁','λ₂','λ₃'][i]}</p>
                      <p className="text-base font-extrabold text-fuchsia-700 font-mono">{fmt(lam)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-xs font-bold text-gray-500 mb-2">Сопствени вектори (нормализирани)</p>
                <table className="text-xs w-full">
                  <thead><tr>
                    <th className="text-left text-gray-400 pr-4 pb-1 font-semibold">λ</th>
                    <th className="text-left text-gray-400 pb-1 font-semibold">v</th>
                  </tr></thead>
                  <tbody>
                    {e3.lams.map((lam, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="text-fuchsia-700 font-bold font-mono pr-4 py-1">{fmt(lam)}</td>
                        <td className="text-gray-700 font-mono py-1">
                          ({e3.vecs[i].map(v => fmt(v)).join(', ')})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-600">
                <strong>Проверка:</strong>&nbsp;
                tr(A) = {fmt(m3[0][0]+m3[1][1]+m3[2][2])} ≈ Σλ = {fmt(e3.lams.reduce((s,l)=>s+l,0))}&nbsp;|&nbsp;
                det(A) = {fmt(det3(m3))} ≈ ∏λ = {fmt(e3.lams.reduce((s,l)=>s*l,1))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-fuchsia-50 border border-fuchsia-100 rounded-xl p-3 text-xs text-fuchsia-700">
        <strong>Сопствена вредност λ, вектор v:</strong> A·v = λ·v — трансформацијата само го скалира v.
        Тралот на кружницата е слика на единичната кружница под A.
        Пресечните насоки со сопствените вектори се скалирани со |λ|.
      </div>
    </div>
  );
}
