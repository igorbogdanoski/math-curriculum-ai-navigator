import React from 'react';
import { Card } from '../common/Card';
// FIX: Corrected import path for ICONS
import { ICONS } from '../../constants';

interface ProactiveSuggestionCardProps {
    suggestionText: string;
    onDismiss: () => void;
    onGenerate: () => void;
}

export const ProactiveSuggestionCard: React.FC<ProactiveSuggestionCardProps> = ({ suggestionText, onDismiss, onGenerate }) => {
    const match = suggestionText.match(/\[(.*?)\]/);
    const mainText = match ? suggestionText.replace(match[0], '').trim() : suggestionText;
    const actionText = match ? match[1] : 'Преземи акција';

    return (
        <Card className="mb-6 border-l-4 border-brand-accent bg-blue-50 animate-fade-in">
            <div className="flex items-start">
                <div className="flex-shrink-0">
                    <ICONS.sparkles className="w-8 h-8 text-brand-secondary" />
                </div>
                <div className="ml-4 flex-1">
                    <h3 className="text-lg font-semibold text-brand-primary">AI Проактивен Предлог</h3>
                    <p className="mt-1 text-gray-700">{mainText}</p>
                    <div className="mt-4 flex space-x-4">
                        <button
                            onClick={onGenerate}
                            className="px-4 py-2 text-sm font-medium text-white bg-brand-secondary rounded-md hover:bg-brand-primary transition-colors"
                        >
                            {actionText}
                        </button>
                        <button
                            onClick={onDismiss}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-transparent rounded-md hover:bg-gray-200"
                        >
                            Отфрли
                        </button>
                    </div>
                </div>
                 <button onClick={onDismiss} className="p-1 rounded-full hover:bg-gray-200 ml-2" aria-label="Отфрли предлог">
                    <ICONS.close className="w-5 h-5 text-gray-500" />
                </button>
            </div>
        </Card>
    );
};