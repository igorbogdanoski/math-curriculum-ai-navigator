import React from 'react';
import { TrendingDown, ArrowRight, CheckCircle } from 'lucide-react';
import { type WeakConcept } from '../../hooks/useDailyBrief';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';

interface FormativeNextStepCardProps {
    weakConcepts: WeakConcept[];
}

export const FormativeNextStepCard: React.FC<FormativeNextStepCardProps> = ({ weakConcepts }) => {
    const { openGeneratorPanel } = useGeneratorPanel();

    if (weakConcepts.length === 0) return null;

    const top = weakConcepts[0]; // Already sorted by avg asc

    const handleGenerate = (concept: WeakConcept) => {
        openGeneratorPanel({
            selectedConcepts: concept.conceptId ? [concept.conceptId] : [],
            materialType: 'QUIZ',
            differentiationLevel: 'support',
            customInstruction: `РЕМЕДИЈАЛЕН КВИЗ: Учениците постигнаа само ${concept.avg}% за "${concept.title}". Генерирај поедноставени прашања со чекор-по-чекор упатства и детални повратни информации.`,
        });
    };

    return (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
                <TrendingDown className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Следен чекор</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {weakConcepts.length} слаб{weakConcepts.length === 1 ? ' концепт' : 'и концепти'}
                        </span>
                    </div>

                    <p className="text-sm text-gray-700 mb-3">
                        <span className="font-semibold text-red-600">„{top.title}"</span>{' '}
                        постигна само <span className="font-bold text-red-600">{top.avg}%</span> просек
                        ({top.count} {top.count === 1 ? 'обид' : 'обиди'}) — препорачуваме ремедијален квиз.
                    </p>

                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => handleGenerate(top)}
                            className="flex items-center gap-1.5 text-xs font-bold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition"
                        >
                            Генерирај ремедијален квиз
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>

                        {weakConcepts.slice(1, 3).map(c => (
                            <button
                                key={c.conceptId ?? c.title}
                                type="button"
                                onClick={() => handleGenerate(c)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition border border-blue-200"
                            >
                                {c.title} ({c.avg}%)
                            </button>
                        ))}

                        {weakConcepts.length === 0 && (
                            <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Сите концепти над 70%
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
