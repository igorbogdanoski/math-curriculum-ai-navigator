import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useNotification } from '../contexts/NotificationContext';
import { examService } from '../services/firestoreService.exam';
import type { ExamSession, ExamResponse } from '../services/firestoreService.types';
import { useRouter } from '../hooks/useRouter';
import {
  Play, Square, Users, Clock, CheckCircle, Loader2,
  BarChart2, Copy, ExternalLink, Printer,
} from 'lucide-react';

const STATUS_LABEL: Record<ExamResponse['status'], string> = {
  joined: 'Чека',
  solving: 'Решава',
  submitted: 'Предал',
};
const STATUS_COLOR: Record<ExamResponse['status'], string> = {
  joined: 'bg-yellow-100 text-yellow-800',
  solving: 'bg-blue-100 text-blue-800',
  submitted: 'bg-emerald-100 text-emerald-800',
};
const VARIANT_BADGE: Record<string, string> = {
  A: 'bg-blue-100 text-blue-700',
  B: 'bg-green-100 text-green-700',
  V: 'bg-amber-100 text-amber-700',
  G: 'bg-purple-100 text-purple-700',
};

export const ExamPresenterView: React.FC<{ id?: string }> = ({ id }) => {
  const { firebaseUser } = useAuth();
  const { navigate } = useNavigation();
  const { addNotification } = useNotification();
  const { params } = useRouter([]);

  const sessionId = id ?? params?.id ?? '';

  const [session, setSession] = useState<ExamSession | null>(null);
  const [responses, setResponses] = useState<ExamResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = examService.subscribeExamSession(sessionId, s => {
      setSession(s);
      setLoading(false);
    });
    return unsub;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = examService.subscribeExamResponses(sessionId, setResponses);
    return unsub;
  }, [sessionId]);

  const handleStart = async () => {
    if (!session) return;
    setActing(true);
    await examService.startExamSession(session.id, session.duration);
    addNotification('Испитот стартуваше!', 'success');
    setActing(false);
  };

  const handleEnd = async () => {
    if (!session) return;
    if (!window.confirm('Сигурни ли сте дека сакате да го завршите испитот? Сите студенти ќе бидат автоматски поднесени.')) return;
    setActing(true);
    await examService.updateExamStatus(session.id, 'ended');
    addNotification('Испитот е завршен.', 'info');
    setActing(false);
  };

  const copyJoinCode = () => {
    if (session?.joinCode) {
      navigator.clipboard.writeText(session.joinCode);
      addNotification('Кодот е копиран!', 'success');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Испитот не е пронајден.</p>
      </div>
    );
  }

  const joined = responses.filter(r => r.status === 'joined').length;
  const solving = responses.filter(r => r.status === 'solving').length;
  const submitted = responses.filter(r => r.status === 'submitted').length;
  const total = responses.length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                🏛️ {session.title}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {session.gradeLevel}. одд. · {session.subject} · {Math.round(session.duration / 60)} мин
              </p>
            </div>

            {/* Join Code */}
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-400 mb-0.5">Код за приклучување</p>
                <button
                  type="button"
                  onClick={copyJoinCode}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-mono text-xl font-bold tracking-widest hover:bg-indigo-700 transition-colors"
                >
                  {session.joinCode}
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Action bar */}
          <div className="mt-4 flex flex-wrap gap-3">
            {session.status === 'draft' && (
              <button
                type="button"
                onClick={() => examService.updateExamStatus(session.id, 'waiting')}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold"
              >
                <Users className="w-4 h-4" /> Отвори за приклучување
              </button>
            )}
            {session.status === 'waiting' && (
              <button
                type="button"
                onClick={handleStart}
                disabled={acting}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold"
              >
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Старт
              </button>
            )}
            {session.status === 'active' && (
              <>
                <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-semibold">
                  <Clock className="w-4 h-4" /> Во тек…
                </span>
                <button
                  type="button"
                  onClick={handleEnd}
                  disabled={acting}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold"
                >
                  {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                  Заврши испит
                </button>
              </>
            )}
            {(session.status === 'ended') && (
              <button
                type="button"
                onClick={() => navigate(`/exam/results/${session.id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold"
              >
                <BarChart2 className="w-4 h-4" /> Резултати и оцени
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}${window.location.pathname}#/exam/play`;
                window.open(url, '_blank');
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:border-indigo-400 text-gray-700 rounded-xl text-sm font-semibold"
            >
              <ExternalLink className="w-4 h-4" /> Линк за ученици
            </button>
            <button
              type="button"
              onClick={() => navigate(`/exam/print/${session.id}`)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 hover:border-purple-400 text-gray-700 rounded-xl text-sm font-semibold"
            >
              <Printer className="w-4 h-4" /> Печати испит
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Приклучени', value: joined, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: 'Решаваат', value: solving, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Предале', value: submitted, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-2xl p-4 text-center border border-white`}>
              <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Напредок на одделението</span>
              <span>{submitted}/{total} предале</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (submitted / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Student table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              Ученици ({total})
            </h2>
          </div>
          {total === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Сè уште нема приклучени ученици. Сподели го кодот: <strong className="text-gray-600 font-mono">{session.joinCode}</strong>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Ученик</th>
                    <th className="px-4 py-2 text-left">Варијанта</th>
                    <th className="px-4 py-2 text-left">Статус</th>
                    <th className="px-4 py-2 text-right">Одговори</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {responses.map(r => {
                    const answerCount = Object.keys(r.answers ?? {}).length;
                    const questionCount = session.variants[r.variantKey]?.length ?? 0;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{r.studentName}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${VARIANT_BADGE[r.variantKey] ?? ''}`}>
                            Вар. {r.variantKey}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[r.status]}`}>
                            {STATUS_LABEL[r.status]}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500">
                          {r.status === 'submitted'
                            ? <CheckCircle className="w-4 h-4 text-emerald-500 inline" />
                            : `${answerCount}/${questionCount}`
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
