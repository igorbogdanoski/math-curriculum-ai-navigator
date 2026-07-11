import React, { useState, useEffect } from 'react';
import { Loader2, X, Users } from 'lucide-react';
import { getTestSubmissions } from '../../services/firestoreService.dugga';
import type { DuggaTest, DuggaSubmission } from '../../services/firestoreService.dugga';
import { DOK_COLORS } from './duggaLibraryConstants';
import { isAnswerCorrect, gradeLabel, gradeBg } from './duggaResultsScoring';

type ResultsTab = 'overview' | 'questions' | 'students';

export function DuggaResultsPanel({ test, onClose }: { test: DuggaTest; onClose: () => void }) {
  const [submissions, setSubmissions] = useState<DuggaSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ResultsTab>('overview');

  useEffect(() => {
    getTestSubmissions(test.id).then(s => {
      setSubmissions(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [test.id]);

  const n = submissions.length;
  const avgPct = n > 0 ? Math.round(submissions.reduce((s, sub) => s + sub.percentage, 0) / n) : 0;
  const pass = submissions.filter(s => s.percentage >= 50).length;

  // Per-question accuracy
  const questionStats = test.questions
    .filter(q => q.type !== 'section_header')
    .map(q => {
      const grades = submissions.map(sub => isAnswerCorrect(q, sub.answers[q.id]));
      const objective = grades.some(g => g !== null);
      const correct = grades.filter(g => g === true).length;
      const pct = n > 0 && objective ? Math.round((correct / n) * 100) : null;
      return { q, pct, correct };
    });

  const tabs: { id: ResultsTab; label: string }[] = [
    { id: 'overview', label: 'Преглед' },
    { id: 'questions', label: 'По прашање' },
    { id: 'students', label: 'Ученици' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 truncate max-w-sm">{test.title}</h2>
            <p className="text-xs text-gray-500">{n} поднесувања · {test.questions.filter(q => q.type !== 'section_header').length} прашања</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        {n > 0 && (
          <div className="flex border-b border-gray-100 shrink-0">
            {tabs.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === t.id ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="overflow-y-auto flex-1 p-4">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          )}

          {!loading && n === 0 && (
            <div className="text-center py-10 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Нема поднесувања за овој тест.</p>
              <p className="text-xs mt-1">Сподели го кодот <span className="font-mono font-bold text-indigo-600">{test.shareCode}</span> со учениците.</p>
            </div>
          )}

          {/* ── OVERVIEW ── */}
          {!loading && n > 0 && tab === 'overview' && (
            <div className="space-y-4">
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-indigo-50 rounded-xl">
                  <div className="text-2xl font-black text-indigo-700">{n}</div>
                  <div className="text-xs text-indigo-600 mt-0.5">Ученици</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <div className="text-2xl font-black text-green-700">{avgPct}%</div>
                  <div className="text-xs text-green-600 mt-0.5">Просек</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                  <div className="text-2xl font-black text-amber-700">{pass}/{n}</div>
                  <div className="text-xs text-amber-600 mt-0.5">Положиле (≥50%)</div>
                </div>
              </div>

              {/* Grade distribution */}
              <div className="p-4 bg-gray-50 rounded-2xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Распределба на оценки</p>
                <div className="flex items-end gap-1 h-20">
                  {[
                    { label: '1', range: '0–49%', color: 'bg-red-400', count: submissions.filter(s => s.percentage < 50).length },
                    { label: '2', range: '50–59%', color: 'bg-amber-400', count: submissions.filter(s => s.percentage >= 50 && s.percentage < 60).length },
                    { label: '3', range: '60–74%', color: 'bg-blue-400', count: submissions.filter(s => s.percentage >= 60 && s.percentage < 75).length },
                    { label: '4', range: '75–89%', color: 'bg-indigo-400', count: submissions.filter(s => s.percentage >= 75 && s.percentage < 90).length },
                    { label: '5', range: '90–100%', color: 'bg-green-400', count: submissions.filter(s => s.percentage >= 90).length },
                  ].map(({ label, color, count }) => {
                    const h = Math.round((count / n) * 100);
                    return (
                      <div key={label} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-xs font-bold text-gray-700">{count > 0 ? count : ''}</span>
                        <div className={`w-full rounded-t-md ${color} transition-all`} style={{ height: `${Math.max(h, count > 0 ? 8 : 0)}%` }} />
                        <span className="text-xs font-bold text-gray-500">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Weakest question highlight */}
              {questionStats.some(s => s.pct !== null) && (() => {
                const worst = [...questionStats].filter(s => s.pct !== null).sort((a, b) => (a.pct ?? 100) - (b.pct ?? 100))[0];
                if (!worst || worst.pct === null) return null;
                return (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start">
                    <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-black text-red-600">!</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-red-700">Најтешко прашање ({worst.pct}% точни)</p>
                      <p className="text-xs text-red-600 mt-0.5 line-clamp-2">{worst.q.text.replace(/<[^>]*>/g, '')}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── PER QUESTION ── */}
          {!loading && n > 0 && tab === 'questions' && (
            <div className="space-y-2">
              {questionStats.map(({ q, pct }, i) => (
                <div key={q.id} className="p-3 rounded-xl border border-gray-200">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-mono text-gray-400 shrink-0 mt-0.5">Q{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-700 line-clamp-2">{q.text.replace(/<[^>]*>/g, '').slice(0, 120)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {pct !== null ? (
                          <>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${pct >= 75 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold w-10 text-right ${pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 italic">AI оценување</span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${DOK_COLORS[q.dok]}`}>DoK {q.dok}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── STUDENTS ── */}
          {!loading && n > 0 && tab === 'students' && (
            <div className="space-y-2">
              {[...submissions].sort((a, b) => b.percentage - a.percentage).map(sub => (
                <div key={sub.id} className="flex items-center justify-between gap-4 p-3 rounded-xl border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{sub.studentName}</p>
                    <p className="text-xs text-gray-400">{sub.submittedAt?.toDate?.()?.toLocaleDateString('mk-MK') ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-800">{sub.score}/{sub.totalPoints}</div>
                      <div className="text-xs text-gray-500">{sub.percentage}%</div>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${gradeBg(sub.percentage)}`}>
                      {gradeLabel(sub.percentage)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
