import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Play, Users, ArrowLeft, Hash, Monitor, Radio, Trophy, Square, Check, Copy } from 'lucide-react';
import QRCode from 'react-qr-code';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { type LiveSession } from '../services/firestoreService.types';

export const HostLiveQuizView: React.FC = () => {
    const { firebaseUser } = useAuth();
    const [quizzes, setQuizzes] = useState<{ id: string; title: string; conceptId?: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [session, setSession] = useState<LiveSession | null>(null);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState(false);
    const unsubRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        firestoreService.fetchCachedQuizList().then(list => {
            setQuizzes(list);
            setLoading(false);
        });
    }, []);

    // Subscribe to session when sessionId changes
    useEffect(() => {
        if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        if (!sessionId) return;
        let alive = true;
        unsubRef.current = firestoreService.subscribeLiveSession(sessionId, s => {
            if (alive) setSession(s);
        });
        return () => {
            alive = false;
            if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
        };
    }, [sessionId]);

    const handleCreateSession = async (quiz: { id: string; title: string; conceptId?: string }) => {
        if (!firebaseUser) return;
        setCreating(true);
        try {
            // createLiveSession returns the Firestore doc ID (session ID)
            const id = await firestoreService.createLiveSession(firebaseUser.uid, quiz.id, quiz.title, quiz.conceptId);
            setSessionId(id);
        } catch (error) {
            console.error('Error creating live session:', error);
        } finally {
            setCreating(false);
        }
    };

    const handleEndSession = async () => {
        if (!sessionId) return;
        await firestoreService.updateLiveSessionStatus(sessionId, 'ended');
        setSessionId(null);
        setSession(null);
    };

    const handleCopyLink = () => {
        if (!session) return;
        const url = `${window.location.origin}/#/live?code=${session.joinCode}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleOpenDisplay = () => {
        if (!sessionId) return;
        window.open(`${window.location.origin}/#/live/display?sid=${sessionId}`, '_blank');
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    // ── ACTIVE SESSION DASHBOARD ──────────────────────────────────────────────
    if (session && session.status === 'active') {
        const joinLink = `${window.location.origin}/#/live?code=${session.joinCode}`;
        const participants = Object.entries(session.studentResponses || {})
            .sort(([, a], [, b]) => {
                const order = { completed: 0, in_progress: 1, joined: 2 };
                return (order[a.status] ?? 3) - (order[b.status] ?? 3);
            });
        const completedCount = participants.filter(([, v]) => v.status === 'completed').length;
        const avgScore = completedCount > 0
            ? Math.round(participants.filter(([, v]) => v.status === 'completed')
                .reduce((s, [, v]) => s + (v.percentage ?? 0), 0) / completedCount)
            : null;

        return (
            <div className="p-6 max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="flex items-center gap-1.5 text-xs font-black text-red-700 bg-red-100 border border-red-200 px-3 py-1 rounded-full animate-pulse">
                                <Radio className="w-3.5 h-3.5" /> LIVE
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">{session.quizTitle}</h1>
                        <p className="text-slate-500 text-sm mt-0.5">{participants.length} ученик{participants.length !== 1 ? 'и' : ''} приклучен{participants.length !== 1 ? 'и' : ''}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={handleOpenDisplay}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center gap-2 transition-colors font-medium text-sm"
                            title="Отвори fullscreen приказ за проектор/паметна табла"
                        >
                            <Monitor className="w-4 h-4" />
                            Проектор приказ
                        </button>
                        <button
                            type="button"
                            onClick={handleEndSession}
                            className="px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 flex items-center gap-2 transition-colors font-medium text-sm border border-red-200"
                        >
                            <Square className="w-4 h-4" />
                            Заврши сесија
                        </button>
                    </div>
                </div>

                {/* Join code + QR card */}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-6">
                        {/* Code */}
                        <div className="text-center flex-1">
                            <p className="text-indigo-200 font-semibold text-xs uppercase tracking-widest mb-2">Код за придружување</p>
                            <div className="text-6xl md:text-7xl font-black tracking-widest bg-white/10 px-6 py-4 rounded-2xl border border-white/20 inline-block">
                                {session.joinCode}
                            </div>
                            <p className="text-indigo-200 text-sm mt-2">Внеси го на <strong className="text-white">/live</strong></p>
                            <div className="flex justify-center gap-3 mt-4">
                                <button
                                    onClick={handleCopyLink}
                                    className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-sm transition-all flex items-center gap-2 text-sm"
                                >
                                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'Копирано!' : 'Копирај линк'}
                                </button>
                                <a
                                    href={joinLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-4 py-2 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shadow-lg flex items-center gap-2 text-sm font-medium"
                                >
                                    Отвори како ученик
                                </a>
                            </div>
                        </div>
                        {/* QR code */}
                        <div className="bg-white p-3 rounded-2xl hidden sm:block shadow-xl">
                            <QRCode value={`${window.location.origin}/#/live?code=${session.joinCode}`} size={120} />
                        </div>
                    </div>
                </div>

                {/* Live stats bar */}
                {completedCount > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 px-6 py-4 flex flex-wrap gap-6 shadow-sm">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <Trophy className="w-4 h-4 text-yellow-500" />
                            Завршиле: <strong className="text-slate-800">{completedCount}/{participants.length}</strong>
                        </div>
                        {avgScore !== null && (
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                                Просечен резултат: <strong className={avgScore >= 70 ? 'text-green-600' : 'text-amber-500'}>{avgScore}%</strong>
                            </div>
                        )}
                        {/* Progress bar */}
                        <div className="flex-1 min-w-[120px] flex items-center gap-3">
                            <div className="flex-1 bg-slate-100 rounded-full h-2">
                                <div
                                    className={`bg-green-500 h-2 rounded-full transition-all duration-700 ${
                                        participants.length > 0
                                            ? ['w-0','w-1/12','w-2/12','w-3/12','w-4/12','w-5/12','w-6/12','w-7/12','w-8/12','w-9/12','w-10/12','w-11/12','w-full'][Math.round(completedCount / participants.length * 12)] ?? 'w-full'
                                            : 'w-0'
                                    }`}
                                />
                            </div>
                            <span className="text-xs text-slate-400 whitespace-nowrap">
                                {participants.length > 0 ? Math.round(completedCount / participants.length * 100) : 0}%
                            </span>
                        </div>
                    </div>
                )}

                {/* Students table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-600" />
                            Ученици
                        </h2>
                        <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-bold">
                            {participants.length}
                        </span>
                    </div>

                    {participants.length === 0 ? (
                        <div className="text-center py-16 text-slate-400 bg-slate-50">
                            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="font-semibold">Чекаме ученици да се придружат...</p>
                            <p className="text-sm mt-1">Споделете го кодот <strong className="text-indigo-600">{session.joinCode}</strong></p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-xs text-slate-400 uppercase tracking-widest text-left border-b border-slate-100 bg-slate-50">
                                        <th className="py-3 px-6 font-semibold">Ученик</th>
                                        <th className="py-3 px-4 text-center font-semibold">Статус</th>
                                        <th className="py-3 px-6 text-center font-semibold">Резултат</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {participants.map(([name, data]) => (
                                        <tr key={name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                                            <td className="py-3 px-6 font-semibold text-slate-800 flex items-center gap-3">
                                                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                                                    {name.charAt(0).toUpperCase()}
                                                </div>
                                                {name}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {data.status === 'completed' && <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full">✅ Завршено</span>}
                                                {data.status === 'in_progress' && <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-full animate-pulse">🔄 Решава</span>}
                                                {data.status === 'joined' && <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">⏳ Чека</span>}
                                            </td>
                                            <td className="py-3 px-6 text-center">
                                                {data.status === 'completed' && data.percentage !== undefined
                                                    ? <span className={`font-black text-base ${data.percentage >= 70 ? 'text-green-600' : 'text-amber-500'}`}>{data.percentage}%</span>
                                                    : <span className="text-slate-300">—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ── ENDED SESSION SUMMARY ────────────────────────────────────────────────
    if (session && session.status === 'ended') {
        const participants = Object.entries(session.studentResponses || {});
        const completedCount = participants.filter(([, v]) => v.status === 'completed').length;
        const avgScore = completedCount > 0
            ? Math.round(participants.filter(([, v]) => v.status === 'completed')
                .reduce((s, [, v]) => s + (v.percentage ?? 0), 0) / completedCount)
            : null;
        return (
            <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
                <div className="text-5xl mb-2">🎉</div>
                <h2 className="text-2xl font-black text-slate-800">Сесијата е завршена!</h2>
                <p className="text-slate-500">{session.quizTitle} · {participants.length} ученик{participants.length !== 1 ? 'и' : ''} учествуваа</p>
                {avgScore !== null && <p className="text-lg font-bold text-indigo-600">Просечен резултат: {avgScore}%</p>}
                <button
                    type="button"
                    onClick={() => { setSession(null); setSessionId(null); }}
                    className="mt-4 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"
                >
                    Нова сесија →
                </button>
            </div>
        );
    }

    // ── QUIZ SELECTION ────────────────────────────────────────────────────────
    return (
        <div className="p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-8">
                <a href="#/" aria-label="Назад" className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-slate-500" />
                </a>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
                        <Radio className="w-8 h-8 text-red-500" />
                        Квизови во живо
                    </h1>
                    <p className="text-slate-500 text-sm">Избери квиз и започни сесија во реално време</p>
                </div>
            </div>

            {quizzes.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                    <Hash className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-800">Нема зачувани квизови</h3>
                    <p className="text-slate-500 mt-2 max-w-md mx-auto">Генерирајте квизови преку AI Генераторот — ќе се појават овде.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {quizzes.map((quiz) => (
                        <div key={quiz.id} className="bg-white border border-slate-200 p-6 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all group">
                            <h3 className="font-bold text-lg text-slate-800 mb-1 group-hover:text-indigo-700 transition-colors">{quiz.title}</h3>
                            <p className="text-xs text-slate-400 mb-4">ID: {quiz.id.slice(0, 8)}...</p>
                            <button
                                type="button"
                                onClick={() => handleCreateSession(quiz)}
                                disabled={creating}
                                className="w-full px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 font-bold disabled:opacity-50"
                            >
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                Започни Live Квиз
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
