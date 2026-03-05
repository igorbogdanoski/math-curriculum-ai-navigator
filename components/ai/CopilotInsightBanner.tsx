import React, { useMemo } from 'react';
import { Bot, Sparkles, PlusCircle } from 'lucide-react';
import type { QuizResult } from '../../services/firestoreService';
import type { ConceptStat } from '../../views/analytics/shared';

interface Props {
    results: QuizResult[];
    weakConcepts: ConceptStat[];
    onGenerateRemedial: (conceptId: string, title: string, avgPct: number) => void;
}

export const CopilotInsightBanner: React.FC<Props> = ({ results, weakConcepts, onGenerateRemedial }) => {
    
    // Find concepts where at least 2 students are struggling (low score or low confidence)
    const remedialSuggestions = useMemo(() => {
        const issuesByConcept: Record<string, { title: string, students: Set<string>, avgPct: number }> = {};
        
        // Populate titles and avgPct from weakConcepts
        weakConcepts.forEach(c => {
            issuesByConcept[c.conceptId] = { title: c.title, students: new Set(), avgPct: c.avgPct };
        });

        results.forEach(r => {
            if (!r.conceptId || !r.studentName) return;
            // struggling condition: percentage < 60 OR confidence < 3
            if (r.percentage < 60 || (r.confidence !== undefined && r.confidence < 3)) {
                if (!issuesByConcept[r.conceptId]) {
                    issuesByConcept[r.conceptId] = { title: r.quizTitle, students: new Set(), avgPct: r.percentage };
                }
                issuesByConcept[r.conceptId].students.add(r.studentName);
            }
        });

        // Filter out concepts with < 2 students struggling to make it a "group" recommendation
        const suggestions = Object.entries(issuesByConcept)
            .map(([id, data]) => ({
                id,
                title: data.title,
                students: Array.from(data.students),
                avgPct: data.avgPct
            }))
            .filter(s => s.students.length >= 2)
            .sort((a, b) => b.students.length - a.students.length); // sort by number of students struggling

        return suggestions;
    }, [results, weakConcepts]);

    if (remedialSuggestions.length === 0) return null;

    return (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-5 mb-6 shadow-sm relative overflow-hidden">
            <Bot className="absolute -right-4 -bottom-4 w-32 h-32 text-indigo-100 opacity-50 pointer-events-none" />
            
            <div className="flex items-start gap-4 relative z-10">
                <div className="bg-indigo-100 p-3 rounded-full text-indigo-600 shrink-0">
                    <Sparkles className="w-6 h-6" />
                </div>
                
                <div className="flex-1">
                    <h3 className="font-bold text-indigo-900 text-lg mb-1">
                        AI Ко-Пилот: Предлог Корективни Задачи
                    </h3>
                    <p className="text-indigo-700 text-sm mb-4">
                        Анализирав {results.length} резултати и детектирав групи на ученици кои имаат потешкотии со слични концепти (низок скор или ниска самодоверба). 
                        Ви препорачувам да им доделите специјализирани задачи за поддршка.
                    </p>

                    <div className="space-y-3">
                        {remedialSuggestions.slice(0, 3).map((suggestion) => (
                            <div key={suggestion.id} className="bg-white/80 border border-indigo-100 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h4 className="font-semibold text-gray-800">
                                        {suggestion.title}
                                    </h4>
                                    <p className="text-sm text-gray-600 mt-1">
                                        <span className="font-medium text-red-500">{suggestion.students.length} ученици:</span> {suggestion.students.join(', ')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => onGenerateRemedial(suggestion.id, suggestion.title, suggestion.avgPct)}
                                    className="shrink-0 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    Генерирај задача
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
