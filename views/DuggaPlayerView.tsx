import React, { useState, useCallback } from 'react';
import {
  Search, CheckCircle2, XCircle, Loader2, Award,
  ArrowUp, ArrowDown, Clock, User, BookOpen, Shuffle,
  RotateCcw, ChevronRight, Trophy,
} from 'lucide-react';
import { MathRenderer } from '../components/common/MathRenderer';
import { MathInput } from '../components/common/MathInput';
import { getDuggaTestByCode, submitDuggaTest } from '../services/firestoreService.dugga';
import type { DuggaTest, DuggaQuestion } from '../services/firestoreService.dugga';
import { duggaAPI } from '../services/gemini/dugga';
import { autoScore, needsAIGrade, parseAIEarnedPoints, percentageToMkGrade } from '../utils/duggaScoring';
import type { QResult } from '../utils/duggaScoring';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'code' | 'name' | 'test' | 'submitting' | 'results';

// ─── Answer Input Components ──────────────────────────────────────────────────

function AnswerInput({ q, answer, onChange, disabled }: {
  q: DuggaQuestion; answer: string; onChange: (v: string) => void; disabled: boolean;
}) {
  switch (q.type) {
    case 'multiple_choice': {
      const opts = q.options ?? [];
      return (
        <div className="space-y-2 mt-3">
          {opts.map(opt => (
            <label key={opt.id}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${answer === opt.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'} ${disabled ? 'cursor-default' : ''}`}>
              <input type="radio" className="accent-indigo-600" checked={answer === opt.id}
                onChange={() => !disabled && onChange(opt.id)} disabled={disabled} />
              <span className="text-sm text-gray-800"><MathRenderer text={opt.text} /></span>
            </label>
          ))}
        </div>
      );
    }
    case 'checklist': {
      const opts = q.options ?? [];
      const selected = answer ? answer.split(',').filter(Boolean) : [];
      return (
        <div className="space-y-2 mt-3">
          {opts.map(opt => {
            const checked = selected.includes(opt.id);
            return (
              <label key={opt.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${checked ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-white'} ${disabled ? 'cursor-default' : ''}`}>
                <input type="checkbox" className="accent-indigo-600" checked={checked} disabled={disabled}
                  onChange={() => {
                    if (disabled) return;
                    const next = checked ? selected.filter(id => id !== opt.id) : [...selected, opt.id];
                    onChange(next.join(','));
                  }} />
                <span className="text-sm text-gray-800"><MathRenderer text={opt.text} /></span>
              </label>
            );
          })}
        </div>
      );
    }
    case 'true_false': {
      const opts = ['Точно', 'Неточно'];
      return (
        <div className="flex gap-3 mt-3">
          {opts.map(v => (
            <button type="button" key={v} disabled={disabled}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm border-2 transition-all ${answer === v ? (v === 'Точно' ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500') : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'} ${disabled ? 'cursor-default' : ''}`}
              onClick={() => !disabled && onChange(v)}>
              {v === 'Точно' ? '✓ Точно' : '✗ Неточно'}
            </button>
          ))}
        </div>
      );
    }
    case 'statement_eval': {
      const opts = ['Точно', 'Неточно', 'Делумно точно'];
      return (
        <div className="flex gap-2 flex-wrap mt-3">
          {opts.map(v => (
            <button type="button" key={v} disabled={disabled}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm border-2 transition-all ${answer === v ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'} ${disabled ? 'cursor-default' : ''}`}
              onClick={() => !disabled && onChange(v)}>
              {v}
            </button>
          ))}
        </div>
      );
    }
    case 'fill_blanks':
    case 'short_answer': {
      return (
        <div className="mt-3">
          {disabled
            ? <div className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm bg-gray-50 text-gray-600">{answer || '—'}</div>
            : <MathInput value={answer} onChange={onChange} placeholder="Внеси го одговорот..." className="w-full" />}

        </div>
      );
    }
    case 'essay': {
      return (
        <textarea rows={5} disabled={disabled} value={answer} onChange={e => onChange(e.target.value)}
          placeholder="Напиши го твоето решение / доказ..."
          className="w-full mt-3 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50" />
      );
    }
    case 'ordering': {
      const currentOrder = answer ? answer.split('|') : (q.orderItems ?? []);
      return (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-gray-500 mb-1">Постави ги во точен редослед:</p>
          {currentOrder.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-gray-200 bg-gray-50">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
              <span className="flex-1 text-sm text-gray-800"><MathRenderer text={item} /></span>
              {!disabled && (
                <div className="flex gap-0.5">
                  <button type="button" disabled={idx === 0} aria-label="Помести нагоре"
                    onClick={() => {
                      const next = [...currentOrder];
                      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                      onChange(next.join('|'));
                    }}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-20 transition-colors">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" disabled={idx === currentOrder.length - 1} aria-label="Помести надолу"
                    onClick={() => {
                      const next = [...currentOrder];
                      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                      onChange(next.join('|'));
                    }}
                    className="p-1 hover:bg-gray-200 rounded disabled:opacity-20 transition-colors">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    case 'multi_match': {
      const pairs = q.matchPairs ?? [];
      const rightOptions = pairs.map(p => p.right);
      let parsed: Record<string, string> = {};
      try { parsed = answer ? JSON.parse(answer) : {}; } catch { /* */ }
      return (
        <div className="mt-3 space-y-2">
          {pairs.map((pair, pi) => (
            <div key={pi} className="flex items-center gap-3">
              <div className="flex-1 text-sm font-medium bg-indigo-50 rounded-xl px-3 py-2 border border-indigo-100">
                <MathRenderer text={pair.left} />
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
              <select disabled={disabled} value={parsed[pair.left] ?? ''}
                aria-label={`Поврзи: ${pair.left}`}
                onChange={e => {
                  const next = { ...parsed, [pair.left]: e.target.value };
                  onChange(JSON.stringify(next));
                }}
                className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50">
                <option value="">— избери —</option>
                {rightOptions.map((r, ri) => <option key={ri} value={r}>{r}</option>)}
              </select>
            </div>
          ))}
        </div>
      );
    }
    case 'table_completion': {
      const headers = q.tableHeaders ?? [];
      const rows = q.tableRows ?? [];
      let cells: Record<string, string> = {};
      try { cells = answer ? JSON.parse(answer) : {}; } catch { /* */ }
      return (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm border-collapse rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-indigo-50">
                {headers.map((h, hi) => (
                  <th key={hi} className="border border-indigo-200 px-3 py-2 text-center font-semibold text-indigo-700">
                    <MathRenderer text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border border-gray-200 px-2 py-1.5 text-center bg-white">
                      {cell === '' ? (
                        <input type="text" disabled={disabled} value={cells[`${ri}_${ci}`] ?? ''}
                          aria-label={`Ред ${ri + 1}, колона ${ci + 1}`}
                          placeholder="?"
                          onChange={e => {
                            const next = { ...cells, [`${ri}_${ci}`]: e.target.value };
                            onChange(JSON.stringify(next));
                          }}
                          className="w-20 text-center border-b-2 border-indigo-400 focus:outline-none bg-transparent text-sm" />
                      ) : (
                        <span className="text-gray-700"><MathRenderer text={cell} /></span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'list_items': {
      const count = Math.max(3, q.options?.length ?? 3);
      let items: string[] = [];
      try { items = answer ? JSON.parse(answer) : []; } catch { /* */ }
      while (items.length < count) items.push('');
      return (
        <div className="mt-3 space-y-2">
          {items.map((item, ii) => (
            <div key={ii} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-5 text-right shrink-0">{ii + 1}.</span>
              <input type="text" disabled={disabled} value={item}
                aria-label={`Ставка ${ii + 1}`}
                placeholder={`${ii + 1}. одговор`}
                onChange={e => {
                  const next = [...items];
                  next[ii] = e.target.value;
                  onChange(JSON.stringify(next));
                }}
                className="flex-1 rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50" />
            </div>
          ))}
        </div>
      );
    }
    case 'diagram_annotate': {
      return (
        <div className="mt-3 space-y-3">
          {q.imageUrl && <img src={q.imageUrl} alt="Дијаграм" className="max-w-full rounded-xl border border-gray-200" />}
          <textarea rows={4} disabled={disabled} value={answer} onChange={e => onChange(e.target.value)}
            placeholder="Опиши ги означените делови..."
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50" />
        </div>
      );
    }
    case 'interactive_table': {
      const headers = q.tableHeaders ?? [];
      const rows = q.tableRows ?? [];
      let checked: Record<string, boolean> = {};
      try { checked = answer ? JSON.parse(answer) : {}; } catch { /* */ }
      return (
        <div className="mt-3 overflow-x-auto">
          <table className="text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-3 py-2" aria-label="Ред"></th>
                {headers.map((h, hi) => (
                  <th key={hi} className="border border-gray-200 px-4 py-2 text-center font-semibold text-gray-700">
                    <MathRenderer text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  <td className="border border-gray-200 px-3 py-2 font-medium text-gray-700 bg-gray-50">
                    <MathRenderer text={row[0] ?? ''} />
                  </td>
                  {headers.map((_, ci) => (
                    <td key={ci} className="border border-gray-200 px-4 py-2 text-center">
                      <input type="checkbox" className="accent-indigo-600 w-4 h-4" disabled={disabled}
                        aria-label={`${row[0] ?? `Ред ${ri + 1}`} — ${headers[ci] ?? `Кол ${ci + 1}`}`}
                        checked={!!checked[`${ri}_${ci}`]}
                        onChange={e => {
                          const next = { ...checked, [`${ri}_${ci}`]: e.target.checked };
                          onChange(JSON.stringify(next));
                        }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    case 'multi_part': {
      return (
        <textarea rows={6} disabled={disabled} value={answer} onChange={e => onChange(e.target.value)}
          placeholder="Одговори на сите делови..."
          className="w-full mt-3 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50" />
      );
    }
    case 'inline_select': {
      return (
        <input type="text" disabled={disabled} value={answer} onChange={e => onChange(e.target.value)}
          placeholder="Одговор..."
          className="w-full mt-3 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50" />
      );
    }
    default:
      return (
        <input type="text" disabled={disabled} value={answer} onChange={e => onChange(e.target.value)}
          placeholder="Одговор..."
          className="w-full mt-3 rounded-xl border-2 border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent disabled:bg-gray-50" />
      );
  }
}

// ─── Question Card ─────────────────────────────────────────────────────────────

const DOK_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-amber-100 text-amber-700',
  4: 'bg-red-100 text-red-700',
};

function QuestionCard({ q, idx, answer, onChange, result, showResults }: {
  q: DuggaQuestion; idx: number; answer: string;
  onChange: (id: string, v: string) => void;
  result?: QResult; showResults: boolean;
}) {
  if (q.type === 'section_header') {
    return (
      <div className="pt-4 pb-1">
        <h3 className="text-base font-bold text-indigo-700 border-b-2 border-indigo-200 pb-2 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <MathRenderer text={q.text} />
        </h3>
      </div>
    );
  }

  const borderClass = showResults && result
    ? result.correct === true ? 'border-green-300 bg-green-50'
    : result.correct === false ? 'border-red-300 bg-red-50'
    : 'border-amber-300 bg-amber-50'
    : 'border-gray-200 bg-white';

  const answered = answer.length > 0;

  return (
    <div className={`rounded-2xl border-2 p-5 transition-all ${borderClass}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className={`shrink-0 w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center ${answered && !showResults ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
            {idx + 1}
          </span>
          <div className="flex-1 min-w-0 text-sm font-medium text-gray-800 leading-relaxed">
            <MathRenderer text={q.text} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DOK_COLORS[q.dok]}`}>DoK{q.dok}</span>
          <span className="text-xs font-semibold text-gray-500">{q.points}п</span>
          {showResults && result && (
            result.correct === true
              ? <CheckCircle2 className="w-5 h-5 text-green-500" />
              : result.correct === false
                ? <XCircle className="w-5 h-5 text-red-500" />
                : <Clock className="w-5 h-5 text-amber-500" />
          )}
        </div>
      </div>

      {/* Answer UI */}
      <AnswerInput q={q} answer={answer} onChange={v => onChange(q.id, v)} disabled={showResults} />

      {/* Results feedback */}
      {showResults && result && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
          {result.feedback && (
            <p className="text-xs text-gray-600">{result.feedback}</p>
          )}
          {result.aiGrade && (
            <div className="text-xs bg-blue-50 rounded-xl p-3 border border-blue-200 whitespace-pre-line">
              <span className="font-semibold text-blue-700 block mb-1">AI Оценување:</span>
              {result.aiGrade}
            </div>
          )}
          {q.hint && result.correct !== true && (
            <p className="text-xs text-amber-700 italic bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200">
              Совет: {q.hint}
            </p>
          )}
          {q.solution && (
            <details className="text-xs">
              <summary className="cursor-pointer text-indigo-600 font-semibold hover:text-indigo-800">
                Прикажи решение
              </summary>
              <div className="mt-1.5 p-3 bg-indigo-50 rounded-xl border border-indigo-200 text-gray-700">
                <MathRenderer text={q.solution} />
              </div>
            </details>
          )}
          <div className="text-xs font-bold text-right text-gray-700">
            {result.earned} / {result.maxPoints} поени
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function DuggaPlayerView() {
  const { user, firebaseUser } = useAuth();
  const { addNotification } = useNotification();

  const [phase, setPhase] = useState<Phase>('code');
  const [code, setCode] = useState('');
  const [loadingTest, setLoadingTest] = useState(false);
  const [test, setTest] = useState<DuggaTest | null>(null);
  const [studentName, setStudentName] = useState(
    (user as any)?.displayName ?? firebaseUser?.displayName ?? ''
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, QResult>>({});
  const [totalScore, setTotalScore] = useState(0);
  const [maxScore, setMaxScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState('Оценување...');

  const handleAnswer = useCallback((id: string, v: string) => {
    setAnswers(prev => ({ ...prev, [id]: v }));
  }, []);

  const fetchTest = async () => {
    if (!code.trim()) return;
    setLoadingTest(true);
    try {
      const t = await getDuggaTestByCode(code.trim());
      if (!t) {
        addNotification('Тестот не е пронајден. Провери го кодот.', 'error');
        return;
      }
      setTest(t);
      // Initialize ordering questions with shuffled order
      const initAnswers: Record<string, string> = {};
      t.questions.forEach(q => {
        if (q.type === 'ordering' && q.orderItems?.length) {
          const shuffled = [...q.orderItems].sort(() => Math.random() - 0.5);
          initAnswers[q.id] = shuffled.join('|');
        }
      });
      setAnswers(initAnswers);
      setPhase('name');
    } catch {
      addNotification('Грешка при вчитување. Обиди се повторно.', 'error');
    } finally {
      setLoadingTest(false);
    }
  };

  const handleSubmit = async () => {
    if (!test) return;
    setSubmitting(true);
    setPhase('submitting');

    const qResults: Record<string, QResult> = {};
    let earned = 0;
    let maxPts = 0;

    const gradeable = test.questions.filter(q => q.type !== 'section_header');

    // 1) Auto-score all questions
    for (const q of gradeable) {
      const ans = answers[q.id] ?? '';
      const auto = autoScore(q, ans);
      if (auto) {
        qResults[q.id] = auto;
        earned += auto.earned;
      } else {
        qResults[q.id] = { earned: 0, maxPoints: q.points, correct: null, feedback: 'Потребно дополнително оценување' };
      }
      maxPts += q.points;
    }

    // 2) AI-grade essay/open questions
    const aiQs = gradeable.filter(needsAIGrade);
    if (aiQs.length > 0) {
      setSubmitStatus(`AI оценување (${aiQs.length} есеј одговори)...`);
      for (const q of aiQs) {
        try {
          const grade = await duggaAPI.gradeEssayAnswer({
            question: q.text,
            studentAnswer: answers[q.id] ?? '',
            maxPoints: q.points,
          });
          const match = grade.match(/(\d+)\s*\/\s*\d+/);
          const aiEarned = match ? Math.min(parseInt(match[1]), q.points) : 0;
          qResults[q.id] = { earned: aiEarned, maxPoints: q.points, correct: aiEarned >= q.points * 0.7, feedback: '', aiGrade: grade };
          earned += aiEarned;
        } catch {
          qResults[q.id] = { ...qResults[q.id], feedback: 'AI оценувањето не успеа. Потребна рачна оценка.' };
        }
      }
    }

    // 3) Save to Firestore
    setSubmitStatus('Зачувување...');
    try {
      await submitDuggaTest({
        testId: test.id,
        testTitle: test.title,
        studentUid: firebaseUser?.uid ?? `anon_${Date.now()}`,
        studentName: studentName.trim() || 'Анонимен ученик',
        answers,
        score: earned,
        totalPoints: maxPts,
        percentage: maxPts > 0 ? Math.round((earned / maxPts) * 100) : 0,
        aiGradeNotes: Object.values(qResults).filter(r => r.aiGrade).map(r => r.aiGrade).join('\n---\n'),
      });
    } catch {
      // Non-critical
    }

    setResults(qResults);
    setTotalScore(earned);
    setMaxScore(maxPts);
    setSubmitting(false);
    setPhase('results');
  };

  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const gradeLabel = pct >= 90 ? 'Одличен (5)' : pct >= 75 ? 'Многу добар (4)' : pct >= 60 ? 'Добар (3)' : pct >= 50 ? 'Задоволителен (2)' : 'Недоволен (1)';
  const gradeColor = pct >= 90 ? 'text-green-600' : pct >= 75 ? 'text-blue-600' : pct >= 60 ? 'text-amber-600' : pct >= 50 ? 'text-orange-600' : 'text-red-600';
  const answeredCount = test ? test.questions.filter(q => q.type !== 'section_header' && (answers[q.id] ?? '').length > 0).length : 0;
  const totalAnswerable = test ? test.questions.filter(q => q.type !== 'section_header').length : 0;

  // ── Phase: CodeEntry ──────────────────────────────────────────────────────
  if (phase === 'code') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
              <Trophy className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Дига Тест</h1>
            <p className="text-gray-500 mt-2">Внеси го кодот за тестот добиен од наставникот</p>
          </div>
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Код за тест</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && fetchTest()}
                maxLength={6}
                placeholder="пр. AB3K7Z"
                className="w-full text-center text-3xl font-mono font-bold tracking-[0.4em] uppercase rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none py-4 px-4 transition-all"
              />
            </div>
            <button type="button"
              onClick={fetchTest}
              disabled={loadingTest || code.length < 4}
              className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-3">
              {loadingTest ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              {loadingTest ? 'Барање...' : 'Влези во тестот'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: NameEntry ──────────────────────────────────────────────────────
  if (phase === 'name' && test) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <User className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">{test.title}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {test.questions.filter(q => q.type !== 'section_header').length} прашања · {test.totalPoints} поени · ~{test.estimatedMinutes} мин
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Твоето ime и презиме</label>
              <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setPhase('test')}
                placeholder="пр. Ана Петровска"
                className="w-full rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none px-4 py-3 text-sm transition-all" />
            </div>
            {test.description && (
              <div className="bg-indigo-50 rounded-xl p-3 text-sm text-indigo-800 border border-indigo-200">
                {test.description}
              </div>
            )}
            <button type="button" onClick={() => setPhase('test')} disabled={!studentName.trim()}
              className="w-full py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
              Започни го тестот
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Test ───────────────────────────────────────────────────────────
  if (phase === 'test' && test) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-bold text-gray-900 text-sm truncate">{test.title}</h1>
              <p className="text-xs text-gray-500">{studentName}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-xs text-gray-600 font-medium">
                <span className={answeredCount === totalAnswerable ? 'text-green-600 font-bold' : ''}>
                  {answeredCount}
                </span>/{totalAnswerable} одговорено
              </div>
              <div className="w-20 h-2 rounded-full bg-gray-200 overflow-hidden">
                <div role="progressbar" aria-label="Напредок"
                  className="h-full rounded-full bg-indigo-500 transition-all"
                  style={{ width: `${totalAnswerable > 0 ? (answeredCount / totalAnswerable) * 100 : 0}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-32">
          {test.questions.map((q, idx) => (
            <QuestionCard key={q.id} q={q} idx={idx} answer={answers[q.id] ?? ''}
              onChange={handleAnswer} result={results[q.id]} showResults={false} />
          ))}
        </div>

        {/* Sticky submit bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-20">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              {totalAnswerable - answeredCount > 0
                ? <span className="text-amber-600 font-medium">{totalAnswerable - answeredCount} прашање(а) без одговор</span>
                : <span className="text-green-600 font-medium">Сите прашања одговорени</span>}
            </p>
            <button type="button" onClick={handleSubmit}
              className="px-8 py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg">
              Предај тест
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase: Submitting ─────────────────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-xl animate-pulse">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Оценување...</h2>
          <p className="text-gray-500 text-sm">{submitStatus}</p>
        </div>
      </div>
    );
  }

  // ── Phase: Results ────────────────────────────────────────────────────────
  if (phase === 'results' && test) {
    return (
      <div className="min-h-screen bg-gray-50 pb-12">
        {/* Score banner */}
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
          <div className="max-w-2xl mx-auto px-4 py-10 text-center">
            <Award className="w-14 h-14 mx-auto mb-4 opacity-90" />
            <h1 className="text-2xl font-bold mb-1">{test.title}</h1>
            <p className="text-indigo-200 text-sm mb-6">{studentName}</p>
            <div className="flex items-center justify-center gap-8">
              <div>
                <div className="text-5xl font-black">{totalScore}</div>
                <div className="text-indigo-200 text-sm">/ {maxScore} поени</div>
              </div>
              <div className="w-px h-16 bg-white/20" />
              <div>
                <div className="text-5xl font-black">{pct}%</div>
                <div className={`text-base font-bold mt-1 ${pct >= 90 ? 'text-green-300' : pct >= 60 ? 'text-yellow-300' : 'text-red-300'}`}>
                  {gradeLabel}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <h2 className="text-base font-bold text-gray-700">Детален преглед</h2>
          {test.questions.map((q, idx) => (
            <QuestionCard key={q.id} q={q} idx={idx} answer={answers[q.id] ?? ''}
              onChange={handleAnswer} result={results[q.id]} showResults={true} />
          ))}

          {/* Retry button */}
          <div className="pt-4 text-center">
            <button type="button"
              onClick={() => {
                setPhase('code');
                setCode('');
                setTest(null);
                setAnswers({});
                setResults({});
                setTotalScore(0);
                setMaxScore(0);
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">
              <RotateCcw className="w-4 h-4" />
              Нов тест
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
