import React from 'react';
import { ICONS } from '../../constants';
import type { MenuState } from './graphUtils';

interface GraphContextMenuProps {
    state: MenuState;
    style: { top: number; left: number };
    onClose: () => void;
    onViewConcept: () => void;
    onGenerateTest: () => void;
    onGenerateIdeas: () => void;
    onAIAnalyze: () => void;
}

export function GraphContextMenu({
    state, style, onClose, onViewConcept, onGenerateTest, onGenerateIdeas, onAIAnalyze,
}: GraphContextMenuProps) {
    if (!state.visible) return null;

    return (
        <div
            className="absolute z-20 bg-white rounded-lg shadow-2xl border border-gray-100 p-2 animate-fade-in-up flex flex-col gap-1 min-w-[240px]"
            style={{ top: style.top, left: style.left }}
        >
            <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-start bg-gray-50 rounded-t-lg -mx-2 -mt-2 mb-1">
                <div>
                    <p className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">Опции за поим</p>
                    <p className="text-sm font-bold text-gray-800 line-clamp-2 leading-tight">{state.label}</p>
                </div>
                <button type="button" aria-label="Затвори мени" onClick={onClose} className="text-gray-400 hover:text-red-500 transition-colors">
                    <ICONS.close className="w-4 h-4" />
                </button>
            </div>
            <button type="button" onClick={onViewConcept} className="flex items-center text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-brand-secondary p-2 rounded transition-colors font-medium">
                <ICONS.bookOpen className="w-4 h-4 mr-3 text-blue-500"/> Види детали за поимот
            </button>
            <button type="button" onClick={onGenerateTest} className="flex items-center text-left text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 p-2 rounded transition-colors font-medium">
                <ICONS.generator className="w-4 h-4 mr-3 text-purple-500"/> Генерирај Тест/Квиз
            </button>
            <button type="button" onClick={onGenerateIdeas} className="flex items-center text-left text-sm text-gray-700 hover:bg-yellow-50 hover:text-yellow-700 p-2 rounded transition-colors font-medium">
                <ICONS.lightbulb className="w-4 h-4 mr-3 text-yellow-500"/> Генерирај Идеи за час
            </button>
            <button type="button" onClick={onAIAnalyze} className="flex items-center text-left text-sm text-gray-700 hover:bg-green-50 hover:text-green-700 p-2 rounded transition-colors font-medium border-t border-gray-100 mt-1 pt-3">
                <ICONS.zap className="w-4 h-4 mr-3 text-green-500"/> AI Педагошки Анализатор
            </button>
        </div>
    );
}
