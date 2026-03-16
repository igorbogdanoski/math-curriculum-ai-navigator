import React, { useEffect, useState } from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { useTeacherAnalytics } from '../../hooks/useTeacherAnalytics';
import { AlertTriangle, ChevronRight, Sparkles } from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useGeneratorPanel } from '../../contexts/GeneratorPanelContext';

export const WeakConceptsWidget: React.FC = () => {
    const { firebaseUser } = useAuth();
    const { navigate } = useNavigation();
    const { openGeneratorPanel } = useGeneratorPanel();
    const { data: analyticsData, isLoading } = useTeacherAnalytics(firebaseUser?.uid);
    const [criticalConcepts, setCriticalConcepts] = useState<any[]>([]);

    useEffect(() => {
        if (!analyticsData?.results) return;
        const results = analyticsData.results;
        
        // Group by concept
        const grouped: Record<string, { attempts: number, correct: number, title: string }> = {};
        (results || []).forEach(r => {
            if (!r.conceptId) return;
            
            if (!grouped[r.conceptId]) {
                // Try to use quizTitle as proxy for concept title, or fallback to ID
                grouped[r.conceptId] = { attempts: 0, correct: 0, title: r.quizTitle || r.conceptId };
            }
            // Use totalQuestions instead of questions.length
            grouped[r.conceptId].attempts += (r.totalQuestions || 0);
            grouped[r.conceptId].correct += r.score;
        });

        const weak = Object.values(grouped)
            .map(g => ({ ...g, pct: Math.round((g.correct / Math.max(g.attempts, 1)) * 100) }))
            .filter(g => g.pct < 60 && g.attempts >= 5) // At least 5 attempts to show up
            .sort((a, b) => a.pct - b.pct)
            .slice(0, 3); // top 3 weakest

        setCriticalConcepts(weak);
    }, [analyticsData?.results]);

    if (isLoading || criticalConcepts.length === 0) return null;

    return (
        <Card className="border-l-4 border-l-red-500 bg-red-50/30">
            <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="font-bold text-red-700">Детекција на слаби точки</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Учениците покажуваат послаб резултат на следниве лекции врз основа на квизовите:</p>
            <div className="space-y-2 mb-4">
                {criticalConcepts.map((c, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded shadow-sm border border-red-100">
                        <span className="font-medium text-sm text-gray-800">{c.title}</span>
                        <div className="flex items-center gap-2">
                            <span className="font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full text-xs">{c.pct}%</span>
                            <button
                                type="button"
                                onClick={() => openGeneratorPanel({
                                    materialType: 'LEARNING_PATH',
                                    customInstruction: `Генерирај ремедијациска патека за концептот: "${c.title}". Фокус на основни грешки и поддршка.`,
                                })}
                                className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2 py-1 rounded-full hover:bg-indigo-700 transition-colors"
                                title="Генерирај ремедијациска патека"
                            >
                                <Sparkles className="w-3 h-3" /> Ремедијација
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={() => navigate('/analytics')}
                className="text-sm text-brand-primary font-bold hover:underline flex items-center"
            >
                Отвори детална аналитика <ChevronRight className="w-4 h-4 ml-1" />
            </button>
        </Card>
    );
};
