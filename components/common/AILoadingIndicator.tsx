
import React, { useState, useEffect } from 'react';
import { ICONS } from '../../constants';

const LOADING_MESSAGES = [
    "Ги анализирам наставните стандарди...",
    "Структурирам педагошка рамка...",
    "Креирам диференцирани активности...",
    "Го финализирам документот...",
    "Применувам Блумова таксономија...",
    "Проверувам усогласеност..."
];

export const AILoadingIndicator: React.FC = () => {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex((prev: number) => (prev + 1) % LOADING_MESSAGES.length);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center p-6 space-y-4 animate-fade-in">
            <div className="relative">
                <div className="absolute inset-0 bg-brand-secondary/20 rounded-full animate-ping"></div>
                <div className="relative bg-white p-3 rounded-full shadow-lg border border-brand-secondary/30">
                    <ICONS.sparkles className="w-8 h-8 text-brand-secondary animate-pulse" />
                </div>
            </div>
            <div className="text-center">
                <p className="text-lg font-semibold text-gray-800 animate-fade-in-up key={messageIndex}">
                    {LOADING_MESSAGES[messageIndex]}
                </p>
                <p className="text-xs text-gray-500 mt-1">AI Асистентот работи...</p>
            </div>
        </div>
    );
};
