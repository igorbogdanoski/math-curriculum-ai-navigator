import React, { useEffect, useState } from 'react';
import { firestoreService, type QuizResult, type ConceptMastery } from '../services/firestoreService';
import { ICONS } from '../constants';
import {
  Loader2, User, Star, BookOpen, Home, BarChart2, CheckCircle2, XCircle,
  Calendar, RefreshCw, Trophy, Flame, PlayCircle, Printer,
} from 'lucide-react';
import { GradeBadge } from '../components/common/GradeBadge';

const formatDate = (ts: any): string => {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', year: 'numeric' });
};

interface Props {
  /** Passed from URL query param ?name=... — enables read-only parent view */
  name?: string;
}

export const StudentProgressView: React.FC<Props> = ({ name: nameProp }) => {
  const isReadOnly = !!nameProp;

  const [studentName, setStudentName] = useState<string>(
    () => nameProp || localStorage.getItem('studentName') || ''
  );
  const [nameInput, setNameInput] = useState<string>(
    () => nameProp || localStorage.getItem('studentName') || ''
  );
  const [results, setResults] = useState<QuizResult[]>([]);
  const [masteryRecords, setMasteryRecords] = useState<ConceptMastery[]>([]);
  // conceptId → quizId for "play again" self-navigation
  const [nextQuizIds, setNextQuizIds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchResults = async (name: string) => {
    if (!name.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const [quizData, masteryData] = await Promise.all([
        firestoreService.fetchQuizResultsByStudentName(name.trim()),
        firestoreService.fetchMasteryByStudent(name.trim()),
      ]);
      setResults(quizData);
      setMasteryRecords(masteryData);

      // Pre-fetch quiz links for failed concepts (self-navigation)
      const failedConceptIds = Array.from(
        new Set(quizData.filter(r => r.percentage < 70 && r.conceptId).map(r => r.conceptId!))
      );
      if (failedConceptIds.length > 0) {
        const quizLookups = await Promise.all(
          failedConceptIds.map(cid =>
            firestoreService.fetchLatestQuizByConcept(cid).then(q => ({ cid, id: q?.id }))
          )
        );
        const map: Record<string, string> = {};
        quizLookups.forEach(({ cid, id }) => { if (id) map[cid] = id; });
        setNextQuizIds(map);
      }
    } catch {
      setResults([]);
      setMasteryRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on mount if name is known
  useEffect(() => {
    if (studentName) {
      fetchResults(studentName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    if (!isReadOnly) localStorage.setItem('studentName', trimmed);
    setStudentName(trimmed);
    fetchResults(trimmed);
  };

  const totalQuizzes = results.length;
  const passed = results.filter(r => r.percentage >= 70).length;
  const avgPct = totalQuizzes > 0
    ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / totalQuizzes)
    : 0;

  const masteredCount = masteryRecords.filter(m => m.mastered).length;
  const inProgressCount = masteryRecords.filter(m => !m.mastered && m.consecutiveHighScores > 0).length;

  const handlePrint = () => window.print();

  const printDate = new Date().toLocaleDateString('mk-MK', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-indigo-600 p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-2xl flex justify-between items-center mb-8 text-white">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
            <ICONS.logo className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-black text-xl tracking-tighter uppercase">
              {isReadOnly ? 'Прогрес на Ученик' : 'Мој Прогрес'}
            </h1>
            {isReadOnly && (
              <p className="text-white/60 text-xs font-semibold">Приказ за родители — само за читање</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {searched && totalQuizzes > 0 && (
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/10 transition no-print"
            >
              <Printer className="w-4 h-4" /> Печати извештај
            </button>
          )}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => { window.location.hash = '/'; }}
              className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/10 transition no-print"
            >
              <Home className="w-4 h-4" /> Почетна
            </button>
          )}
        </div>
      </div>

      {/* Search card — hidden in read-only (parent) mode */}
      {!isReadOnly && (
        <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="font-black text-slate-800">Внеси го твоето ime</p>
              <p className="text-xs text-slate-400">Ги гледаш само твоите резултати</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Ime и презиме..."
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 font-semibold focus:outline-none focus:border-indigo-400 transition"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={!nameInput.trim() || loading}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Прикажи
            </button>
          </div>
        </div>
      )}

      {/* Parent read-only header */}
      {isReadOnly && (
        <div className="w-full max-w-2xl bg-white/10 border border-white/20 rounded-2xl px-5 py-3 mb-6 flex items-center gap-3">
          <User className="w-5 h-5 text-white/70 flex-shrink-0" />
          <p className="text-white font-bold">{studentName}</p>
        </div>
      )}

      {/* Stats summary */}
      {searched && !loading && totalQuizzes > 0 && (
        <div className="w-full max-w-2xl grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 text-center shadow">
            <BarChart2 className="w-6 h-6 text-indigo-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-slate-800">{totalQuizzes}</p>
            <p className="text-xs text-slate-500 font-semibold">Квизови</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow">
            <CheckCircle2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-black text-slate-800">{passed}</p>
            <p className="text-xs text-slate-500 font-semibold">Положени</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow">
            <Star className="w-6 h-6 text-yellow-400 mx-auto mb-1" fill="currentColor" />
            <p className="text-2xl font-black text-slate-800">{avgPct}%</p>
            <p className="text-xs text-slate-500 font-semibold">Просек</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow">
            <Trophy className="w-6 h-6 text-yellow-500 mx-auto mb-1" fill="currentColor" />
            <p className="text-2xl font-black text-slate-800">{masteredCount}</p>
            <p className="text-xs text-slate-500 font-semibold">Совладани</p>
          </div>
        </div>
      )}

      {/* Mastery section */}
      {searched && !loading && masteryRecords.length > 0 && (
        <div className="w-full max-w-2xl mb-6">
          <div className="bg-white rounded-2xl shadow p-4">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-yellow-500" fill="currentColor" />
              <p className="font-bold text-slate-800 text-sm">Совладување на концепти</p>
            </div>
            <div className="space-y-2">
              {masteryRecords
                .sort((a, b) => (b.mastered ? 1 : 0) - (a.mastered ? 1 : 0) || b.consecutiveHighScores - a.consecutiveHighScores)
                .map((m) => (
                  <div key={m.conceptId} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.mastered ? 'bg-yellow-100' : 'bg-blue-50'}`}>
                      {m.mastered
                        ? <Trophy className="w-4 h-4 text-yellow-500" fill="currentColor" />
                        : <Flame className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{m.conceptTitle || m.conceptId}</p>
                      <p className="text-xs text-slate-400">
                        {m.mastered
                          ? `Совладан! Најдобар резултат: ${m.bestScore}%`
                          : `${m.consecutiveHighScores}/3 по ред ≥85% — Последен: ${m.lastScore}%`}
                      </p>
                    </div>
                    {m.mastered && (
                      <span className="text-xs font-black text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full flex-shrink-0">✓ Совладан</span>
                    )}
                    {!m.mastered && m.consecutiveHighScores > 0 && (
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full flex-shrink-0">
                        {3 - m.consecutiveHighScores} уште
                      </span>
                    )}
                  </div>
                ))}
            </div>
            {inProgressCount > 0 && (
              <p className="text-xs text-slate-400 mt-3 text-center">
                🔥 {inProgressCount} концепт{inProgressCount === 1 ? '' : 'и'} во напредок — продолжи со вежбање!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-3 mt-8">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
          <p className="text-white/70 text-sm font-bold">Вчитување...</p>
        </div>
      )}

      {/* Results list */}
      {searched && !loading && (
        <div className="w-full max-w-2xl space-y-3">
          {totalQuizzes === 0 ? (
            <div className="bg-white rounded-3xl p-8 text-center shadow">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="font-bold text-slate-500">Нема пронајдено резултати за „{studentName}"</p>
              <p className="text-xs text-slate-400 mt-1">
                Провери дали името е точно напишано, или одиграј прв квиз.
              </p>
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
                    {!isPassed && nextQuizId && (
                      <button
                        type="button"
                        onClick={() => { window.location.hash = `/play/${nextQuizId}`; }}
                        className="flex items-center gap-1 text-xs font-bold bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition mt-0.5"
                      >
                        <PlayCircle className="w-3 h-3" /> Вежбај
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <footer className="mt-10 text-white/50 text-xs font-bold uppercase tracking-widest no-print">
        Powered by Math Curriculum AI Navigator
      </footer>

      {/* ── Printable Parent Report (hidden on screen, visible on print) ── */}
      {searched && totalQuizzes > 0 && (
        <div className="printable-root hidden" aria-hidden="true">
          {/* Page header */}
          <div className="rpt-header">
            <div className="rpt-header-row">
              <div>
                <h1 className="rpt-title">Извештај за Напредок на Ученик</h1>
                <p className="rpt-subtitle">Математика — Math Curriculum AI Navigator</p>
              </div>
              <div className="rpt-meta">
                <div>Датум: <strong>{printDate}</strong></div>
                <div className="rpt-meta-date">Документ генериран автоматски</div>
              </div>
            </div>
          </div>

          {/* Student info */}
          <div className="rpt-student-box">
            <span className="rpt-student-label">Ученик</span>
            <p className="rpt-student-name">{studentName}</p>
          </div>

          {/* Summary stats */}
          <div className="rpt-stats-grid">
            {[
              { label: 'Вкупно квизови', value: String(totalQuizzes) },
              { label: 'Положени (≥70%)', value: String(passed) },
              { label: 'Просечен резултат', value: `${avgPct}%` },
              { label: 'Совладани концепти', value: String(masteredCount) },
            ].map(s => (
              <div key={s.label} className="rpt-stat-card">
                <p className="rpt-stat-value">{s.value}</p>
                <p className="rpt-stat-label">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Mastery section */}
          {masteryRecords.length > 0 && (
            <div className="rpt-section">
              <h2 className="rpt-section-title">Совладување на концепти</h2>
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th className="rpt-th rpt-th-left">Концепт</th>
                    <th className="rpt-th rpt-th-center">Обиди</th>
                    <th className="rpt-th rpt-th-center">Најдобар резултат</th>
                    <th className="rpt-th rpt-th-center">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {masteryRecords
                    .sort((a, b) => (b.mastered ? 1 : 0) - (a.mastered ? 1 : 0))
                    .map((m) => (
                      <tr key={m.conceptId}>
                        <td className="rpt-td">{m.conceptTitle || m.conceptId}</td>
                        <td className="rpt-td rpt-td-center">{m.attempts}</td>
                        <td className={`rpt-td rpt-td-center rpt-td-bold ${m.bestScore >= 85 ? 'rpt-td-green' : 'rpt-td-amber'}`}>{m.bestScore}%</td>
                        <td className={`rpt-td rpt-td-center rpt-td-bold ${m.mastered ? 'rpt-td-green' : 'rpt-td-blue'}`}>
                          {m.mastered ? '✓ Совладан' : `${m.consecutiveHighScores}/3 во тек`}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Quiz history */}
          <div className="rpt-section">
            <h2 className="rpt-section-title">Историја на квизови</h2>
            <table className="rpt-table">
              <thead>
                <tr>
                  <th className="rpt-th rpt-th-left">Квиз</th>
                  <th className="rpt-th rpt-th-center">Датум</th>
                  <th className="rpt-th rpt-th-center">Резултат</th>
                  <th className="rpt-th rpt-th-center">Статус</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'rpt-row-even' : 'rpt-row-odd'}>
                    <td className="rpt-td">{r.quizTitle}</td>
                    <td className="rpt-td rpt-td-center">{formatDate(r.playedAt)}</td>
                    <td className={`rpt-td rpt-td-center rpt-td-bold ${r.percentage >= 70 ? 'rpt-td-green' : 'rpt-td-amber'}`}>
                      {r.percentage}% ({r.correctCount}/{r.totalQuestions})
                    </td>
                    <td className={`rpt-td rpt-td-center rpt-td-bold ${r.percentage >= 70 ? 'rpt-td-green' : 'rpt-td-amber'}`}>
                      {r.percentage >= 70 ? 'Положен' : 'Не положен'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Print footer */}
          <div className="rpt-footer-bar">
            <span>Math Curriculum AI Navigator — Педагошки систем за следење на напредок</span>
            <span>Извештај генериран на {printDate}</span>
          </div>

          {/* Signature lines */}
          <div className="rpt-signatures">
            <div>
              <div className="rpt-signature-line" />
              <p className="rpt-signature-label">Потпис на наставник</p>
            </div>
            <div>
              <div className="rpt-signature-line" />
              <p className="rpt-signature-label">Потпис на родител / старател</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
