import React, { useEffect, useState } from 'react';
import { firestoreService, type QuizResult } from '../services/firestoreService';
import { ICONS } from '../constants';
import {
  Loader2, User, Star, BookOpen, Home, BarChart2, CheckCircle2, XCircle, Calendar, RefreshCw,
} from 'lucide-react';

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
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const fetchResults = async (name: string) => {
    if (!name.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const data = await firestoreService.fetchQuizResultsByStudentName(name.trim());
      setResults(data);
    } catch {
      setResults([]);
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
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => { window.location.hash = '/'; }}
            className="flex items-center gap-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full border border-white/10 transition"
          >
            <Home className="w-4 h-4" /> Почетна
          </button>
        )}
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
        <div className="w-full max-w-2xl grid grid-cols-3 gap-3 mb-6">
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
              return (
                <div
                  key={i}
                  className="bg-white rounded-2xl p-4 shadow flex items-center gap-4"
                >
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
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xl font-black ${isPassed ? 'text-green-600' : 'text-amber-500'}`}>
                      {r.percentage}%
                    </p>
                    <p className="text-xs text-slate-400">{r.correctCount}/{r.totalQuestions}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <footer className="mt-10 text-white/50 text-xs font-bold uppercase tracking-widest">
        Powered by Math Curriculum AI Navigator
      </footer>
    </div>
  );
};
