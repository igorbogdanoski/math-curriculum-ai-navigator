import React, { useState } from 'react';
import { BarChart3, Flame, Brain, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { heatColor, mkGrade, type StudentSubmission, type HeatmapEntry } from './testGradingTypes';

interface BatchResultsPanelProps {
  doneSubmissions: (StudentSubmission & { results: NonNullable<StudentSubmission['results']> })[];
  heatmap: HeatmapEntry[];
  classAvg: number;
  topMisconceptions: [string, number][];
  onReset: () => void;
}

export function BatchResultsPanel({ doneSubmissions, heatmap, classAvg, topMisconceptions, onReset }: BatchResultsPanelProps) {
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Class Summary */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-600" /> Резиме на класата
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-indigo-50 rounded-xl">
            <p className="text-3xl font-black text-indigo-600">{doneSubmissions.length}</p>
            <p className="text-xs font-bold text-indigo-500 mt-1">Прегледани</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-xl">
            <p className={`text-3xl font-black ${classAvg >= 70 ? 'text-green-600' : classAvg >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{classAvg}%</p>
            <p className="text-xs font-bold text-gray-500 mt-1">Просек на класата</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-xl">
            <p className="text-3xl font-black text-green-600">
              {doneSubmissions.filter(s => {
                const total = s.results.reduce((sum, r) => sum + r.earnedPoints, 0);
                const max = s.results.reduce((sum, r) => sum + r.maxPoints, 0);
                return max > 0 && (total / max) >= 0.8;
              }).length}
            </p>
            <p className="text-xs font-bold text-green-600 mt-1">Над 80%</p>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-xl">
            <p className="text-3xl font-black text-red-600">
              {doneSubmissions.filter(s => {
                const total = s.results.reduce((sum, r) => sum + r.earnedPoints, 0);
                const max = s.results.reduce((sum, r) => sum + r.maxPoints, 0);
                return max > 0 && (total / max) < 0.5;
              }).length}
            </p>
            <p className="text-xs font-bold text-red-600 mt-1">Под 50%</p>
          </div>
        </div>
      </div>

      {/* Misconception Heatmap */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" /> Heatmap на успешност по прашање
        </h2>
        <p className="text-xs text-gray-400 mb-4">Процент на точни одговори — темно-зелено = добро, темно-црвено = проблематично</p>
        <div className="space-y-3">
          {heatmap.map((h, i) => (
            <div key={h.questionId} className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-400 w-6 flex-shrink-0">П{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-700 truncate mb-1">{h.questionText || `Прашање ${i + 1}`}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div className={`h-4 rounded-full transition-all duration-700 ${heatColor(h.successRate)}`}
                      style={{ width: `${Math.round(h.successRate * 100)}%` }} />
                  </div>
                  <span className="text-xs font-black text-gray-700 w-10 text-right flex-shrink-0">
                    {Math.round(h.successRate * 100)}%
                  </span>
                </div>
                {h.misconceptions.length > 0 && (
                  <p className="text-[10px] text-orange-600 mt-0.5 truncate">
                    ⚠ {h.misconceptions[0]}{h.misconceptions.length > 1 ? ` +${h.misconceptions.length - 1}` : ''}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className="text-[10px] text-gray-400 font-bold">ЛЕГЕНДА:</span>
          {[['bg-green-500', '80–100%'], ['bg-lime-400', '60–80%'], ['bg-amber-400', '40–60%'], ['bg-orange-500', '20–40%'], ['bg-red-500', '0–20%']].map(([cls, lbl]) => (
            <div key={lbl} className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-sm ${cls}`} />
              <span className="text-[10px] text-gray-500">{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Misconceptions */}
      {topMisconceptions.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
          <h3 className="font-bold text-orange-900 flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5" /> Најчести misconceptions во класата — за следниот час
          </h3>
          <ol className="space-y-2">
            {topMisconceptions.map(([m, count], i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-orange-800">
                <span className="font-black text-orange-500 flex-shrink-0">{i + 1}.</span>
                <span className="flex-1">{m}</span>
                <span className="text-xs bg-orange-200 text-orange-800 font-bold px-2 py-0.5 rounded-full flex-shrink-0">{count}x</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Individual results */}
      <div>
        <h2 className="text-lg font-black text-gray-900 mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" /> Резултати по ученик
        </h2>
        <div className="space-y-2">
          {doneSubmissions.map(sub => {
            const total = sub.results.reduce((sum, r) => sum + r.earnedPoints, 0);
            const max = sub.results.reduce((sum, r) => sum + r.maxPoints, 0);
            const pct = max > 0 ? Math.round((total / max) * 100) : 0;
            const gi = mkGrade(pct);
            const isExpanded = expandedStudent === sub.id;
            return (
              <div key={sub.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedStudent(isExpanded ? null : sub.id)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                >
                  <img src={sub.preview} alt={sub.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-bold text-gray-900 truncate">{sub.name}</p>
                    <p className="text-xs text-gray-400">{total}/{max} поени</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={`text-xl font-black ${gi.color}`}>{gi.grade}</span>
                    <span className="text-gray-400 text-sm ml-1">{pct}%</span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                </button>
                {isExpanded && (
                  <div className="border-t border-gray-50 p-4 space-y-2 bg-gray-50/50">
                    {sub.results.map((r, ri) => (
                      <div key={r.questionId} className={`p-3 rounded-xl border ${r.earnedPoints === r.maxPoints ? 'border-green-100 bg-green-50/50' : r.earnedPoints === 0 ? 'border-red-100 bg-red-50/50' : 'border-amber-100 bg-amber-50/50'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-gray-500">П{ri + 1}</span>
                          <div className="flex items-center gap-1.5">
                            {r.confidence !== undefined && (
                              <span
                                title={`AI сигурност: ${Math.round(r.confidence * 100)}%`}
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                  r.confidence >= 0.85 ? 'bg-green-100 text-green-700' :
                                  r.confidence >= 0.6  ? 'bg-amber-100 text-amber-700' :
                                  'bg-red-100 text-red-600'
                                }`}
                              >
                                {Math.round(r.confidence * 100)}%
                              </span>
                            )}
                            <span className="text-sm font-black text-gray-700">{r.earnedPoints}/{r.maxPoints}</span>
                          </div>
                        </div>
                        <p className="text-xs text-gray-600">{r.feedback}</p>
                        {r.misconception && (
                          <p className="text-[10px] text-orange-600 mt-1">⚠ {r.misconception}</p>
                        )}
                        {r.correctionHint && r.earnedPoints < r.maxPoints && (
                          <p className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 mt-1">💡 {r.correctionHint}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        className="w-full py-3 border-2 border-dashed border-gray-200 text-gray-500 font-bold rounded-2xl hover:border-violet-300 hover:text-violet-600 transition-all"
      >
        + Прегледај нов тест
      </button>
    </div>
  );
}
