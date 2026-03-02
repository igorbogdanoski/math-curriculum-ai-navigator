import React, { useState, useEffect, useRef } from 'react';
import { Radio, Play, Square, Copy, Check, Loader2, Users, Trophy } from 'lucide-react';
import { firestoreService, type LiveSession } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';

type CachedQuiz = { id: string; title: string; conceptId?: string };

const STATUS_ICON: Record<string, string> = {
    joined: '⏳',
    in_progress: '🔄',
    completed: '✅',
};
const STATUS_LABEL: Record<string, string> = {
    joined: 'Се приклучи',
    in_progress: 'Во тек',
    completed: 'Завршено',
};

export const LiveTab: React.FC = () => {
    const { firebaseUser } = useAuth();
    const [quizzes, setQuizzes] = useState<CachedQuiz[]>([]);
    const [loadingQuizzes, setLoadingQuizzes] = useState(true);
    const [selectedQuizId, setSelectedQuizId] = useState('');
    const [creating, setCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [session, setSession] = useState<LiveSession | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const unsubRef = useRef<(() => void) | null>(null);

    const [copied, setCopied] = useState(false);

    useEffect(() => {
        (async () => {
            const list = await firestoreService.fetchCachedQuizList();
            setQuizzes(list);
            if (list.length > 0) setSelectedQuizId(list[0].id);
            setLoadingQuizzes(false);
        })();
    }, []);

    // Subscribe / unsubscribe when sessionId changes
    // П38: isMounted guard prevents setSession on unmounted component
    useEffect(() => {
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        if (!sessionId) return;
        let isMounted = true;
        unsubRef.current = firestoreService.subscribeLiveSession(sessionId, data => {
            if (isMounted) setSession(data);
        });
        return () => {
            isMounted = false;
            if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        };
    }, [sessionId]);

    const handleCreate = async () => {
        if (!firebaseUser || !selectedQuizId) return;
        const quiz = quizzes.find(q => q.id === selectedQuizId);
        if (!quiz) return;
        setCreating(true);
        const id = await firestoreService.createLiveSession(
            firebaseUser.uid, quiz.id, quiz.title, quiz.conceptId,
        );
        setSessionId(id);
        setShowForm(false);
        setCreating(false);
    };

    const handleEnd = async () => {
        if (!sessionId) return;
        await firestoreService.updateLiveSessionStatus(sessionId, 'ended');
        setSessionId(null);
        setSession(null);
    };

    const handleCopyCode = () => {
        if (!session) return;
        navigator.clipboard.writeText(session.joinCode).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const studentEntries = session
        ? Object.entries(session.studentResponses).sort(([, a], [, b]) => {
            const order = { completed: 0, in_progress: 1, joined: 2 };
            return (order[a.status] ?? 3) - (order[b.status] ?? 3);
          })
        : [];

    const completedCount = studentEntries.filter(([, v]) => v.status === 'completed').length;
    const avgScore = completedCount > 0
        ? Math.round(studentEntries.filter(([, v]) => v.status === 'completed')
            .reduce((s, [, v]) => s + (v.percentage ?? 0), 0) / completedCount)
        : null;

    return (
        <SilentErrorBoundary name="LiveTab">
            <div className="space-y-6">

                {/* Active session dashboard */}
                {session && session.status === 'active' && (
                    <Card className="border-red-200 bg-red-50">
                        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1.5 text-xs font-black text-red-700 bg-red-100 border border-red-200 px-3 py-1 rounded-full animate-pulse">
                                    <Radio className="w-3.5 h-3.5" /> LIVE
                                </span>
                                <div>
                                    <p className="font-bold text-slate-800">{session.quizTitle}</p>
                                    <p className="text-xs text-slate-500">{studentEntries.length} ученици приклучени</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Join code */}
                                <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-2 border border-red-200 shadow-sm">
                                    <div className="text-center">
                                        <p className="text-xs text-slate-400 font-semibold leading-none mb-0.5">Код за влез</p>
                                        <p className="text-3xl font-black text-indigo-700 tracking-widest leading-none">{session.joinCode}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleCopyCode}
                                        title="Копирај код"
                                        className="p-1.5 text-gray-400 hover:text-indigo-600 transition"
                                    >
                                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleEnd}
                                    className="flex items-center gap-1.5 text-xs font-bold bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition"
                                >
                                    <Square className="w-3.5 h-3.5" /> Заврши
                                </button>
                            </div>
                        </div>

                        {/* Summary stats */}
                        {completedCount > 0 && (
                            <div className="flex gap-4 mb-3 text-xs font-semibold text-slate-600 bg-white rounded-lg px-3 py-2 border border-red-100">
                                <span><Trophy className="w-3.5 h-3.5 inline mr-1 text-yellow-500" />Завршиле: <strong>{completedCount}/{studentEntries.length}</strong></span>
                                {avgScore !== null && <span>Просек: <strong>{avgScore}%</strong></span>}
                            </div>
                        )}

                        {/* Student table */}
                        {studentEntries.length === 0 ? (
                            <div className="flex items-center gap-2 py-6 justify-center text-slate-400">
                                <Users className="w-5 h-5" />
                                <p className="text-sm font-semibold">Учениците се приклучуваат на <strong className="text-indigo-600">/live</strong> и го внесуваат кодот <strong className="text-indigo-700">{session.joinCode}</strong></p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-xs text-gray-400 uppercase tracking-widest text-left border-b border-red-100">
                                            <th className="py-2 px-3 font-semibold">Ученик</th>
                                            <th className="py-2 px-3 text-center font-semibold">Статус</th>
                                            <th className="py-2 px-3 text-center font-semibold">Резултат</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {studentEntries.map(([name, resp]) => (
                                            <tr key={name} className="border-b border-red-50 hover:bg-white/60 transition-colors">
                                                <td className="py-2.5 px-3 font-semibold text-slate-700">{name}</td>
                                                <td className="py-2.5 px-3 text-center">
                                                    <span className="text-sm">{STATUS_ICON[resp.status] ?? '?'}</span>
                                                    <span className="ml-1.5 text-xs text-slate-500">{STATUS_LABEL[resp.status] ?? resp.status}</span>
                                                </td>
                                                <td className="py-2.5 px-3 text-center">
                                                    {resp.status === 'completed' && resp.percentage !== undefined
                                                        ? <span className={`font-bold ${resp.percentage >= 70 ? 'text-green-600' : 'text-amber-500'}`}>{resp.percentage}%</span>
                                                        : <span className="text-gray-300">—</span>
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                )}

                {/* Ended session summary */}
                {session && session.status === 'ended' && (
                    <Card className="border-gray-200 bg-gray-50">
                        <p className="text-sm font-bold text-gray-500 mb-2">Сесијата е завршена</p>
                        <p className="text-xs text-gray-400">Квиз: {session.quizTitle} · Учествувале: {studentEntries.length}</p>
                        {avgScore !== null && <p className="text-xs text-gray-400">Просечен резултат: {avgScore}%</p>}
                        <button type="button" onClick={() => setSession(null)}
                            className="mt-3 text-xs font-bold text-indigo-600 hover:underline">Нова сесија →</button>
                    </Card>
                )}

                {/* No active session — form or start button */}
                {!session && (
                    <Card>
                        <div className="flex items-center gap-2 mb-4">
                            <Radio className="w-5 h-5 text-red-500" />
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest">Live Сесија</h2>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Создај live сесија — учениците ќе добијат <strong>4-цифрен код</strong> за влез и
                            ќе решаваат квизот во реално време. Гледај ги нивните резултати веднаш.
                        </p>

                        {!showForm ? (
                            <button
                                type="button"
                                onClick={() => setShowForm(true)}
                                className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-700 transition"
                            >
                                <Play className="w-4 h-4" /> Нова Live Сесија
                            </button>
                        ) : (
                            <div className="space-y-3 bg-red-50 border border-red-200 rounded-xl p-4">
                                <p className="text-xs font-bold text-red-700 uppercase tracking-widest">Избери квиз</p>
                                {loadingQuizzes ? (
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span className="text-sm">Вчитување квизови...</span>
                                    </div>
                                ) : quizzes.length === 0 ? (
                                    <p className="text-sm text-gray-400">Нема генерирани квизови. Прво генерирај квиз во Генератор.</p>
                                ) : (
                                    <select
                                        value={selectedQuizId}
                                        onChange={e => setSelectedQuizId(e.target.value)}
                                        aria-label="Избери квиз за live сесија"
                                        className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm bg-white"
                                    >
                                        {quizzes.map(q => (
                                            <option key={q.id} value={q.id}>{q.title}</option>
                                        ))}
                                    </select>
                                )}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCreate}
                                        disabled={creating || !selectedQuizId || loadingQuizzes}
                                        className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-40 transition"
                                    >
                                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                        {creating ? 'Создавање...' : 'Старт'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowForm(false)}
                                        className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition"
                                    >
                                        Откажи
                                    </button>
                                </div>
                            </div>
                        )}
                    </Card>
                )}
            </div>
        </SilentErrorBoundary>
    );
};
