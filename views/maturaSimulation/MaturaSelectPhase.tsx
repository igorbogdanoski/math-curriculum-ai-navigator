import React from 'react';
import { GraduationCap, Play, BookOpen } from 'lucide-react';
import { Card } from '../../components/common/Card';
import type { MaturaExamMeta } from '../../services/firestoreService.matura';
import {
    SESSION_LABELS, LANG_FLAGS, TRACK_ACCENT,
    DURATION_SECONDS, gradeFromPercent, examLabel,
} from './maturaSimUtils';
import type { SimResult } from './maturaSimUtils';

interface TrackGroup {
    track: string;
    label: string;
    accent: { pill: string; header: string };
    years: {
        year: number;
        sessions: {
            session: string;
            variants: MaturaExamMeta[];
        }[];
    }[];
}

interface MaturaSelectPhaseProps {
    examsByTrack: TrackGroup[];
    examsLoading: boolean;
    examsLength: number;
    getPastResult: (examId: string) => SimResult | null;
    startExam: (exam: MaturaExamMeta) => void;
}

export function MaturaSelectPhase({ examsByTrack, examsLoading, examsLength, getPastResult, startExam }: MaturaSelectPhaseProps) {
    return (
        <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
            <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-primary to-blue-700 flex items-center justify-center shadow-lg flex-shrink-0">
                    <GraduationCap className="w-7 h-7 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Симулација на матура</h1>
                    <p className="text-sm text-gray-500">ДИМ — Државна испитна матура · Математика · 180 минути</p>
                </div>
            </div>

            {examsLoading ? (
                <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />)}
                </div>
            ) : examsLength === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <GraduationCap className="w-14 h-14 text-gray-200 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-400">Нема достапни тестови</h3>
                    <p className="text-sm text-gray-400 mt-2">Увезете ДИМ тестови за да започнете.</p>
                </div>
            ) : (
                <div className="space-y-8">
                    {examsByTrack.map(({ track, label, accent, years }) => (
                        <div key={track}>
                            <div className="flex items-center gap-3 mb-3">
                                <span className={`text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${accent.pill}`}>
                                    {label}
                                </span>
                                <div className="flex-1 h-px bg-slate-200" />
                                <span className="text-xs text-slate-400">
                                    {years.reduce((t, y) => t + y.sessions.reduce((s, ses) => s + ses.variants.length, 0), 0)} верзии
                                </span>
                            </div>

                            <div className="space-y-4">
                                {years.map(({ year, sessions }) => (
                                    <div key={year} className="space-y-1.5">
                                        <div className="flex items-center gap-2 pl-1">
                                            <span className={`text-xs font-black tracking-widest ${accent.header}`}>{year}</span>
                                            <div className="flex-1 h-px bg-slate-100" />
                                            <span className="text-xs text-slate-400">
                                                {sessions.reduce((n, s) => n + s.variants.length, 0)} верзии
                                            </span>
                                        </div>

                                        {sessions.map(({ session, variants }) => {
                                            const meta = variants[0];
                                            return (
                                                <div key={session} className="bg-white rounded-2xl border border-slate-200 px-4 py-3 flex items-center gap-4 hover:border-slate-300 transition-all">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-bold text-slate-800 text-sm">{SESSION_LABELS[session] ?? session} сесија</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">{meta.questionCount} пр. · {meta.totalPoints} поени · 180 мин</p>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {variants.map((exam: MaturaExamMeta) => {
                                                            const past  = getPastResult(exam.id);
                                                            const pct   = past ? Math.round((past.totalScore / past.maxScore) * 100) : null;
                                                            const grade = pct !== null ? gradeFromPercent(pct) : null;
                                                            return (
                                                                <button
                                                                    key={exam.id}
                                                                    type="button"
                                                                    onClick={() => startExam(exam)}
                                                                    title={`Започни ${LANG_FLAGS[exam.language] ?? exam.language.toUpperCase()} верзија`}
                                                                    className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border transition group ${
                                                                        grade
                                                                            ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-400'
                                                                            : 'border-slate-200 bg-white hover:border-brand-primary hover:bg-brand-primary/5'
                                                                    }`}
                                                                >
                                                                    <span className={`text-xs font-black ${grade ? 'text-emerald-700' : 'text-slate-700 group-hover:text-brand-primary'}`}>
                                                                        {LANG_FLAGS[exam.language] ?? exam.language.toUpperCase()}
                                                                    </span>
                                                                    {pct !== null ? (
                                                                        <span className="text-[10px] font-bold text-emerald-600">{pct}%</span>
                                                                    ) : (
                                                                        <Play className="w-2.5 h-2.5 text-slate-400 group-hover:text-brand-primary" />
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Card className="bg-blue-50 border-blue-100">
                <div className="flex items-start gap-3">
                    <BookOpen className="w-5 h-5 text-brand-primary mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-bold text-brand-primary text-sm">Совети за симулација</p>
                        <ul className="mt-2 space-y-1 text-sm text-blue-800">
                            <li>• Реши го тестот во тишина, без прекини — баш како вистински испит</li>
                            <li>• Дел I: MC прашања (1 поен) · Дел II: кратки одговори (2 поени) · Дел III: задачи (3–5 поени)</li>
                            <li>• По предавање, AI автоматски ги оценува отворените прашања</li>
                            <li>• Напредокот се зачувува — ако го затвориш прелистувачот, можеш да продолжиш</li>
                        </ul>
                    </div>
                </div>
            </Card>
        </div>
    );
}
