/**
 * MaturaLibraryView — M2 (Firestore edition)
 *
 * Data source: Firestore matura_exams + matura_questions (lazy per exam).
 * Scales to 78+ exams without bundle growth.
 *
 * Browse mode  : filter / reveal answers.
 * Practice mode:
 *   Part 1 MC  → auto-grade (click choice).
 *   Part 2 open → Gemini AI text-grade.
 *   Part 3 open → Self-assess rubric + optional AI.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useMaturaExams, useMaturaQuestions } from '../hooks/useMatura';
import { useAuth } from '../contexts/AuthContext';
import { SECONDARY_TRACK_TO_MATURA_TRACKS } from '../types';

import {
  PART_LABELS, TOPIC_LABELS, TOPIC_COLORS, TRACK_LABELS,
  isOpen, examLabel,
  gradePart2, gradePart3,
  type AIGrade,
} from '../components/matura/maturaLibrary.constants';
import {
  QuestionSkeleton, DokBar, QuestionCard,
} from '../components/matura/MaturaQuestionCard';
import { InternalMaturaTab, collectPracticeConceptIds } from '../components/matura/InternalMaturaTab';
export { collectPracticeConceptIds };
import { TeacherTestBuilder } from '../components/matura/TeacherTestBuilder';
import type { MaturaExamMeta } from '../services/firestoreService.matura';

export function MaturaLibraryView() {
  // ── Tab ──
  const [activeTab, setActiveTab] = useState<'dim' | 'ucilisna' | 'teacher'>('dim');

  // ── Firestore data ──
  const { exams, loading: examsLoading, error: examsError } = useMaturaExams();
  const { user, firebaseUser } = useAuth();

  // ── Exam selection (smart default: prefer teacher's secondary track) ──
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [filterTrack,    setFilterTrack]    = useState<string>('');

  // Unique tracks ordered by first appearance (gymnasium first)
  const availableTracks = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const e of exams) {
      const t = e.track ?? 'gymnasium';
      if (!seen.has(t)) { seen.add(t); ordered.push(t); }
    }
    return ordered;
  }, [exams]);

  const hasMultipleTracks = availableTracks.length > 1;

  // Exams visible in the exam-selector dropdown (filtered by track pill)
  const visibleExams = useMemo(
    () => filterTrack ? exams.filter(e => (e.track ?? 'gymnasium') === filterTrack) : exams,
    [exams, filterTrack],
  );

  useEffect(() => {
    if (examsLoading || !exams.length || selectedExamId) return;
    const relevantTracks = user?.secondaryTrack
      ? SECONDARY_TRACK_TO_MATURA_TRACKS[user.secondaryTrack] ?? []
      : [];
    const smartDefault = relevantTracks.length > 0
      ? exams.find(e => relevantTracks.includes(e.track ?? ''))
      : undefined;
    if (smartDefault) {
      setSelectedExamId(smartDefault.id);
      setFilterTrack(smartDefault.track ?? 'gymnasium');
    }
  }, [exams, examsLoading, user?.secondaryTrack]);

  const resolvedId  = selectedExamId || exams[0]?.id || '';
  const examIdArray = useMemo(() => resolvedId ? [resolvedId] : [], [resolvedId]);
  const { questions: allQuestions, loading: qLoading, error: qError } = useMaturaQuestions(examIdArray);

  // ── Filters ──
  const [filterPart,  setFilterPart]  = useState<0|1|2|3>(0);
  const [filterTopic, setFilterTopic] = useState('');
  const [filterDok,   setFilterDok]   = useState<0|1|2|3|4>(0);
  const [filterType,  setFilterType]  = useState<''|'mc'|'open'>('');
  const [search,      setSearch]      = useState('');

  // ── Practice / reveal ──
  const [practiceMode, setPracticeMode] = useState(false);
  const [revealedIds,  setRevealedIds]  = useState<Set<number>>(new Set());
  const [revealAll,    setRevealAll]    = useState(false);

  // ── Per-question state ──
  const [mcPicks,    setMcPicks]    = useState<Record<number,string>>({});
  const [p2Answers,  setP2Answers]  = useState<Record<number,string>>({});
  const [aiGrades,   setAiGrades]   = useState<Record<number,AIGrade>>({});
  const [gradingP2,  setGradingP2]  = useState<Set<number>>(new Set());
  const [selfChecks, setSelfChecks] = useState<Record<number,boolean[]>>({});
  const [aiDescs,    setAiDescs]    = useState<Record<number,string>>({});
  const [aiGradesP3, setAiGradesP3] = useState<Record<number,AIGrade>>({});
  const [gradingP3,  setGradingP3]  = useState<Set<number>>(new Set());
  const [aiErrors,   setAiErrors]   = useState<Record<number,string>>({});

  const topicAreas = useMemo(
    () => [...new Set(allQuestions.map(q => q.topicArea).filter(Boolean))] as string[],
    [allQuestions],
  );

  const questions = useMemo(() => allQuestions.filter(q => {
    if (filterPart  && q.part !== filterPart)        return false;
    if (filterDok   && q.dokLevel !== filterDok)     return false;
    if (filterTopic && q.topicArea !== filterTopic)  return false;
    if (filterType === 'mc'   &&  isOpen(q))         return false;
    if (filterType === 'open' && !isOpen(q))         return false;
    if (search) {
      const s = search.toLowerCase();
      return q.questionText.toLowerCase().includes(s) || (q.topic ?? '').toLowerCase().includes(s);
    }
    return true;
  }), [allQuestions, filterPart, filterDok, filterTopic, filterType, search]);

  const stats = useMemo(() => {
    if (!allQuestions.length) return null;
    return {
      total: allQuestions.length,
      mc:    allQuestions.filter(q => !isOpen(q)).length,
      open:  allQuestions.filter(isOpen).length,
      pts:   allQuestions.reduce((s,q) => s + q.points, 0),
    };
  }, [allQuestions]);

  const switchExam = useCallback((id: string) => {
    setSelectedExamId(id);
    setRevealedIds(new Set()); setRevealAll(false);
    setMcPicks({}); setP2Answers({});
    setAiGrades({}); setAiGradesP3({}); setSelfChecks({});
    setAiDescs({}); setAiErrors({});
    setFilterPart(0); setFilterDok(0); setFilterTopic('');
    setFilterType(''); setSearch('');
  }, []);

  const toggleReveal = useCallback((n: number) => {
    setRevealedIds(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });
  }, []);
  const hideQ = useCallback((n: number) => {
    setRevealAll(false);
    setRevealedIds(prev => { const s = new Set(prev); s.delete(n); return s; });
  }, []);
  const handleRevealAll = () => {
    if (revealAll) { setRevealedIds(new Set()); setRevealAll(false); }
    else { setRevealedIds(new Set(questions.map(q => q.questionNumber))); setRevealAll(true); }
  };

  const handleGradeP2 = useCallback(async (q: Parameters<typeof gradePart2>[0]) => {
    const n = q.questionNumber;
    setGradingP2(prev => { const s = new Set(prev); s.add(n); return s; });
    setAiErrors(prev => ({ ...prev, [n]: '' }));
    try {
      const grade = await gradePart2(q, p2Answers[n] ?? '');
      setAiGrades(prev => ({ ...prev, [n]: grade }));
      setRevealedIds(prev => { const s = new Set(prev); s.add(n); return s; });
    } catch {
      setAiErrors(prev => ({ ...prev, [n]: 'AI грешка — обидете се повторно.' }));
    } finally {
      setGradingP2(prev => { const s = new Set(prev); s.delete(n); return s; });
    }
  }, [p2Answers]);

  const handleGradeP3 = useCallback(async (q: Parameters<typeof gradePart3>[0]) => {
    const n   = q.questionNumber;
    const desc = aiDescs[n] ?? '';
    if (!desc.trim()) return;
    setGradingP3(prev => { const s = new Set(prev); s.add(n); return s; });
    setAiErrors(prev => ({ ...prev, [n]: '' }));
    try {
      const grade = await gradePart3(q, desc);
      setAiGradesP3(prev => ({ ...prev, [n]: grade }));
    } catch {
      setAiErrors(prev => ({ ...prev, [n]: 'AI грешка — обидете се повторно.' }));
    } finally {
      setGradingP3(prev => { const s = new Set(prev); s.delete(n); return s; });
    }
  }, [aiDescs]);

  const handleSelfCheck = (n: number, maxPts: number, idx: number, val: boolean) => {
    setSelfChecks(prev => {
      const arr = [...(prev[n] ?? Array(maxPts).fill(false))];
      arr[idx] = val; return { ...prev, [n]: arr };
    });
  };

  const loading = examsLoading || qLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ══ Sticky header ══ */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-900">📚 Библиотека — Матура и Испити</h1>
              <p className="text-xs text-gray-500">Државна · Училишна · Завршен испит · {exams.length > 0 ? `${exams.length} испити во базата` : 'Се вчитува…'}</p>
            </div>

            {/* Tab switcher */}
            <div className="flex rounded-xl border border-gray-200 bg-gray-50 p-0.5 gap-0.5">
              <button type="button"
                onClick={() => setActiveTab('dim')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'dim' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                🏛 Државна матура
              </button>
              <button type="button"
                onClick={() => setActiveTab('ucilisna')}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'ucilisna' ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                📝 Училишна матура
              </button>
              {(user?.role === 'teacher' || user?.role === 'school_admin' || user?.role === 'admin') && (
                <button type="button"
                  onClick={() => setActiveTab('teacher')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'teacher' ? 'bg-white text-amber-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  🏫 Составувач
                </button>
              )}
              {(user?.role === 'admin' || user?.role === 'school_admin') && (
                <button type="button"
                  onClick={() => { window.location.href = '/matura-import'; }}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold transition-all text-gray-500 hover:text-violet-700 hover:bg-violet-50">
                  ☁ Увози PDF
                </button>
              )}
            </div>

            {/* DIM-only controls */}
            {activeTab === 'dim' && (
              <>
                <button type="button"
                  onClick={() => setPracticeMode(m => !m)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
                    practiceMode ? 'bg-violet-600 text-white border-violet-600 shadow' : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-50'
                  }`}
                >
                  {practiceMode ? '✏️ Режим: Вежба' : '📖 Режим: Прелистувај'}
                </button>

                <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                  {examsLoading ? (
                    <div className="flex gap-1">
                      {[1,2,3].map(i => <div key={i} className="h-9 w-28 bg-gray-100 animate-pulse rounded-xl" />)}
                    </div>
                  ) : (
                    <>
                      {/* Track pill selector — only when multiple tracks exist */}
                      {hasMultipleTracks && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setFilterTrack('')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border ${
                              filterTrack === '' ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            Сите
                          </button>
                          {availableTracks.map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                setFilterTrack(t);
                                const first = exams.find(e => (e.track ?? 'gymnasium') === t);
                                if (first) switchExam(first.id);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors border ${
                                filterTrack === t
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                              }`}
                            >
                              {TRACK_LABELS[t] ?? t}
                            </button>
                          ))}
                        </div>
                      )}
                      <select
                        title="Избери испит"
                        aria-label="Избери испит"
                        value={resolvedId}
                        onChange={e => switchExam(e.target.value)}
                        className="text-sm border border-gray-200 rounded-xl px-3 py-2 font-semibold text-gray-700 bg-white focus:ring-indigo-300 focus:border-indigo-400 max-w-xs"
                      >
                        {visibleExams.map(e => (
                          <option key={e.id} value={e.id}>{examLabel(e)}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Stats row — DIM only */}
        {activeTab === 'dim' && stats && !loading && (
          <div className="max-w-6xl mx-auto px-4 pb-3 flex flex-wrap items-center gap-4">
            <div className="flex gap-4 text-sm">
              <span className="text-gray-600"><span className="font-bold text-gray-900">{stats.total}</span> пр.</span>
              <span className="text-gray-600"><span className="font-bold text-indigo-700">{stats.mc}</span> MC</span>
              <span className="text-gray-600"><span className="font-bold text-violet-700">{stats.open}</span> отворени</span>
              <span className="text-gray-600"><span className="font-bold text-emerald-700">{stats.pts}</span> поени</span>
            </div>
            <div className="flex-1 min-w-[120px]"><DokBar questions={allQuestions} /></div>
            {practiceMode && (
              <div className="text-xs text-violet-600 font-medium bg-violet-50 px-2 py-1 rounded-lg">
                Дел II: AI оценување · Дел III: самооценување + опц. AI
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ Училишна матура tab ══ */}
      {activeTab === 'ucilisna' && <InternalMaturaTab />}

      {/* ══ Teacher test builder tab ══ */}
      {activeTab === 'teacher' && <TeacherTestBuilder questions={allQuestions} />}

      {/* ══ DIM content ══ */}
      {activeTab === 'dim' && (examsError || qError) && (
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm font-medium">
            ⚠️ {examsError ?? qError}
          </div>
        </div>
      )}

      {/* ══ Filter bar ══ */}
      {activeTab === 'dim' && !examsLoading && (
        <div className="max-w-6xl mx-auto px-4 pt-4 pb-2 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
              <input type="text" placeholder="Пребарај прашање или тема…" value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <button type="button" onClick={handleRevealAll}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${revealAll ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
              {revealAll ? '🙈 Скриј сè' : '👁 Прикажи сè'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Дел:</span>
            {([0,1,2,3] as const).map(p => (
              <button key={p} type="button" onClick={() => setFilterPart(p)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterPart===p?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                {p === 0 ? 'Сите' : PART_LABELS[p]}
              </button>
            ))}
            <span className="ml-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Тип:</span>
            {([['','Сите'],['mc','MC'],['open','Отворена']] as const).map(([v,l]) => (
              <button key={v} type="button" onClick={() => setFilterType(v)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterType===v?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                {l}
              </button>
            ))}
            <span className="ml-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">DoK:</span>
            {([0,1,2,3,4] as const).map(d => (
              <button key={d} type="button" onClick={() => setFilterDok(d)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${filterDok===d?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                {d === 0 ? 'Сите' : `DoK ${d}`}
              </button>
            ))}
          </div>

          {topicAreas.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Тема:</span>
              <button type="button" onClick={() => setFilterTopic('')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filterTopic===''?'bg-gray-700 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}>
                Сите
              </button>
              {topicAreas.map(ta => (
                <button key={ta} type="button" onClick={() => setFilterTopic(ta === filterTopic ? '' : ta)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${filterTopic===ta?'bg-gray-700 text-white':`${TOPIC_COLORS[ta]??'bg-gray-100 text-gray-600'} hover:opacity-80`}`}>
                  {TOPIC_LABELS[ta] ?? ta}
                </button>
              ))}
            </div>
          )}

          {!loading && (
            <div className="text-xs text-gray-500">
              {questions.length} прашање{questions.length !== 1 ? 'а' : ''} пронајдено
              {(filterPart || filterDok || filterTopic || filterType || search) && (
                <button type="button"
                  onClick={() => { setFilterPart(0); setFilterDok(0); setFilterTopic(''); setFilterType(''); setSearch(''); }}
                  className="ml-2 text-indigo-600 hover:underline">
                  Исчисти филтри
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ Question grid (DIM) ══ */}
      {activeTab === 'dim' && <div className="max-w-6xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
            {Array.from({ length: 6 }).map((_, i) => <QuestionSkeleton key={i} />)}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-medium">Нема резултати</p>
            <p className="text-sm mt-1">Промени ги филтрите или пребарувањето</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-2">
            {questions.map(q => {
              const n      = q.questionNumber;
              const checks = selfChecks[n] ?? Array(q.points).fill(false);
              return (
                <QuestionCard
                  key={`${resolvedId}-${n}`}
                  q={q}
                  revealed={revealAll || revealedIds.has(n)}
                  onReveal={() => toggleReveal(n)}
                  onHide={() => hideQ(n)}
                  practiceMode={practiceMode}
                  mcPick={mcPicks[n]}
                  onMcPick={ch => setMcPicks(p => ({ ...p, [n]: ch }))}
                  answer={p2Answers[n] ?? ''}   setAnswer={v => setP2Answers(p => ({ ...p, [n]: v }))}
                  onGradeP2={() => handleGradeP2(q)}
                  gradingP2={gradingP2.has(n)}
                  aiGrade={aiGrades[n]}
                  selfChecks={checks}
                  onSelfCheck={(i, v) => handleSelfCheck(n, q.points, i, v)}
                  aiDesc={aiDescs[n] ?? ''}       setAiDesc={v => setAiDescs(p => ({ ...p, [n]: v }))}
                  onGradeP3={() => handleGradeP3(q)}
                  gradingP3={gradingP3.has(n)}
                  aiGradeP3={aiGradesP3[n]}
                  aiError={aiErrors[n]}
                  questionDocId={`${q.examId}_q${String(n).padStart(2, '00')}`}
                  currentUid={firebaseUser?.uid ?? null}
                  currentDisplayName={firebaseUser?.displayName || firebaseUser?.email || 'Ученик'}
                />
              );
            })}
          </div>
        )}
      </div>}
    </div>
  );
}

export default MaturaLibraryView;
