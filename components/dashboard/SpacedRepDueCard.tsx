import React, { useState } from 'react';
import { Brain, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { type DueForReviewConcept } from '../../hooks/useDailyBrief';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';

interface SpacedRepDueCardProps {
    due: DueForReviewConcept[];
}

export const SpacedRepDueCard: React.FC<SpacedRepDueCardProps> = ({ due }) => {
    const { openGeneratorPanel } = useGeneratorPanel();
    const [expanded, setExpanded] = useState(false);

    if (due.length === 0) return null;

    const shown = expanded ? due : due.slice(0, 3);
    const overdueCount = due.filter(d => d.daysOverdue > 0).length;

    const handleReview = (concept: DueForReviewConcept) => {
        openGeneratorPanel({
            selectedConcepts: concept.conceptId ? [concept.conceptId] : [],
            materialType: 'QUIZ',
            customInstruction: `ПОВТОРУВАЊЕ (Spaced Repetition): Концептот "${concept.title}" не бил проверуван ${concept.daysOverdue + 1} ден${concept.daysOverdue === 0 ? '' : 'а'}. Просечен резултат: ${concept.avg}%. Генерирај краток review квиз (5-7 прашања) со акцент на претходно слабите точки.`,
        });
    };

    const daysLabel = (d: DueForReviewConcept) => {
        if (d.daysOverdue === 0) return 'Денес';
        if (d.daysOverdue === 1) return '1 ден задоцнет';
        return `${d.daysOverdue} дена задоцнет`;
    };

    const urgencyColor = (d: DueForReviewConcept) => {
        if (d.daysOverdue >= 7) return 'text-red-600 bg-red-100';
        if (d.daysOverdue >= 3) return 'text-orange-600 bg-orange-100';
        return 'text-yellow-700 bg-yellow-100';
    };

    return (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4">
            <div className="flex items-start gap-3">
                <Brain className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Повторување (SM-2)</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            {overdueCount} концепт{overdueCount === 1 ? '' : 'и'} задоцнет{overdueCount === 1 ? '' : 'е'}
                        </span>
                    </div>

                    <p className="text-xs text-gray-500 mb-3">
                        Заборавањето трае — овие концепти треба review според SM-2 алгоритмот.
                    </p>

                    <div className="space-y-2">
                        {shown.map(concept => (
                            <div
                                key={concept.conceptId ?? concept.title}
                                className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-purple-100"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-slate-700 truncate">{concept.title}</p>
                                    <p className="text-xs text-gray-400">Просек: {concept.avg}% · {concept.lastQuizDate.toLocaleDateString('mk-MK')}</p>
                                </div>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${urgencyColor(concept)}`}>
                                    {daysLabel(concept)}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleReview(concept)}
                                    title="Генерирај review квиз"
                                    className="flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded-lg transition flex-shrink-0"
                                >
                                    Review
                                    <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {due.length > 3 && (
                        <button
                            type="button"
                            onClick={() => setExpanded(e => !e)}
                            className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold mt-2"
                        >
                            {expanded
                                ? <><ChevronUp className="w-3.5 h-3.5" />Прикажи помалку</>
                                : <><ChevronDown className="w-3.5 h-3.5" />Уште {due.length - 3} концепти</>}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
