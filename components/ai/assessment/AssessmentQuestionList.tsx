import React, { useState, useRef } from 'react';
import { Bookmark, Image as ImageIcon, Loader2, X, RefreshCw, BarChart2, Upload } from 'lucide-react';
import { ChartPreview, DEFAULT_CONFIG } from '../../dataviz/ChartPreview';
import type { ChartType, ChartConfig } from '../../dataviz/ChartPreview';
import { DataTable, DEFAULT_TABLE } from '../../dataviz/DataTable';
import type { TableData } from '../../dataviz/DataTable';
import { ICONS } from '../../../constants';
import { MathRenderer } from '../../common/MathRenderer';
import type { AssessmentQuestion, DokLevel } from '../../../types';
import { DokBadge } from '../../common/DokBadge';

export const cognitiveLevelConfig: Record<string, { label: string; color: string }> = {
    Remembering:   { label: 'Помнење',    color: 'bg-gray-100 text-gray-800'   },
    Understanding: { label: 'Разбирање',  color: 'bg-blue-100 text-blue-800'   },
    Applying:      { label: 'Примена',    color: 'bg-green-100 text-green-800'  },
    Analyzing:     { label: 'Анализа',    color: 'bg-yellow-100 text-yellow-800' },
    Evaluating:    { label: 'Евалуација', color: 'bg-purple-100 text-purple-800' },
    Creating:      { label: 'Креирање',   color: 'bg-pink-100 text-pink-800'   },
};

const CHART_BUILDER_TYPES: ChartType[] = ['bar', 'pie', 'line', 'histogram', 'scatter', 'stacked-bar', 'frequency-polygon'];

export interface AssessmentQuestionListProps {
    questions: AssessmentQuestion[];
    isEditing: boolean;
    handleQuestionFieldChange: (qIndex: number, field: keyof AssessmentQuestion, value: string) => void;
    handleOptionChange: (qIndex: number, optIndex: number, value: string) => void;
    onSaveQuestion?: (q: AssessmentQuestion) => void;
    onVisualize?: (idx: number, questionText: string) => Promise<void>;
    onDeleteImage?: (idx: number) => void;
    onRegenerateImage?: (idx: number, customPrompt: string) => Promise<void>;
    onRegenerateQuestion?: (idx: number) => Promise<void>;
    regeneratingQuestionIdx?: number | null;
    visualizingIdx?: number | null;
    onChartChange?: (idx: number, chartData: AssessmentQuestion['chartData'], chartConfig: AssessmentQuestion['chartConfig']) => void;
    onUploadImage?: (idx: number, file: File) => Promise<void>;
}

export const AssessmentQuestionList: React.FC<AssessmentQuestionListProps> = ({
    questions, isEditing, handleQuestionFieldChange, handleOptionChange,
    onSaveQuestion, onVisualize, onDeleteImage, onRegenerateImage,
    onRegenerateQuestion, regeneratingQuestionIdx, visualizingIdx,
    onChartChange, onUploadImage,
}) => {
    const [openPromptIdx, setOpenPromptIdx] = useState<number | null>(null);
    const [promptMap, setPromptMap] = useState<Record<number, string>>({});
    const [chartBuilderIdx, setChartBuilderIdx] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadTargetIdx, setUploadTargetIdx] = useState<number | null>(null);
    const [chartBuilderTable, setChartBuilderTable] = useState<TableData>(DEFAULT_TABLE);
    const [chartBuilderType, setChartBuilderType] = useState<ChartType>('bar');
    const chartBuilderConfig: ChartConfig = { ...DEFAULT_CONFIG, type: chartBuilderType };

    const questionTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
        MULTIPLE_CHOICE: ICONS.myLessons,
        SHORT_ANSWER:    ICONS.edit,
        TRUE_FALSE:      ICONS.check,
        ESSAY:           ICONS.generator,
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
                                {!isEditing && onRegenerateQuestion && (
                                    <button type="button" onClick={() => onRegenerateQuestion(index)} disabled={regeneratingQuestionIdx === index}
                                        title="Замени прашање со AI"
                                        className="p-1.5 text-gray-300 hover:text-indigo-500 transition opacity-0 group-hover:opacity-100">
                                        {regeneratingQuestionIdx === index ? <Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> : <RefreshCw className="w-4 h-4" />}
                                    </button>
                                )}
                                {!isEditing && !q.imageUrl && onVisualize && (
                                    <button onClick={() => onVisualize(index, q.question)} disabled={isVisualizing}
                                        title="Визуелизирај со AI"
                                        className="p-1.5 text-gray-300 hover:text-amber-600 transition opacity-0 group-hover:opacity-100">
                                        {isVisualizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                                    </button>
                                )}
                                {!isEditing && !q.imageUrl && onUploadImage && (
                                    <button type="button" onClick={() => { setUploadTargetIdx(index); fileInputRef.current?.click(); }}
                                        disabled={isVisualizing} title="Прикачи своја слика"
                                        className="p-1.5 text-gray-300 hover:text-violet-600 transition opacity-0 group-hover:opacity-100 flex-shrink-0">
                                        <Upload className="w-4 h-4" />
                                    </button>
                                )}
                                {onSaveQuestion && (
                                    <button type="button" onClick={() => onSaveQuestion(q)} title="Зачувај во банка"
                                        className="p-1.5 text-gray-300 hover:text-indigo-600 transition flex-shrink-0">
                                        <Bookmark className="w-4 h-4" />
                                    </button>
                                )}
                                {!isEditing && !q.chartData && onChartChange && (
                                    <button type="button"
                                        onClick={() => { setChartBuilderIdx(index); setChartBuilderTable(DEFAULT_TABLE); setChartBuilderType('bar'); }}
                                        title="Додади DataViz График кон ова прашање"
                                        className="p-1.5 text-gray-300 hover:text-teal-600 transition opacity-0 group-hover:opacity-100 flex-shrink-0">
                                        <BarChart2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 ml-8">
                            <div className="flex-1">
                                {q.type === 'MULTIPLE_CHOICE' && q.options && (
                                    <ul className="list-['A)_'] list-inside space-y-2">
                                        {q.options.map((opt: string, i: number) => (
                                            <li key={`q${index}-opt${i}`} className="flex items-center text-gray-700">
                                                {isEditing ? (
                                                    <input type="text" value={opt}
                                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleOptionChange(index, i, e.target.value)}
                                                        className="w-full text-sm p-1 border-b" />
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
                                        <input type="text" value={q.answer}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuestionFieldChange(index, 'answer', e.target.value)}
                                            className="w-full text-sm p-1 border-b bg-transparent" />
                                    ) : (
                                        <span className="text-sm font-medium text-brand-primary"><MathRenderer text={q.answer} /></span>
                                    )}
                                </div>

                                {isEditing ? (
                                    <div className="mt-4">
                                        <span className="font-bold text-xs uppercase tracking-wider text-gray-500 block mb-1">Решение чекор-по-чекор:</span>
                                        <textarea value={q.solution || ''}
                                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleQuestionFieldChange(index, 'solution', e.target.value)}
                                            className="w-full p-2 border rounded-md text-sm mt-1" rows={3}
                                            placeholder="Внесете детално решение..." />
                                    </div>
                                ) : q.solution && (
                                    <div className="mt-4 p-3 bg-blue-50/50 border-l-4 border-blue-400 text-sm rounded-r-lg">
                                        <span className="font-bold text-xs uppercase tracking-wider text-blue-600 block mb-1">Решение чекор-по-чекор:</span>
                                        <div className="text-gray-700 italic"><MathRenderer text={q.solution} /></div>
                                    </div>
                                )}
                            </div>

                            {q.imageUrl && (
                                <div className="md:w-64 flex-shrink-0 animate-in fade-in zoom-in duration-500">
                                    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white relative group/img">
                                        <img src={q.imageUrl} alt={`Визуелизација за прашање ${index + 1}`} className="w-full h-auto" />
                                        {onDeleteImage && (
                                            <button type="button" onClick={() => { onDeleteImage(index); setOpenPromptIdx(null); }}
                                                title="Избриши илустрација"
                                                className="absolute top-1.5 right-1.5 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity shadow hover:bg-red-600">
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                        <div className="p-1.5 bg-gray-50 border-t">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] text-gray-400 italic">AI Илустрација</span>
                                                {onRegenerateImage && (
                                                    <button type="button" onClick={() => setOpenPromptIdx(openPromptIdx === index ? null : index)}
                                                        title="Промени со наоки"
                                                        className="text-[10px] text-indigo-500 hover:text-indigo-700 font-medium flex items-center gap-0.5">
                                                        <RefreshCw className="w-2.5 h-2.5" /> Промени
                                                    </button>
                                                )}
                                            </div>
                                            {openPromptIdx === index && onRegenerateImage && (
                                                <div className="mt-1.5 flex flex-col gap-1">
                                                    <textarea value={promptMap[index] ?? ''}
                                                        onChange={e => setPromptMap(pm => ({ ...pm, [index]: e.target.value }))}
                                                        placeholder="Опис за нова илустрација..."
                                                        className="w-full text-xs p-1.5 border rounded resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                                        rows={2} />
                                                    <button type="button"
                                                        onClick={() => { onRegenerateImage(index, promptMap[index] || q.question); setOpenPromptIdx(null); }}
                                                        disabled={visualizingIdx === index}
                                                        className="text-xs bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 justify-center">
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
                                                <button type="button" onClick={() => onChartChange(index, undefined, undefined)}
                                                    title="Отстрани график"
                                                    className="text-[10px] text-red-400 hover:text-red-600 font-medium flex items-center gap-0.5 no-print">
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
                                    <p className="text-sm font-black text-teal-800 flex items-center gap-2"><BarChart2 className="w-4 h-4" /> Додади DataViz График</p>
                                    <button type="button" onClick={() => setChartBuilderIdx(null)} title="Откажи" aria-label="Откажи" className="p-1 text-gray-400 hover:text-red-500 transition">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {CHART_BUILDER_TYPES.map(ct => (
                                        <button key={ct} type="button" onClick={() => setChartBuilderType(ct)}
                                            className={`px-2 py-1 text-[11px] font-bold rounded-lg border-2 transition ${chartBuilderType === ct ? 'border-teal-500 bg-teal-100 text-teal-800' : 'border-gray-200 bg-white text-gray-600 hover:border-teal-300'}`}>
                                            {ct}
                                        </button>
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
                                        onClick={() => { if (onChartChange) onChartChange(index, chartBuilderTable, { type: chartBuilderType }); setChartBuilderIdx(null); }}
                                        className="flex-1 bg-teal-600 text-white py-2 rounded-xl text-sm font-black hover:bg-teal-700 transition">
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
                            <div className="ml-8 mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] no-print items-center">
                                <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ${levelInfo.color}`}>{levelInfo.label}</span>
                                {q.dokLevel && <DokBadge level={q.dokLevel as DokLevel} size="compact" />}
                                {q.difficulty_level && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Тежина: {q.difficulty_level}</span>}
                                {q.concept_evaluated && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Поим: {q.concept_evaluated}</span>}
                            </div>
                        )}
                    </div>
                );
            })}
            {onUploadImage && (
                <input ref={fileInputRef} type="file" accept="image/*"
                    aria-label="Прикачи слика за прашање" className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && uploadTargetIdx !== null) onUploadImage(uploadTargetIdx, file);
                        e.target.value = '';
                        setUploadTargetIdx(null);
                    }}
                />
            )}
        </div>
    );
};
