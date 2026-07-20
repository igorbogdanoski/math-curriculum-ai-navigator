import React, { useState, useMemo } from 'react';
import {
  gaussElim, cramer, determinantCofactor, inverseAdjugate,
  luDecompose, choleskyDecompose, svdDecompose, matrixExp, jordanDecompose,
  identity, matFromFlat, fmtNum,
  type Mat,
} from '../../utils/matrixOps';
import { useLanguage } from '../../i18n/LanguageContext';

// ─── n×n Solver Lab ───────────────────────────────────────────────────────────
const GRID_COLS: Record<number, string> = { 2:'grid-cols-2', 3:'grid-cols-3', 4:'grid-cols-4', 5:'grid-cols-5', 6:'grid-cols-6' };
type NxNMode   = 'matrix' | 'system';
type NxNMethod = 'gauss' | 'cramer' | 'cofactor' | 'lu' | 'adj' | 'chol' | 'svd' | 'exp' | 'jordan';

const DIMS = [2, 3, 4, 5, 6] as const;
type Dim = typeof DIMS[number];

function makeFlat(n: number): number[] {
  return identity(n).flat();
}

function MatGrid({ flat, n, onChange, color = 'indigo', label }: {
  flat: number[]; n: Dim; onChange: (f: number[]) => void; color?: string; label: string;
}) {
  const update = (idx: number, v: string) => {
    const next = [...flat];
    next[idx] = parseFloat(v) || 0;
    onChange(next);
  };
  const cellSize = n <= 3 ? 'w-12 h-10' : n <= 4 ? 'w-10 h-9' : 'w-9 h-8';
  return (
    <div>
      <p className={`text-xs font-bold text-${color}-600 mb-1.5`}>{label}</p>
      <div className={`inline-grid gap-0.5 ${GRID_COLS[n]}`}>
        {flat.map((val, idx) => (
          <input
            key={idx}
            type="number"
            value={val}
            onChange={e => update(idx, e.target.value)}
            className={`${cellSize} text-center text-xs font-bold border-2 rounded-md focus:outline-none focus:ring-1 focus:ring-${color}-400 border-${color}-200 bg-${color}-50 text-${color}-800`}
            aria-label={`${label} [${Math.floor(idx/n)+1},${idx%n+1}]`}
          />
        ))}
      </div>
    </div>
  );
}

function VecInput({ vals, onChange, color = 'violet', label }: {
  vals: number[]; onChange: (v: number[]) => void; color?: string; label: string;
}) {
  const update = (i: number, v: string) => {
    const next = [...vals];
    next[i] = parseFloat(v) || 0;
    onChange(next);
  };
  return (
    <div>
      <p className={`text-xs font-bold text-${color}-600 mb-1.5`}>{label}</p>
      <div className="flex flex-col gap-0.5">
        {vals.map((v, i) => (
          <input
            key={i}
            type="number"
            value={v}
            onChange={e => update(i, e.target.value)}
            className={`w-12 h-8 text-center text-xs font-bold border-2 rounded-md focus:outline-none border-${color}-200 bg-${color}-50 text-${color}-800`}
            aria-label={`b[${i+1}]`}
          />
        ))}
      </div>
    </div>
  );
}

function MatResult({ m, label, color = 'emerald' }: { m: Mat | null; label: string; color?: string }) {
  const { t } = useLanguage();
  if (!m) return (
    <div className="text-center p-3 rounded-xl border border-red-200 bg-red-50">
      <p className="text-xs font-bold text-red-500">{label}</p>
      <p className="text-sm text-red-600 mt-1">{t('dataviz.linalgAdv.notExistsSingular')}</p>
    </div>
  );
  const n = m.length;
  return (
    <div className={`rounded-xl border p-3 bg-${color}-50 border-${color}-200`}>
      <p className={`text-xs font-bold text-${color}-600 mb-2`}>{label}</p>
      <div className={`inline-grid gap-0.5 ${GRID_COLS[n]}`}>
        {m.flat().map((v, i) => (
          <div key={i} className={`w-14 h-8 flex items-center justify-center text-xs font-bold font-mono bg-white border border-${color}-100 rounded`}>
            {fmtNum(v, 3)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function NxNSolverLab() {
  const { t } = useLanguage();
  const [n, setN]           = useState<Dim>(3);
  const [mode, setMode]     = useState<NxNMode>('system');
  const [method, setMethod] = useState<NxNMethod>('gauss');
  const [flatA, setFlatA]   = useState<number[]>(() => makeFlat(3));
  const [bVec, setBVec]     = useState<number[]>([1, 0, 0]);

  const A: Mat = useMemo(() => matFromFlat(flatA, n), [flatA, n]);

  const changeN = (newN: Dim) => {
    setN(newN);
    setFlatA(makeFlat(newN));
    setBVec(new Array(newN).fill(0));
  };

  const changeMode = (newMode: NxNMode) => {
    setMode(newMode);
    if (newMode === 'system' && !['gauss', 'cramer'].includes(method)) setMethod('gauss');
  };

  const MATRIX_METHODS: { id: NxNMethod; label: string; mode: NxNMode[] }[] = [
    { id: 'gauss',    label: t('dataviz.linalgAdv.methodGauss'), mode: ['system', 'matrix'] },
    { id: 'cramer',   label: t('dataviz.linalgAdv.methodCramer'),   mode: ['system'] },
    { id: 'cofactor', label: t('dataviz.linalgAdv.methodCofactor'),      mode: ['matrix'] },
    { id: 'lu',       label: t('dataviz.linalgAdv.methodLU'),     mode: ['matrix'] },
    { id: 'adj',      label: t('dataviz.linalgAdv.methodAdj'),     mode: ['matrix'] },
    { id: 'chol',     label: t('dataviz.linalgAdv.methodChol'),       mode: ['matrix'] },
    { id: 'svd',      label: t('dataviz.linalgAdv.methodSVD'),        mode: ['matrix'] },
    { id: 'exp',      label: t('dataviz.linalgAdv.methodExp'),   mode: ['matrix'] },
    { id: 'jordan',   label: t('dataviz.linalgAdv.methodJordan'),      mode: ['matrix'] },
  ];

  const availMethods = MATRIX_METHODS.filter(m =>
    m.mode.includes(mode) && (m.id === 'jordan' ? n <= 3 : true)
  );

  const result = useMemo(() => {
    try {
      if (mode === 'system') {
        if (method === 'gauss') return { type: 'gauss' as const, data: gaussElim(A, bVec) };
        if (method === 'cramer') return { type: 'cramer' as const, data: cramer(A, bVec) };
      } else {
        if (method === 'gauss')    return { type: 'gaussMat' as const, data: gaussElim(A) };
        if (method === 'cofactor') return { type: 'det' as const, data: { det: determinantCofactor(A) } };
        if (method === 'lu')       return { type: 'lu' as const, data: luDecompose(A) };
        if (method === 'adj')      return { type: 'inv' as const, data: inverseAdjugate(A) };
        if (method === 'chol')     return { type: 'chol' as const, data: choleskyDecompose(A) };
        if (method === 'svd')      return { type: 'svd' as const, data: svdDecompose(A) };
        if (method === 'exp')      return { type: 'exp' as const, data: matrixExp(A) };
        if (method === 'jordan')   return { type: 'jordan' as const, data: jordanDecompose(A) };
      }
    } catch { return null; }
    return null;
  }, [A, bVec, mode, method]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {DIMS.map(d => (
            <button key={d} type="button" onClick={() => changeN(d)}
              className={`w-9 h-9 rounded-lg text-sm font-bold border-2 transition ${n === d ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-500 hover:border-sky-300'}`}>
              {d}×{d}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
          {(['system', 'matrix'] as NxNMode[]).map(m => (
            <button key={m} type="button" onClick={() => changeMode(m)}
              className={`px-3 py-1.5 transition-colors ${mode === m ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'} ${m === 'matrix' ? 'border-l border-gray-200' : ''}`}>
              {m === 'system' ? t('dataviz.linalgAdv.modeSystem') : t('dataviz.linalgAdv.modeMatrix')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {availMethods.map(me => (
          <button key={me.id} type="button" onClick={() => setMethod(me.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition ${method === me.id ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-500 hover:border-sky-300'}`}>
            {me.label}
          </button>
        ))}
      </div>

      <div className="flex gap-4 flex-wrap items-start">
        <MatGrid flat={flatA} n={n} onChange={setFlatA} color="sky" label={t('dataviz.linalgAdv.matrixALabel').replace('{n}', String(n)).replace('{n}', String(n))} />
        {mode === 'system' && (
          <VecInput vals={bVec} onChange={setBVec} color="violet" label={t('dataviz.linalgAdv.vectorB')} />
        )}
      </div>

      {result && (
        <div className="space-y-3">
          {result.type === 'gauss' && result.data.solution && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-xs font-bold text-emerald-600 mb-2">{t('dataviz.linalgAdv.solutionX')}</p>
                <div className="flex gap-2 flex-wrap">
                  {result.data.solution.map((xi, i) => (
                    <div key={i} className="px-3 py-2 bg-white border border-emerald-200 rounded-lg text-center">
                      <p className="text-[10px] text-gray-400">x{i+1}</p>
                      <p className="text-sm font-extrabold text-emerald-700 font-mono">{fmtNum(xi, 4)}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-emerald-500 mt-2">det(A) = {fmtNum(result.data.det, 6)} · {t('dataviz.linalgAdv.rank')} = {result.data.rank}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-bold text-gray-500 mb-1.5">{t('dataviz.linalgAdv.steps')}</p>
                {result.data.steps.map((s, i) => (
                  <p key={i} className="text-xs font-mono text-gray-600 leading-5">
                    <span className="text-gray-400">{i+1}.</span> {s.desc}
                  </p>
                ))}
              </div>
            </>
          )}

          {result.type === 'gauss' && !result.data.solution && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              {t('dataviz.linalgAdv.noUniqueSolution').replace('{det}', fmtNum(result.data.det, 6)).replace('{rank}', String(result.data.rank))}
            </div>
          )}

          {result.type === 'cramer' && result.data && (
            <div className="space-y-2">
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                <p className="text-xs font-bold text-violet-600 mb-2">
                  {t('dataviz.linalgAdv.cramerDet').replace('{det}', fmtNum(result.data.det, 6))}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {result.data.solution.map((xi, i) => (
                    <div key={i} className="px-3 py-2 bg-white border border-violet-200 rounded-lg text-center">
                      <p className="text-[10px] text-gray-400">x{i+1} = D{i+1}/D</p>
                      <p className="text-xs text-violet-500 font-mono">{fmtNum(result.data!.columns[i].detDi,3)} / {fmtNum(result.data!.det,3)}</p>
                      <p className="text-sm font-extrabold text-violet-700 font-mono">{fmtNum(xi, 4)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {result.type === 'cramer' && !result.data && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              {t('dataviz.linalgAdv.cramerInvalid')}
            </div>
          )}

          {result.type === 'det' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-xs font-bold text-amber-600 mb-1">{t('dataviz.linalgAdv.detLaplace')}</p>
              <p className="text-3xl font-extrabold text-amber-700 font-mono">{fmtNum(result.data.det, 8)}</p>
              <p className="text-xs text-amber-500 mt-1">
                {Math.abs(result.data.det) < 1e-10 ? t('dataviz.linalgAdv.singularNoInverse') : t('dataviz.linalgAdv.invertibleMatrix')}
              </p>
            </div>
          )}

          {result.type === 'lu' && (
            <div className="grid md:grid-cols-2 gap-3">
              <MatResult m={result.data.L} label={t('dataviz.linalgAdv.lowerTriangular')} color="sky" />
              <MatResult m={result.data.U} label={t('dataviz.linalgAdv.upperTriangular')} color="amber" />
            </div>
          )}

          {result.type === 'inv' && (
            <MatResult m={result.data} label="A⁻¹ = adj(A) / det(A)" color="emerald" />
          )}

          {result.type === 'chol' && (
            result.data.isValid ? (
              <div className="space-y-3">
                <MatResult m={result.data.L} label={t('dataviz.linalgAdv.lowerTriangularChol')} color="teal" />
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-xs text-teal-700">
                  <strong>{t('dataviz.linalgAdv.choleskyBanachiewicz')}</strong> A = L·Lᵀ &nbsp;|&nbsp;
                  Lᵢᵢ = √(Aᵢᵢ − Σₖ Lᵢₖ²) &nbsp;|&nbsp;
                  Lᵢⱼ = (Aᵢⱼ − Σₖ LᵢₖLⱼₖ) / Lⱼⱼ &nbsp;{t('dataviz.linalgAdv.forILtGtJ')}
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                {t('dataviz.linalgAdv.choleskyNotPossible').replace('{reason}', result.data.reason ?? '')}
              </div>
            )
          )}

          {result.type === 'svd' && (
            <div className="space-y-3">
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-xs font-bold text-purple-600 mb-2">{t('dataviz.linalgAdv.singularValues')}</p>
                <div className="flex gap-2 flex-wrap">
                  {result.data.S.map((s, i) => (
                    <div key={i} className="px-3 py-2 bg-white border border-purple-200 rounded-lg text-center">
                      <p className="text-[10px] text-gray-400">σ{i+1}</p>
                      <p className="text-sm font-extrabold text-purple-700 font-mono">{fmtNum(s, 4)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <MatResult m={result.data.U} label={t('dataviz.linalgAdv.leftSingularVectors')} color="indigo" />
                <MatResult m={result.data.Vt} label={t('dataviz.linalgAdv.rightSingularVectors')} color="rose" />
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-700">
                <strong>A = U · Σ · Vᵀ</strong> &nbsp;|&nbsp; σᵢ = √λᵢ(AᵀA) &nbsp;|&nbsp;
                {t('dataviz.linalgAdv.rankNonzero')} &nbsp;|&nbsp; ||A||₂ = σ₁
              </div>
            </div>
          )}

          {result.type === 'exp' && (
            <div className="space-y-3">
              <MatResult m={result.data} label={t('dataviz.linalgAdv.matrixExpLabel')} color="emerald" />
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700">
                <strong>eᴬ = Σₖ Aᵏ/k!</strong> &nbsp;|&nbsp; {t('dataviz.linalgAdv.taylorNote')} &nbsp;|&nbsp;
                {t('dataviz.linalgAdv.diagonalizableNote')}
              </div>
            </div>
          )}

          {result.type === 'jordan' && (
            result.data.isValid ? (
              <div className="space-y-3">
                <MatResult m={result.data.J} label={t('dataviz.linalgAdv.jordanForm')} color="amber" />
                <MatResult m={result.data.P} label={t('dataviz.linalgAdv.transitionMatrix')} color="sky" />
                {result.data.Pinv && <MatResult m={result.data.Pinv} label="P⁻¹" color="slate" />}
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                  <strong>A = P J P⁻¹</strong> &nbsp;|&nbsp;
                  {result.data.blocks.map((b, i) => (
                    <span key={i}> {t('dataviz.linalgAdv.blockLabel').replace('{n}', String(i + 1))} λ={fmtNum(b.eigenvalue,3)}{b.isComplex ? `±${fmtNum(b.complexIm??0,3)}i` : ''} ({b.size}×{b.size})</span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                {result.data.reason}
              </div>
            )
          )}
        </div>
      )}

      <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-700">
        <strong>{t('dataviz.linalgAdv.methodsLabel')}</strong> Gauss · Cramer · Cofactor · LU · Adj/det · {t('dataviz.linalgAdv.choleskyPosDef')} ·
        SVD (A=UΣVᵀ) · eᴬ ({t('dataviz.linalgAdv.matrixExpShort')}) · Jordan ({t('dataviz.linalgAdv.normalForm')})
      </div>
    </div>
  );
}
