/**
 * LiveDisplayView — Fullscreen classroom projector / smartboard display.
 * Open this in a separate browser window on the teacher's projector.
 *
 * URL: /#/live/display?sid=<sessionId>
 *
 * Phases:
 *  1. LOBBY  — giant join code + QR + animated student avatars as they join
 *  2. ACTIVE — live student grid (joined / solving / done) + completion bar
 *  3. ENDED  — podium (top 3) + full leaderboard
 */
import React, { useEffect, useState } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { Wifi, Users, Crown, Trophy, CheckCircle } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import { type LiveSession } from '../services/firestoreService.types';

/* ── helpers ─────────────────────────────────────────────────────────────── */
const initials = (name: string) => name.trim().charAt(0).toUpperCase();

const AVATAR_COLORS = [
    'bg-indigo-400 text-indigo-900',
    'bg-purple-400 text-purple-900',
    'bg-pink-400   text-pink-900',
    'bg-sky-400    text-sky-900',
    'bg-teal-400   text-teal-900',
    'bg-amber-400  text-amber-900',
    'bg-rose-400   text-rose-900',
    'bg-green-400  text-green-900',
];
const avatarColor = (name: string) => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

/* ── component ───────────────────────────────────────────────────────────── */
export const LiveDisplayView: React.FC = () => {
    const [session, setSession] = useState<LiveSession | null>(null);
    const [loading, setLoading] = useState(true);

    const sessionId = (() => {
        const parts = window.location.hash.split('?');
        if (parts.length > 1) return new URLSearchParams(parts[1]).get('sid');
        return null;
    })();

    useEffect(() => {
        if (!sessionId) { setLoading(false); return; }
        const unsub = firestoreService.subscribeLiveSession(sessionId, s => {
            setSession(s);
            setLoading(false);
        });
        return () => unsub();
    }, [sessionId]);

    if (loading) {
        return (
            <div className="min-h-screen bg-indigo-900 flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
                <p className="text-2xl font-black">Сесијата не е пронајдена.</p>
                <p className="text-slate-400 text-sm">Провери го URL-то — потребен е параметарот <code>?sid=...</code></p>
            </div>
        );
    }

    const joinUrl = `${window.location.origin}/#/live?code=${session.joinCode}`;
    const entries = Object.entries(session.studentResponses || {});
    const completed = entries.filter(([, v]) => v.status === 'completed');
    const leaderboard = [...completed]
        .sort(([, a], [, b]) => (b.percentage ?? 0) - (a.percentage ?? 0));
    const completionPct = entries.length > 0
        ? Math.round(completed.length / entries.length * 100)
        : 0;
    const avgScore = completed.length > 0
        ? Math.round(completed.reduce((s, [, v]) => s + (v.percentage ?? 0), 0) / completed.length)
        : null;

    /* ── ENDED: Podium + leaderboard ──────────────────────────────────────── */
    if (session.status === 'ended') {
        const top3 = leaderboard.slice(0, 3);
        const rest = leaderboard.slice(3);

        const podiumSlot = (rank: 0 | 1 | 2, heightClass: string, crownVisible: boolean, avatarSizeClass: string, bgClass: string) => {
            const entry = top3[rank];
            if (!entry) return <div className={`w-36 ${heightClass}`} />;
            const [name, data] = entry;
            return (
                <div className="flex flex-col items-center gap-2">
                    {crownVisible && <Crown className="w-10 h-10 text-yellow-400 animate-bounce" />}
                    <div className={`${avatarSizeClass} ${avatarColor(name)} rounded-full flex items-center justify-center font-black text-3xl shadow-2xl`}>
                        {initials(name)}
                    </div>
                    <p className={`font-black text-center max-w-[140px] truncate ${rank === 0 ? 'text-yellow-300 text-xl' : 'text-white text-lg'}`}>{name}</p>
                    <p className={`font-black ${rank === 0 ? 'text-2xl text-yellow-200' : 'text-xl text-white/80'}`}>{data.percentage}%</p>
                    <div className={`${bgClass} w-36 ${heightClass} rounded-t-3xl flex items-end justify-center pb-4 shadow-xl`}>
                        <span className="text-white/60 font-black text-5xl">{rank + 1}</span>
                    </div>
                </div>
            );
        };

        return (
            <div className="min-h-screen bg-gradient-to-b from-indigo-950 via-purple-900 to-slate-900 flex flex-col items-center justify-center p-8 text-white overflow-auto">
                <Trophy className="w-12 h-12 text-yellow-400 mb-2" />
                <h1 className="text-4xl font-black mb-1 text-center">{session.quizTitle}</h1>
                <p className="text-indigo-300 mb-10 text-lg">
                    {entries.length} ученик{entries.length !== 1 ? 'и' : ''} учествуваа
                    {avgScore !== null && <> · Просек: <strong className="text-white">{avgScore}%</strong></>}
                </p>

                {/* Podium */}
                <div className="flex items-end gap-4 mb-10">
                    {/* 2nd */}
                    {podiumSlot(1, 'h-40', false, 'w-20 h-20', 'bg-slate-500')}
                    {/* 1st */}
                    {podiumSlot(0, 'h-56', true, 'w-24 h-24', 'bg-yellow-500')}
                    {/* 3rd */}
                    {podiumSlot(2, 'h-28', false, 'w-20 h-20', 'bg-amber-700')}
                </div>

                {/* Rest of leaderboard */}
                {rest.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-w-3xl w-full">
                        {rest.map(([name, data], i) => (
                            <div key={name} className="bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-3 border border-white/10">
                                <span className="text-white/40 font-black w-6 text-center text-sm">{i + 4}</span>
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${avatarColor(name)}`}>
                                    {initials(name)}
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">{name}</p>
                                    <p className="text-xs text-indigo-300">{data.percentage}%</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    /* ── ACTIVE: Live grid + QR ────────────────────────────────────────────── */
    const sortedEntries = [...entries].sort(([, a], [, b]) => {
        const order: Record<string, number> = { completed: 0, in_progress: 1, joined: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 to-purple-950 flex flex-col p-6 text-white">

            {/* ── Top bar ── */}
            <div className="flex flex-wrap items-start justify-between gap-6 mb-6">
                {/* Title + LIVE badge */}
                <div className="flex-1 min-w-0">
                    <span className="inline-flex items-center gap-1.5 text-xs font-black text-red-400 bg-red-900/40 border border-red-500/30 px-3 py-1 rounded-full animate-pulse mb-2">
                        <Wifi className="w-3.5 h-3.5" /> LIVE
                    </span>
                    <h1 className="text-3xl font-black truncate">{session.quizTitle}</h1>
                    <p className="text-indigo-300 text-sm mt-1 flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        {entries.length} приклучен{entries.length !== 1 ? 'и' : ''}
                        {completed.length > 0 && <> · <CheckCircle className="w-4 h-4 text-green-400" /> {completed.length} завршиле</>}
                    </p>
                </div>

                {/* QR + code */}
                <div className="flex items-center gap-4 bg-white/10 rounded-2xl p-4 border border-white/10 flex-shrink-0">
                    <div className="bg-white p-2 rounded-xl">
                        <QRCode value={joinUrl} size={96} />
                    </div>
                    <div className="text-center">
                        <p className="text-indigo-300 text-xs font-semibold uppercase tracking-widest mb-1">Код за влез</p>
                        <p className="text-5xl font-black tracking-widest">{session.joinCode}</p>
                        <p className="text-indigo-400 text-xs mt-1">на <strong className="text-white">/live</strong></p>
                    </div>
                </div>
            </div>

            {/* ── Completion progress bar ── */}
            {entries.length > 0 && (
                <div className="mb-6">
                    <div className="flex justify-between text-xs text-indigo-300 mb-1.5">
                        <span>Напредок</span>
                        <span>{completed.length} / {entries.length} завршиле ({completionPct}%)</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-4 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-green-400 to-emerald-400 h-4 rounded-full transition-all duration-1000"
                            style={{ width: `${completionPct}%` }}
                        />
                    </div>
                </div>
            )}

            {/* ── Student grid ── */}
            {entries.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-indigo-300">
                    <Users className="w-16 h-16 opacity-30" />
                    <p className="text-xl font-semibold">Чекаме ученици...</p>
                    <p className="text-sm opacity-60">Скенирај го QR или внеси го кодот <strong className="text-white">{session.joinCode}</strong> на /live</p>
                </div>
            ) : (
                <div className="flex-1 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 content-start">
                    {sortedEntries.map(([name, data]) => (
                        <div
                            key={name}
                            className={`rounded-2xl p-3 flex flex-col items-center gap-2 transition-all duration-500 border ${
                                data.status === 'completed'
                                    ? 'bg-green-500/25 border-green-400/40'
                                    : data.status === 'in_progress'
                                    ? 'bg-blue-500/25 border-blue-400/40'
                                    : 'bg-white/5 border-white/10'
                            }`}
                        >
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-xl shadow-lg ${avatarColor(name)}`}>
                                {initials(name)}
                            </div>
                            <p className="font-semibold text-xs text-center truncate w-full" title={name}>{name}</p>
                            {data.status === 'completed' && (
                                <span className="text-xs font-black text-green-300">{data.percentage}% ✓</span>
                            )}
                            {data.status === 'in_progress' && (
                                <span className="text-xs text-blue-300 animate-pulse">Решава…</span>
                            )}
                            {data.status === 'joined' && (
                                <span className="text-xs text-white/30">Чека</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
