
import React from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import type { AIRecommendation, AIRecommendationAction } from '../../types';
import { useNavigation } from '../../contexts/NavigationContext';

interface RecommendationCardProps {
    recommendation: AIRecommendation;
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    'Нова Активност': ICONS.sparkles,
    'Професионален Развој': ICONS.lightbulb,
    'Покриеност на Стандарди': ICONS.chart,
    'Рефлексија': ICONS.assistant,
};

const categoryColors: Record<string, string> = {
    'Нова Активност': 'border-blue-500',
    'Професионален Развој': 'border-purple-500',
    'Покриеност на Стандарди': 'border-green-500',
    'Рефлексија': 'border-yellow-500',
};

export const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation }) => {
    const { navigate } = useNavigation();
    
    // Use fallback for dynamic/unknown categories
    const Icon = categoryIcons[recommendation.category] || ICONS.sparkles;
    const borderColor = categoryColors[recommendation.category] || 'border-gray-300';

    const handleActionClick = (action: AIRecommendationAction) => {
        if (action.path) {
            const params = new URLSearchParams(action.params as Record<string, string>).toString();
            const fullPath = params ? `${action.path}?${params}` : action.path;
            navigate(fullPath);
        }
    };

    return (
        <Card className={`border-l-4 ${borderColor} flex flex-col h-full`}>
            <div className="flex items-center mb-2">
                <Icon className="w-5 h-5 text-gray-500 mr-2" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">{recommendation.category}</p>
            </div>
            <h4 className="text-md font-bold text-brand-primary mb-2">{recommendation.title}</h4>
            <p className="text-sm text-gray-700 flex-grow">{recommendation.recommendationText}</p>
            {recommendation.action && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                        onClick={() => handleActionClick(recommendation.action!)}
                        className="w-full flex items-center justify-center gap-2 bg-brand-secondary text-white px-3 py-2 rounded-lg shadow hover:bg-brand-primary transition-colors text-sm font-semibold"
                    >
                        <ICONS.sparkles className="w-4 h-4" />
                        {recommendation.action.label}
                    </button>
                </div>
            )}
        </Card>
    );
};
