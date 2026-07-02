import React from 'react';
import {
    ChevronLeft, ChevronRight, CheckCircle2, Clock,
    AlertTriangle, Loader2, Grid3x3, List, PenLine, FileText,
} from 'lucide-react';
import { MathRenderer } from '../../components/common/MathRenderer';
import { DokBadge } from '../../components/common/DokBadge';
import type { MaturaQuestion, MaturaExamMeta } from '../../services/firestoreService.matura';
import { CHOICES, CHOICE_COLORS, CHOICE_LIGHT, DURATION_SECONDS, formatTime, examLabel, hasAnswer } from './maturaSimUtils';
import type { SimAnswers } from './maturaSimUtils';

interface MaturaExamPhaseProps {
    qLoading: boolean;
    questions: MaturaQuestion[];
    selectedExam: MaturaExamMeta;
    currentIdx: number;
    setCurrentIdx: React.Dispatch<React.SetStateAction<number>>;
    answers: SimAnswers;
    setAnswers: React.Dispatch<React.SetStateAction<SimAnswers>>;
    timeLeft: number;
    timerPaused: boolean;
    viewMode: 'single' | 'grid';
    setViewMode: React.Dispatch<React.SetStateAction<'single' | 'grid'>>;
    handleSubmit: () => void;
    onCancel: () => void;
}

export function MaturaExamPhase({
    qLoading, questions, selectedExam, currentIdx, setCurrentIdx,
    answers, setAnswers, timeLeft, timerPaused, viewMode, setViewMode,
    handleSubmit, onCancel,
}: MaturaExamPhaseProps) {
    if (qLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
                <p className="text-gray-500 font-semibold">Вчитување прашања…</p>
            </div>
        );
    }

    const q        = questions[currentIdx];
    const answered = questions.filter(qq => hasAnswer(qq, answers)).length;
    const total    = questions.length;
    const timerPct = (timeLeft / DURATION_SECONDS) * 100;
    const timerColor = timerPct > 30 ? 'bg-emerald-500' : timerPct > 10 ? 'bg-amber-500' : 'bg-red-500';

    return (
        <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
            {/* Top bar */}
            <div className="flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 sticky top-2 z-10">
                <div className="flex items-center gap-2">
                    <button type="button"
                        title="Откажи и врати се на избор на тест"
                        aria-label="Откажи и врати се на избор на тест"
                        onClick={() => { if (window.confirm('Ќе ги изгубиш неодговорените. Откажи?')) onCancel(); }}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                    >
                        <ChevronLeft className="w-5 h-5 text-gray-500" />
                    </button>
                    <span className="font-bold text-gray-700 text-sm hidden sm:block truncate max-w-[180px]">
                        {examLabel(selectedExam)}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 font-semibold">{answered}/{total}</span>
                    <div className="flex items-center gap-1.5">
                        <Clock className={`w-4 h-4 ${timeLeft < 600 ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} />
                        <span className={`font-mono font-bold text-sm ${timeLeft < 600 ? 'text-red-600' : 'text-gray-700'}`}>
                            {formatTime(timeLeft)}
                        </span>
                        {timerPaused && (
                            <span
                                className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5"
                                data-testid="matura-sim-paused"
                                title="Тајмерот е паузиран додека табот е скриен"
                            >
                                ⏸ паузиран
                            </span>
                        )}
                    </div>
                    <button type="button" title={viewMode === 'single' ? 'Преглед' : 'Едно по едно'}
                        onClick={() => setViewMode(v => v === 'single' ? 'grid' : 'single')}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition"
                    >
                        {viewMode === 'single' ? <Grid3x3 className="w-4 h-4 text-gray-500" /> : <List className="w-4 h-4 text-gray-500" />}
                    </button>
                </div>
            </div>

            {/* Timer bar */}
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <progress
                    className={`w-full h-full ${timerColor.includes('red') ? 'accent-red-500' : 'accent-emerald-500'}`}
                    max={100}
                    value={timerPct}
                />
            </div>

            {timeLeft < 600 && timeLeft > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm font-semibold text-red-700">Останати помалку од 10 минути!</p>
                </div>
            )}

            {viewMode === 'grid' ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Преглед на прашања</p>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                        {questions.map((qq, i) => {
                            const done = hasAnswer(qq, answers);
                            return (
                                <button key={qq.questionNumber} type="button"
                                    onClick={() => { setCurrentIdx(i); setViewMode('single'); }}
                                    className={`aspect-square rounded-xl text-xs font-bold transition-all ${
                                        i === currentIdx
                                            ? 'bg-brand-primary text-white ring-2 ring-brand-primary ring-offset-1'
                                            : done
                                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {qq.questionNumber}
                                </button>
                            );
                        })}
                    </div>
                    <div className="flex gap-3 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-100 rounded" />Одговорено</span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-100 rounded" />Не одговорено</span>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold bg-brand-primary/10 text-brand-primary px-2.5 py-1 rounded-full">
                                Прашање {currentIdx + 1} / {total}
                            </span>
                            {q.topicArea && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{q.topicArea}</span>
                            )}
                            <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                                Дел {q.part === 1 ? 'I' : q.part === 2 ? 'II' : 'III'}
                            </span>
                            {q.dokLevel && <DokBadge level={q.dokLevel as 1|2|3|4} size="compact" />}
                        </div>
                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded-full flex-shrink-0">
                            {q.points} {q.points === 1 ? 'поен' : 'поени'}
                        </span>
                    </div>

                    <div className="text-base font-semibold text-gray-800 leading-relaxed">
                        <MathRenderer text={q.questionText} />
                    </div>

                    {q.imageUrls?.map((url, i) => (
                        <img key={i} src={url} alt={q.imageDescription ?? `Слика ${i + 1}`}
                            className="max-w-full rounded-xl border border-gray-200 shadow-sm" />
                    ))}

                    {q.part === 1 && q.choices && Object.keys(q.choices).length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {CHOICES.map(choice => {
                                const text = q.choices?.[choice];
                                if (!text) return null;
                                const selected = answers.mc[q.questionNumber] === choice;
                                return (
                                    <button key={choice} type="button"
                                        onClick={() => setAnswers(prev => ({ ...prev, mc: { ...prev.mc, [q.questionNumber]: choice } }))}
                                        className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                                            selected
                                                ? `border-transparent bg-gradient-to-r ${CHOICE_COLORS[choice]} text-white shadow-md scale-[1.02]`
                                                : `${CHOICE_LIGHT[choice]} hover:scale-[1.01]`
                                        }`}
                                    >
                                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0 ${selected ? 'bg-white/20' : 'bg-white/80'}`}>{choice}</span>
                                        <span className="text-sm font-medium"><MathRenderer text={text} /></span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {q.part === 2 && (
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <PenLine className="w-3.5 h-3.5" /> Твои одговори
                            </p>
                            {(['А', 'Б'] as const).map(ltr => {
                                const key = ltr === 'А' ? 'p2a' : 'p2b';
                                return (
                                    <div key={ltr}>
                                        <label className="text-sm font-semibold text-gray-600 mb-1.5 block">Дел {ltr}:</label>
                                        <input
                                            type="text"
                                            value={answers[key][q.questionNumber] ?? ''}
                                            onChange={e => setAnswers(prev => ({ ...prev, [key]: { ...prev[key], [q.questionNumber]: e.target.value } }))}
                                            placeholder={`Одговор за дел ${ltr}…`}
                                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none"
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {q.part === 3 && (
                        <div className="space-y-2">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5" /> Опис на твоето решение
                            </p>
                            <textarea
                                rows={4}
                                value={answers.p3[q.questionNumber] ?? ''}
                                onChange={e => setAnswers(prev => ({ ...prev, p3: { ...prev.p3, [q.questionNumber]: e.target.value } }))}
                                placeholder="Опишај ги чекорите на твоето решение. AI ќе го оцени математичкото размислување, не буквалниот текст."
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-brand-primary focus:border-transparent outline-none"
                            />
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center justify-between gap-3">
                <button type="button" disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx(i => i - 1)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition"
                >
                    <ChevronLeft className="w-4 h-4" /> Претходно
                </button>

                {currentIdx < total - 1 ? (
                    <button type="button"
                        onClick={() => setCurrentIdx(i => i + 1)}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
                    >
                        Следно <ChevronRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button type="button"
                        onClick={() => {
                            const unanswered = total - answered;
                            const msg = unanswered > 0
                                ? `Има ${unanswered} неодговорени прашања. Предај?`
                                : 'Сигурен/на си дека сакаш да предадеш?';
                            if (window.confirm(msg)) handleSubmit();
                        }}
                        className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold hover:opacity-90 transition shadow-md"
                    >
                        <CheckCircle2 className="w-4 h-4" /> Предај тест
                    </button>
                )}
            </div>
        </div>
    );
}
