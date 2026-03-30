import React, { useState, useEffect, useMemo } from 'react';
import { Trash2, Search, BookOpen, CheckSquare, Square, PlusSquare, ShieldCheck, Shield, Globe } from 'lucide-react';
import { firestoreService } from '../../services/firestoreService';
import type { SavedQuestion, DokLevel } from '../../types';
import { DOK_META } from '../../types';
import { DokBadge } from '../../components/common/DokBadge';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { db } from '../../firebaseConfig';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useLanguage } from '../../i18n/LanguageContext';
import { ErrorBoundary } from '../../components/common/ErrorBoundary';

interface QuestionBankTabProps {
  teacherUid: string;
}

const QUESTION_TYPE_KEYS: Record<string, string> = {
  MULTIPLE_CHOICE: 'analytics.qbank.typeMultiple',
  SHORT_ANSWER:    'analytics.qbank.typeShort',
  TRUE_FALSE:      'analytics.qbank.typeTrueFalse',
  ESSAY:           'analytics.qbank.typeEssay',
  FILL_IN_THE_BLANK: 'analytics.qbank.typeFill',
};

const QuestionBankTabInner: React.FC<QuestionBankTabProps> = ({ teacherUid }) => {
  const { addNotification } = useNotification();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; title?: string; variant?: 'danger' | 'warning' | 'info'; onConfirm: () => void } | null>(null);
  const [questions, setQuestions] = useState<SavedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<Set<string>>(new Set());
  const [published, setPublished] = useState<Set<string>>(new Set());
  const [searchText, setSearchText] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterGrade, setFilterGrade] = useState<string>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());
  const [creatingQuiz, setCreatingQuiz] = useState(false);
  const [onlyVerified, setOnlyVerified] = useState(false);

  useEffect(() => {
    if (!teacherUid) return;
    setLoading(true);
    firestoreService.fetchSavedQuestions(teacherUid)
      .then(qs => setQuestions(qs))
      .finally(() => setLoading(false));
  }, [teacherUid]);

  const allTypes = useMemo(() => {
    const types = new Set(questions.map(q => q.type));
    return Array.from(types).sort();
  }, [questions]);

  const allGrades = useMemo(() => {
    const grades = new Set(questions.map(q => q.gradeLevel).filter(Boolean));
    return Array.from(grades as Set<number>).sort((a, b) => a - b);
  }, [questions]);

  const verifiedCount = useMemo(() => questions.filter(q => q.isVerified).length, [questions]);

  const dokStats = useMemo(() => {
    const total = questions.length;
    if (total === 0) return null;
    const counts: Record<DokLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let tagged = 0;
    for (const q of questions) {
      if (q.dokLevel && q.dokLevel >= 1 && q.dokLevel <= 4) {
        counts[q.dokLevel as DokLevel]++;
        tagged++;
      }
    }
    return { counts, tagged, total };
  }, [questions]);

  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (searchText && !q.question.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (filterType && q.type !== filterType) return false;
      if (filterGrade && String(q.gradeLevel) !== filterGrade) return false;
      if (onlyVerified && !q.isVerified) return false;
      return true;
    });
  }, [questions, searchText, filterType, filterGrade, onlyVerified]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(q => q.id)));
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedAnswers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleVerify = async (questionId: string, current: boolean) => {
    try {
      await firestoreService.verifyQuestion(questionId, !current);
      setQuestions(prev => prev.map(q => q.id === questionId ? { ...q, isVerified: !current } : q));
    } catch {
      addNotification(t('analytics.qbank.errVerify'), 'error');
    }
  };

  const handlePublish = async (q: SavedQuestion) => {
    if (!q.isVerified) {
      addNotification(t('analytics.qbank.errNotVerified'), 'error');
      return;
    }
    setPublishing(prev => new Set(prev).add(q.id));
    try {
      await firestoreService.publishToNationalLibrary(q, user?.name ?? t('analytics.qbank.defaultTitle'), user?.schoolName, user?.isMentor ?? false);
      setPublished(prev => new Set(prev).add(q.id));
      setQuestions(prev => prev.map(item => item.id === q.id ? { ...item, isPublic: true } : item));
      addNotification(t('analytics.qbank.published'), 'success');
    } catch {
      addNotification(t('analytics.qbank.errPublish'), 'error');
    } finally {
      setPublishing(prev => { const n = new Set(prev); n.delete(q.id); return n; });
    }
  };

  const handleDelete = (questionId: string) => {
    setConfirmDialog({
      message: t('analytics.qbank.confirmDelete'),
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await firestoreService.deleteQuestion(questionId);
          setQuestions(prev => prev.filter(q => q.id !== questionId));
          setSelected(prev => { const n = new Set(prev); n.delete(questionId); return n; });
          addNotification(t('analytics.qbank.deleted'), 'success');
        } catch {
          addNotification(t('analytics.qbank.errDelete'), 'error');
        }
      }
    });
  };

  const handleCreateQuiz = async () => {
    if (selected.size === 0) {
      addNotification(t('analytics.qbank.errNoneSelected'), 'error');
      return;
    }
    const selectedQs = questions.filter(q => selected.has(q.id));
    const gradeLevel = selectedQs[0]?.gradeLevel;

    setCreatingQuiz(true);
    try {
      const ref = await addDoc(collection(db, 'cached_ai_materials'), {
        type: 'quiz',
        teacherUid,
        gradeLevel: gradeLevel ?? null,
        content: {
          title: t('analytics.qbank.defaultTitle'),
          type: 'QUIZ',
          questions: selectedQs.map(q => ({
            type: q.type,
            question: q.question,
            options: q.options ?? [],
            answer: q.answer,
            solution: q.solution ?? '',
            cognitiveLevel: q.cognitiveLevel ?? 'Remembering',
            difficulty_level: q.difficulty_level ?? 'Medium',
          })),
        },
        createdAt: serverTimestamp(),
        expiresAt: null,
      });
      const quizUrl = `${window.location.origin}/#/student/${ref.id}`;
      addNotification(`Квизот е создаден! Линк: ${quizUrl}`, 'success');
      setSelected(new Set());
    } catch (err) {
      console.error('Error creating quiz from bank:', err);
      addNotification(t('analytics.qbank.errCreateQuiz'), 'error');
    } finally {
      setCreatingQuiz(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-indigo-600" />
          Банка на прашања
          <span className="text-sm font-normal text-gray-500 ml-1">({questions.length} прашања)</span>
          {verifiedCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />{verifiedCount} верификувани
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={handleCreateQuiz}
          disabled={selected.size === 0 || creatingQuiz}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition"
        >
          <PlusSquare className="w-4 h-4" />
          {creatingQuiz ? t('analytics.qbank.creating') : t('analytics.qbank.createQuiz').replace('{n}', String(selected.size))}
        </button>
      </div>

      {/* DoK Analytics Panel */}
      {dokStats && dokStats.tagged > 0 && (
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-black text-indigo-700 uppercase tracking-widest">Webb's DoK — Покриеност на банката</p>
            <span className="text-xs text-gray-400">{dokStats.tagged}/{dokStats.total} прашања со DoK ознака</span>
          </div>
          {/* Stacked bar */}
          <div className="flex h-4 rounded-full overflow-hidden gap-0.5 mb-3">
            {([1, 2, 3, 4] as DokLevel[]).map(lvl => {
              const pct = dokStats.tagged > 0 ? Math.round((dokStats.counts[lvl] / dokStats.tagged) * 100) : 0;
              if (pct === 0) return null;
              return (
                <div key={lvl} title={`${DOK_META[lvl].label}: ${dokStats.counts[lvl]} прашања (${pct}%)`}
                  className={`h-full ${DOK_META[lvl].dot} transition-all`} style={{ width: `${pct}%` }} />
              );
            })}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([1, 2, 3, 4] as DokLevel[]).map(lvl => {
              const m = DOK_META[lvl];
              const count = dokStats.counts[lvl];
              const pct = dokStats.tagged > 0 ? Math.round((count / dokStats.tagged) * 100) : 0;
              const isLow = pct < 10 && dokStats.tagged >= 5;
              return (
                <div key={lvl} className={`p-2.5 rounded-xl border ${m.color} ${isLow ? 'ring-2 ring-amber-400' : ''}`}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className={`w-2 h-2 rounded-full ${m.dot}`} />
                    <span className="text-[10px] font-black">{m.label}</span>
                  </div>
                  <p className="text-xl font-black leading-none">{count}</p>
                  <p className="text-[9px] opacity-70 mt-0.5">{pct}% · {m.mk}</p>
                  {isLow && <p className="text-[9px] text-amber-600 font-bold mt-1">⚠ Мало покритие</p>}
                </div>
              );
            })}
          </div>
          {([1, 2, 3, 4] as DokLevel[]).some(l => dokStats.counts[l] === 0 && dokStats.tagged >= 4) && (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              💡 Некои DoK нивоа немаат прашања. Генерирај материјали со цел DoK таргет за целосна педагошка покриеност.
            </p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Пребарај прашања..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
        </div>
        <select
          title="Филтрирај по тип"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">Сите типови</option>
          {allTypes.map(qtype => (
            <option key={qtype} value={qtype}>{t(QUESTION_TYPE_KEYS[qtype] ?? '') || qtype}</option>
          ))}
        </select>
        <select
          title="Филтрирај по одделение"
          value={filterGrade}
          onChange={e => setFilterGrade(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        >
          <option value="">Сите одделенија</option>
          {allGrades.map(g => (
            <option key={g} value={String(g)}>{g}. одделение</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOnlyVerified(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${onlyVerified ? 'bg-green-100 border-green-400 text-green-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-green-50'}`}
        >
          <ShieldCheck className="w-4 h-4" />
          Само верификувани
        </button>
      </div>

      {/* Select all + count */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <button type="button" onClick={toggleAll} className="flex items-center gap-1 hover:text-indigo-600 transition">
            {selected.size === filtered.length
              ? <CheckSquare className="w-4 h-4 text-indigo-600" />
              : <Square className="w-4 h-4" />}
            {selected.size === filtered.length ? t('analytics.qbank.deselectAll') : t('analytics.qbank.selectAll')}
          </button>
          {selected.size > 0 && (
            <span className="ml-2 text-indigo-600 font-semibold">{selected.size} {t('analytics.qbank.marked')}</span>
          )}
        </div>
      )}

      {/* Question list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('analytics.qbank.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {questions.length === 0
            ? t('analytics.qbank.empty')
            : t('analytics.qbank.noFilter')}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(q => (
            <div
              key={q.id}
              className={`border rounded-xl p-4 transition ${q.isVerified ? 'border-green-300 bg-green-50/30' : selected.has(q.id) ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex items-start gap-3">
                {/* Checkbox */}
                <button type="button" onClick={() => toggleSelect(q.id)} className="mt-0.5 flex-shrink-0">
                  {selected.has(q.id)
                    ? <CheckSquare className="w-5 h-5 text-indigo-600" />
                    : <Square className="w-5 h-5 text-gray-400" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{q.question}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {t(QUESTION_TYPE_KEYS[q.type] ?? '') || q.type}
                    </span>
                    {q.gradeLevel && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                        {q.gradeLevel}. одд.
                      </span>
                    )}
                    {q.conceptTitle && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                        {q.conceptTitle}
                      </span>
                    )}
                    {q.cognitiveLevel && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        {q.cognitiveLevel}
                      </span>
                    )}
                    {q.dokLevel && <DokBadge level={q.dokLevel as DokLevel} size="compact" />}
                    {q.isVerified && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-600 text-white font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Верификувана
                      </span>
                    )}
                  </div>

                  {/* Revealed answer */}
                  {revealedAnswers.has(q.id) && (
                    <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700">
                      <span className="font-semibold">Одговор:</span> {q.answer}
                      {q.options && q.options.length > 0 && (
                        <ul className="mt-1 list-disc list-inside space-y-0.5">
                          {q.options.map((opt, i) => (
                            <li key={`opt-${i}`} className={opt === q.answer ? 'font-semibold text-green-700' : ''}>{opt}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleReveal(q.id)}
                    className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition"
                  >
                    {revealedAnswers.has(q.id) ? t('analytics.qbank.hideAnswer') : t('analytics.qbank.revealAnswer')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVerify(q.id, !!q.isVerified)}
                    title={q.isVerified ? t('analytics.qbank.unverifyTip') : t('analytics.qbank.verifyTip')}
                    className={`p-1.5 transition ${q.isVerified ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-green-600'}`}
                  >
                    {q.isVerified ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                  </button>
                  {q.isVerified && (
                    <button
                      type="button"
                      onClick={() => handlePublish(q)}
                      disabled={publishing.has(q.id) || published.has(q.id) || !!q.isPublic}
                      title={q.isPublic ? t('analytics.qbank.alreadyPublished') : t('analytics.qbank.publishTip')}
                      className={`p-1.5 transition ${q.isPublic || published.has(q.id) ? 'text-green-500 cursor-default' : 'text-gray-400 hover:text-indigo-600'}`}
                    >
                      <Globe className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    title="Избриши"
                    className="p-1.5 text-gray-400 hover:text-red-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bottom action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 bg-white border border-indigo-200 rounded-xl shadow-lg p-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-indigo-700">{selected.size} {t('analytics.qbank.marked')}</span>
          <button
            type="button"
            onClick={handleCreateQuiz}
            disabled={creatingQuiz}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition"
          >
            <PlusSquare className="w-4 h-4" />
            {creatingQuiz ? t('analytics.qbank.creating') : t('analytics.qbank.createQuizBtn')}
          </button>
        </div>
      )}
      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          title={confirmDialog.title}
          variant={confirmDialog.variant ?? 'warning'}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export const QuestionBankTab: React.FC<QuestionBankTabProps> = (props) => (
  <ErrorBoundary>
    <QuestionBankTabInner {...props} />
  </ErrorBoundary>
);
