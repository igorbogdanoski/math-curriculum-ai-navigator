import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { callGeminiProxy, DEFAULT_MODEL } from '../services/gemini/core';
import { addBreadcrumb } from '../services/sentryService';
import { useExamVisibilityPause } from '../hooks/useExamVisibilityPause';
import { useMaturaExams, useMaturaQuestions } from '../hooks/useMatura';
import { saveUserMaturaResult, buildMissionPlan, saveMaturaMissionPlan } from '../services/firestoreService.matura';
import type { MaturaExamMeta } from '../services/firestoreService.matura';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useAuth } from '../contexts/AuthContext';

import {
    TRACK_LABELS, TRACK_ORDER, TRACK_ACCENT, SESSION_ORDER,
    DURATION_SECONDS, examLabel, hasAnswer, gradeFromPercent,
    progressKey, resultKey, gradePart2, gradePart3,
} from './maturaSimulation/maturaSimUtils';
import type { Phase, SimAnswers, SimResult } from './maturaSimulation/maturaSimUtils';
import { MaturaSelectPhase } from './maturaSimulation/MaturaSelectPhase';
import { MaturaExamPhase } from './maturaSimulation/MaturaExamPhase';
import { MaturaGradingPhase } from './maturaSimulation/MaturaGradingPhase';
import { MaturaResultsPhase } from './maturaSimulation/MaturaResultsPhase';

const ANALYSIS_MODEL = DEFAULT_MODEL;

export const MaturaSimulationView: React.FC = () => {
    const { addNotification } = useNotification();
    const { navigate } = useNavigation();
    const { firebaseUser } = useAuth();

    const [phase,        setPhase]        = useState<Phase>('select');
    const [selectedExam, setSelectedExam] = useState<MaturaExamMeta | null>(null);
    const [expandedSolutions, setExpandedSolutions] = useState<Set<number>>(new Set());
    const { exams, loading: examsLoading } = useMaturaExams();
    const { questions, loading: qLoading  } = useMaturaQuestions(
        selectedExam ? [selectedExam.id] : [],
        undefined,
        Boolean(selectedExam),
    );

    const [answers,     setAnswers]     = useState<SimAnswers>({ mc: {}, p2a: {}, p2b: {}, p3: {} });
    const [currentIdx,  setCurrentIdx]  = useState(0);
    const [timeLeft,    setTimeLeft]    = useState(DURATION_SECONDS);
    const [viewMode,    setViewMode]    = useState<'single' | 'grid'>('single');
    const examStartRef                  = useRef<number>(0);

    const [gradingProgress, setGradingProgress] = useState({ done: 0, total: 0 });

    const [result,      setResult]      = useState<SimResult | null>(null);
    const [aiAnalysis,  setAiAnalysis]  = useState('');
    const [aiLoading,   setAiLoading]   = useState(false);

    const [planSaving,  setPlanSaving]  = useState(false);
    const [planCreated, setPlanCreated] = useState(false);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const getPastResult = useCallback((examId: string): SimResult | null => {
        try {
            const raw = localStorage.getItem(resultKey(examId));
            return raw ? (JSON.parse(raw) as SimResult) : null;
        } catch { return null; }
    }, []);

    // ── Group exams by track → year → session ─────────────────────────────────
    const examsByTrack = useMemo(() => {
        const trackMap = new Map<string, Map<number, Map<string, MaturaExamMeta[]>>>();
        for (const exam of exams) {
            const track = exam.track ?? 'gymnasium';
            if (!trackMap.has(track)) trackMap.set(track, new Map());
            const yearMap = trackMap.get(track)!;
            if (!yearMap.has(exam.year)) yearMap.set(exam.year, new Map());
            const sessMap = yearMap.get(exam.year)!;
            if (!sessMap.has(exam.session)) sessMap.set(exam.session, []);
            sessMap.get(exam.session)!.push(exam);
        }
        return Array.from(trackMap.entries())
            .sort(([a], [b]) => TRACK_ORDER.indexOf(a) - TRACK_ORDER.indexOf(b))
            .map(([track, yearMap]) => ({
                track,
                label: TRACK_LABELS[track] ?? track,
                accent: TRACK_ACCENT[track] ?? TRACK_ACCENT['gymnasium'],
                years: Array.from(yearMap.entries())
                    .sort(([a], [b]) => b - a)
                    .map(([year, sessMap]) => ({
                        year,
                        sessions: Array.from(sessMap.entries())
                            .sort(([a], [b]) => SESSION_ORDER.indexOf(a) - SESSION_ORDER.indexOf(b))
                            .map(([session, variants]) => ({
                                session,
                                variants: variants.sort((a, b) => ['mk','al','tr'].indexOf(a.language) - ['mk','al','tr'].indexOf(b.language)),
                            })),
                    })),
            }));
    }, [exams]);

    // ── Timer ─────────────────────────────────────────────────────────────────
    const [timerPaused, setTimerPaused] = useState(false);
    useExamVisibilityPause({
        enabled: phase === 'exam',
        onPause: () => setTimerPaused(true),
        onResume: () => setTimerPaused(false),
    });
    useEffect(() => {
        if (phase !== 'exam') return;
        if (timerPaused) return;
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [phase, timerPaused]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (phase === 'exam' && timeLeft === 0) handleSubmit(); }, [timeLeft, phase]);

    useEffect(() => {
        if (phase !== 'exam' || !selectedExam) return;
        localStorage.setItem(progressKey(selectedExam.id), JSON.stringify({
            examId: selectedExam.id, answers, timeLeft, savedAt: Date.now(),
        }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [answers]);

    // ── Start exam ────────────────────────────────────────────────────────────
    const startExam = useCallback((exam: MaturaExamMeta) => {
        if (timerRef.current) clearInterval(timerRef.current);
        let restoredAnswers: SimAnswers | null = null;
        let restoredTime: number | null = null;
        try {
            const saved = localStorage.getItem(progressKey(exam.id));
            if (saved) {
                const parsed = JSON.parse(saved) as { examId: string; answers: SimAnswers; timeLeft: number; savedAt: number };
                if (parsed.examId === exam.id && (Date.now() - parsed.savedAt) < 4 * 3600 * 1000) {
                    if (window.confirm(`Најден е незавршен тест (${Math.floor(parsed.timeLeft/60)}:${String(parsed.timeLeft%60).padStart(2,'0')} останато). Продолжи?`)) {
                        restoredAnswers = parsed.answers;
                        restoredTime    = parsed.timeLeft;
                    }
                }
            }
        } catch { /* ignore */ }
        setSelectedExam(exam);
        setCurrentIdx(0);
        setAnswers(restoredAnswers ?? { mc: {}, p2a: {}, p2b: {}, p3: {} });
        setTimeLeft(restoredTime ?? DURATION_SECONDS);
        setViewMode('single');
        setResult(null);
        setAiAnalysis('');
        examStartRef.current = Date.now();
        setTimerPaused(false);
        setPhase('exam');
        addBreadcrumb('matura.simulation', 'session_started', { examId: exam.id, restored: Boolean(restoredAnswers) });
    }, []);

    // ── Submit → grade ────────────────────────────────────────────────────────
    const handleSubmit = useCallback(async () => {
        if (!selectedExam || phase === 'grading' || phase === 'results') return;
        if (timerRef.current) clearInterval(timerRef.current);
        localStorage.removeItem(progressKey(selectedExam.id));
        setPhase('grading');

        const openQs = questions.filter(q => q.part === 2 || q.part === 3);
        setGradingProgress({ done: 0, total: openQs.length });
        const grades: Record<number, { score: number; maxPoints: number; correct?: boolean; feedback?: string }> = {};

        questions.filter(q => q.part === 1).forEach(q => {
            const correct = (answers.mc[q.questionNumber] ?? '').toUpperCase() === (q.correctAnswer ?? '').toUpperCase();
            grades[q.questionNumber] = { score: correct ? q.points : 0, maxPoints: q.points, correct };
        });

        for (const q of openQs) {
            try {
                if (q.part === 2) {
                    const g = await gradePart2(q, answers.p2a[q.questionNumber] ?? '', answers.p2b[q.questionNumber] ?? '');
                    grades[q.questionNumber] = { score: g.score, maxPoints: g.maxScore, feedback: g.feedback };
                } else {
                    const g = await gradePart3(q, answers.p3[q.questionNumber] ?? '');
                    grades[q.questionNumber] = { score: g.score, maxPoints: g.maxScore, feedback: g.feedback };
                }
            } catch {
                grades[q.questionNumber] = { score: 0, maxPoints: q.points, feedback: 'Оценувањето не успеа.' };
            }
            setGradingProgress(prev => ({ ...prev, done: prev.done + 1 }));
        }

        const totalScore      = Object.values(grades).reduce((s, g) => s + g.score, 0);
        const maxScore        = questions.reduce((s, q) => s + q.points, 0);
        const durationSeconds = Math.round((Date.now() - examStartRef.current) / 1000);
        const simResult: SimResult = {
            examId: selectedExam.id, examTitle: examLabel(selectedExam),
            answers, grades, totalScore, maxScore, durationSeconds,
            completedAt: new Date().toISOString(),
        };
        localStorage.setItem(resultKey(selectedExam.id), JSON.stringify(simResult));

        if (firebaseUser?.uid) {
            void saveUserMaturaResult(firebaseUser.uid, {
                examId: simResult.examId, examTitle: simResult.examTitle,
                grades: simResult.grades, totalScore: simResult.totalScore,
                maxScore: simResult.maxScore, durationSeconds: simResult.durationSeconds,
                completedAt: simResult.completedAt,
            });
        }
        setResult(simResult);
        setPhase('results');
        addBreadcrumb('matura.simulation', 'session_submitted', {
            examId: simResult.examId, totalScore: simResult.totalScore,
            maxScore: simResult.maxScore, durationSeconds: simResult.durationSeconds,
            autoSubmitted: timeLeft === 0,
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedExam, phase, questions, answers, firebaseUser]);

    // ── Topic + part breakdown ────────────────────────────────────────────────
    const topicBreakdown = useMemo(() => {
        if (!result) return {} as Record<string, { score: number; max: number }>;
        return questions.reduce((acc, q) => {
            const t = q.topicArea ?? q.topic ?? 'Друго';
            if (!acc[t]) acc[t] = { score: 0, max: 0 };
            acc[t].max   += q.points;
            acc[t].score += result.grades[q.questionNumber]?.score ?? 0;
            return acc;
        }, {} as Record<string, { score: number; max: number }>);
    }, [result, questions]);

    const partBreakdown = useMemo(() => {
        if (!result) return null;
        return ([1, 2, 3] as const).map(p => {
            const qs    = questions.filter(q => q.part === p);
            const score = qs.reduce((s, q) => s + (result.grades[q.questionNumber]?.score ?? 0), 0);
            const max   = qs.reduce((s, q) => s + q.points, 0);
            return { part: p, score, max, count: qs.length };
        });
    }, [result, questions]);

    // ── AI Analysis ───────────────────────────────────────────────────────────
    const requestAiAnalysis = useCallback(async () => {
        if (!result || aiLoading) return;
        setAiLoading(true);
        try {
            const weakTopics = Object.entries(topicBreakdown)
                .filter(([, v]) => v.score < v.max * 0.5)
                .map(([t, v]) => `${t}: ${v.score}/${v.max}`)
                .join(', ');
            const pct    = Math.round((result.totalScore / result.maxScore) * 100);
            const prompt = `Ученик полагаше симулација на матура по математика.
Резултат: ${result.totalScore}/${result.maxScore} поени (${pct}%).
Слаби теми: ${weakTopics || 'нема забележани'}.
Дај кратка, охрабрувачка анализа (3–4 реченици на македонски) со конкретни совети.`;
            const resp = await callGeminiProxy({
                model: ANALYSIS_MODEL, skipTierOverride: true,
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.4, maxOutputTokens: 400 },
            });
            setAiAnalysis(resp.text);
        } catch {
            addNotification('AI анализата не е достапна моментално.', 'error');
        } finally {
            setAiLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result, aiLoading, topicBreakdown]);

    // ── Mission plan ──────────────────────────────────────────────────────────
    const handleGeneratePlan = useCallback(async () => {
        if (!firebaseUser?.uid || planSaving || planCreated) return;
        setPlanSaving(true);
        try {
            const weakest = Object.entries(topicBreakdown)
                .filter(([, v]) => v.max > 0)
                .sort(([, a], [, b]) => (a.score / a.max) - (b.score / b.max))[0];
            const primaryTopic = weakest?.[0] ?? 'algebra';
            const plan = buildMissionPlan(
                firebaseUser.uid,
                `simulation-${result?.examTitle ?? 'matura'}`,
                result?.examTitle ?? 'Симулација',
                primaryTopic,
            );
            await saveMaturaMissionPlan(firebaseUser.uid, plan);
            setPlanCreated(true);
        } catch {
            addNotification('Планот не можеше да се зачува. Обиди се повторно.', 'error');
        } finally {
            setPlanSaving(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firebaseUser?.uid, planSaving, planCreated, topicBreakdown, result]);

    // ── Phase routing ─────────────────────────────────────────────────────────
    if (phase === 'select') {
        return (
            <MaturaSelectPhase
                examsByTrack={examsByTrack}
                examsLoading={examsLoading}
                examsLength={exams.length}
                getPastResult={getPastResult}
                startExam={startExam}
            />
        );
    }

    if (phase === 'exam' && selectedExam) {
        return (
            <MaturaExamPhase
                qLoading={qLoading}
                questions={questions}
                selectedExam={selectedExam}
                currentIdx={currentIdx}
                setCurrentIdx={setCurrentIdx}
                answers={answers}
                setAnswers={setAnswers}
                timeLeft={timeLeft}
                timerPaused={timerPaused}
                viewMode={viewMode}
                setViewMode={setViewMode}
                handleSubmit={handleSubmit}
                onCancel={() => setPhase('select')}
            />
        );
    }

    if (phase === 'grading') {
        return <MaturaGradingPhase done={gradingProgress.done} total={gradingProgress.total} />;
    }

    if (phase === 'results' && result && selectedExam) {
        return (
            <MaturaResultsPhase
                result={result}
                selectedExam={selectedExam}
                questions={questions}
                partBreakdown={partBreakdown}
                topicBreakdown={topicBreakdown}
                aiAnalysis={aiAnalysis}
                aiLoading={aiLoading}
                requestAiAnalysis={requestAiAnalysis}
                expandedSolutions={expandedSolutions}
                setExpandedSolutions={setExpandedSolutions}
                planCreated={planCreated}
                planSaving={planSaving}
                handleGeneratePlan={handleGeneratePlan}
                hasUser={Boolean(firebaseUser)}
                onBack={() => setPhase('select')}
                onRetry={() => startExam(selectedExam)}
                onGoStats={() => navigate('/matura-stats')}
                onGoPortal={() => navigate('/matura-portal')}
                answers={answers}
            />
        );
    }

    return null;
};
