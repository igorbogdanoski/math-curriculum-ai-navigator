import React, { useState, useMemo, useEffect, useRef } from 'react';
import { MathRenderer } from '../common/MathRenderer';
import { DokBadge }     from '../common/DokBadge';
import { useAuth }      from '../../contexts/AuthContext';
import { firestoreService } from '../../services/firestoreService';
import type { MaturaChoice, DokLevel } from '../../types';
import { TOPIC_LABELS } from './maturaLibrary.constants';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface InternalQuestion {
  questionNumber: number;
  part: 1 | 2;
  questionType: 'mc' | 'open';
  questionText: string;
  choices?: Record<string, string>;
  correctAnswer: string;
  topic: string;
  topicArea: string;
  dokLevel: DokLevel;
  conceptIds: string[];
  hints?: string[];
  aiSolution?: string;
  successRatePercent?: number;
}

type IntPracticePhase = 'browse' | 'practice' | 'results';

const INT_CHOICES: MaturaChoice[] = ['А', 'Б', 'В', 'Г'];
const INT_PAGE_SIZE = 20;
const INT_MC_COUNT  = 15;
const INT_OPEN_COUNT = 4;

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function collectPracticeConceptIds(
  practiceQs: ReadonlyArray<Pick<InternalQuestion, 'conceptIds'>>,
): string[] {
  return [...new Set(practiceQs.flatMap(q => q.conceptIds))];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function InternalMaturaTab() {
  const { firebaseUser } = useAuth();
  const [allQuestions, setAllQuestions] = useState<InternalQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterTopic,  setFilterTopic]  = useState('');
  const [filterDok,    setFilterDok]    = useState<0|1|2|3|4>(0);
  const [filterType,   setFilterType]   = useState<''|'mc'|'open'>('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(0);
  const [revealedIds,  setRevealedIds]  = useState<Set<number>>(new Set());

  const [phase,           setPhase]           = useState<IntPracticePhase>('browse');
  const [practiceQs,      setPracticeQs]      = useState<InternalQuestion[]>([]);
  const [practiceIdx,     setPracticeIdx]      = useState(0);
  const [mcPicks,         setMcPicks]         = useState<Record<number,string>>({});
  const [openRevealed,    setOpenRevealed]    = useState<Set<number>>(new Set());
  const [selfScores,      setSelfScores]      = useState<Record<number, number>>({});
  const [saving,          setSaving]          = useState(false);
  const savedRef = useRef(false);

  useEffect(() => {
    import('../../data/matura/raw/internal-matura-bank-gymnasium-mk.json')
      .then((mod) => {
        setAllQuestions((mod.default as unknown as { questions: InternalQuestion[] }).questions);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(0); }, [filterTopic, filterDok, filterType, search]);

  const topics = useMemo(
    () => [...new Set(allQuestions.map(q => q.topicArea))].sort(),
    [allQuestions],
  );

  const filtered = useMemo(() => allQuestions.filter(q => {
    if (filterTopic && q.topicArea !== filterTopic)   return false;
    if (filterDok   && q.dokLevel  !== filterDok)     return false;
    if (filterType === 'mc'   && q.questionType !== 'mc')   return false;
    if (filterType === 'open' && q.questionType !== 'open') return false;
    if (search) {
      const s = search.toLowerCase();
      return q.questionText.toLowerCase().includes(s) || q.topicArea.toLowerCase().includes(s);
    }
    return true;
  }), [allQuestions, filterTopic, filterDok, filterType, search]);

  const pageQs     = filtered.slice(page * INT_PAGE_SIZE, (page + 1) * INT_PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / INT_PAGE_SIZE);

  const stats = useMemo(() => allQuestions.length > 0 ? {
    total: allQuestions.length,
    mc:    allQuestions.filter(q => q.questionType === 'mc').length,
    open:  allQuestions.filter(q => q.questionType !== 'mc').length,
  } : null, [allQuestions]);

  function startPractice() {
    const mc   = shuffle(allQuestions.filter(q => q.questionType === 'mc')).slice(0, INT_MC_COUNT);
    const open = shuffle(allQuestions.filter(q => q.questionType !== 'mc')).slice(0, INT_OPEN_COUNT);
    setPracticeQs(shuffle([...mc, ...open]));
    setPracticeIdx(0);
    setMcPicks({});
    setOpenRevealed(new Set());
    setSelfScores({});
    savedRef.current = false;
    setPhase('practice');
  }

  function nextQuestion() {
    if (practiceIdx + 1 < practiceQs.length) {
      setPracticeIdx(i => i + 1);
    } else {
      finishPractice();
    }
  }

  function finishPractice() {
    setPhase('results');
    if (!savedRef.current && firebaseUser) {
      savedRef.current = true;
      const mcQs = practiceQs.filter(q => q.questionType === 'mc');
      const correctMC = mcQs.filter(q => mcPicks[q.questionNumber] === q.correctAnswer).length;
      const openPts = practiceQs
        .filter(q => q.questionType !== 'mc')
        .reduce((sum, q) => sum + (selfScores[q.questionNumber] ?? 0), 0);
      const maxPts = mcQs.length + practiceQs.filter(q => q.questionType !== 'mc').length * 4;
      const scored  = correctMC + openPts;
      const pct = maxPts > 0 ? Math.round(scored / maxPts * 100) : 0;
      setSaving(true);
      const studentName = firebaseUser.displayName || firebaseUser.email || firebaseUser.uid;
      firestoreService.saveQuizResult({
        quizId:         'internal-matura-gymnasium',
        quizTitle:      'Вежба — Училишна матура (Гимназиско)',
        score:          scored,
        correctCount:   correctMC,
        totalQuestions: practiceQs.length,
        percentage:     pct,
        gradeLevel:     13,
        conceptId:      undefined,
      }).catch(() => {}).finally(() => setSaving(false));

      collectPracticeConceptIds(practiceQs).forEach((cid: string) => {
        firestoreService.updateConceptMastery(
          studentName, cid, pct, { gradeLevel: 13 },
        ).catch(() => {});
      });
    }
  }

  // ── Results phase ──
  if (phase === 'results') {
    const mcQs      = practiceQs.filter(q => q.questionType === 'mc');
    const openQs    = practiceQs.filter(q => q.questionType !== 'mc');
    const correctMC = mcQs.filter(q => mcPicks[q.questionNumber] === q.correctAnswer).length;
    const openPts   = openQs.reduce((s, q) => s + (selfScores[q.questionNumber] ?? 0), 0);
    const maxPts    = mcQs.length + openQs.length * 4;
    const scored    = correctMC + openPts;
    const pct       = maxPts > 0 ? Math.round(scored / maxPts * 100) : 0;

    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="text-6xl mb-4">{pct >= 70 ? '🎉' : pct >= 50 ? '📚' : '💪'}</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Резултат: {pct}%</h2>
        <p className="text-gray-500 mb-1">{scored} / {maxPts} поени</p>
        <p className="text-sm text-gray-400 mb-6">MC: {correctMC}/{mcQs.length} · Отворени: {openPts}/{openQs.length * 4} pt</p>
        {saving && <p className="text-xs text-violet-500 mb-3">Се зачувува резултатот…</p>}
        <div className="flex justify-center gap-3">
          <button type="button" onClick={startPractice}
            className="px-6 py-2 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-700 text-sm">
            Вежбај повторно
          </button>
          <button type="button" onClick={() => setPhase('browse')}
            className="px-6 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 text-sm">
            Назад кон библиотека
          </button>
        </div>
      </div>
    );
  }

  // ── Practice phase ──
  if (phase === 'practice' && practiceQs.length > 0) {
    const q       = practiceQs[practiceIdx];
    const n       = q.questionNumber;
    const isMC    = q.questionType === 'mc';
    const picked  = mcPicks[n];
    const revealed = openRevealed.has(n);
    const isLast  = practiceIdx + 1 >= practiceQs.length;

    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-violet-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.round(((practiceIdx + 1) / practiceQs.length) * 100)}%` }}
            />
          </div>
          <span className="text-sm text-gray-500 shrink-0">
            {practiceIdx + 1} / {practiceQs.length}
          </span>
          <button type="button" onClick={finishPractice}
            className="text-xs text-gray-400 hover:text-gray-600 underline shrink-0">
            Заврши
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isMC ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
              {isMC ? 'MC · 1 поен' : 'Отворено · 4 поени'}
            </span>
            <DokBadge level={q.dokLevel} size="compact" />
            <span className="text-xs text-gray-400 ml-auto">{q.topicArea}</span>
          </div>

          <div className="text-sm text-gray-800 mb-4 leading-relaxed">
            <MathRenderer text={q.questionText} />
          </div>

          {isMC && q.choices && (
            <div className="space-y-2">
              {INT_CHOICES.map(ch => {
                const label = q.choices![ch];
                if (!label) return null;
                const isChosen  = picked === ch;
                const isCorrect = q.correctAnswer === ch;
                const showResult = picked !== undefined;
                let cls = 'border-gray-200 bg-white text-gray-700 hover:border-violet-300';
                if (showResult && isCorrect)     cls = 'border-emerald-400 bg-emerald-50 text-emerald-800 font-semibold';
                else if (showResult && isChosen) cls = 'border-red-400 bg-red-50 text-red-700';
                return (
                  <button key={ch} type="button"
                    disabled={picked !== undefined}
                    onClick={() => setMcPicks(p => ({ ...p, [n]: ch }))}
                    className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${cls}`}>
                    <span className="font-semibold mr-2">{ch}.</span>
                    <MathRenderer text={label} />
                  </button>
                );
              })}
              {picked && (
                <>
                  <p className={`text-xs font-semibold mt-1 ${picked === q.correctAnswer ? 'text-emerald-600' : 'text-red-600'}`}>
                    {picked === q.correctAnswer ? '✓ Точно!' : `✗ Точен: ${q.correctAnswer}`}
                  </p>
                  {q.aiSolution && (
                    <div className="mt-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">✨ Детално решение:</p>
                      <div className="text-xs text-gray-800 leading-relaxed">
                        <MathRenderer text={q.aiSolution} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!isMC && (
            <div className="space-y-3">
              {!revealed ? (
                <button type="button"
                  onClick={() => setOpenRevealed(s => { const n2 = new Set(s); n2.add(n); return n2; })}
                  className="px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100">
                  👁 Прикажи точен одговор
                </button>
              ) : (
                <>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Точен одговор:</p>
                    <div className="text-sm text-gray-800"><MathRenderer text={q.correctAnswer} /></div>
                  </div>
                  {q.aiSolution && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
                      <p className="text-xs font-semibold text-indigo-700 mb-1">✨ Детално решение:</p>
                      <div className="text-sm text-gray-800 leading-relaxed">
                        <MathRenderer text={q.aiSolution} />
                      </div>
                    </div>
                  )}
                </>
              )}
              {revealed && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Самооценување (0–4 поени):</p>
                  <div className="flex gap-2">
                    {[0,1,2,3,4].map(pts => (
                      <button key={pts} type="button"
                        onClick={() => setSelfScores(p => ({ ...p, [n]: pts }))}
                        className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors ${
                          selfScores[n] === pts ? 'bg-violet-600 text-white border-violet-600' : 'bg-white border-gray-200 text-gray-600 hover:border-violet-300'
                        }`}>
                        {pts}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-between mt-4">
          <button type="button"
            onClick={() => setPracticeIdx(i => Math.max(0, i - 1))}
            disabled={practiceIdx === 0}
            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 disabled:opacity-40">
            ← Претходно
          </button>
          <button type="button"
            onClick={nextQuestion}
            disabled={isMC && picked === undefined}
            className="px-5 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40">
            {isLast ? 'Завршувам' : 'Следно →'}
          </button>
        </div>
      </div>
    );
  }

  // ── Browse phase ──
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">📝 Базен прашања — Училишна матура (Гимназиско)</h2>
              {stats && (
                <p className="text-xs text-gray-500">
                  {stats.total} прашања · {stats.mc} MC · {stats.open} отворени
                </p>
              )}
            </div>
            <button type="button" onClick={startPractice}
              disabled={allQuestions.length === 0}
              className="ml-auto px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-40 shadow-sm">
              ✏️ Вежбај ({INT_MC_COUNT} MC + {INT_OPEN_COUNT} отворени)
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-4 pb-2 space-y-2">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input type="text" placeholder="Пребарај…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
          <select title="Избери тема" aria-label="Избери тема" value={filterTopic} onChange={e => setFilterTopic(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700 focus:ring-violet-300">
            <option value="">Сите теми</option>
            {topics.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select title="Избери тип" aria-label="Избери тип" value={filterType} onChange={e => setFilterType(e.target.value as ''|'mc'|'open')}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700">
            <option value="">Сите типови</option>
            <option value="mc">MC</option>
            <option value="open">Отворени</option>
          </select>
        </div>
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs font-semibold text-gray-500">DoK:</span>
          {([0,1,2,3,4] as const).map(d => (
            <button key={d} type="button" onClick={() => setFilterDok(d)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${filterDok===d?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
              {d === 0 ? 'Сите' : `DoK ${d}`}
            </button>
          ))}
          <span className="ml-2 text-xs text-gray-400">{filtered.length} прашања</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                <div className="h-3 bg-gray-100 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-full mb-2" />
                <div className="h-4 bg-gray-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : pageQs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🔍</div>
            <p className="font-medium">Нема резултати</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {pageQs.map(q => {
              const n = q.questionNumber;
              const isRev = revealedIds.has(n);
              return (
                <div key={n} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-gray-400">#{n}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${q.questionType === 'mc' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                      {q.questionType === 'mc' ? 'MC' : 'Отворено'}
                    </span>
                    <DokBadge level={q.dokLevel} size="compact" />
                    <span className="text-xs text-gray-400 ml-auto">{q.topicArea}</span>
                  </div>
                  <div className="text-sm text-gray-800 leading-relaxed">
                    <MathRenderer text={q.questionText} />
                  </div>
                  {q.questionType === 'mc' && q.choices && (
                    <div className="space-y-1">
                      {INT_CHOICES.map(ch => q.choices?.[ch] ? (
                        <div key={ch} className={`text-xs px-3 py-1.5 rounded-lg border ${isRev && q.correctAnswer===ch ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold' : 'border-gray-100 text-gray-600'}`}>
                          <span className="font-semibold mr-1">{ch}.</span><MathRenderer text={q.choices[ch]!} />
                        </div>
                      ) : null)}
                    </div>
                  )}
                  {isRev && (
                    <>
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                        <p className="text-xs font-semibold text-emerald-700 mb-0.5">Точен одговор:</p>
                        <div className="text-xs text-gray-800"><MathRenderer text={q.correctAnswer} /></div>
                      </div>
                      {q.aiSolution && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
                          <p className="text-xs font-semibold text-indigo-700 mb-1">✨ Детално решение:</p>
                          <div className="text-xs text-gray-800 leading-relaxed">
                            <MathRenderer text={q.aiSolution} />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <button type="button"
                    onClick={() => setRevealedIds(prev => {
                      const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s;
                    })}
                    className="text-xs text-violet-600 hover:underline self-start mt-auto">
                    {isRev ? '🙈 Скриј' : `👁 Прикажи${q.aiSolution ? ' решение' : ' одговор'}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 hover:border-violet-300 disabled:opacity-40">
              ← Претх.
            </button>
            <span className="text-sm text-gray-500">{page + 1} / {totalPages}</span>
            <button type="button" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-600 hover:border-violet-300 disabled:opacity-40">
              Следна →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
