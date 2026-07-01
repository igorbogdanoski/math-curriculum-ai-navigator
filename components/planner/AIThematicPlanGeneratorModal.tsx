import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { useCurriculum } from '../../hooks/useCurriculum';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { geminiService } from '../../services/geminiService';
import type { Grade, Topic, ThematicPlanLesson, AIGeneratedThematicPlan } from '../../types';
import { ICONS } from '../../constants';
import { OfficialThematicPlanTable } from './OfficialThematicPlanTable';
import { saveThematicPlanEdit, loadThematicPlanEdit, fetchTeacherThematicHistory, type TeacherThematicHistoryItem } from '../../services/firestoreService.plans';
import { getGradeHoursInfo } from '../../services/gemini/plans';
import { PedagogicalEnrichPanel } from './PedagogicalEnrichPanel';
import { CoachBubble } from '../common/CoachBubble';
import { ThematicPlanOfficialForm } from './ThematicPlanOfficialForm';
import { resolveGradeByLabel } from '../../utils/gradeMatch';

interface AIThematicPlanGeneratorModalProps {
    hideModal: () => void;
    /** When set (from Annual Plan drill-down), skip selection and auto-generate */
    prefillThemeName?: string;
    prefillGradeTitle?: string;
    prefillGradeId?: string;
    prefillWeeks?: number;
}

function buildHistoryContext(history: TeacherThematicHistoryItem[]): string | undefined {
    if (!history.length) return undefined;
    const lines = history.map((h, i) =>
        `Претходен план ${i + 1}: „${h.thematicUnit}" — педагошки модели: ${h.teachingModels.join(', ') || 'нема детектирани'}. Клучни активности: ${h.lessonSummaries.slice(0, 2).join(' | ') || 'нема'}.`
    );
    return lines.join('\n');
}

export const AIThematicPlanGeneratorModal: React.FC<AIThematicPlanGeneratorModalProps> = ({
    hideModal,
    prefillThemeName,
    prefillGradeTitle,
    prefillGradeId,
    prefillWeeks,
}) => {
    const { curriculum } = useCurriculum();
    const { addNotification } = useNotification();
    const { firebaseUser } = useAuth();
    const { navigate } = useNavigation();
    const printRef = useRef<HTMLDivElement>(null);

    const isPrefilled = Boolean(prefillThemeName && prefillGradeTitle);
    // When coming from Annual Plan, show config screen first instead of auto-generating
    const [showConfig, setShowConfig] = useState(isPrefilled);

    const [selectedGradeId, setSelectedGradeId] = useState<string>(curriculum?.grades[0]?.id || '');
    const [selectedTopicId, setSelectedTopicId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [generatedPlan, setGeneratedPlan] = useState<AIGeneratedThematicPlan | null>(null);
    const [viewMode, setViewMode] = useState<'preview' | 'official'>('official');

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editablePlan, setEditablePlan] = useState<AIGeneratedThematicPlan | null>(null);
    const [authorName, setAuthorName] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [period, setPeriod] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [teacherHistory, setTeacherHistory] = useState<TeacherThematicHistoryItem[]>([]);
    const [coachKey, setCoachKey] = useState<string | null>(null);
    const [showOfficialForm, setShowOfficialForm] = useState(false);
    const [broAccordionOpen, setBroAccordionOpen] = useState(false);
    const [pedagAccordionOpen, setPedagAccordionOpen] = useState(false);

    const selectedGradeObj = useMemo(() =>
        curriculum?.grades.find(g => g.id === selectedGradeId),
    [curriculum, selectedGradeId]);

    const topicsForGrade = useMemo(() => selectedGradeObj?.topics || [], [selectedGradeObj]);

    const selectedTopicObj = useMemo(() =>
        topicsForGrade.find(t => t.id === selectedTopicId),
    [topicsForGrade, selectedTopicId]);

    // Fetch teacher's thematic history for AI context
    useEffect(() => {
        if (!firebaseUser?.uid) return;
        fetchTeacherThematicHistory(firebaseUser.uid).then(setTeacherHistory).catch(() => {});
    }, [firebaseUser?.uid]);

    // Sync editablePlan when generatedPlan arrives + check for saved edits
    useEffect(() => {
        if (!generatedPlan) return;
        if (!firebaseUser?.uid || !selectedGradeId || !selectedTopicId) {
            setEditablePlan(generatedPlan);
            setIsEditing(false);
            return;
        }
        loadThematicPlanEdit(firebaseUser.uid, selectedGradeId, selectedTopicId).then(saved => {
            if (saved) {
                setEditablePlan(saved.plan);
                setAuthorName(prev => prev || saved.authorName);
                setSchoolName(prev => prev || saved.schoolName);
                setPeriod(prev => prev || saved.period);
                setSavedAt(new Date());
            } else {
                setEditablePlan(generatedPlan);
            }
            setIsEditing(false);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generatedPlan]);

    // Resolve grade+topic from prefill props (used both in config screen and when generating)
    const gradeForConfig = useMemo(() => {
        if (!curriculum || !isPrefilled) return null;
        return (
            curriculum.grades.find(g => g.id === prefillGradeId) ??
            resolveGradeByLabel(curriculum.grades, prefillGradeTitle) ??
            curriculum.grades[0]
        );
    }, [curriculum, isPrefilled, prefillGradeId, prefillGradeTitle]);

    const topicForConfig = useMemo(() => {
        if (!gradeForConfig || !isPrefilled) return null;
        return (
            gradeForConfig.topics.find(t =>
                t.title.toLowerCase().includes((prefillThemeName ?? '').toLowerCase()) ||
                (prefillThemeName ?? '').toLowerCase().includes(t.title.toLowerCase())
            ) ?? gradeForConfig.topics[0]
        );
    }, [gradeForConfig, isPrefilled, prefillThemeName]);

    const handleConfigGenerate = useCallback(() => {
        if (!gradeForConfig || !topicForConfig) return;
        setSelectedGradeId(gradeForConfig.id);
        setSelectedTopicId(topicForConfig.id);
        setShowConfig(false);
        setIsLoading(true);
        geminiService.generateThematicPlan(gradeForConfig, topicForConfig, undefined, buildHistoryContext(teacherHistory))
            .then(p => setGeneratedPlan(p))
            .catch(err => addNotification((err as Error).message, 'error'))
            .finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gradeForConfig, topicForConfig]);

    const handleGradeChange = (gradeId: string) => {
        setSelectedGradeId(gradeId);
        const grade = curriculum?.grades.find(g => g.id === gradeId);
        if (grade && grade.topics.length > 0) {
            setSelectedTopicId(grade.topics[0].id);
        } else {
            setSelectedTopicId('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGradeObj || !selectedTopicObj) {
            addNotification('Ве молиме изберете валидно одделение и тема.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const plan = await geminiService.generateThematicPlan(selectedGradeObj, selectedTopicObj, undefined, buildHistoryContext(teacherHistory));
            setGeneratedPlan(plan);
        } catch (error) {
            addNotification((error as Error).message, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLessonChange = useCallback((idx: number, field: string, value: string | number) => {
        setEditablePlan(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                lessons: prev.lessons.map((l, i) =>
                    i === idx
                        ? { ...l, [field]: value, ...(field === 'keyActivities' ? { scenario: undefined } : {}) }
                        : l
                ),
            };
        });
    }, []);

    const handleHeaderChange = useCallback((field: 'authorName' | 'schoolName' | 'period', value: string) => {
        if (field === 'authorName') setAuthorName(value);
        if (field === 'schoolName') setSchoolName(value);
        if (field === 'period') setPeriod(value);
    }, []);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Тематски_план_${prefillThemeName ?? selectedTopicObj?.title ?? 'plan'}`,
        pageStyle: `
          @page { size: A4 landscape; margin: 10mm; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            thead { display: table-header-group; }
          }
        `,
    });

    // ── Config screen rendered when isPrefilled before generation ────────────
    const renderConfigScreen = () => {
        const gradeInfo = gradeForConfig ? getGradeHoursInfo(gradeForConfig.level) : null;
        const weeks = prefillWeeks ?? 4;
        const topicHours = gradeInfo ? weeks * gradeInfo.weeklyHours : null;
        const exploreUrl = gradeForConfig ? `/explore?gradeId=${gradeForConfig.id}` : '/explore';

        return (
            <div className="p-6 space-y-5">
                {/* Info cards row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                        <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Одделение</p>
                        <p className="text-base font-bold text-blue-800">{gradeForConfig?.title ?? prefillGradeTitle}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                        <p className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-1">Траење</p>
                        <p className="text-base font-bold text-emerald-800">{weeks} {weeks === 1 ? 'недела' : 'недели'}</p>
                    </div>
                    {topicHours !== null && gradeInfo && (
                        <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
                            <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide mb-1">Вкупно часови</p>
                            <p className="text-base font-bold text-violet-800">
                                {topicHours} часа
                                <span className="text-xs font-normal text-violet-500 ml-1">
                                    ({weeks}нед × {gradeInfo.weeklyHours}ч/нед, {gradeInfo.lessonMinutes}мин)
                                </span>
                            </p>
                        </div>
                    )}
                </div>

                {/* Topic match info */}
                {topicForConfig && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Тематска целина во програмата</p>
                        <p className="text-sm font-medium text-gray-800">{topicForConfig.title}</p>
                        {topicForConfig.concepts && topicForConfig.concepts.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                                {topicForConfig.concepts.length} концепти: {topicForConfig.concepts.slice(0, 4).map(c => c.title).join(', ')}{topicForConfig.concepts.length > 4 ? '...' : ''}
                            </p>
                        )}
                    </div>
                )}

                {/* What AI will generate */}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-800">
                    <p className="font-semibold mb-2 flex items-center gap-2">
                        <ICONS.sparkles className="w-4 h-4" />
                        AI ќе генерира тематски план со:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-indigo-700">
                        <li>{topicHours ?? '~'} наставни единици со датум, цели и Bloom таксономија</li>
                        <li>Конкретни активности и сценарија за секој час</li>
                        <li>БРО стандарди III-А поврзани со секоја единица</li>
                        <li>Официјален формат за печатење (МОН образец)</li>
                    </ul>
                </div>

                {/* Link to Истражи програма */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                    <span>Сакаш да ги видиш целите и стандардите прво?</span>
                    <button
                        type="button"
                        onClick={() => { hideModal(); navigate(exploreUrl); }}
                        className="text-brand-primary font-semibold hover:underline"
                    >
                        Истражи програма →
                    </button>
                </div>
            </div>
        );
    };

    const handleSaveEdits = async () => {
        if (!editablePlan || !firebaseUser?.uid || !selectedGradeId || !selectedTopicId) return;
        setIsSaving(true);
        try {
            await saveThematicPlanEdit(firebaseUser.uid, selectedGradeId, selectedTopicId, editablePlan, { authorName, schoolName, period });
            setSavedAt(new Date());
            setCoachKey(`thematic_${selectedTopicId}_${Date.now()}`);
            addNotification('✅ Тематскиот план е зачуван!', 'success');
        } catch {
            addNotification('Грешка при зачувување. Обидете се повторно.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Standard code extraction ─────────────────────────────────────────────

    const extractStdCodes = (text: string): string[] => {
      const matches = text.match(/III-[АA]\.(\d+)/g);
      return matches ? [...new Set(matches)] : [];
    };

    const allCoveredStandards = useMemo(() => {
      if (!editablePlan) return [];
      const all = editablePlan.lessons.flatMap(l => extractStdCodes(l.learningOutcomes));
      return [...new Set(all)].sort((a, b) => {
        const na = parseInt(a.split('.')[1]); const nb = parseInt(b.split('.')[1]);
        return na - nb;
      });
    }, [editablePlan]);

    // S94-E3: Bloom HOT% — Apply(3)+Analyze(4)+Evaluate(5)+Create(6) across all lessons
    const bloomHotPct = useMemo(() => {
      if (!editablePlan) return null;
      const HOT_KEYWORDS = [
        'примени', 'примена', 'применува', 'реши', 'решава', 'конструира', 'конструирање',
        'анализира', 'анализирај', 'разложи', 'спореди', 'разликува', 'класифицира',
        'оцени', 'оценува', 'евалуира', 'критички', 'вреднува', 'расправа', 'аргументира',
        'создава', 'дизајнира', 'состави', 'планира', 'синтетизира', 'конципира', 'проект',
        'примениte', 'применуваат',
      ];
      const LOW_KEYWORDS = [
        'именува', 'наведи', 'набројува', 'дефинира', 'препознава', 'повторува', 'памети',
        'објаснува', 'опишува', 'резимира', 'претвора', 'преведува', 'илустрира',
      ];
      let hot = 0; let low = 0;
      editablePlan.lessons.forEach(l => {
        const text = `${l.learningOutcomes} ${l.keyActivities}`.toLowerCase();
        if (HOT_KEYWORDS.some(kw => text.includes(kw))) hot++;
        else if (LOW_KEYWORDS.some(kw => text.includes(kw))) low++;
      });
      const total = editablePlan.lessons.length;
      if (total === 0) return null;
      return Math.round((hot / total) * 100);
    }, [editablePlan]);

    const showBloomHotAlert = bloomHotPct !== null && bloomHotPct < 20;

    // ── Render helpers ───────────────────────────────────────────────────────

    const renderContent = () => {
        if (showConfig && isPrefilled && !generatedPlan && !isLoading) {
            return renderConfigScreen();
        }

        if (isLoading) {
            return (
                <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
                    <p className="mt-4 text-gray-600">
                        AI асистентот ја анализира темата и ги креира наставните единици со сценарија... Ова може да потрае неколку моменти.
                    </p>
                </div>
            );
        }

        if (editablePlan) {
            if (viewMode === 'official') {
                return (
                    <div ref={printRef} className="p-4 bg-gray-100 min-h-[400px]">
                        {isEditing && (
                            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center gap-2 text-sm text-blue-700">
                                <ICONS.edit className="w-4 h-4 flex-shrink-0" />
                                <span>Режим на уредување — кликни на полињата за да внесеш промени пред печатење</span>
                            </div>
                        )}
                        {allCoveredStandards.length > 0 && (
                            <div className="mb-3 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg print:hidden">
                                <p className="text-[11px] font-bold text-indigo-700 mb-1.5">📋 БРО стандарди III-А покриени во темата ({allCoveredStandards.length})</p>
                                <div className="flex flex-wrap gap-1">
                                    {allCoveredStandards.map(code => (
                                        <span key={code} className="px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-[11px] font-bold">
                                            {code}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        <OfficialThematicPlanTable
                            data={editablePlan}
                            grade={selectedGradeObj}
                            topic={selectedTopicObj}
                            authorName={authorName}
                            schoolName={schoolName}
                            period={period}
                            isEditable={isEditing}
                            onLessonChange={handleLessonChange}
                            onHeaderChange={handleHeaderChange}
                        />
                    </div>
                );
            }

            // Preview mode (simplified table)
            return (
                <div className="p-6">
                    <h3 className="text-xl font-semibold mb-3 text-brand-primary">{editablePlan.thematicUnit}</h3>

                    {/* БРО standards summary — accordion */}
                    {allCoveredStandards.length > 0 && (
                        <div className="mb-4 border border-indigo-100 rounded-lg overflow-hidden">
                            <button
                                type="button"
                                onClick={() => setBroAccordionOpen(o => !o)}
                                className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50 hover:bg-indigo-100 transition-colors text-xs font-bold text-indigo-700"
                            >
                                <span>📋 Покриени БРО стандарди III-А ({allCoveredStandards.length})</span>
                                <span className="text-indigo-500">{broAccordionOpen ? '▲' : '▼'}</span>
                            </button>
                            {broAccordionOpen && (
                                <div className="p-3 flex flex-wrap gap-1.5">
                                    {allCoveredStandards.map(code => (
                                        <span
                                            key={code}
                                            className="px-2 py-0.5 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-[11px] font-bold"
                                        >
                                            {code}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="max-h-[55vh] overflow-y-auto overflow-x-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Час</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Наставна единица</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Цели / Стандарди</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Активности</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Оценување</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {editablePlan.lessons.map((lesson: ThematicPlanLesson) => {
                                    const codes = extractStdCodes(lesson.learningOutcomes);
                                    return (
                                        <tr key={lesson.lessonNumber}>
                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{lesson.lessonNumber}</td>
                                            <td className="px-4 py-2 whitespace-normal text-sm text-gray-800 font-semibold">{lesson.lessonUnit}</td>
                                            <td className="px-4 py-2 whitespace-normal text-sm text-gray-600">
                                                <span>{lesson.learningOutcomes}</span>
                                                {codes.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        {codes.map(code => (
                                                            <span
                                                                key={code}
                                                                className="px-1.5 py-0.5 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 text-[10px] font-bold"
                                                            >
                                                                {code}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 whitespace-normal text-sm text-gray-600">{lesson.keyActivities}</td>
                                            <td className="px-4 py-2 whitespace-normal text-sm text-gray-600">{lesson.assessment}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pedagogical enrichment — accordion, preview mode only */}
                    {viewMode === 'preview' && (
                        <div className="px-6 pb-4">
                            <div className="border border-violet-100 rounded-lg overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setPedagAccordionOpen(o => !o)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-violet-50 hover:bg-violet-100 transition-colors text-xs font-bold text-violet-700"
                                >
                                    <span>🎓 Педагошко збогатување на темата</span>
                                    <span className="text-violet-400">{pedagAccordionOpen ? '▲' : '▼'}</span>
                                </button>
                                {pedagAccordionOpen && (
                                    <div className="p-3">
                                        <PedagogicalEnrichPanel
                                            planType="thematic"
                                            planSummary={{
                                                grade: selectedGradeObj?.title ?? '',
                                                title: editablePlan.thematicUnit,
                                                objectives: editablePlan.lessons.slice(0, 5).map(l => l.learningOutcomes),
                                                activities: editablePlan.lessons.slice(0, 5).map(l => l.keyActivities),
                                                weeks: prefillWeeks,
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Form — grade/topic selection
        return (
            <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-600">
                        Изберете одделение и тема, а AI асистентот ќе ви генерира предлог-план со наставни единици, цели, детални сценарија за час и активности за целата тема.
                    </p>
                    <div>
                        <label htmlFor="grade-select" className="block text-sm font-medium text-gray-700">Одделение</label>
                        <select
                            id="grade-select"
                            value={selectedGradeId}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleGradeChange(e.target.value)}
                            className="mt-1 block w-full p-2 border-gray-300 rounded-md"
                        >
                            {curriculum?.grades.map((g: Grade) => <option key={g.id} value={g.id}>{g.title}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="topic-select" className="block text-sm font-medium text-gray-700">Тематска целина</label>
                        <select
                            id="topic-select"
                            value={selectedTopicId}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTopicId(e.target.value)}
                            className="mt-1 block w-full p-2 border-gray-300 rounded-md"
                            disabled={topicsForGrade.length === 0}
                        >
                            <option value="">-- Избери тема --</option>
                            {topicsForGrade.map((t: Topic) => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                    </div>
                </div>
                <div className="flex justify-end items-center bg-gray-50 p-4 rounded-b-lg">
                    <button type="button" onClick={hideModal} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 mr-3">
                        Откажи
                    </button>
                    <button
                        type="submit"
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary"
                        disabled={!selectedTopicId || isLoading}
                    >
                        {isLoading ? 'Генерирам...' : 'Генерирај тематски план'}
                    </button>
                </div>
            </form>
        );
    };

    const renderFooter = () => {
        // Config screen footer
        if (showConfig && isPrefilled && !generatedPlan && !isLoading) {
            return (
                <div className="flex justify-between items-center bg-gray-50 p-4 rounded-b-lg border-t border-gray-200">
                    <button type="button" onClick={hideModal}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm">
                        Откажи
                    </button>
                    <button
                        type="button"
                        onClick={handleConfigGenerate}
                        disabled={!gradeForConfig || !topicForConfig}
                        className="px-6 py-2.5 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 flex items-center gap-2 font-bold disabled:opacity-50"
                    >
                        <ICONS.sparkles className="w-4 h-4" />
                        Генерирај тематски план
                    </button>
                </div>
            );
        }

        if (isLoading || !editablePlan) return null;

        return (
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-b-lg border-t border-gray-200 gap-2 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={() => { setGeneratedPlan(null); setEditablePlan(null); setIsEditing(false); }}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 text-sm"
                    >
                        Назад
                    </button>
                    {viewMode === 'official' && (
                        <button
                            type="button"
                            onClick={() => setIsEditing(v => !v)}
                            className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-colors ${
                                isEditing
                                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <ICONS.edit className="w-4 h-4" />
                            {isEditing ? 'Прегледај' : 'Уреди'}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setViewMode(viewMode === 'official' ? 'preview' : 'official')}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
                    >
                        <ICONS.eye className="w-4 h-4" />
                        {viewMode === 'official' ? 'Поедноставен' : 'Официјален'}
                    </button>
                </div>
                <div className="flex gap-2">
                    {firebaseUser && (
                        <button
                            type="button"
                            onClick={handleSaveEdits}
                            disabled={isSaving}
                            className="px-3 py-2 bg-emerald-600 text-white rounded-lg shadow hover:bg-emerald-700 flex items-center gap-1.5 text-sm disabled:opacity-60 transition"
                            title={savedAt ? `Последно зачувано: ${savedAt.toLocaleTimeString('mk')}` : 'Зачувај ги промените во Firestore'}
                        >
                            {isSaving
                                ? <><ICONS.spinner className="w-4 h-4 animate-spin" /> Зачувувам...</>
                                : <>{savedAt ? '✅' : <ICONS.bookmark className="w-4 h-4" />} Зачувај</>
                            }
                        </button>
                    )}
                    {editablePlan && (
                        <button
                            type="button"
                            onClick={() => setShowOfficialForm(true)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 flex items-center gap-2 text-sm"
                            title="МОН официјален образец — A4 пејзаж, со потписи"
                        >
                            📄 МОН Образец
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-4 py-2 bg-brand-accent text-white rounded-lg shadow hover:bg-opacity-90 flex items-center gap-2 text-sm"
                        title={(!authorName || !schoolName) ? 'Препорачливо е да ги пополните полињата Изготвил/-а и Училиште пред печатење' : undefined}
                    >
                        <ICONS.printer className="w-4 h-4" />
                        Испечати
                    </button>
                    <button
                        type="button"
                        onClick={hideModal}
                        className="px-4 py-2 bg-brand-primary text-white rounded-lg shadow hover:bg-brand-secondary text-sm"
                    >
                        Затвори
                    </button>
                </div>

                {/* S94-E3: Bloom HOT Gap Alert */}
                {showBloomHotAlert && editablePlan && (
                    <div className="mx-2 mt-3 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <span className="text-lg shrink-0">⚠️</span>
                        <div>
                            <p className="text-xs font-black text-amber-800">
                                Само {bloomHotPct}% HOT активности — МОН препорачува ≥20%
                            </p>
                            <p className="text-[11px] text-amber-700 mt-0.5">
                                Додај активности со „анализира", „дизајнира", „оценува", „решава проблеми" во клучните активности на лекциите за да го зголемиш нивото на когнитивна сложеност.
                            </p>
                        </div>
                    </div>
                )}

                {/* AI Coach feedback after save */}
                {coachKey && editablePlan && (
                    <div className="mt-3 mx-2 mb-1">
                        <CoachBubble
                            plan={editablePlan}
                            planType="thematic"
                            dismissKey={coachKey}
                            onDismiss={() => setCoachKey(null)}
                        />
                    </div>
                )}
            </div>
        );
    };

    if (!curriculum) return null;

    return (
        <>
        <div
            className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 pt-6 overflow-y-auto animate-fade-in"
            onClick={hideModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-thematic-plan-title"
        >
            <div
                className="bg-white rounded-lg shadow-xl max-w-[92vw] w-full overflow-hidden flex flex-col my-0 min-h-0 max-h-[calc(100vh-3rem)]"
                onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 border-b flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <h2 id="ai-thematic-plan-title" className="text-xl font-bold text-brand-primary flex items-center gap-2">
                            <ICONS.sparkles className="w-5 h-5" />
                            {isPrefilled ? (
                                <span>Тематски план: <span className="text-emerald-600">{prefillThemeName}</span></span>
                            ) : 'AI Генератор на Тематски План'}
                        </h2>
                        <button
                            type="button"
                            onClick={hideModal}
                            className="p-1 rounded-full hover:bg-gray-200"
                            aria-label="Затвори модал"
                        >
                            <ICONS.close className="w-6 h-6 text-gray-600" />
                        </button>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1">
                    {renderContent()}
                </div>

                {/* Footer */}
                {renderFooter()}
            </div>
        </div>

        {/* S94-E1: МОН Official Form overlay */}
        {showOfficialForm && editablePlan && (
            <ThematicPlanOfficialForm
                data={editablePlan}
                gradeLabel={selectedGradeObj ? `${selectedGradeObj.level}. одделение` : ''}
                subject="Математика"
                authorName={authorName}
                schoolName={schoolName}
                period={period}
                academicYear={new Date().getFullYear() + '/' + (new Date().getFullYear() + 1)}
                onClose={() => setShowOfficialForm(false)}
            />
        )}
        </>
    );
};
