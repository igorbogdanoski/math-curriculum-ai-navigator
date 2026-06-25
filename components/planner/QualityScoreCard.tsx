import React from 'react';
import type { PlanQualityReport } from '../../services/gemini/planAnalysis';

export const QualityScoreCard: React.FC<{ report: PlanQualityReport }> = ({ report }) => {
  const scoreColor = (s: number) =>
    s >= 80 ? 'text-emerald-600' : s >= 60 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = (s: number) =>
    s >= 80 ? 'bg-emerald-50 border-emerald-100' : s >= 60 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';

  const dims = [
    { label: 'Блум баланс',      key: 'bloomBalance',          icon: '🧠' },
    { label: 'Покриеност',        key: 'curriculumCoverage',    icon: '📚' },
    { label: 'Оценување',         key: 'assessmentDistribution', icon: '📋' },
    { label: 'Прогресија',        key: 'verticalProgression',   icon: '📈' },
  ] as const;

  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-4 border text-center ${scoreBg(report.overallScore)}`}>
        <div className={`text-5xl font-black ${scoreColor(report.overallScore)}`}>{report.overallScore}</div>
        <div className="text-sm text-gray-500 mt-1 font-medium">Вкупна оценка / 100</div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {dims.map(({ label, key, icon }) => {
          const dim = report[key];
          return (
            <div key={key} className={`rounded-lg p-3 border ${scoreBg(dim.score)}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-600">{icon} {label}</span>
                <span className={`text-lg font-black ${scoreColor(dim.score)}`}>{dim.score}</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-tight">{dim.comment}</p>
            </div>
          );
        })}
      </div>
      {report.strengths.length > 0 && (
        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
          <h4 className="text-xs font-bold text-emerald-700 mb-1.5">✅ Силни страни</h4>
          <ul className="space-y-1">
            {report.strengths.map((s, i) => (
              <li key={i} className="text-xs text-emerald-800 flex gap-1.5">
                <span className="text-emerald-400 shrink-0">•</span>{s}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.suggestions.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
          <h4 className="text-xs font-bold text-amber-700 mb-1.5">💡 Препораки за подобрување</h4>
          <ul className="space-y-1">
            {report.suggestions.map((s, i) => (
              <li key={i} className="text-xs text-amber-800 flex gap-1.5">
                <span className="text-amber-400 shrink-0">{i + 1}.</span>{s}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
