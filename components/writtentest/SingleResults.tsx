import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Brain, Lightbulb } from 'lucide-react';
import type { GradeResult, TestQuestion } from './testGradingTypes';

export const SingleResults: React.FC<{ results: GradeResult[]; questions: TestQuestion[] }> = ({ results, questions }) => {
  const totalEarned = results.reduce((sum, r) => sum + r.earnedPoints, 0);
  const totalMax = results.reduce((sum, r) => sum + r.maxPoints, 0);
  const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

  const getMkGrade = (pct: number) => {
    if (pct >= 90) return { grade: '5', label: 'Одличен', color: 'text-green-600', stroke: '#10b981' };
    if (pct >= 75) return { grade: '4', label: 'Многу добар', color: 'text-blue-600', stroke: '#3b82f6' };
    if (pct >= 60) return { grade: '3', label: 'Добар', color: 'text-yellow-600', stroke: '#eab308' };
    if (pct >= 50) return { grade: '2', label: 'Доволен', color: 'text-orange-600', stroke: '#f97316' };
    return { grade: '1', label: 'Незадоволителен', color: 'text-red-600', stroke: '#ef4444' };
  };
  const gi = getMkGrade(percentage);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-32 h-32 flex-shrink-0">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#f3f4f6" strokeWidth="12" />
              <circle cx="60" cy="60" r="50" fill="none" stroke={gi.stroke} strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - percentage / 100)}`}
                className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-gray-900">{percentage}%</span>
              <span className="text-xs text-gray-400 font-medium">Точност</span>
            </div>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className={`text-5xl font-black mb-1 ${gi.color}`}>{gi.grade}</div>
            <div className="text-xl font-bold text-gray-800">{gi.label}</div>
            <div className="text-gray-500 mt-1">{totalEarned} / {totalMax} поени</div>
            <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
              <span className="text-xs bg-green-50 text-green-700 font-bold px-3 py-1 rounded-full">
                {results.filter(r => r.earnedPoints === r.maxPoints).length} целосни
              </span>
              <span className="text-xs bg-amber-50 text-amber-700 font-bold px-3 py-1 rounded-full">
                {results.filter(r => r.earnedPoints > 0 && r.earnedPoints < r.maxPoints).length} делумни
              </span>
              <span className="text-xs bg-red-50 text-red-700 font-bold px-3 py-1 rounded-full">
                {results.filter(r => r.earnedPoints === 0).length} без поени
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {results.map((r, i) => {
          const qText = questions.find(q => q.id === r.questionId)?.text || `Прашање ${i + 1}`;
          const isOk = r.earnedPoints === r.maxPoints;
          const isZero = r.earnedPoints === 0;
          return (
            <div key={r.questionId} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isOk ? 'border-green-200' : isZero ? 'border-red-100' : 'border-amber-100'}`}>
              <div className={`flex items-center gap-4 p-4 ${isOk ? 'bg-green-50/60' : isZero ? 'bg-red-50/60' : 'bg-amber-50/60'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isOk ? 'bg-green-100 text-green-600' : isZero ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-600'}`}>
                  {isOk ? <CheckCircle2 className="w-5 h-5" /> : isZero ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Прашање {i + 1}</p>
                  <p className="font-bold text-gray-900 truncate">{qText}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-2xl font-black ${isOk ? 'text-green-600' : isZero ? 'text-red-500' : 'text-amber-600'}`}>{r.earnedPoints}</span>
                  <span className="text-gray-400 font-medium">/{r.maxPoints}</span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-700 leading-relaxed flex-1">{r.feedback}</p>
                  {r.confidence !== undefined && (
                    <span
                      title={`AI сигурност при читање на рачниот пис: ${Math.round(r.confidence * 100)}%`}
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.confidence >= 0.85 ? 'bg-green-100 text-green-700' :
                        r.confidence >= 0.6  ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-600'
                      }`}
                    >
                      {Math.round(r.confidence * 100)}% читливост
                    </span>
                  )}
                </div>
                {r.misconception && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                    <Brain className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-orange-700 uppercase tracking-wider block mb-0.5">Misconception</span>
                      <span className="text-sm text-orange-800">{r.misconception}</span>
                    </div>
                  </div>
                )}
                {r.correctionHint && r.earnedPoints < r.maxPoints && (
                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-0.5">Совет за исправка</span>
                      <span className="text-sm text-blue-800">{r.correctionHint}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {results.some(r => r.misconception) && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
          <h3 className="font-bold text-orange-900 flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5" /> Misconceptions — за следниот час
          </h3>
          <ul className="space-y-2">
            {results.filter(r => r.misconception).map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-orange-800">
                <span className="font-bold flex-shrink-0">П{results.indexOf(r) + 1}:</span>
                {r.misconception}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
