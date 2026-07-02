import React from 'react';
import type { Grade } from '../../types';
import { MASTERY_COLORS, FOCUS_COLOR, PRIOR_COLOR, FUTURE_COLOR, GRADE_COLORS, getRomanGrade } from './graphUtils';

interface GraphLegendProps {
    showMasteryOverlay: boolean;
    focusNodeId: string | null;
    curriculum: { grades: Grade[] } | null;
    isClustered: boolean;
}

export function GraphLegend({ showMasteryOverlay, focusNodeId, curriculum, isClustered }: GraphLegendProps) {
    return (
        <div className="absolute bottom-12 right-4 bg-white/95 p-4 rounded-lg shadow-xl border border-gray-200 text-xs max-w-xs backdrop-blur-sm z-10">
            <div className="font-bold mb-2 text-gray-800 text-sm border-b pb-1 flex justify-between items-center">
                <span>Легенда</span>
                {showMasteryOverlay && !focusNodeId && (
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                        🎯 Мастери
                    </span>
                )}
            </div>
            <div className="space-y-3">
                {showMasteryOverlay && !focusNodeId ? (
                    <div className="space-y-1.5 animate-fade-in">
                        {[
                            { color: MASTERY_COLORS.mastered,   label: '≥ 85% — Совладано' },
                            { color: MASTERY_COLORS.passing,    label: '70–84% — Задоволително' },
                            { color: MASTERY_COLORS.developing, label: '50–69% — Во развој' },
                            { color: MASTERY_COLORS.struggling, label: '< 50% — Потребна помош' },
                            { color: MASTERY_COLORS.noData,     label: 'Нема податоци', faded: true },
                        ].map(({ color, label, faded }) => (
                            <div key={color} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: color }} />
                                <span className={faded ? 'text-gray-500' : 'font-medium text-gray-700'}>{label}</span>
                            </div>
                        ))}
                        <p className="text-[10px] text-gray-400 mt-1 border-t pt-1">
                            Просечен % на твоите ученици по квиз
                        </p>
                    </div>
                ) : !focusNodeId ? (
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 animate-fade-in">
                        {(curriculum?.grades ?? []).map((g: Grade) => (
                            <div key={g.level} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm shadow-sm border border-gray-300" style={{ backgroundColor: GRADE_COLORS[g.level] ?? '#9E9E9E' }} />
                                <span>{g.level}. Одд. ({getRomanGrade(g.level)}){g.secondaryTrack ? ' ★' : ''}</span>
                            </div>
                        ))}
                        {isClustered && (
                            <div className="col-span-2 flex items-start gap-2 mt-2 border-t pt-2 text-gray-600">
                                <div className="mt-0.5" style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '10px solid gray' }} />
                                <span>Тематски кластер</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 animate-fade-in">
                        {[
                            { color: PRIOR_COLOR,  label: 'Предзнаење (Основа)', bold: false },
                            { color: FOCUS_COLOR,  label: 'Активен Фокус',       bold: true  },
                            { color: FUTURE_COLOR, label: 'Идни Знаења (Примена)', bold: false },
                        ].map(({ color, label, bold }) => (
                            <div key={color} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-sm border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
                                <span className={bold ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}>{label}</span>
                            </div>
                        ))}
                    </div>
                )}

                {focusNodeId && (
                    <div className="border-t pt-2 bg-orange-50 -mx-4 px-4 pb-2 -mb-4 rounded-b-lg text-[10px] text-gray-600 leading-tight mt-2">
                        <strong>Режим на Фокус:</strong> Прикажани се само поврзаните поими за да се олесни следењето на вертикалната прогресија.
                    </div>
                )}
            </div>
        </div>
    );
}
