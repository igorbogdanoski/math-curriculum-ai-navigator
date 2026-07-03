import React from 'react';
import { nationalStandards } from '../../data/national-standards';
import { CROSS_CURRICULAR_WITH_MATH, AREA_LABELS, AREA_ICONS, AREA_COLORS } from '../../data/allNationalStandardsComplete';
import type { SubjectArea } from '../../data/allNationalStandardsComplete';
import { topicsAddressStd } from './planAnalyticsHelpers';

interface Props {
  planTopics: string[];
  gradeNum: number | null;
}

export const NationalStandardsPanel: React.FC<Props> = ({ planTopics, gradeNum: _gradeNum }) => {
  const [showCross, setShowCross] = React.useState(false);
  const [expandedArea, setExpandedArea] = React.useState<SubjectArea | null>(null);

  const byCode = new Map<string, typeof nationalStandards[0]>();
  for (const s of nationalStandards) {
    const ex = byCode.get(s.code);
    if (!ex || (s.gradeLevel ?? 0) > (ex.gradeLevel ?? 0)) byCode.set(s.code, s);
  }
  const mathUnique = [...byCode.values()].sort((a, b) => {
    const na = parseInt(a.code.replace(/[^\d]/g, ''), 10);
    const nb = parseInt(b.code.replace(/[^\d]/g, ''), 10);
    return na - nb;
  });
  const mathAddressed = mathUnique.filter(s => topicsAddressStd(planTopics, s.description));
  const mathPct = mathUnique.length > 0 ? Math.round((mathAddressed.length / mathUnique.length) * 100) : 0;

  const crossByArea = React.useMemo(() => {
    const map = new Map<SubjectArea, typeof CROSS_CURRICULAR_WITH_MATH>();
    for (const s of CROSS_CURRICULAR_WITH_MATH) {
      if (!map.has(s.area)) map.set(s.area, []);
      map.get(s.area)!.push(s);
    }
    return map;
  }, []);

  const areasOrder: SubjectArea[] = ['language', 'foreign_lang', 'digital', 'personal', 'society', 'technology', 'arts'];

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
          МОН Национални Стандарди — 8 Подрачја
        </h3>
        <span className="text-[10px] text-gray-400 italic">
          Компетенции по завршување на основно образование — развиваат се постепено низ сите 9 год.
        </span>
      </div>

      {/* Math standards III-А.1–27 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold text-indigo-700">🔢 III. Математика — III-А.1–27</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
            mathPct >= 70 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : mathPct >= 40 ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-gray-50 text-gray-500 border-gray-200'
          }`}>
            {mathAddressed.length}/{mathUnique.length} ({mathPct}%)
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${mathPct >= 70 ? 'bg-emerald-500' : mathPct >= 40 ? 'bg-amber-400' : 'bg-indigo-300'}`} style={{ width: `${mathPct}%` }} />
        </div>
        <div className="flex flex-wrap gap-1">
          {mathUnique.map(std => {
            const ok = topicsAddressStd(planTopics, std.description);
            return (
              <span
                key={std.code}
                title={std.description}
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold cursor-default select-none ${
                  ok ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                {ok ? '✓' : '○'} {std.code}
              </span>
            );
          })}
        </div>
        {mathAddressed.length < mathUnique.length && (
          <details className="text-[10px]">
            <summary className="cursor-pointer text-indigo-500 hover:text-indigo-700 font-semibold select-none">
              Непокриени математички стандарди ({mathUnique.length - mathAddressed.length})
            </summary>
            <ul className="mt-1 space-y-0.5 pl-3">
              {mathUnique.filter(s => !topicsAddressStd(planTopics, s.description)).map(s => (
                <li key={s.code} className="text-gray-500">
                  <span className="font-mono text-indigo-500 font-bold">{s.code}</span>
                  {' — '}{s.description.slice(0, 80)}{s.description.length > 80 ? '…' : ''}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowCross(v => !v)}
        className="w-full flex items-center justify-between text-[11px] font-bold text-gray-600 hover:text-gray-800 border border-gray-100 rounded-lg px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span>🔗 Меѓупредметни поврзувања (7 подрачја)</span>
        <span className="text-gray-400">{showCross ? '▲' : '▼'}</span>
      </button>

      {showCross && (
        <div className="space-y-2">
          <p className="text-[10px] text-gray-400">
            Стандарди од другите 7 подрачја кои имаат директна врска со математичките концепти.
          </p>
          {areasOrder.map(area => {
            const stds = crossByArea.get(area) ?? [];
            if (stds.length === 0) return null;
            const colors = AREA_COLORS[area];
            const icon = AREA_ICONS[area];
            const label = AREA_LABELS[area];
            const isOpen = expandedArea === area;
            return (
              <div key={area} className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
                <button
                  type="button"
                  onClick={() => setExpandedArea(isOpen ? null : area)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold ${colors.text} hover:opacity-80 transition-opacity`}
                >
                  <span>{icon} {label}</span>
                  <span className="opacity-60">{stds.length} стандарди {isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    {stds.map(s => (
                      <div key={s.code} className="bg-white rounded-md border border-gray-100 p-2 space-y-1">
                        <div className="flex items-start gap-2">
                          <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border} shrink-0`}>
                            {s.code}
                          </span>
                          <p className="text-[10px] text-gray-700 leading-relaxed">{s.description}</p>
                        </div>
                        {s.mathBridge && s.mathBridge.length > 0 && (
                          <div className="flex flex-wrap gap-1 pl-1">
                            {s.mathBridge.map((b, i) => (
                              <span key={i} className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 rounded px-1.5 py-0.5 font-medium">
                                🔢 {b}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
