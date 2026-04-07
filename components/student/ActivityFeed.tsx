import React from 'react';
import { BookOpen, Calendar, CheckCircle2, PlayCircle, XCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { GradeBadge } from '../common/GradeBadge';
import type { QuizResult, Announcement, Assignment } from '../../services/firestoreService';

const formatDate = (ts: any): string => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface Props {
  announcements: Announcement[];
  assignments: Assignment[];
  results: QuizResult[];
  studentName: string;
  nextQuizIds: Record<string, string>;
  isReadOnly: boolean;
}

export const ActivityFeed: React.FC<Props> = ({
  announcements,
  assignments,
  results,
  studentName,
  nextQuizIds,
  isReadOnly,
}) => {
  const { t } = useLanguage();
  const totalQuizzes = results.length;

  return (
    <>
      {/* Teacher Announcements */}
      {announcements.length > 0 && (
        <div className="w-full max-w-2xl mb-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-1.5">
              {t('progress.announcements')}
            </p>
            <ul className="space-y-1">
              {announcements.map(a => (
                <li key={a.id} className="text-sm text-amber-700">📢 {a.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Assignments */}
      {assignments.length > 0 && !isReadOnly && (
        <div className="w-full max-w-2xl mb-3">
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
            <p className="font-bold text-indigo-800 text-sm mb-3 flex items-center gap-1.5">
              {t('progress.myTasks')} ({assignments.filter(a => !a.completedBy.includes(studentName)).length} {t('progress.pendingSuffix')})
            </p>
            <div className="space-y-2">
              {assignments.map(a => {
                const done = a.completedBy.includes(studentName);
                const today = new Date().toISOString().split('T')[0];
                const overdue = !done && a.dueDate < today;
                return (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl bg-white border ${overdue ? 'border-red-200' : done ? 'border-green-200' : 'border-indigo-100'}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {a.title}
                      </p>
                      <p className={`text-xs mt-0.5 ${overdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                        {done
                          ? t('progress.assignmentDone')
                          : overdue
                            ? `${t('progress.assignmentOverdue')} ${a.dueDate}`
                            : `${t('progress.assignmentDueSuffix')} ${a.dueDate}`}
                      </p>
                    </div>
                    {!done && a.materialType === 'RECOVERY_WORKSHEET' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (a.recoveryConceptIds?.length) {
                            try {
                              sessionStorage.setItem('matura_recovery_prefill', JSON.stringify({
                                sourceConceptId: a.recoveryConceptIds[0],
                                conceptIds: a.recoveryConceptIds,
                                assignmentId: a.id,
                              }));
                            } catch { /* ignore */ }
                          }
                          window.location.hash = '#/matura-practice';
                        }}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                      >
                        Почни Recovery
                      </button>
                    )}
                    {!done && a.materialType !== 'RECOVERY_WORKSHEET' && (
                      <button
                        type="button"
                        onClick={() => { window.location.hash = `/play/${a.cacheId}?assignId=${a.id}&tid=${a.teacherUid}`; }}
                        className="flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                        {t('progress.solve')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quiz Results */}
      <div className="w-full max-w-2xl space-y-3">
        {totalQuizzes === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center shadow">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-slate-500">{t('progress.noResultsTitle')} "{studentName}"</p>
            <p className="text-xs text-slate-400 mt-1">{t('progress.noResultsDesc')}</p>
          </div>
        ) : (
          results.map((r, i) => {
            const isPassed = r.percentage >= 70;
            const nextQuizId = r.conceptId ? nextQuizIds[r.conceptId] : undefined;
            return (
              <div key={i} className="bg-white rounded-2xl p-4 shadow flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isPassed ? 'bg-green-100' : 'bg-amber-100'}`}>
                  {isPassed
                    ? <CheckCircle2 className="w-6 h-6 text-green-600" />
                    : <XCircle className="w-6 h-6 text-amber-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-800 text-sm truncate">{r.quizTitle}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-400">{formatDate(r.playedAt)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  <p className={`text-xl font-black ${isPassed ? 'text-green-600' : 'text-amber-500'}`}>
                    {r.percentage}%
                  </p>
                  <GradeBadge pct={r.percentage} showLabel={true} />
                  <p className="text-xs text-slate-400">{r.correctCount}/{r.totalQuestions}</p>
                  {r.confidence != null && (
                    <span title={`${t('progress.confidenceLabel')}: ${r.confidence}/5`} className="text-base leading-none">
                      {['😟', '😐', '🙂', '😊', '🤩'][r.confidence - 1]}
                    </span>
                  )}
                  {!isPassed && nextQuizId && (
                    <button
                      type="button"
                      onClick={() => { window.location.hash = `/play/${nextQuizId}`; }}
                      className="flex items-center gap-1 text-xs font-bold bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition mt-0.5"
                    >
                      <PlayCircle className="w-3 h-3" /> {t('progress.practice')}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};
