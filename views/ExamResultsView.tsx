import React, { useState, useEffect } from 'react';
import { useNavigation } from '../contexts/NavigationContext';
import { useNotification } from '../contexts/NotificationContext';
import { examService } from '../services/firestoreService.exam';
import { geminiService } from '../services/geminiService';
import type { ExamSession, ExamResponse } from '../services/firestoreService.types';
import { useRouter } from '../hooks/useRouter';
import {
  Loader2, Wand2, Download, CheckCircle, XCircle, BarChart2,
  ChevronDown, ChevronUp, ArrowLeft,
} from 'lucide-react';

const VARIANT_BADGE: Record<string, string> = {
  A: 'bg-blue-100 text-blue-700',
  B: 'bg-green-100 text-green-700',
  V: 'bg-amber-100 text-amber-700',
  G: 'bg-purple-100 text-purple-700',
};

function pct(score: number, max: number): number {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

function gradeLabel(p: number): string {
  if (p >= 90) return '5 (Одличен)';
  if (p >= 75) return '4 (Многу добар)';
  if (p >= 60) return '3 (Добар)';
  if (p >= 50) return '2 (Доволен)';
  return '1 (Недоволен)';
}
function gradeColor(p: number): string {
  if (p >= 90) return 'text-emerald-700';
  if (p >= 75) return 'text-blue-700';
  if (p >= 60) return 'text-amber-700';
  if (p >= 50) return 'text-orange-700';
  return 'text-red-700';
}

export const ExamResultsView: React.FC<{ id?: string }> = ({ id }) => {
  const { navigate } = useNavigation();
  const { addNotification } = useNotification();
  const { params } = useRouter([]);

  const sessionId = id ?? params?.id ?? '';

  const [session, setSession] = useState<ExamSession | null>(null);
  const [responses, setResponses] = useState<ExamResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    Promise.all([
      examService.getExamSession(sessionId),
      examService.getExamResponses(sessionId),
    ]).then(([s, r]) => {
      setSession(s);
      setResponses(r);
      setLoading(false);
    });
  }, [sessionId]);

  const handleGradeOne = async (response: ExamResponse) => {
    if (!session || gradingId) return;
    const questions = session.variants[response.variantKey] ?? [];
    if (!questions.length) return;
    setGradingId(response.id);
    try {
      const gradingInput = questions.map(q => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
        points: q.points,
      }));
      const feedback = await (geminiService as any).gradeExamResponses(gradingInput, response.answers ?? {});
      const score = (feedback as { points: number }[]).reduce((s: number, f: { points: number }) => s + f.points, 0);
      const maxScore = questions.reduce((s, q) => s + q.points, 0);
      await examService.saveGradingResult(session.id, response.id, { score, maxScore, aiFeedback: feedback });
      setResponses(prev => prev.map(r =>
        r.id === response.id ? { ...r, score, maxScore, aiFeedback: feedback, gradedAt: new Date() as any } : r,
      ));
      addNotification(`${response.studentName} оценет: ${score}/${maxScore} (${pct(score, maxScore)}%)`, 'success');
    } catch {
      addNotification('Грешка при AI оценување.', 'error');
    }
    setGradingId(null);
  };

  const handleGradeAll = async () => {
    const ungraded = responses.filter(r => r.status === 'submitted' && !r.gradedAt);
    for (const r of ungraded) {
      await handleGradeOne(r);
    }
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }
  if (!session) {
    return <div className="p-8 text-gray-500">Испитот не е пронајден.</div>;
  }

  const submitted = responses.filter(r => r.status === 'submitted');
  const graded = submitted.filter(r => !!r.gradedAt);
  const avgScore = graded.length > 0
    ? Math.round(graded.reduce((s, r) => s + pct(r.score ?? 0, r.maxScore ?? 1), 0) / graded.length)
    : null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <button
            type="button"
            onClick={() => navigate(`/exam/presenter/${session.id}`)}
            className="p-2 rounded-xl hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Резултати — {session.title}</h1>
            <p className="text-sm text-gray-500">{session.gradeLevel}. одд. · {submitted.length} предале</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-200 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-800">{submitted.length}</p>
            <p className="text-xs text-gray-500">Предале</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-200 text-center shadow-sm">
            <p className="text-2xl font-bold text-indigo-600">{graded.length}</p>
            <p className="text-xs text-gray-500">Оценети</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-200 text-center shadow-sm">
            <p className={`text-2xl font-bold ${avgScore != null ? gradeColor(avgScore) : 'text-gray-400'}`}>
              {avgScore != null ? `${avgScore}%` : '—'}
            </p>
            <p className="text-xs text-gray-500">Просек</p>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-gray-200 text-center shadow-sm">
            <p className="text-2xl font-bold text-gray-800">{session.variants.A.length}</p>
            <p className="text-xs text-gray-500">Прашања/вар.</p>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleGradeAll}
            disabled={!!gradingId || submitted.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold"
          >
            {gradingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            AI Оцени ги сите
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 hover:border-indigo-400 text-gray-700 rounded-xl text-sm font-semibold"
          >
            <Download className="w-4 h-4" /> Печати / PDF
          </button>
        </div>

        {/* Results table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            <span className="font-semibold text-gray-800">Листа на ученици</span>
          </div>
          {responses.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Нема предадени одговори.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {responses.map(r => {
                const isExpanded = expanded === r.id;
                const questions = session.variants[r.variantKey] ?? [];
                const scorePct = r.score != null && r.maxScore ? pct(r.score, r.maxScore) : null;
                return (
                  <div key={r.id}>
                    <div
                      className="px-5 py-3 flex items-center gap-3 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpanded(isExpanded ? null : r.id)}
                    >
                      <span className="font-medium text-gray-800 flex-1">{r.studentName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${VARIANT_BADGE[r.variantKey] ?? ''}`}>
                        Вар. {r.variantKey}
                      </span>
                      {r.status !== 'submitted' && (
                        <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Не предал</span>
                      )}
                      {scorePct != null ? (
                        <span className={`font-bold text-sm ${gradeColor(scorePct)}`}>
                          {r.score}/{r.maxScore} ({scorePct}%) — {gradeLabel(scorePct)}
                        </span>
                      ) : r.status === 'submitted' ? (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); handleGradeOne(r); }}
                          disabled={!!gradingId}
                          className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold disabled:opacity-50"
                        >
                          {gradingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                          Оцени
                        </button>
                      ) : null}
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="px-5 pb-4 bg-gray-50 space-y-2">
                        {questions.map((q, qi) => {
                          const studentAns = (r.answers ?? {})[`q${qi}`] ?? '—';
                          const fb = r.aiFeedback?.find(f => f.questionId === q.id);
                          return (
                            <div key={q.id} className="text-sm rounded-xl bg-white border border-gray-100 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-gray-700 flex-1">{qi + 1}. {q.question}</p>
                                {fb && (
                                  <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${fb.correct ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                    {fb.points}/{q.points}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 flex flex-col gap-1 text-xs">
                                <span className="text-gray-500">
                                  Ученик: <span className="text-gray-800 font-medium">{studentAns}</span>
                                </span>
                                <span className="text-emerald-700">
                                  Точно: <span className="font-medium">{q.answer}</span>
                                </span>
                                {fb && (
                                  <span className="text-gray-500 flex items-center gap-1">
                                    {fb.correct ? <CheckCircle className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-red-500" />}
                                    {fb.feedback}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
