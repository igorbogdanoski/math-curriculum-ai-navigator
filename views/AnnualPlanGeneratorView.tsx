import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import {
  fetchTopicOverlaysForGrade,
  saveTopicOverlay,
  deleteTopicOverlay,
  type TopicOverlay,
} from '../services/firestoreService.curriculumOverlays';
import { useReactToPrint } from 'react-to-print';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import type { AIGeneratedAnnualPlanTopic } from '../types';
import { geminiService } from '../services/geminiService';
import { generatePlanICS, downloadICS } from '../utils/icalExport';
import { resolveGradeByLabel } from '../utils/gradeMatch';
import { PlanGanttChart } from '../components/planner/PlanGanttChart';
import { AIThematicPlanGeneratorModal } from '../components/planner/AIThematicPlanGeneratorModal';
import { AnnualPlanOfficialForm } from '../components/planner/AnnualPlanOfficialForm';
import { SortableTopic } from '../components/planner/SortableTopic';
const PlanAnalyticsDashboard = React.lazy(() =>
  import('../components/planner/PlanAnalyticsDashboard').then(m => ({ default: m.PlanAnalyticsDashboard }))
);
import { PlanningBreadcrumb } from '../components/planner/PlanningBreadcrumb';
import { PlanningChainBar } from '../components/planner/PlanningChainBar';
import { CollabShareButton } from '../components/planner/CollabShareButton';
import { PedagogicalEnrichPanel } from '../components/planner/PedagogicalEnrichPanel';
import { usePlanning } from '../contexts/PlanningContext';
import { usePlanner } from '../contexts/PlannerContext';
import { useAnnualPlanGeneration } from '../hooks/useAnnualPlanGeneration';

interface AnnualPlanGeneratorViewProps {
    planId?: string; // when set → edit mode (load + update)
}

export const AnnualPlanGeneratorView: React.FC<AnnualPlanGeneratorViewProps> = ({ planId }) => {
    const {
        curriculum,
        selectedGradeId, setSelectedGradeId,
        subject, setSubject,
        weeks, setWeeks,
        currentStep, setCurrentStep,
        isGenerating,
        plan, setPlan,
        isLoadingExisting,
        isPublic, isTogglingPublic,
        parallelProgress, setParallelProgress, isGeneratingParallel,
        isSaving, savedId,
        subjectError, setSubjectError,
        viewers, remoteUpdatedBy,
        handleSave, handleTogglePublic, handleGenerateAllThematic, handleGenerate,
        user, firebaseUser, navigate,
    } = useAnnualPlanGeneration({ planId });

    const { setPlanningState } = usePlanning();
    const { lessonPlans } = usePlanner();

    // ── S94-E5: Lesson count per topic title (for Progress Tracker badges) ──────
    const lessonCountMap = useMemo(() => {
        const map = new Map<string, number>();
        lessonPlans.forEach((lp: { theme: string }) => {
            if (!lp.theme) return;
            map.set(lp.theme, (map.get(lp.theme) ?? 0) + 1);
        });
        return map;
    }, [lessonPlans]);

    // ── UI-only state ──────────────────────────────────────────────────────────
    const [viewMode, setViewMode] = useState<'list' | 'gantt' | 'analytics'>('list');
    const [thematicTopic, setThematicTopic] = useState<AIGeneratedAnnualPlanTopic | null>(null);
    const [showOfficialForm, setShowOfficialForm] = useState(false);
    const [officialIsEditing, setOfficialIsEditing] = useState(false);

    // ── S93-D: Curriculum Overlays (teacher notes per topic) ───────────────────
    const [overlays, setOverlays] = useState<Map<number, TopicOverlay>>(new Map());
    useEffect(() => {
        if (!firebaseUser?.uid || !selectedGradeId) return;
        fetchTopicOverlaysForGrade(firebaseUser.uid, selectedGradeId).then(list => {
            const map = new Map<number, TopicOverlay>();
            list.forEach(o => map.set(o.topicIndex, o));
            setOverlays(map);
        }).catch(() => {});
    }, [firebaseUser?.uid, selectedGradeId]);

    const handleNoteChange = useCallback(async (topicIdx: number, topicTitle: string, note: string, color: TopicOverlay['color']) => {
        if (!firebaseUser?.uid || !selectedGradeId) return;
        await saveTopicOverlay(firebaseUser.uid, selectedGradeId, topicIdx, topicTitle, note, color).catch(() => {});
        setOverlays(prev => {
            const next = new Map(prev);
            next.set(topicIdx, { id: '', uid: firebaseUser.uid!, gradeId: selectedGradeId, topicIndex: topicIdx, topicTitle, note, color, updatedAt: null });
            return next;
        });
    }, [firebaseUser?.uid, selectedGradeId]);

    const handleNoteDelete = useCallback(async (topicIdx: number) => {
        if (!firebaseUser?.uid || !selectedGradeId) return;
        await deleteTopicOverlay(firebaseUser.uid, selectedGradeId, topicIdx).catch(() => {});
        setOverlays(prev => {
            const next = new Map(prev);
            next.delete(topicIdx);
            return next;
        });
    }, [firebaseUser?.uid, selectedGradeId]);
    const [officialAuthorName, setOfficialAuthorName] = useState('');
    const [officialSchoolName, setOfficialSchoolName] = useState('');
    const [officialAcademicYear, setOfficialAcademicYear] = useState('2026/2027');

    const printRef = useRef<HTMLDivElement>(null);
    const officialFormRef = useRef<HTMLDivElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active.id !== over.id && plan) {
            const oldIndex = parseInt(active.id.split('-')[1]);
            const newIndex = parseInt(over.id.split('-')[1]);
            
            const newPlan = { ...plan };
            newPlan.topics = arrayMove(newPlan.topics, oldIndex, newIndex);
            
            setPlan(newPlan);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Годишна_Програма_${plan?.subject}_${plan?.grade}`,
        pageStyle: `
          @page { size: A4 landscape; margin: 10mm 12mm; }
          * { box-sizing: border-box; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; }
          body > div { max-width: 100% !important; width: 100% !important; box-shadow: none !important; margin: 0 !important; }
          thead { display: table-header-group !important; }
          tbody tr { break-inside: avoid !important; page-break-inside: avoid !important; }
        `,
    });

    const handleOfficialPrint = useReactToPrint({
        contentRef: officialFormRef,
        documentTitle: `Годишна_Глобална_Програма_${plan?.subject}_${plan?.grade}`,
        pageStyle: `
          @page { size: A4 landscape; margin: 10mm 12mm; }
          * { box-sizing: border-box; }
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; }
          body > div { max-width: 100% !important; width: 100% !important; box-shadow: none !important; margin: 0 !important; }
          table { border-collapse: collapse !important; width: 100% !important; }
          thead { display: table-header-group !important; }
          tbody tr { break-inside: avoid !important; page-break-inside: avoid !important; }
          textarea, input[type="text"], input[type="number"] {
            border: none !important; outline: none !important; resize: none !important;
            background: transparent !important; -webkit-appearance: none;
            font-family: inherit !important; font-size: inherit !important;
            padding: 0 !important; margin: 0 !important; width: 100% !important; overflow: hidden !important;
          }
          select { border: none !important; background: transparent !important; -webkit-appearance: none; appearance: none; padding: 0 !important; font-family: inherit !important; font-size: inherit !important; }
        `,
    });

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            <Helmet>
              <title>Годишен Наставен План — MisMath AI</title>
              <meta name="description" content="Генерирај AI-асистиран годишен план за математика според БРО програмата — по одделение, трифазна структура, Bloom анализа." />
              <link rel="canonical" href="https://ai.mismath.net/annual-planner" />
            </Helmet>
            <PlanningChainBar currentStep="annual" />
            <PlanningBreadcrumb />
            {isLoadingExisting && (
                <div className="flex items-center justify-center py-20">
                    <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mr-4" />
                    <span className="text-gray-500 font-medium">Вчитување на планот...</span>
                </div>
            )}
            {!isLoadingExisting && (
            <>
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <ICONS.planner className="w-8 h-8" />
                        {planId ? 'Уреди Годишна Програма' : 'AI Годишна Програма'}
                    </h1>
                    <p className="text-gray-500 mt-2">
                        {planId
                            ? 'Уредувате постоечка програма — промените ќе се зачуваат на истото место.'
                            : 'Автоматско генерирање на структуриран годишен план (Annual Curriculum Planner)'}
                    </p>
                </div>
                {/* Ж7.1 — Presence indicator (only in edit mode) */}
                {planId && (viewers.length > 0 || remoteUpdatedBy) && (
                    <div className="flex flex-col items-end gap-1.5">
                        {viewers.length > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                {viewers.map(v => v.displayName).join(', ')} {viewers.length === 1 ? 'е' : 'се'} онлајн
                            </div>
                        )}
                        {remoteUpdatedBy && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-medium text-amber-700">
                                <ICONS.arrowPath className="w-3.5 h-3.5" />
                                {remoteUpdatedBy} зачуваше промени — превчитајте за да ги добиете
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Progress Stepper */}
            <div className="mb-10 w-full px-2 relative flex items-center justify-between max-w-2xl mx-auto">
                <div className="absolute left-[10%] right-[10%] top-5 h-[2px] bg-gray-200 -z-10">
                    <div className="h-full bg-blue-600 transition-all duration-300 ease-in-out" style={{ width: `${((currentStep - 1) / 2) * 100}%` }}></div>
                </div>
                
                {[
                    { step: 1, label: 'Одделение & Предмет' },
                    { step: 2, label: 'Параметри' },
                    { step: 3, label: 'Генерирање & Преглед' }
                ].map((s) => (
                    <div key={s.step} className="flex flex-col items-center gap-2 text-center">
                        <button 
                            type="button"
                            onClick={() => s.step < currentStep || (plan && s.step === 3) ? setCurrentStep(s.step) : null}
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-4 z-10
                                ${currentStep === s.step 
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110' 
                                    : currentStep > s.step 
                                        ? 'bg-blue-600 border-blue-600 text-white' 
                                        : 'bg-white border-gray-200 text-gray-400'
                                }`}
                        >
                            {currentStep > s.step ? '✓' : s.step}
                        </button>
                        <span className={`text-[10px] sm:text-xs font-bold transition-colors ${currentStep === s.step ? 'text-blue-600' : 'text-gray-500'}`}>
                            {s.label}
                        </span>
                    </div>
                ))}
            </div>

            <div className="max-w-4xl mx-auto">
                {currentStep === 1 && (
                    <Card className="animate-fade-in p-8">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-sm">1</span>
                            Изберете Одделение и Предмет
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label htmlFor="apg-grade" className="block text-sm font-bold text-gray-700 mb-2">Одделение</label>
                                <select
                                    id="apg-grade"
                                    className="w-full p-3 border-2 border-gray-100 rounded-xl bg-gray-50 focus:bg-white focus:border-blue-500 outline-none transition-all font-medium"
                                    value={selectedGradeId}
                                    onChange={(e) => setSelectedGradeId(e.target.value)}
                                >
                                    {curriculum?.grades.map(g => (
                                        <option key={g.id} value={g.id}>{g.title}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="apg-subject" className="block text-sm font-bold text-gray-700 mb-2">Предмет</label>
                                <input
                                    id="apg-subject"
                                    type="text"
                                    placeholder="пр. Математика"
                                    value={subject}
                                    onChange={(e) => { setSubject(e.target.value); if (subjectError) setSubjectError(''); }}
                                    className={`w-full p-3 border-2 rounded-xl bg-gray-50 focus:bg-white outline-none transition-all font-medium ${subjectError ? 'border-red-400 focus:border-red-500' : 'border-gray-100 focus:border-blue-500'}`}
                                />
                                {subjectError && <p className="mt-1 text-xs text-red-500">{subjectError}</p>}
                            </div>
                        </div>
                        <div className="mt-8 flex justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    if (!subject.trim()) { setSubjectError('Внесете назив на предметот.'); return; }
                                    setCurrentStep(2);
                                }}
                                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                Следно <ICONS.chevronDown className="w-5 h-5 -rotate-90" />
                            </button>
                        </div>
                    </Card>
                )}

                {currentStep === 2 && (
                    <Card className="animate-fade-in p-8">
                        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                            <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-lg flex items-center justify-center text-sm">2</span>
                            Параметри на планирањето
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center justify-between">
                                    <span>Вкупно недели во учебната година</span>
                                    <span className="text-blue-600">{weeks} недели</span>
                                </label>
                                <input
                                    type="range"
                                    title="Број на недели"
                                    min="20"
                                    max="40"
                                    value={weeks}
                                    onChange={(e) => setWeeks(Number(e.target.value))}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                />
                                <div className="flex justify-between text-[10px] text-gray-400 mt-2">
                                    <span>20 недели</span>
                                    <span>36 недели (Стандардно)</span>
                                    <span>40 недели</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-between">
                            <button 
                                onClick={() => setCurrentStep(1)}
                                className="px-6 py-3 bg-white border-2 border-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center gap-2"
                            >
                                <ICONS.chevronDown className="w-5 h-5 rotate-90" /> Назад
                            </button>
                            <button 
                                onClick={() => { setCurrentStep(3); if (!plan) handleGenerate(); }}
                                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"
                            >
                                Генерирај <ICONS.sparkles className="w-5 h-5" />
                            </button>
                        </div>
                    </Card>
                )}

                {currentStep === 3 && (
                    <div className="space-y-6 animate-fade-in">
                        {!plan && isGenerating ? (
                            <Card className="p-12 text-center flex flex-col items-center">
                                <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                                <h3 className="text-xl font-bold text-gray-800 mb-2">Генерирање на Годишна Програма</h3>
                                <p className="text-gray-500 max-w-sm">AI ги анализира националните стандарди и ги распределува темите за Вашето одделение...</p>
                            </Card>
                        ) : plan ? (
                            <Card>
                                <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
                                    <div>
                                        <h2 className="text-2xl font-bold">
                                            {plan.subject} ({plan.grade})
                                        </h2>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {viewMode === 'list' ? 'Повлечи ги темите за да го смениш редоследот · Кликни Тематски план за детална разработка' : 'Кликни на тема за да генерираш тематски план'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {/* List / Gantt / Analytics toggle */}
                                        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('list')}
                                                className={`px-3 py-1.5 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                📋 Листа
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('gantt')}
                                                className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${viewMode === 'gantt' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                📅 Gantt
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('analytics')}
                                                className={`px-3 py-1.5 transition-colors border-l border-gray-200 ${viewMode === 'analytics' ? 'bg-violet-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                📊 Аналитика
                                            </button>
                                        </div>
                                        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-3 py-1 rounded-full">
                                            {plan.totalWeeks} недели
                                        </span>
                                        {user && (
                                            <>
                                            <button
                                                type="button"
                                                onClick={handleSave}
                                                disabled={isSaving}
                                                title="Зачувај (Ctrl+S)"
                                                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-60 transition shadow-sm"
                                            >
                                                {isSaving
                                                    ? <><ICONS.spinner className="w-4 h-4 animate-spin" /> Зачувувам...</>
                                                    : savedId && !planId ? '✓ Зачувано' : planId ? 'Ажурирај' : 'Зачувај'}
                                            </button>
                                            {savedId && (
                                                <button
                                                    type="button"
                                                    onClick={handleTogglePublic}
                                                    disabled={isTogglingPublic}
                                                    title={isPublic ? 'Откажи споделување' : 'Сподели во Библиотека'}
                                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-sm transition shadow-sm border ${
                                                        isPublic
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {isTogglingPublic
                                                        ? <ICONS.spinner className="w-4 h-4 animate-spin" />
                                                        : isPublic ? '🌐 Јавно' : '🔒 Приватно'}
                                                </button>
                                            )}
                                            {(savedId ?? planId) && firebaseUser && (
                                                <CollabShareButton
                                                    planType="annual"
                                                    planId={savedId ?? planId ?? ''}
                                                    ownerUid={firebaseUser.uid}
                                                    ownerName={user?.name ?? 'Наставник'}
                                                    isOwner
                                                />
                                            )}
                                            </>
                                        )}
                                        <button
                                            onClick={() => {
                                                const ics = generatePlanICS(plan);
                                                downloadICS(ics, `Годишна_Програма_${plan.subject}_${plan.grade}.ics`);
                                            }}
                                            className="p-2 border-2 border-gray-100 rounded-xl hover:bg-gray-50 transition text-gray-600"
                                            title="iCal Експорт"
                                        >
                                            📅
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleGenerateAllThematic}
                                            disabled={isGeneratingParallel}
                                            title="Загреј ги сите тематски планови паралелно (кешираат за брз пристап)"
                                            className="flex items-center gap-1 px-2.5 py-1.5 border-2 border-indigo-100 rounded-xl hover:bg-indigo-50 transition text-indigo-700 text-xs font-bold disabled:opacity-50"
                                        >
                                            {isGeneratingParallel
                                                ? <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Загревам...</>
                                                : '⚡ Загреј сите'}
                                        </button>
                                        <button
                                            onClick={handlePrint}
                                            className="p-2 border-2 border-gray-100 rounded-xl hover:bg-gray-50 transition text-gray-600"
                                            title="Печати"
                                        >
                                            🖨️
                                        </button>
                                        <button
                                            onClick={() => setShowOfficialForm(true)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 border-2 border-blue-100 rounded-xl hover:bg-blue-50 transition text-blue-700 text-xs font-bold"
                                            title="Официјален МОН образец за Годишна програма"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                            Официјален образец
                                        </button>
                                        <button
                                            onClick={() => {
                                                sessionStorage.setItem('dataviz_import', JSON.stringify({
                                                    tableData: {
                                                        headers: ['Тема', 'Недели'],
                                                        rows: plan.topics.map((t: AIGeneratedAnnualPlanTopic) => [t.title.slice(0, 30), t.durationWeeks]),
                                                    },
                                                    config: { title: `${plan.grade} — ${plan.subject}`, xLabel: 'Тема', yLabel: 'Недели', type: 'bar-horizontal' },
                                                }));
                                                navigate('/data-viz');
                                            }}
                                            className="p-2 border-2 border-indigo-100 rounded-xl hover:bg-indigo-50 transition text-indigo-600"
                                            title="Визуализирај во DataViz Studio"
                                        >
                                            📊
                                        </button>
                                    </div>
                                </div>

                                {/* ── S78-B: Parallel thematic generation progress ── */}
                                {parallelProgress && (
                                    <div className="mb-4 bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold text-indigo-700">
                                                ⚡ Загревање на тематски планови: {parallelProgress.done}/{parallelProgress.total}
                                            </span>
                                            {!isGeneratingParallel && (
                                                <button type="button" onClick={() => setParallelProgress(null)} className="text-xs text-indigo-400 hover:text-indigo-600">✕</button>
                                            )}
                                        </div>
                                        <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.round((parallelProgress.done / parallelProgress.total) * 100)}%` }}
                                            />
                                        </div>
                                        {!isGeneratingParallel && parallelProgress.done === parallelProgress.total && (() => {
                                            const failed = parallelProgress.results.filter(r => r.status === 'error');
                                            return (
                                                <div className="mt-1.5">
                                                    <p className="text-[10px] text-indigo-600">
                                                        ✅ Завршено! {failed.length === 0 ? 'Кликни на тема во Gantt за моментален пристап.' : ''}
                                                    </p>
                                                    {failed.length > 0 && (
                                                        <div className="mt-1.5 space-y-1">
                                                            <p className="text-[10px] font-bold text-red-600">⚠️ {failed.length} теми со грешка — обиди се повторно:</p>
                                                            {failed.map(f => (
                                                                <div key={f.topic} className="flex items-center gap-1.5">
                                                                    <span className="text-[10px] text-red-700 flex-1 truncate">✗ {f.topic}</span>
                                                                    <button
                                                                        type="button"
                                                                        className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition font-bold shrink-0"
                                                                        onClick={() => {
                                                                            if (!plan || !curriculum) return;
                                                                            const gradeMatch = resolveGradeByLabel(curriculum.grades, plan.grade) ?? curriculum.grades[0];
                                                                            const topicMatch = gradeMatch?.topics.find(t =>
                                                                                t.title.toLowerCase().includes(f.topic.toLowerCase().slice(0, 5)) ||
                                                                                f.topic.toLowerCase().includes(t.title.toLowerCase().slice(0, 5))
                                                                            ) ?? gradeMatch?.topics[0];
                                                                            if (!gradeMatch || !topicMatch) return;
                                                                            setParallelProgress(prev => prev ? {
                                                                                ...prev,
                                                                                results: prev.results.map(r => r.topic === f.topic ? { ...r, status: 'ok' } : r),
                                                                            } : null);
                                                                            geminiService.generateThematicPlan(gradeMatch, topicMatch, user ?? undefined)
                                                                                .catch(() => setParallelProgress(prev => prev ? {
                                                                                    ...prev,
                                                                                    results: prev.results.map(r => r.topic === f.topic ? { ...r, status: 'error' } : r),
                                                                                } : null));
                                                                        }}
                                                                    >
                                                                        Повтори
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}

                                {viewMode === 'analytics' ? (
                                    <div className="mb-6">
                                        <React.Suspense fallback={<div className="flex items-center justify-center py-12 text-slate-400 text-sm">Вчитување аналитики...</div>}>
                                            <PlanAnalyticsDashboard plan={plan} weeklyHours={4} />
                                        </React.Suspense>
                                    </div>
                                ) : viewMode === 'gantt' ? (
                                    <div className="mb-6">
                                        <PlanGanttChart
                                            topics={plan.topics}
                                            onTopicClick={t => setThematicTopic(t)}
                                        />
                                    </div>
                                ) : (
                                <div className="print:p-8 print:bg-white" ref={printRef}>
                                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                                        <SortableContext
                                            items={plan.topics.map((_, idx) => `topic-${idx}`)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {plan.topics.map((topic, idx) => (
                                                <SortableTopic
                                                    key={`topic-${idx}`}
                                                    id={`topic-${idx}`}
                                                    topic={topic}
                                                    idx={idx}
                                                    onGenerateThematic={() => {
                                                        setPlanningState({
                                                            annualPlanId: savedId,
                                                            themeName: topic.title,
                                                            hoursAllocated: topic.durationWeeks * (plan.totalWeeks > 0 ? 4 : 4),
                                                            bloomTargets: [1, 2, 3],
                                                            objectives: topic.objectives,
                                                        });
                                                        setThematicTopic(topic);
                                                    }}
                                                    onGenerateLesson={() => {
                                                        setPlanningState({
                                                            annualPlanId: savedId,
                                                            themeName: topic.title,
                                                            objectives: topic.objectives,
                                                        });
                                                        const params = new URLSearchParams({
                                                            prefillTopic: topic.title,
                                                            prefillGrade: plan.grade,
                                                            prefillSubject: plan.subject,
                                                        });
                                                        navigate(`/planner/lesson/new?${params.toString()}`);
                                                    }}
                                                    onUpdate={(updated) => {
                                                        setPlan(prev => prev ? {
                                                            ...prev,
                                                            topics: prev.topics.map((t, i) => i === idx ? updated : t),
                                                        } : null);
                                                    }}
                                                    exploreGradeId={selectedGradeId}
                                                    overlayNote={overlays.get(idx)?.note}
                                                    overlayColor={overlays.get(idx)?.color}
                                                    onNoteChange={(note, color) => handleNoteChange(idx, topic.title, note, color)}
                                                    onNoteDelete={() => handleNoteDelete(idx)}
                                                    lessonCount={lessonCountMap.get(topic.title) ?? 0}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
                                </div>
                                )}
                                {viewMode === 'list' && (
                                    <div className="mt-6">
                                        <PedagogicalEnrichPanel
                                            planType="annual"
                                            planSummary={{
                                                grade: plan.grade ?? '',
                                                title: `${plan.subject} — ${plan.grade}`,
                                                topics: plan.topics.map(t => t.title),
                                                objectives: plan.topics.flatMap(t => t.objectives ?? []).slice(0, 8),
                                                weeks: plan.topics.reduce((s, t) => s + (t.durationWeeks ?? 0), 0),
                                            }}
                                        />
                                    </div>
                                )}

                                <div className="mt-8 pt-6 border-t flex justify-start">
                                    <button
                                        onClick={() => setCurrentStep(2)}
                                        className="px-6 py-3 text-blue-600 font-bold hover:bg-blue-50 rounded-xl transition-all"
                                    >
                                        ← Назад кон параметри
                                    </button>
                                </div>
                            </Card>
                        ) : (
                            <Card className="p-12 text-center">
                                <div className="mb-4 text-gray-300 flex justify-center"><ICONS.planner className="w-12 h-12" /></div>
                                <h3 className="text-lg font-medium text-gray-900 mb-1">Грешка при генерирање</h3>
                                <p className="text-gray-500 mb-6">Настана грешка. Ве молиме обидете се повторно.</p>
                                <button onClick={() => setCurrentStep(2)} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Обиди се повторно</button>
                            </Card>
                        )}

                        {/* Thematic Plan Modal — triggered from Gantt click or list button */}
                        {plan && thematicTopic && (
                            <AIThematicPlanGeneratorModal
                                hideModal={() => setThematicTopic(null)}
                                prefillThemeName={thematicTopic.title}
                                prefillGradeTitle={plan.grade}
                                prefillGradeId={selectedGradeId}
                                prefillWeeks={thematicTopic.durationWeeks}
                            />
                        )}
                    </div>
                )}
            </div>
            </>
            )}

            {/* ── Official MoN Annual Plan Form Modal ──────────────────────────── */}
            {showOfficialForm && plan && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in"
                    onClick={() => setShowOfficialForm(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Официјален образец за Годишна програма"
                >
                    <div
                        className="bg-white rounded-lg shadow-xl max-w-[95vw] w-full overflow-hidden flex flex-col max-h-[95vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 border-b flex-shrink-0 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-brand-primary flex items-center gap-2">
                                <ICONS.printer className="w-5 h-5" />
                                Официјален образец — Годишна Глобална Програма (МОН)
                            </h2>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setOfficialIsEditing(v => !v)}
                                    className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-colors ${
                                        officialIsEditing
                                            ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <ICONS.edit className="w-4 h-4" />
                                    {officialIsEditing ? 'Прегледај' : 'Уреди'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleOfficialPrint()}
                                    className="px-3 py-1.5 bg-brand-accent text-white rounded-lg flex items-center gap-2 text-sm hover:bg-opacity-90"
                                >
                                    <ICONS.printer className="w-4 h-4" />
                                    Испечати
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowOfficialForm(false)}
                                    className="p-1 rounded-full hover:bg-gray-200"
                                    aria-label="Затвори"
                                >
                                    <ICONS.close className="w-5 h-5 text-gray-600" />
                                </button>
                            </div>
                        </div>

                        {officialIsEditing && (
                            <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-sm text-blue-700 flex-shrink-0">
                                <ICONS.edit className="w-4 h-4 flex-shrink-0" />
                                <span>Режим на уредување — кликни на полињата за да внесеш промени пред печатење</span>
                            </div>
                        )}

                        {/* Scrollable form body */}
                        <div className="overflow-auto flex-1 p-6 bg-gray-100">
                            <div ref={officialFormRef} className="bg-white shadow-sm mx-auto min-w-[900px]">
                                <AnnualPlanOfficialForm
                                    data={plan}
                                    authorName={officialAuthorName}
                                    schoolName={officialSchoolName}
                                    academicYear={officialAcademicYear}
                                    isEditable={officialIsEditing}
                                    onHeaderChange={(field, value) => {
                                        if (field === 'authorName') setOfficialAuthorName(value);
                                        if (field === 'schoolName') setOfficialSchoolName(value);
                                        if (field === 'academicYear') setOfficialAcademicYear(value);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
