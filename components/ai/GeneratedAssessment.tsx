import React, { useState, useEffect, useRef } from 'react';
import { Bookmark, Image as ImageIcon, Loader2, X, RefreshCw, BarChart2, Upload } from 'lucide-react';
import { ChartPreview, DEFAULT_CONFIG } from '../dataviz/ChartPreview';
import type { ChartType, ChartConfig } from '../dataviz/ChartPreview';
import { DataTable, DEFAULT_TABLE } from '../dataviz/DataTable';
import type { TableData } from '../dataviz/DataTable';
import { Card } from '../common/Card';
import { downloadAsPdf } from '../../utils/pdfDownload';
import { ICONS } from '../../constants';
import { MathRenderer } from '../common/MathRenderer';
import type { AIGeneratedAssessment, AssessmentQuestion, DifferentiationLevel } from '../../types';
import { FlashcardViewer } from './FlashcardViewer';
import { QuizViewer } from './QuizViewer';
import { shareService } from '../../services/shareService';
import { useNotification } from '../../contexts/NotificationContext';
import { geminiService } from '../../services/geminiService';
import { uploadQuestionImage } from '../../services/storageService';
import { useAuth } from '../../contexts/AuthContext';
import { ForumShareButton } from '../forum/ForumShareButton';

const InteractiveQuizPlayer = React.lazy(() => import('./InteractiveQuizPlayer').then(m => ({ default: m.InteractiveQuizPlayer })));

type DifferentiatedVersion = { profileName: string; questions: AssessmentQuestion[] };

interface GeneratedAssessmentProps {
  material: AIGeneratedAssessment;
  onSaveQuestion?: (q: AssessmentQuestion) => void;
}

const convertToStandardLatex = (text: string): string => {
    return text.replace(/\\\\/g, '\\');
};

const cognitiveLevelConfig: Record<string, { label: string; color: string; }> = {
    Remembering: { label: 'Помнење', color: 'bg-gray-100 text-gray-800' },
    Understanding: { label: 'Разбирање', color: 'bg-blue-100 text-blue-800' },
    Applying: { label: 'Примена', color: 'bg-green-100 text-green-800' },
    Analyzing: { label: 'Анализа', color: 'bg-yellow-100 text-yellow-800' },
    Evaluating: { label: 'Евалуација', color: 'bg-purple-100 text-purple-800' },
    Creating: { label: 'Креирање', color: 'bg-pink-100 text-pink-800' },
};

const CHART_BUILDER_TYPES: ChartType[] = ['bar', 'pie', 'line', 'histogram', 'scatter', 'stacked-bar', 'frequency-polygon'];

const QuestionList: React.FC<{
    questions: AssessmentQuestion[];
    isEditing: boolean;
    handleQuestionFieldChange: (qIndex: number, field: keyof AssessmentQuestion, value: string) => void;
    handleOptionChange: (qIndex: number, optIndex: number, value: string) => void;
    onSaveQuestion?: (q: AssessmentQuestion) => void;
    onVisualize?: (idx: number, questionText: string) => Promise<void>;
    onDeleteImage?: (idx: number) => void;
    onRegenerateImage?: (idx: number, customPrompt: string) => Promise<void>;
    visualizingIdx?: number | null;
    onChartChange?: (idx: number, chartData: AssessmentQuestion['chartData'], chartConfig: AssessmentQuestion['chartConfig']) => void;
    onUploadImage?: (idx: number, file: File) => Promise<void>;
}> = ({ questions, isEditing, handleQuestionFieldChange, handleOptionChange, onSaveQuestion, onVisualize, onDeleteImage, onRegenerateImage, visualizingIdx, onChartChange, onUploadImage }) => {
    const [openPromptIdx, setOpenPromptIdx] = useState<number | null>(null);
    const [promptMap, setPromptMap] = useState<Record<number, string>>({});
    const [chartBuilderIdx, setChartBuilderIdx] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTargetIdx, setUploadTargetIdx] = useState<number | null>(null);
    const [chartBuilderTable, setChartBuilderTable] = useState<TableData>(DEFAULT_TABLE);
    const [chartBuilderType, setChartBuilderType] = useState<ChartType>('bar');
    const chartBuilderConfig: ChartConfig = { ...DEFAULT_CONFIG, type: chartBuilderType };
    const questionTypeIcons: Record<string, React.ComponentType<{className?: string}>> = {
        MULTIPLE_CHOICE: ICONS.myLessons,
        SHORT_ANSWER: ICONS.edit,
        TRUE_FALSE: ICONS.check,
        ESSAY: ICONS.generator,
        FILL_IN_THE_BLANK: ICONS.chatBubble,
    };
    
    return (
        <div>
            {questions?.map((q: AssessmentQuestion, index: number) => {
                const Icon = questionTypeIcons[q.type] || ICONS.lightbulb;
                const levelInfo = cognitiveLevelConfig[q.cognitiveLevel] || cognitiveLevelConfig['Understanding'];
                const isVisualizing = visualizingIdx === index;

                return (
                    <div key={q.id || index} className="mb-8 pb-6 border-b last:border-b-0 group">
                        <div className="font-semibold flex items-start gap-2 mb-2">
                            <Icon className="w-4 h-4 text-brand-secondary mt-1 flex-shrink-0" />
                            <div className="flex-1">
                                {isEditing ? (
                                    <textarea
                                        value={q.question}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleQuestionFieldChange(index, 'question', e.target.value)}
                                        className="w-full p-2 border rounded-md"
                                        rows={2}
                                    />
                                ) : (
                                    <span className="text-lg text-gray-900">{index + 1}. <MathRenderer text={q.question} /></span>
                                )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0 no-print">
                                {!isEditing && !q.imageUrl && onVisualize && (
                                    <button
                                        onClick={() => onVisualize(index, q.question)}
                                        disabled={isVisualizing}
                                        title="Визуелизирај со AI"
                                        className="p-1.5 text-gray-300 hover:text-amber-600 transition opacity-0 group-hover:opacity-100"
                                    >
                                        {isVisualizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                                    </button>
                                )}
                                {!isEditing && !q.imageUrl && onUploadImage && (
                                    <button
                                        type="button"
                                        onClick={() => { setUploadTargetIdx(index); fileInputRef.current?.click(); }}
                                        disabled={isVisualizing}
                                        title="Прикачи своја слика"
                                        className="p-1.5 text-gray-300 hover:text-violet-600 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    >
                                        <Upload className="w-4 h-4" />
                                    </button>
                                )}
                                {onSaveQuestion && (
                                    <button
                                        type="button"
                                        onClick={() => onSaveQuestion(q)}
                                        title="Зачувај во банка"
                                        className="p-1.5 text-gray-300 hover:text-indigo-600 transition flex-shrink-0"
                                    >
                                        <Bookmark className="w-4 h-4" />
                                    </button>
                                )}
                                {!isEditing && !q.chartData && onChartChange && (
                                    <button
                                        type="button"
                                        onClick={() => { setChartBuilderIdx(index); setChartBuilderTable(DEFAULT_TABLE); setChartBuilderType('bar'); }}
                                        title="Додади DataViz График кон ова прашање"
                                        className="p-1.5 text-gray-300 hover:text-teal-600 transition opacity-0 group-hover:opacity-100 flex-shrink-0"
                                    >
                                        <BarChart2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex flex-col md:flex-row gap-6 ml-8">
                            <div className="flex-1">
                                {q.type === 'MULTIPLE_CHOICE' && q.options && (
                                    <ul className={`list-['A)_'] list-inside space-y-2`}>
                                        {q.options.map((opt: string, i: number) => (
                                            <li key={`q${index}-opt${i}`} className="flex items-center text-gray-700">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={opt}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleOptionChange(index, i, e.target.value)}
                                                        className="w-full text-sm p-1 border-b"
                                                    />
                                                ) : (
                                                    <MathRenderer text={opt} />
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                 {(q.type === 'SHORT_ANSWER' || q.type === 'FILL_IN_THE_BLANK' || q.type === 'ESSAY') && !isEditing && (
                                    <div className="h-16 border-b-2 border-dotted border-gray-400"></div>
                                )}
                                
                                <div className={`p-2 rounded-md mt-4 no-print ${isEditing ? 'bg-gray-50' : 'bg-gray-100/50 border border-gray-100'}`}>
                                    <span className="font-bold text-xs uppercase tracking-wider text-gray-500 block mb-1">Точен одговор:</span>
                                    {isEditing ? (
                                        <input 
                                            type="text"
                                            value={q.answer}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuestionFieldChange(index, 'answer', e.target.value)}
                                            className="w-full text-sm p-1 border-b bg-transparent"
                                        />
                                    ) : (
                                        <span className="text-sm font-medium text-brand-primary"><MathRenderer text={q.answer} /></span>
                                    )}
                                </div>

                                {isEditing ? (
                                    <div className="mt-4">
                                        <span className="font-bold text-xs uppercase tracking-wider text-gray-500 block mb-1">Решение чекор-по-чекор:</span>
                                        <textarea 
                                            value={q.solution || ''}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleQuestionFieldChange(index, 'solution', e.target.value)}
                                            className="w-full p-2 border rounded-md text-sm mt-1"
                                            rows={3}
                                            placeholder="Внесете детално решение..."
                                        />
                                    </div>
                                ) : q.solution && (
                                    <div className="mt-4 p-3 bg-blue-50/50 border-l-4 border-blue-400 text-sm rounded-r-lg">
                                        <span className="font-bold text-xs uppercase tracking-wider text-blue-600 block mb-1">Решение чекор-по-чекор:</span>
                                        <div className="text-gray-700 italic">
                                            <MathRenderer text={q.solution} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {q.imageUrl && (
                                <div className="md:w-64 flex-shrink-0 animate-in fade-in zoom-in duration-500">
                                    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white relative group/img">
                                        <img src={q.imageUrl} alt={`Визуелизација за прашање ${index + 1}`} className="w-full h-auto" />
                                        {onDeleteImage && (
                                            <button
                                                type="button"
                                                onClick={() => { onDeleteImage(index); setOpenPromptIdx(null); }}
                                                title="Избриши илустрација"
                                                className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity shadow hover:bg-red-600"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                        <div className="p-1.5 bg-gray-50 border-t">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-400 italic">AI Илустрација</span>
                                                {onRegenerateImage && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenPromptIdx(openPromptIdx === index ? null : index)}
                                                        title="Промени со наоки"
                                                        className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-0.5"
                                                    >
                                                        <RefreshCw className="w-2.5 h-2.5" /> Промени
                                                    </button>
                                                )}
                                            </div>
                                            {openPromptIdx === index && onRegenerateImage && (
                                                <div className="mt-1.5 flex flex-col gap-1">
                                                    <textarea
                                                        value={promptMap[index] ?? ''}
                                                        onChange={e => setPromptMap(pm => ({ ...pm, [index]: e.target.value }))}
                                                        placeholder="Опис за нова илустрација..."
                                                        className="w-full text-xs p-1.5 border rounded resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                        rows={2}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            onRegenerateImage(index, promptMap[index] || q.question);
                                                            setOpenPromptIdx(null);
                                                        }}
                                                        disabled={visualizingIdx === index}
                                                        className="text-xs bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 justify-center"
                                                    >
                                                        {visualizingIdx === index && <Loader2 className="w-3 h-3 animate-spin" />}
                                                        Регенерирај
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            {q.chartData && (
                                <div className="md:w-72 flex-shrink-0 animate-in fade-in zoom-in duration-500">
                                    <div className="rounded-xl overflow-hidden border border-teal-200 shadow-sm bg-white">
                                        <div className="p-3">
                                            <ChartPreview
                                                data={q.chartData as TableData}
                                                config={{ ...DEFAULT_CONFIG, type: (q.chartConfig?.type as ChartType) ?? 'bar', ...q.chartConfig } as ChartConfig}
                                            />
                                        </div>
                                        <div className="px-3 py-1.5 bg-teal-50 border-t border-teal-100 flex items-center justify-between">
                                            <span className="text-[10px] text-teal-700 font-bold flex items-center gap-1">
                                                <BarChart2 className="w-3 h-3" /> DataViz График
                                            </span>
                                            {onChartChange && (
                                                <button type="button"
                                                    onClick={() => onChartChange(index, undefined, undefined)}
                                                    title="Отстрани график"
                                                    className="text-[10px] text-red-400 hover:text-red-600 font-medium flex items-center gap-0.5 no-print"
                                                >
                                                    <X className="w-2.5 h-2.5" /> Отстрани
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {chartBuilderIdx === index && (
                            <div className="mt-3 ml-6 p-4 border-2 border-teal-300 rounded-xl bg-teal-50/60 space-y-3 no-print">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-black text-teal-800 flex items-center gap-2">
                                        <BarChart2 className="w-4 h-4" /> Додади DataViz График
                                    </p>
                                    <button type="button" onClick={() => setChartBuilderIdx(null)} title="Откажи" aria-label="Откажи" className="p-1 text-gray-400 hover:text-red-500 transition">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {CHART_BUILDER_TYPES.map(ct => (
                                        <button key={ct} type="button" onClick={() => setChartBuilderType(ct)}
                                            className={`px-2 py-1 text-[11px] font-bold rounded-lg border-2 transition ${
                                                chartBuilderType === ct ? 'border-teal-500 bg-teal-100 text-teal-800' : 'border-gray-200 bg-white text-gray-600 hover:border-teal-300'
                                            }`}
                                        >{ct}</button>
                                    ))}
                                </div>
                                <div className="bg-white rounded-lg border border-gray-200 p-2">
                                    <DataTable data={chartBuilderTable} onChange={setChartBuilderTable} />
                                </div>
                                <div className="bg-white rounded-lg border border-gray-200 p-3">
                                    <ChartPreview data={chartBuilderTable} config={chartBuilderConfig} />
                                </div>
                                <div className="flex gap-2">
                                    <button type="button"
                                        onClick={() => {
                                            if (onChartChange) onChartChange(index, chartBuilderTable, { type: chartBuilderType });
                                            setChartBuilderIdx(null);
                                        }}
                                        className="flex-1 bg-teal-600 text-white py-2 rounded-xl text-sm font-black hover:bg-teal-700 transition"
                                    >
                                        ✓ Зачувај График во Прашањето
                                    </button>
                                    <button type="button" onClick={() => setChartBuilderIdx(null)}
                                        className="px-4 bg-gray-100 text-gray-600 py-2 rounded-xl text-sm font-bold hover:bg-gray-200 transition">
                                        Откажи
                                    </button>
                                </div>
                            </div>
                        )}

                        {!isEditing && (
                            <div className="ml-8 mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] no-print">
                                <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${levelInfo.color}`}>{levelInfo.label}</span>
                                {q.difficulty_level && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Тежина: {q.difficulty_level}</span>}
                                {q.concept_evaluated && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Поим: {q.concept_evaluated}</span>}
                            </div>
                        )}
                    </div>
                );
            })}
            {/* Hidden file input for teacher image upload — shared across all questions */}
            {onUploadImage && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    aria-label="Прикачи слика за прашање"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && uploadTargetIdx !== null) {
                            onUploadImage(uploadTargetIdx, file);
                        }
                        e.target.value = '';
                        setUploadTargetIdx(null);
                    }}
                />
            )}
        </div>
    );
};


export const GeneratedAssessment: React.FC<GeneratedAssessmentProps> = ({ material, onSaveQuestion }) => {
    const [editableMaterial, setEditableMaterial] = useState<AIGeneratedAssessment>(material);
    const [isEditing, setIsEditing] = useState(false);
    const [showFlashcards, setShowFlashcards] = useState(false);
    const [showQuiz, setShowQuiz] = useState(false);
    const [isPlayingQuiz, setIsPlayingQuiz] = useState(false);
    const [activeTab, setActiveTab] = useState('standard');
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const [visualizingIdx, setVisualizingIdx] = useState<number | null>(null);
    const [isBatchVisualizing, setIsBatchVisualizing] = useState(false);
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const { addNotification } = useNotification();
    const { firebaseUser } = useAuth();

    const handleUploadImage = async (idx: number, file: File) => {
        if (!firebaseUser?.uid) {
            addNotification('Мора да бидете логирани за да прикачите слика.', 'warning');
            return;
        }
        setVisualizingIdx(idx);
        try {
            const url = await uploadQuestionImage(file, firebaseUser.uid);
            setEditableMaterial(prev => {
                const setImage = (qs: AssessmentQuestion[]) => {
                    const next = [...qs];
                    next[idx] = { ...next[idx], imageUrl: url };
                    return next;
                };
                if (activeTab === 'standard') return { ...prev, questions: setImage(prev.questions) };
                return {
                    ...prev,
                    differentiatedVersions: prev.differentiatedVersions?.map(v =>
                        v.profileName === activeTab ? { ...v, questions: setImage(v.questions) } : v
                    ) || [],
                };
            });
            addNotification('Сликата е успешно прикачена!', 'success');
        } catch {
            addNotification('Грешка при прикачување на сликата.', 'error');
        } finally {
            setVisualizingIdx(null);
        }
    };

    const handleVisualize = async (idx: number, questionText: string) => {
        setVisualizingIdx(idx);
        try {
            const result = await geminiService.generateIllustration(`Mathematical educational illustration for this problem: ${questionText}. Simple, clear, whiteboard style.`);
            
            setEditableMaterial(prev => {
                if (activeTab === 'standard') {
                    const newQuestions = [...prev.questions];
                    newQuestions[idx] = { ...newQuestions[idx], imageUrl: result.imageUrl };
                    return { ...prev, questions: newQuestions };
                }
                const newVersions = prev.differentiatedVersions?.map(v => {
                    if (v.profileName === activeTab) {
                        const newQuestions = [...v.questions];
                        newQuestions[idx] = { ...newQuestions[idx], imageUrl: result.imageUrl };
                        return { ...v, questions: newQuestions };
                    }
                    return v;
                }) || [];
                return { ...prev, differentiatedVersions: newVersions };
            });

            addNotification('Илустрацијата е успешно генерирана!', 'success');
        } catch (error) {
            console.error('Visualization error:', error);
            addNotification('Грешка при генерирање на илустрацијата.', 'error');
        } finally {
            setVisualizingIdx(null);
        }
    };

    const handleDeleteImage = (idx: number) => {
        setEditableMaterial(prev => {
            const clearImage = (qs: AssessmentQuestion[]) => {
                const next = [...qs];
                next[idx] = { ...next[idx], imageUrl: undefined };
                return next;
            };
            if (activeTab === 'standard') return { ...prev, questions: clearImage(prev.questions) };
            return {
                ...prev,
                differentiatedVersions: prev.differentiatedVersions?.map(v =>
                    v.profileName === activeTab ? { ...v, questions: clearImage(v.questions) } : v
                ) || [],
            };
        });
    };

    const handleRegenerateImage = async (idx: number, customPrompt: string) => {
        setVisualizingIdx(idx);
        try {
            const result = await geminiService.generateIllustration(customPrompt);
            setEditableMaterial(prev => {
                const setImage = (qs: AssessmentQuestion[]) => {
                    const next = [...qs];
                    next[idx] = { ...next[idx], imageUrl: result.imageUrl };
                    return next;
                };
                if (activeTab === 'standard') return { ...prev, questions: setImage(prev.questions) };
                return {
                    ...prev,
                    differentiatedVersions: prev.differentiatedVersions?.map(v =>
                        v.profileName === activeTab ? { ...v, questions: setImage(v.questions) } : v
                    ) || [],
                };
            });
            addNotification('Илустрацијата е успешно регенерирана!', 'success');
        } catch {
            addNotification('Грешка при регенерирање на илустрацијата.', 'error');
        } finally {
            setVisualizingIdx(null);
        }
    };

    const handleBatchVisualize = async (indicesOverride?: number[]) => {
        const questions = activeTab === 'standard'
            ? editableMaterial.questions
            : (editableMaterial.differentiatedVersions?.find(v => v.profileName === activeTab)?.questions || []);

        const indicesToGen = indicesOverride ?? questions
            .map((q, i) => (!q.imageUrl ? i : -1))
            .filter(i => i !== -1);

        if (indicesToGen.length === 0) {
            if (!indicesOverride) addNotification('Сите прашања веќе имаат илустрации.', 'info');
            return;
        }

        setIsBatchVisualizing(true);
        setIsActionsMenuOpen(false);
        if (!indicesOverride) addNotification(`Започнува паралелно генерирање на ${indicesToGen.length} илустрации...`, 'info');

        try {
            await Promise.all(indicesToGen.map(idx => handleVisualize(idx, questions[idx].question)));
            if (!indicesOverride) addNotification('Сите илустрации се успешно генерирани!', 'success');
        } catch {
            addNotification('Дел од илустрациите не беа генерирани.', 'warning');
        } finally {
            setIsBatchVisualizing(false);
        }
    };

    // Auto-generate images for questions that contain math formulas (non-blocking)
    const HAS_MATH = /\$[\s\S]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/;
    useEffect(() => {
        const mathIndices = editableMaterial.questions
            .map((q, i) => (!q.imageUrl && HAS_MATH.test(q.question) ? i : -1))
            .filter(i => i !== -1);
        if (mathIndices.length > 0) {
            handleBatchVisualize(mathIndices);
        }
    // Run once when material first loads — intentional dep on material.questions identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [material]);


    useEffect(() => {
        setEditableMaterial(material);
        setIsEditing(false);
        setActiveTab('standard');
    }, [material]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
                setIsActionsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditableMaterial((prev: AIGeneratedAssessment) => ({ ...prev, title: e.target.value }));
    };
    
    const handleQuestionFieldChangeForVersion = (versionName: string, qIndex: number, field: keyof AssessmentQuestion, value: string) => {
        setEditableMaterial((prev: AIGeneratedAssessment) => {
            if (versionName === 'standard') {
                const newQuestions = [...prev.questions];
                newQuestions[qIndex] = { ...newQuestions[qIndex], [field]: value };
                return { ...prev, questions: newQuestions };
            }
            const newVersions = prev.differentiatedVersions?.map((v: DifferentiatedVersion) => {
                if (v.profileName === versionName) {
                    const newQuestions = [...v.questions];
                    newQuestions[qIndex] = { ...newQuestions[qIndex], [field]: value };
                    return { ...v, questions: newQuestions };
                }
                return v;
            }) || [];
            return { ...prev, differentiatedVersions: newVersions };
        });
    };

    const handleChartChangeForVersion = (versionName: string, qIndex: number, chartData: AssessmentQuestion['chartData'], chartConfig: AssessmentQuestion['chartConfig']) => {
        setEditableMaterial((prev: AIGeneratedAssessment) => {
            if (versionName === 'standard') {
                const newQuestions = [...prev.questions];
                newQuestions[qIndex] = { ...newQuestions[qIndex], chartData, chartConfig };
                return { ...prev, questions: newQuestions };
            }
            const newVersions = prev.differentiatedVersions?.map((v: DifferentiatedVersion) => {
                if (v.profileName === versionName) {
                    const newQ = [...v.questions];
                    newQ[qIndex] = { ...newQ[qIndex], chartData, chartConfig };
                    return { ...v, questions: newQ };
                }
                return v;
            }) || [];
            return { ...prev, differentiatedVersions: newVersions };
        });
    };

    const handleOptionChangeForVersion = (versionName: string, qIndex: number, optIndex: number, value: string) => {
        setEditableMaterial((prev: AIGeneratedAssessment) => {
            const updateOptions = (questions: AssessmentQuestion[]) => {
                const newQuestions = [...questions];
                const oldQuestion = newQuestions[qIndex];
                const newOptions = [...(oldQuestion.options || [])];
                newOptions[optIndex] = value;
                newQuestions[qIndex] = { ...oldQuestion, options: newOptions };
                return newQuestions;
            };

            if (versionName === 'standard') {
                return { ...prev, questions: updateOptions(prev.questions) };
            }
            
            const newVersions = prev.differentiatedVersions?.map((v: DifferentiatedVersion) => 
                v.profileName === versionName ? { ...v, questions: updateOptions(v.questions) } : v
            ) || [];

            return { ...prev, differentiatedVersions: newVersions };
        });
    };
    
    const handleSaveEdit = () => setIsEditing(false);

    const handleCancelEdit = () => {
        setEditableMaterial(material);
        setIsEditing(false);
    };

    const handleExport = async (format: 'md' | 'tex' | 'pdf' | 'doc' | 'download-doc' | 'clipboard') => {
        setIsActionsMenuOpen(false);
        if (format === 'pdf') {
            if (!contentRef.current) return;
            setIsPdfLoading(true);
            try {
                const filename = editableMaterial.title.replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_').toLowerCase() || 'тест';
                await downloadAsPdf(contentRef.current, filename);
            } finally {
                setIsPdfLoading(false);
            }
            return;
        }

        const filename = `${editableMaterial.title.replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_').toLowerCase()}`;
        let content = '';
        let mimeType = 'text/plain;charset=utf-8';
        let extension = format;
        
        const formatVersionForText = (title: string, questions: AssessmentQuestion[], selfAssessment?: string[]) => {
            let textContent = `${title}\n\n`;
            questions.forEach((q, i) => {
                textContent += `${i + 1}. ${q.question}\n`;
                if (q.options) textContent += q.options.map(o => `   - ${o}`).join('\n') + '\n';
                textContent += `Одговор: ${q.answer}\n\n`;
            });
            if (selfAssessment && selfAssessment.length > 0) {
                textContent += `Прашања за самооценување:\n${selfAssessment.map((sq, i) => `${i+1}. ${sq}`).join('\n')}\n\n`;
            }
            return textContent;
        };

        content += formatVersionForText('Стандардна верзија', editableMaterial.questions, editableMaterial.selfAssessmentQuestions);
        editableMaterial.differentiatedVersions?.forEach((v: DifferentiatedVersion) => {
            content += '\n---\n';
            content += formatVersionForText(`Верзија за ${v.profileName}`, v.questions);
        });

        if (format === 'clipboard') {
            navigator.clipboard.writeText(convertToStandardLatex(content)).then(() => addNotification('Тестот е копиран како обичен текст.', 'success')).catch(() => addNotification('Грешка при копирање.', 'error'));
            return;
        }

        if (format === 'doc' || format === 'download-doc') {
            const printableElement = document.getElementById('full-printable-assessment');
            if (!printableElement) {
                addNotification('Грешка: Содржината за извоз не е пронајдена.', 'error');
                return;
            }
            const renderedHtml = printableElement.innerHTML;

            const fullHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
                    <style>
                        body { font-family: 'Segoe UI', Calibri, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; }
                        h1, h2, h3, h4 { color: #0D47A1; }
                        .katex { font-size: 1.1em !important; }
                        .mb-4 { margin-bottom: 1rem; }
                        .pb-4 { padding-bottom: 1rem; }
                        .border-b { border-bottom: 1px solid #eee; }
                        ul { list-style-type: none; padding-left: 20px; }
                        li { margin-bottom: 8px; }
                    </style>
                </head>
                <body>
                    <div style="max-width: 800px; margin: 0 auto;">
                        ${renderedHtml}
                    </div>
                </body>
                </html>
            `;
            
            if (format === 'download-doc') {
                const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.doc`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                return;
            }

            try {
                const blob = new Blob([fullHtml], { type: 'text/html' });
                const clipboardItem = new ClipboardItem({ 'text/html': blob });
                navigator.clipboard.write([clipboardItem]).then(() => addNotification('Тестот е копиран со форматирање за Word.', 'success')).catch(() => addNotification('Грешка при копирање.', 'error'));
            } catch (error) {
                addNotification('Копирањето со форматирање не е поддржано.', 'error');
            }
            return;
        } else { // md, tex
            content = convertToStandardLatex(content);
            if(format === 'md') mimeType = 'text/markdown;charset=utf-8';
            if(format === 'tex') mimeType = 'application/x-tex;charset=utf-8';
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (material.error) {
        return <p className="text-red-500">{material.error}</p>;
    }
    
    const levelLabels: Record<DifferentiationLevel, string> = {
        standard: 'Стандардна верзија',
        support: 'Верзија за поддршка',
        advanced: 'Верзија за напредни ученици',
    };

    const levelColors: Record<DifferentiationLevel, string> = {
        standard: 'bg-gray-100 text-gray-800',
        support: 'bg-green-100 text-green-800',
        advanced: 'bg-purple-100 text-purple-800',
    };
    
    const hasDifferentiatedVersions = editableMaterial.differentiatedVersions && editableMaterial.differentiatedVersions.length > 0;
    const currentQuestions = activeTab === 'standard' 
        ? editableMaterial.questions 
        : editableMaterial.differentiatedVersions?.find((v: DifferentiatedVersion) => v.profileName === activeTab)?.questions || [];

    const selfAssessmentSection = (questions?: string[]) => {
        if (!questions || questions.length === 0) return null;
        return (
            <div className="mt-6 pt-4 border-t">
                <h4 className="text-lg font-semibold text-brand-secondary mb-2">Прашања за самооценување</h4>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                    {questions.map((sq, i) => (
                        <li key={`selfassess-${i}`}>
                            <MathRenderer text={sq} />
                            <div className="h-12 border-b-2 border-dotted border-gray-400 mt-2"></div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <>
        {/* Truncation warning — shown when AI hit token limits and response was structurally recovered */}
        {editableMaterial._isPartial && (
            <div className="mt-4 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-300 rounded-xl text-sm text-amber-800 no-print">
                <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                <span>
                    <strong>Делумен одговор</strong> — AI го достигна лимитот на токени и материјалот може да биде некомплетен.
                    Намалете го бројот на прашања или генерирајте повторно.
                </span>
            </div>
        )}
        <Card id="printable-area" className="mt-6 border-l-4 border-brand-accent" ref={contentRef}>
            <div className="flex justify-between items-start mb-4">
                <div className='flex-1 pr-4'>
                    {isEditing ? (
                        <input 
                            type="text" 
                            value={editableMaterial.title}
                            onChange={handleTitleChange}
                            className="text-2xl font-bold w-full p-1 border rounded-md"
                        />
                    ) : (
                        <h3 className="text-2xl font-bold">{editableMaterial.title}</h3>
                    )}
                    {!hasDifferentiatedVersions && editableMaterial.differentiationLevel && editableMaterial.differentiationLevel !== 'standard' && (
                        <span className={`mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full inline-block ${levelColors[editableMaterial.differentiationLevel]}`}>
                            {levelLabels[editableMaterial.differentiationLevel]}
                        </span>
                    )}
                </div>
                <div className="flex space-x-2 no-print">
                    {isEditing ? (
                        <>
                            <button type="button" onClick={handleCancelEdit} className="flex items-center bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm">
                                <ICONS.close className="w-5 h-5 mr-1" /> Откажи
                            </button>
                             <button type="button" onClick={handleSaveEdit} className="flex items-center bg-green-600 text-white px-3 py-2 rounded-lg shadow hover:bg-green-700 transition-colors text-sm">
                                <ICONS.check className="w-5 h-5 mr-1" /> Зачувај
                            </button>
                        </>
                    ) : (
                         <div className="relative" ref={actionsMenuRef}>
                            <button type="button" onClick={() => setIsActionsMenuOpen((prev: boolean) => !prev)} className="flex items-center gap-2 bg-brand-primary text-white px-3 py-2 rounded-lg shadow hover:bg-brand-secondary">
                                <ICONS.menu className="w-5 h-5" />
                                Акции
                                <ICONS.chevronDown className={`w-4 h-4 transition-transform ${isActionsMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isActionsMenuOpen && (
                                <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 animate-fade-in-up">
                                    <div className="py-1">
                                         <button type="button" onClick={() => { setIsEditing(true); setIsActionsMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.edit className="w-5 h-5 mr-3" /> Уреди го тестот
                                        </button>
                                        <button type="button" onClick={() => { setShowFlashcards(true); setIsActionsMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.flashcards className="w-5 h-5 mr-3" /> Отвори флеш-картички
                                        </button>
                                        <button type="button" onClick={() => { setShowQuiz(true); setIsActionsMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.quiz className="w-5 h-5 mr-3" /> Отвори квиз (Преглед)
                                        </button>
                                        <button type="button" onClick={() => { setIsPlayingQuiz(true); setIsActionsMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.play className="w-5 h-5 mr-3" /> Интерактивен квиз (Игра)
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => handleBatchVisualize()}
                                            disabled={isBatchVisualizing}
                                            className="w-full text-left flex items-center px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 font-bold disabled:opacity-50"
                                        >
                                            {isBatchVisualizing ? (
                                                <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                            ) : (
                                                <ICONS.sparkles className="w-5 h-5 mr-3" />
                                            )}
                                            Генерирај илустрации за сите
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const shareData = shareService.generateQuizShareData({ 
                                                    title: editableMaterial.title, 
                                                    questions: activeTab === 'standard' ? editableMaterial.questions : (editableMaterial.differentiatedVersions?.find(v => v.profileName === activeTab)?.questions || editableMaterial.questions) 
                                                });
                                                const shareUrl = `${window.location.origin}/#/quiz/${shareData}`;
                                                navigator.clipboard.writeText(shareUrl).then(() => addNotification('Линкот за квизот е копиран!', 'success'));
                                                setIsActionsMenuOpen(false);
                                            }} 
                                            className="w-full text-left flex items-center px-4 py-2 text-sm text-brand-primary hover:bg-brand-bg font-medium"
                                        >
                                            <ICONS.share className="w-5 h-5 mr-3" /> Сподели линк за ученици
                                        </button>
                                        <div className="border-t my-1"></div>
                                        <button type="button" onClick={() => handleExport('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.download className="w-5 h-5 mr-3" /> Сними како Markdown (.md)
                                        </button>
                                        <button type="button" onClick={() => handleExport('tex')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.download className="w-5 h-5 mr-3" /> Сними како LaTeX (.tex)
                                        </button>
                                        <button type="button" onClick={() => handleExport('download-doc')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.download className="w-5 h-5 mr-3" /> Експортирај во Word (.doc)
                                        </button>
                                        <button type="button" onClick={() => handleExport('doc')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.copy className="w-5 h-5 mr-3" /> Копирај за Word (форматирано)
                                        </button>
                                        <button type="button" onClick={() => handleExport('pdf')} disabled={isPdfLoading} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                                            {isPdfLoading ? <Loader2 className="w-5 h-5 mr-3 animate-spin" /> : <ICONS.printer className="w-5 h-5 mr-3" />} {isPdfLoading ? 'Генерирање PDF…' : 'Преземи PDF'}
                                        </button>
                                         <button type="button" onClick={() => handleExport('clipboard')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.edit className="w-5 h-5 mr-3" /> Копирај како обичен текст
                                        </button>
                                        <div className="border-t border-gray-100 my-1" />
                                        <div className="px-2 py-1">
                                            <ForumShareButton
                                                prefillTitle={editableMaterial.title}
                                                prefillBody={`Споделувам: „${editableMaterial.title}" — генерирано со AI. Мислења, подобрувања?`}
                                                prefillCategory="resource"
                                                className="w-full justify-start !px-2 !py-2 !text-sm !border-0 !bg-transparent !text-indigo-600 hover:!bg-indigo-50 !rounded-md"
                                                label="Сподели во Форум"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="hidden print:block mb-4">
                <h3 className="text-xl font-bold">{editableMaterial.title}</h3>
                <p>Име и презиме: ____________________________</p>
                <p>Дата: ____________</p>
            </div>
            {editableMaterial.alignment_goal && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 no-print">
                    <strong>Цел на тестот:</strong> {editableMaterial.alignment_goal}
                </div>
            )}
            
            {hasDifferentiatedVersions && (
                <div className="border-b border-gray-200 mb-4 no-print">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        <button type="button" onClick={() => setActiveTab('standard')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'standard' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Стандардна верзија</button>
                        {editableMaterial.differentiatedVersions?.map((v: DifferentiatedVersion) => (
                            <button type="button" key={v.profileName} onClick={() => setActiveTab(v.profileName)} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === v.profileName ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>За {v.profileName}</button>
                        ))}
                    </nav>
                </div>
            )}

            <div className="print:hidden">
                {material.illustrationUrl && (
                    <div className="mb-8 rounded-2xl overflow-hidden border-2 border-gray-100 shadow-sm bg-white">
                        <img src={material.illustrationUrl} alt="Контекстуална илустрација" className="w-full h-auto max-h-80 object-cover" />
                        <div className="p-3 bg-gray-50 flex items-center justify-between border-t border-gray-100">
                            <span className="text-xs text-gray-500 italic flex items-center gap-2">
                                <ICONS.sparkles className="w-3.5 h-3.5 text-amber-500" />
                                AI Генерирана контекстуална илустрација
                            </span>
                        </div>
                    </div>
                )}
                <QuestionList
                    questions={currentQuestions}
                    isEditing={isEditing}
                    handleQuestionFieldChange={(qIndex: number, field: keyof AssessmentQuestion, value: string) => handleQuestionFieldChangeForVersion(activeTab, qIndex, field, value)}
                    handleOptionChange={(qIndex: number, optIndex: number, value: string) => handleOptionChangeForVersion(activeTab, qIndex, optIndex, value)}
                    onSaveQuestion={onSaveQuestion}
                    onVisualize={handleVisualize}
                    onDeleteImage={handleDeleteImage}
                    onRegenerateImage={handleRegenerateImage}
                    visualizingIdx={visualizingIdx}
                    onChartChange={(qIndex, chartData, chartConfig) => handleChartChangeForVersion(activeTab, qIndex, chartData, chartConfig)}
                    onUploadImage={handleUploadImage}
                />
                {selfAssessmentSection(editableMaterial.selfAssessmentQuestions)}
            </div>

            {!showFlashcards && !showQuiz && !isPlayingQuiz && (
                <div className="hidden print:block" id="full-printable-assessment">
                    {/* Printable view */}
                    <h3 className="text-xl font-bold">{editableMaterial.title}</h3>
                    { hasDifferentiatedVersions ? (
                        <>
                            <h4 className="text-lg font-semibold mt-4">Стандардна верзија</h4>
                            <QuestionList questions={editableMaterial.questions} isEditing={false} handleQuestionFieldChange={()=>{}} handleOptionChange={()=>{}} />
                            {selfAssessmentSection(editableMaterial.selfAssessmentQuestions)}
                            {editableMaterial.differentiatedVersions?.map((v: DifferentiatedVersion) => (
                                <div key={v.profileName} className="mt-6 pt-6 border-t" style={{pageBreakBefore: 'always'}}>
                                    <h4 className="text-lg font-semibold">Верзија за: {v.profileName}</h4>
                                    <QuestionList questions={v.questions} isEditing={false} handleQuestionFieldChange={()=>{}} handleOptionChange={()=>{}} />
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            <QuestionList questions={editableMaterial.questions} isEditing={false} handleQuestionFieldChange={()=>{}} handleOptionChange={()=>{}} />
                            {selfAssessmentSection(editableMaterial.selfAssessmentQuestions)}
                        </>
                    )}
                </div>
            )}
        </Card>
        {showFlashcards && <FlashcardViewer questions={editableMaterial.questions} title={editableMaterial.title} onClose={() => setShowFlashcards(false)} />}
        {showQuiz && <QuizViewer questions={editableMaterial.questions} onClose={() => setShowQuiz(false)} />}
        {isPlayingQuiz && (
            <React.Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 text-white">Вчитување на квизот...</div>}>
                <InteractiveQuizPlayer questions={editableMaterial.questions} title={editableMaterial.title} onClose={() => setIsPlayingQuiz(false)} />
            </React.Suspense>
        )}
        </>
    );
};