import React, { useState, useEffect } from 'react';
import { Loader2, X, Users, ChevronLeft, Clock } from 'lucide-react';
import { getTestSubmissions, gradeSubmissionQuestion } from '../../services/firestoreService.dugga';
import type { DuggaTest, DuggaSubmission } from '../../services/firestoreService.dugga';
import { DOK_COLORS } from './duggaLibraryConstants';
import { isAnswerCorrect, gradeLabel, gradeBg } from './duggaResultsScoring';
import { useLanguage } from '../../i18n/LanguageContext';

// ─── Per-student submission detail + manual-grading control ───────────────────
// 2026-07-19 (audit_2026_07_18_full_app_review, Wave 5.2): questions where
// autoScore()/AI grading couldn't produce a score (questionResults[id].correct
// === null — see needsManualReview() in utils/duggaScoring.ts) previously had
// no way for a teacher to ever award points for them. This view lets a teacher
// open one student's submission and manually grade exactly those questions.

function SubmissionDetail({ test, submission, onBack, onGraded }: {
  test: DuggaTest;
  submission: DuggaSubmission;
  onBack: () => void;
  onGraded: (updated: DuggaSubmission) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const { t } = useLanguage();

  const results = submission.questionResults ?? {};
  const questions = test.questions.filter(q => q.type !== 'section_header');

  const save = async (questionId: string, maxPoints: number) => {
    const raw = drafts[questionId];
    const points = Number(raw);
    if (raw === undefined || raw.trim() === '' || Number.isNaN(points)) return;
    setSavingId(questionId);
    try {
      await gradeSubmissionQuestion(submission.id, questionId, points);
      const clamped = Math.max(0, Math.min(points, maxPoints));
      const nextResults = {
        ...results,
        [questionId]: { ...results[questionId], earned: clamped, correct: clamped >= maxPoints, feedback: '' },
      };
      const score = Object.values(nextResults).reduce((s, r) => s + r.earned, 0);
      const pendingReviewPoints = Object.values(nextResults).reduce((s, r) => s + (r.correct === null ? r.maxPoints : 0), 0);
      const gradedMaxPts = submission.totalPoints - pendingReviewPoints;
      const percentage = gradedMaxPts > 0 ? Math.round((score / gradedMaxPts) * 100) : 0;
      onGraded({ ...submission, questionResults: nextResults, score, pendingReviewPoints, percentage });
    } catch {
      // Non-critical — the teacher can retry the save.
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700">
        <ChevronLeft className="w-3.5 h-3.5" /> {t('duggaResults.backToStudents')}
      </button>
      <div className="flex items-center justify-between px-1">
        <div>
          <p className="font-bold text-sm text-gray-800">{submission.studentName}</p>
          <p className="text-xs text-gray-400">{submission.score}/{submission.totalPoints} {t('duggaResults.points')} · {submission.percentage}%</p>
        </div>
        {(submission.pendingReviewPoints ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full">
            <Clock className="w-3 h-3" /> {submission.pendingReviewPoints} {t('duggaResults.pointsPending')}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {questions.map((q, i) => {
          const r = results[q.id];
          const needsReview = r?.correct === null;
          return (
            <div key={q.id} className={`p-3 rounded-xl border ${needsReview ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <span className="text-xs font-mono text-gray-400 shrink-0 mt-0.5">Q{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 line-clamp-2">{q.text.replace(/<[^>]*>/g, '')}</p>
                  {!r ? (
                    <p className="text-xs text-gray-400 italic mt-1">{t('duggaResults.noRecordedResult')}</p>
                  ) : needsReview ? (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min={0}
                        max={r.maxPoints}
                        step="0.5"
                        placeholder="0"
                        value={drafts[q.id] ?? ''}
                        onChange={e => setDrafts(d => ({ ...d, [q.id]: e.target.value }))}
                        className="w-16 px-2 py-1 text-xs rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <span className="text-xs text-gray-500">/ {r.maxPoints} {t('duggaResults.points')}</span>
                      <button
                        type="button"
                        onClick={() => save(q.id, r.maxPoints)}
                        disabled={savingId === q.id}
                        className="text-xs font-bold bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600 disabled:opacity-50"
                      >
                        {savingId === q.id ? t('duggaResults.saving') : t('duggaResults.save')}
                      </button>
                    </div>
                  ) : (
                    <p className={`text-xs font-bold mt-1 ${r.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {r.earned}/{r.maxPoints} {t('duggaResults.points')} {r.correct ? '✓' : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ResultsTab = 'overview' | 'questions' | 'students';

export function DuggaResultsPanel({ test, onClose }: { test: DuggaTest; onClose: () => void }) {
  const [submissions, setSubmissions] = useState<DuggaSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ResultsTab>('overview');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    setSelectedSubmissionId(null);
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
    { id: 'overview', label: t('duggaResults.tabOverview') },
    { id: 'questions', label: t('duggaResults.tabByQuestion') },
    { id: 'students', label: t('duggaResults.tabStudents') },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 truncate max-w-sm">{test.title}</h2>
            <p className="text-xs text-gray-500">{n} {t('duggaResults.submissions')} · {test.questions.filter(q => q.type !== 'section_header').length} {t('duggaResults.questions')}</p>
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
                onClick={() => { setTab(t.id); setSelectedSubmissionId(null); }}
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
              <p className="text-sm">{t('duggaResults.noSubmissions')}</p>
              <p className="text-xs mt-1">{t('duggaResults.shareCode')} <span className="font-mono font-bold text-indigo-600">{test.shareCode}</span> {t('duggaResults.withStudents')}</p>
            </div>
          )}

          {/* ── OVERVIEW ── */}
          {!loading && n > 0 && tab === 'overview' && (
            <div className="space-y-4">
              {/* KPI row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-indigo-50 rounded-xl">
                  <div className="text-2xl font-black text-indigo-700">{n}</div>
                  <div className="text-xs text-indigo-600 mt-0.5">{t('duggaResults.students')}</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <div className="text-2xl font-black text-green-700">{avgPct}%</div>
                  <div className="text-xs text-green-600 mt-0.5">{t('duggaResults.average')}</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                  <div className="text-2xl font-black text-amber-700">{pass}/{n}</div>
                  <div className="text-xs text-amber-600 mt-0.5">{t('duggaResults.passed')}</div>
                </div>
              </div>

              {/* Grade distribution */}
              <div className="p-4 bg-gray-50 rounded-2xl">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('duggaResults.gradeDistribution')}</p>
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
                      <p className="text-xs font-bold text-red-700">{t('duggaResults.hardestQuestion')} ({worst.pct}{t('duggaResults.correctPct')})</p>
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
                          <span className="text-xs text-gray-400 italic">{t('duggaResults.aiGrading')}</span>
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
          {!loading && n > 0 && tab === 'students' && !selectedSubmissionId && (
            <div className="space-y-2">
              {[...submissions].sort((a, b) => b.percentage - a.percentage).map(sub => (
                <button
                  type="button"
                  key={sub.id}
                  onClick={() => setSelectedSubmissionId(sub.id)}
                  className="w-full flex items-center justify-between gap-4 p-3 rounded-xl border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{sub.studentName}</p>
                    <p className="text-xs text-gray-400">{sub.submittedAt?.toDate?.()?.toLocaleDateString('mk-MK') ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {(sub.pendingReviewPoints ?? 0) > 0 && (
                      <Clock className="w-3.5 h-3.5 text-amber-500" aria-label={t('duggaResults.awaitingManualReview')} />
                    )}
                    <div className="text-right">
                      <div className="text-sm font-bold text-gray-800">{sub.score}/{sub.totalPoints}</div>
                      <div className="text-xs text-gray-500">{sub.percentage}%</div>
                    </div>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black ${gradeBg(sub.percentage)}`}>
                      {gradeLabel(sub.percentage)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!loading && n > 0 && tab === 'students' && selectedSubmissionId && (() => {
            const sub = submissions.find(s => s.id === selectedSubmissionId);
            if (!sub) return null;
            return (
              <SubmissionDetail
                test={test}
                submission={sub}
                onBack={() => setSelectedSubmissionId(null)}
                onGraded={updated => setSubmissions(subs => subs.map(s => s.id === updated.id ? updated : s))}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
}
