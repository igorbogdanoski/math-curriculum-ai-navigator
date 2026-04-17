import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Shuffle, BookOpen, Check, X, Loader2, AlertTriangle, Trophy, BarChart2 } from 'lucide-react';
import { Card } from '../components/common/Card';
import { MathRenderer } from '../components/common/MathRenderer';
import { DokBadge } from '../components/common/DokBadge';
import { firestoreService } from '../services/firestoreService';
import type { CachedMaterial } from '../services/firestoreService';
import type { AssessmentQuestion } from '../types';

interface Flashcard {
    id: string;
    front: string;
    back: string;
    dokLevel?: 1 | 2 | 3 | 4;
    cognitiveLevel?: string;
    difficulty?: string;
}

type CardResult = 'easy' | 'hard' | 'skipped';

interface SessionStats {
    easy: number;
    hard: number;
    skipped: number;
    total: number;
}

type UnknownRecord = Record<string, unknown>;
type RawTerm = { term?: string; word?: string; front?: string; definition?: string; meaning?: string; back?: string };
type RawCard = { front?: string; question?: string; term?: string; back?: string; answer?: string; definition?: string; dokLevel?: 1 | 2 | 3 | 4 };

function isRecord(v: unknown): v is UnknownRecord {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function extractFlashcards(material: CachedMaterial): Flashcard[] {
    const content = material.content;
    if (!content) return [];

    const questions: AssessmentQuestion[] = [];

    if (isRecord(content) && Array.isArray(content.questions)) {
        questions.push(...(content.questions as AssessmentQuestion[]));
    } else if (Array.isArray(content)) {
        questions.push(...(content as AssessmentQuestion[]));
    } else if (isRecord(content) && isRecord(content.content) && Array.isArray((content.content as UnknownRecord).questions)) {
        questions.push(...((content.content as UnknownRecord).questions as AssessmentQuestion[]));
    }

    if (questions.length > 0) {
        return questions.map((q, i) => ({
            id: `q-${i}`,
            front: q.question ?? '',
            back: q.answer ?? q.solution ?? '',
            dokLevel: q.dokLevel,
            cognitiveLevel: q.cognitiveLevel,
            difficulty: q.difficulty_level,
        })).filter(c => c.front && c.back);
    }

    if (isRecord(content) && Array.isArray(content.terms)) {
        return (content.terms as RawTerm[]).map((t, i) => ({
            id: `t-${i}`,
            front: t.term ?? t.word ?? t.front ?? '',
            back: t.definition ?? t.meaning ?? t.back ?? '',
        })).filter((c: Flashcard) => c.front && c.back);
    }

    if (isRecord(content) && Array.isArray(content.cards)) {
        return (content.cards as RawCard[]).map((c, i) => ({
            id: `c-${i}`,
            front: c.front ?? c.question ?? c.term ?? '',
            back: c.back ?? c.answer ?? c.definition ?? '',
            dokLevel: c.dokLevel,
        })).filter((c: Flashcard) => c.front && c.back);
    }

    return [];
}

function shuffleArray<T>(arr: T[]): T[] {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

const DIFF_COLOR: Record<string, string> = {
    Easy: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    Medium: 'text-amber-600 bg-amber-50 border-amber-200',
    Hard: 'text-red-600 bg-red-50 border-red-200',
};

interface Props {
    id?: string;
}

export const FlashcardPlayerView: React.FC<Props> = ({ id: materialId }) => {

    const [material, setMaterial] = useState<CachedMaterial | null>(null);
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<Record<string, CardResult>>({});
    const [sessionDone, setSessionDone] = useState(false);
    const [isShuffled, setIsShuffled] = useState(false);
    const flipCardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!materialId) {
            setError('Нема избран материјал. Отворете флешкартички од библиотеката.');
            setLoading(false);
            return;
        }
        (async () => {
            try {
                const mat = await firestoreService.getCachedMaterialById(materialId);
                if (!mat) { setError('Материјалот не е пронајден.'); return; }
                setMaterial(mat);
                const extracted = extractFlashcards(mat);
                if (extracted.length === 0) {
                    setError('Овој материјал не содржи картички за флешкарти (потребни се прашање + одговор).');
                    return;
                }
                setCards(extracted);
            } catch {
                setError('Грешка при вчитување на материјалот.');
            } finally {
                setLoading(false);
            }
        })();
    }, [materialId]);

    const currentCard = cards[currentIndex];

    const handleFlip = useCallback(() => setIsFlipped(f => !f), []);

    const goTo = useCallback((idx: number) => {
        setIsFlipped(false);
        setTimeout(() => setCurrentIndex(idx), 120);
    }, []);

    const next = useCallback(() => {
        if (currentIndex < cards.length - 1) goTo(currentIndex + 1);
        else setSessionDone(true);
    }, [currentIndex, cards.length, goTo]);

    const prev = useCallback(() => {
        if (currentIndex > 0) goTo(currentIndex - 1);
    }, [currentIndex, goTo]);

    const rate = useCallback((result: CardResult) => {
        setResults(r => ({ ...r, [currentCard.id]: result }));
        next();
    }, [currentCard, next]);

    const handleShuffle = () => {
        setCards(s => shuffleArray(s));
        setCurrentIndex(0);
        setIsFlipped(false);
        setResults({});
        setSessionDone(false);
        setIsShuffled(true);
    };

    const handleRestart = () => {
        setCurrentIndex(0);
        setIsFlipped(false);
        setResults({});
        setSessionDone(false);
    };

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleFlip(); }
            if (e.key === 'ArrowRight') next();
            if (e.key === 'ArrowLeft') prev();
            if (e.key === '1') rate('easy');
            if (e.key === '2') rate('hard');
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [handleFlip, next, prev, rate]);

    if (loading) return (
        <div className="flex items-center justify-center min-h-96">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
    );

    if (error) return (
        <div className="max-w-lg mx-auto mt-16">
            <Card className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
                <p className="text-gray-700 font-medium">{error}</p>
            </Card>
        </div>
    );

    const rated = Object.keys(results).length;
    const stats: SessionStats = {
        easy: Object.values(results).filter(r => r === 'easy').length,
        hard: Object.values(results).filter(r => r === 'hard').length,
        skipped: Object.values(results).filter(r => r === 'skipped').length,
        total: cards.length,
    };

    if (sessionDone) return (
        <div className="max-w-lg mx-auto mt-10 px-4">
            <Card className="p-8 text-center">
                <Trophy className="w-14 h-14 text-amber-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Сесијата е завршена!</h2>
                <p className="text-gray-500 mb-6 text-sm">{material?.title}</p>

                <div className="grid grid-cols-3 gap-3 mb-6">
                    <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200">
                        <p className="text-2xl font-bold text-emerald-600">{stats.easy}</p>
                        <p className="text-xs text-emerald-700 mt-0.5">Лесно ✓</p>
                    </div>
                    <div className="rounded-xl p-3 bg-red-50 border border-red-200">
                        <p className="text-2xl font-bold text-red-600">{stats.hard}</p>
                        <p className="text-xs text-red-700 mt-0.5">Тешко ✗</p>
                    </div>
                    <div className="rounded-xl p-3 bg-gray-50 border border-gray-200">
                        <p className="text-2xl font-bold text-gray-500">{stats.skipped}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Прескочено</p>
                    </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                    <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${stats.total > 0 ? (stats.easy / stats.total) * 100 : 0}%` }}
                    />
                </div>

                <div className="flex gap-3 justify-center">
                    <button
                        type="button"
                        onClick={handleRestart}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Почни одново
                    </button>
                    {stats.hard > 0 && (
                        <button
                            type="button"
                            onClick={() => {
                                const hardCards = cards.filter(c => results[c.id] === 'hard');
                                setCards(hardCards);
                                setCurrentIndex(0);
                                setIsFlipped(false);
                                setResults({});
                                setSessionDone(false);
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl border border-red-300 text-red-700 hover:bg-red-50 transition"
                        >
                            <BarChart2 className="w-4 h-4" />
                            Вежбај тешките ({stats.hard})
                        </button>
                    )}
                </div>
            </Card>
        </div>
    );

    if (!currentCard) return null;

    const progress = ((currentIndex + 1) / cards.length) * 100;

    return (
        <div className="max-w-2xl mx-auto px-4 py-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 min-w-0">
                    <BookOpen className="w-5 h-5 text-indigo-500 shrink-0" />
                    <h1 className="text-base font-bold text-gray-800 truncate">{material?.title ?? 'Флешкартички'}</h1>
                </div>
                <button
                    type="button"
                    onClick={handleShuffle}
                    title="Промешај картички"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${isShuffled ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                    <Shuffle className="w-3.5 h-3.5" />
                    Промешај
                </button>
            </div>

            {/* Progress bar */}
            <div className="mb-2 flex items-center gap-3">
                <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="text-xs font-semibold text-gray-500 shrink-0">
                    {currentIndex + 1} / {cards.length}
                </span>
            </div>

            {/* Rated indicator dots */}
            <div className="flex gap-1 mb-5 overflow-x-auto pb-0.5">
                {cards.map((c, i) => {
                    const r = results[c.id];
                    return (
                        <button
                            key={c.id}
                            type="button"
                            onClick={() => goTo(i)}
                            className={`w-2.5 h-2.5 rounded-full shrink-0 transition ${
                                i === currentIndex ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
                            } ${
                                r === 'easy' ? 'bg-emerald-400' :
                                r === 'hard' ? 'bg-red-400' :
                                r === 'skipped' ? 'bg-gray-300' :
                                'bg-indigo-200'
                            }`}
                            title={`Картичка ${i + 1}`}
                        />
                    );
                })}
            </div>

            {/* Flip card */}
            <div
                ref={flipCardRef}
                onClick={handleFlip}
                className="cursor-pointer select-none"
                style={{ perspective: '1200px' }}
            >
                <div
                    className="relative transition-transform duration-500"
                    style={{
                        transformStyle: 'preserve-3d',
                        transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        minHeight: '320px',
                    }}
                >
                    {/* Front */}
                    <div
                        className="absolute inset-0 rounded-2xl border-2 border-indigo-200 bg-white shadow-lg flex flex-col"
                        style={{ backfaceVisibility: 'hidden' }}
                    >
                        <div className="px-5 pt-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-indigo-400">Прашање</span>
                            {currentCard.dokLevel && <DokBadge level={currentCard.dokLevel} size="compact" />}
                            {currentCard.difficulty && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${DIFF_COLOR[currentCard.difficulty] ?? 'text-gray-500 bg-gray-50 border-gray-200'}`}>
                                    {currentCard.difficulty}
                                </span>
                            )}
                            <span className="ml-auto text-[10px] text-gray-400">Клик за да видиш одговор</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-6">
                            <div className="text-center text-gray-800 text-lg font-medium leading-relaxed w-full">
                                <MathRenderer text={currentCard.front} />
                            </div>
                        </div>
                    </div>

                    {/* Back */}
                    <div
                        className="absolute inset-0 rounded-2xl border-2 border-emerald-300 bg-emerald-50 shadow-lg flex flex-col"
                        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                    >
                        <div className="px-5 pt-4 pb-2 border-b border-emerald-100 flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wide text-emerald-600">Одговор</span>
                            <span className="ml-auto text-[10px] text-gray-400">Оцени се и продолжи →</span>
                        </div>
                        <div className="flex-1 flex items-center justify-center p-6">
                            <div className="text-center text-gray-800 text-lg font-medium leading-relaxed w-full">
                                <MathRenderer text={currentCard.back} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="mt-5 flex items-center gap-3">
                <button
                    type="button"
                    onClick={prev}
                    disabled={currentIndex === 0}
                    className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>

                {isFlipped ? (
                    <div className="flex-1 flex gap-2 justify-center">
                        <button
                            type="button"
                            onClick={() => rate('hard')}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl border-2 border-red-300 bg-red-50 text-red-700 hover:bg-red-100 transition"
                        >
                            <X className="w-4 h-4" />
                            Тешко [2]
                        </button>
                        <button
                            type="button"
                            onClick={() => rate('easy')}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl border-2 border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition"
                        >
                            <Check className="w-4 h-4" />
                            Лесно [1]
                        </button>
                    </div>
                ) : (
                    <div className="flex-1 flex gap-2 justify-center">
                        <button
                            type="button"
                            onClick={() => rate('skipped')}
                            className="px-4 py-2.5 text-sm font-semibold rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition"
                        >
                            Прескочи
                        </button>
                        <button
                            type="button"
                            onClick={handleFlip}
                            className="flex-1 py-2.5 text-sm font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
                        >
                            Прикажи одговор [Space]
                        </button>
                    </div>
                )}

                <button
                    type="button"
                    onClick={next}
                    disabled={currentIndex === cards.length - 1 && rated < cards.length}
                    className="p-2.5 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Keyboard hint */}
            <p className="text-center text-[11px] text-gray-400 mt-4">
                ← → навигација &nbsp;·&nbsp; Space/Enter за превртување &nbsp;·&nbsp; 1 = Лесно &nbsp;·&nbsp; 2 = Тешко
            </p>
        </div>
    );
};
