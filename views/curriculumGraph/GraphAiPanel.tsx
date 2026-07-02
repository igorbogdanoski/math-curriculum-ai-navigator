import React from 'react';
import { ICONS } from '../../constants';
import type { EnrichedConcept } from './graphUtils';

interface AiAnalysisResult {
    bloomLevel: string;
    bloomDetails: string;
    misconceptions: string[];
    pedagogicalBridge: string;
    diagnosticQuestion: string;
}

interface GraphAiPanelProps {
    concept: EnrichedConcept;
    isLoading: boolean;
    error: string | null;
    result: AiAnalysisResult | null;
    onClose: () => void;
}

export function GraphAiPanel({ concept, isLoading, error, result, onClose }: GraphAiPanelProps) {
    return (
        <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex justify-center items-start pt-[8vh] sm:pt-[10vh] pb-8 p-4 overflow-y-auto w-full h-[100dvh]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col mb-auto animate-fade-in-up relative z-[1001]">
                <div className="bg-gradient-to-r from-green-500 to-teal-600 p-4 text-white flex justify-between items-center shrink-0 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-full"><ICONS.zap className="w-6 h-6 text-white" /></div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">AI Педагошки Анализатор</h3>
                            <p className="text-green-100 text-xs opacity-90">{concept.title}</p>
                        </div>
                    </div>
                    <button type="button" aria-label="Затвори AI анализатор" onClick={onClose}
                        className="text-white hover:text-green-200 transition-colors bg-white/10 hover:bg-white/20 p-1.5 rounded-full">
                        <ICONS.close className="w-5 h-5"/>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50 flex flex-col gap-4 text-left">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                            <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm text-gray-500 font-medium">
                                AI анализира когнитивни нивоа и мисконцепции за<br/>
                                <strong className="text-gray-700">{concept.title}</strong>...
                            </p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                            <ICONS.alertTriangle className="w-4 h-4 inline mr-2" />{error}
                        </div>
                    )}

                    {result && !isLoading && (
                        <>
                            <div className="bg-white p-4 rounded-xl border-l-4 border-blue-500 shadow-sm">
                                <h4 className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                                    <ICONS.activity className="w-4 h-4 text-blue-500"/> 🎯 Блумова таксономија — <span className="text-blue-600">{result.bloomLevel}</span>
                                </h4>
                                <p className="text-gray-700 text-sm pl-6 border-l-2 border-blue-100">{result.bloomDetails}</p>
                            </div>

                            <div className="bg-white p-4 rounded-xl border-l-4 border-red-500 shadow-sm">
                                <h4 className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                                    <ICONS.alertTriangle className="w-4 h-4 text-red-500"/> 🚧 Чести мисконцепции
                                </h4>
                                <ul className="space-y-1.5 pl-6 border-l-2 border-red-100">
                                    {result.misconceptions.map((m, i) => (
                                        <li key={i} className="text-gray-700 text-sm flex gap-2"><span className="text-red-400 font-bold flex-shrink-0">•</span>{m}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-white p-4 rounded-xl border-l-4 border-purple-500 shadow-sm">
                                <h4 className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                                    <ICONS.gitBranch className="w-4 h-4 text-purple-500 rotate-90"/> 🌉 Педагошки Мост
                                </h4>
                                <p className="text-gray-700 text-sm pl-6 border-l-2 border-purple-100">{result.pedagogicalBridge}</p>
                            </div>

                            <div className="bg-white p-4 rounded-xl border-l-4 border-orange-500 shadow-sm">
                                <h4 className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                                    <ICONS.zap className="w-4 h-4 text-orange-500"/> ⏱️ Блиц Дијагностика
                                </h4>
                                <p className="text-gray-700 font-medium text-sm pl-4 border-l-2 border-orange-200 italic bg-orange-50 py-3 pr-3 rounded-r-lg">
                                    {result.diagnosticQuestion}
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition-colors">
                        Затвори
                    </button>
                </div>
            </div>
        </div>
    );
}
