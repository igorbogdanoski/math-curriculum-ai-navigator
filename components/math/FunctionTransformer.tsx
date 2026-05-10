/**
 * FunctionTransformer (S62-A3)
 *
 * Interactive visualisation of `y = a · f(b·x + c) + d` for all universal
 * base functions (sin/cos/tan/ln/x²/√x/|x|/x³/log_b/b^x/1/x/x^n/x).
 * Dynamically renders extra-param sliders (n, base) per function.
 */
import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  BASE_FUNCTIONS, IDENTITY_PARAMS, defaultExtraParams,
  buildPathD, formatFormula, sampleCurve,
  type BaseFunctionKey, type ExtraParams, type TransformParams,
} from './functionTransformerHelpers';

export interface FunctionTransformerProps {
  initialFunction?: BaseFunctionKey;
  initialParams?: Partial<TransformParams>;
  width?: number;
  height?: number;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  onParamsChange?: (params: TransformParams, fn: BaseFunctionKey) => void;
}

const SLIDER_RANGES = {
  a: { min: -3, max: 3, step: 0.1 },
  b: { min: -3, max: 3, step: 0.1 },
  c: { min: -6, max: 6, step: 0.1 },
  d: { min: -5, max: 5, step: 0.1 },
} as const;

export const FunctionTransformer: React.FC<FunctionTransformerProps> = ({
  initialFunction = 'sin',
  initialParams,
  width = 480,
  height = 320,
  xMin = -2 * Math.PI,
  xMax = 2 * Math.PI,
  yMin = -4,
  yMax = 4,
  onParamsChange,
}) => {
  const [fnKey, setFnKey] = useState<BaseFunctionKey>(initialFunction);
  const [params, setParams] = useState<TransformParams>({
    ...IDENTITY_PARAMS,
    ...initialParams,
  });
  const [extra, setExtra] = useState<ExtraParams>(() =>
    defaultExtraParams(BASE_FUNCTIONS[initialFunction]),
  );

  const fn = BASE_FUNCTIONS[fnKey];

  const updateParam = (k: keyof TransformParams) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...params, [k]: Number(e.target.value) };
    setParams(next);
    onParamsChange?.(next, fnKey);
  };

  const updateExtra = (k: keyof ExtraParams, epDef: { integer?: boolean }) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = Number(e.target.value);
      setExtra(prev => ({ ...prev, [k]: epDef.integer ? Math.round(raw) : raw }));
    };

  const onFnChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value as BaseFunctionKey;
    setFnKey(next);
    setExtra(defaultExtraParams(BASE_FUNCTIONS[next]));
    onParamsChange?.(params, next);
  };

  const reset = () => {
    setParams(IDENTITY_PARAMS);
    setExtra(defaultExtraParams(fn));
    onParamsChange?.(IDENTITY_PARAMS, fnKey);
  };

  const samples = useMemo(
    () => sampleCurve(fn, params, { xMin, xMax, samples: 400 }, extra),
    [fn, params, xMin, xMax, extra],
  );
  const baseSamples = useMemo(
    () => sampleCurve(fn, IDENTITY_PARAMS, { xMin, xMax, samples: 400 }, extra),
    [fn, xMin, xMax, extra],
  );

  const pad = 24;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;
  const toScreen = (x: number, y: number) => ({
    sx: pad + ((x - xMin) / (xMax - xMin)) * plotW,
    sy: pad + plotH - ((y - yMin) / (yMax - yMin)) * plotH,
  });

  const dCurve = buildPathD(samples, toScreen, { yMin, yMax });
  const dBase  = buildPathD(baseSamples, toScreen, { yMin, yMax });
  const x0 = toScreen(0, 0);

  return (
    <div
      className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3"
      data-testid="function-transformer"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black text-gray-800">Трансформација на функција</h3>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-gray-900 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50"
          data-testid="function-transformer-reset"
        >
          <RotateCcw className="w-3 h-3" /> Ресет
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs font-semibold text-gray-700">
          Базна функција:
          <select
            value={fnKey}
            onChange={onFnChange}
            className="ml-2 px-2 py-1 text-xs border border-gray-200 rounded-md bg-white"
            data-testid="function-transformer-select"
          >
            {Object.values(BASE_FUNCTIONS).map((f) => (
              <option key={f.key} value={f.key}>{f.label}</option>
            ))}
          </select>
        </label>
        <code
          className="px-2 py-1 text-xs font-mono bg-indigo-50 text-indigo-800 rounded-md border border-indigo-100"
          data-testid="function-transformer-formula"
        >
          y = {formatFormula(fn, params, extra)}
        </code>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto bg-gray-50 rounded-xl border border-gray-100"
        role="img"
        aria-label={`График на y = ${formatFormula(fn, params, extra)}`}
        data-testid="function-transformer-plot"
      >
        {Array.from({ length: 9 }, (_, i) => i - 4).map((g) => {
          const { sx } = toScreen(g, 0);
          return (
            <line key={`vx${g}`} x1={sx} y1={pad} x2={sx} y2={pad + plotH}
              stroke={g === 0 ? '#9ca3af' : '#e5e7eb'} strokeWidth={g === 0 ? 1.5 : 1} />
          );
        })}
        {Array.from({ length: 9 }, (_, i) => i - 4).map((g) => {
          const { sy } = toScreen(0, g);
          return (
            <line key={`vy${g}`} x1={pad} y1={sy} x2={pad + plotW} y2={sy}
              stroke={g === 0 ? '#9ca3af' : '#e5e7eb'} strokeWidth={g === 0 ? 1.5 : 1} />
          );
        })}
        <path d={dBase}  fill="none" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={dCurve} fill="none" stroke="#4f46e5" strokeWidth={2} />
        <circle cx={x0.sx} cy={x0.sy} r={2.5} fill="#6b7280" />
      </svg>

      {/* a, b, c, d sliders */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['a', 'b', 'c', 'd'] as const).map((k) => (
          <label key={k} className="text-xs font-semibold text-gray-700 space-y-1">
            <span className="flex items-center justify-between">
              <span>{k} = <span className="font-mono font-bold text-indigo-700">{params[k].toFixed(2)}</span></span>
            </span>
            <input
              type="range"
              value={params[k]}
              min={SLIDER_RANGES[k].min}
              max={SLIDER_RANGES[k].max}
              step={SLIDER_RANGES[k].step}
              onChange={updateParam(k)}
              className="w-full accent-indigo-600"
              data-testid={`function-transformer-slider-${k}`}
              aria-label={`Параметар ${k}`}
            />
          </label>
        ))}
      </div>

      {/* Dynamic extra-param sliders (n, base) */}
      {fn.extraParams && fn.extraParams.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-gray-100">
          {fn.extraParams.map((ep) => {
            const val = extra[ep.key] ?? ep.default;
            const display = ep.integer ? Math.round(val).toString() : val.toFixed(2);
            return (
              <label key={ep.key} className="text-xs font-semibold text-gray-700 space-y-1">
                <span className="flex items-center justify-between">
                  <span>{ep.label} = <span className="font-mono font-bold text-emerald-700">{display}</span></span>
                </span>
                <input
                  type="range"
                  value={val}
                  min={ep.min}
                  max={ep.max}
                  step={ep.step}
                  onChange={updateExtra(ep.key, ep)}
                  className="w-full accent-emerald-600"
                  data-testid={`function-transformer-extra-${ep.key}`}
                  aria-label={ep.label}
                />
              </label>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-gray-500">
        Префрли ги слајдерите за да видиш како a, b, c и d ја менуваат основната крива
        <span className="text-gray-400 italic"> (испреклинетата линија = оригиналната f(x))</span>.
      </p>
    </div>
  );
};
