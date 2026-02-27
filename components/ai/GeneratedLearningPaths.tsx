import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import { MathRenderer } from '../common/MathRenderer';
import type { AIGeneratedLearningPaths, LearningPath, LearningPathStep } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';

interface GeneratedLearningPathsProps {
  material: AIGeneratedLearningPaths;
}

const stepIcons: Record<string, React.ComponentType<{className?: string}>> = {
    Introductory: ICONS.lightbulb,
    Practice: ICONS.edit,
    Consolidation: ICONS.share,
    Assessment: ICONS.quiz,
    Project: ICONS.generator
};

export const GeneratedLearningPaths: React.FC<GeneratedLearningPathsProps> = ({ material }) => {
    const { addNotification } = useNotification();
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleExport = (format: 'md' | 'clipboard' | 'pdf') => {
        setIsExportMenuOpen(false);

        if (format === 'pdf') {
            addNotification("Се отвора дијалогот за печатење. Изберете 'Save as PDF' за да го зачувате фајлот.", 'info');
            window.print();
            return;
        }

        // Build text content for md / clipboard
        const lines: string[] = [`# ${material.title}`, ''];
        for (const path of material.paths) {
            lines.push(`## ${path.profileName}`, '');
            for (const step of path.steps) {
                lines.push(`**${step.stepNumber}. [${step.type}]** ${step.activity}`);
            }
            lines.push('');
        }
        const text = lines.join('\n');

        if (format === 'clipboard') {
            navigator.clipboard.writeText(text)
                .then(() => addNotification('Патеките се копирани во clipboard.', 'success'))
                .catch(() => addNotification('Грешка при копирање.', 'error'));
            return;
        }

        // md download
        const filename = (material.title || 'learning-paths').replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_').toLowerCase();
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (material.error) {
        return <p className="text-red-500">{material.error}</p>;
    }

    return (
        <Card id="printable-area" className="mt-6 border-l-4 border-indigo-500">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-2xl font-bold">{material.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">AI генерирани патеки за учење за различни профили на ученици</p>
                </div>
                <div className="no-print relative" ref={exportMenuRef}>
                    <button
                        type="button"
                        onClick={() => setIsExportMenuOpen(prev => !prev)}
                        className="flex items-center gap-2 bg-gray-600 text-white px-3 py-2 rounded-lg shadow hover:bg-gray-700 transition-colors text-sm"
                    >
                        <ICONS.download className="w-5 h-5" />
                        Извези
                        <ICONS.chevronDown className={`w-4 h-4 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isExportMenuOpen && (
                        <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 animate-fade-in-up">
                            <div className="py-1">
                                <button type="button" onClick={() => handleExport('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <ICONS.download className="w-5 h-5 mr-3" /> Сними kako Markdown (.md)
                                </button>
                                <button type="button" onClick={() => handleExport('clipboard')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <ICONS.edit className="w-5 h-5 mr-3" /> Копирај kako обичен текст
                                </button>
                                <button type="button" onClick={() => handleExport('pdf')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                    <ICONS.printer className="w-5 h-5 mr-3" /> Печати/Сними kako PDF
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <div className="hidden print:block mb-6 border-b pb-4">
                <h1 className="text-2xl font-bold text-brand-primary mt-2">{material.title}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {material.paths.map((path: LearningPath, index: number) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg border">
                        <h4 className="text-lg font-bold text-brand-primary text-center mb-4">{path.profileName}</h4>
                        <div className="relative pl-5 space-y-4">
                            {/* Timeline line */}
                            <div className="absolute top-2 left-2.5 h-full w-0.5 bg-gray-300"></div>

                            {path.steps.map((step: LearningPathStep, stepIndex: number) => {
                                const Icon = stepIcons[step.type] || ICONS.star;
                                return (
                                    <div key={stepIndex} className="relative">
                                        <div className="absolute -left-2.5 top-1 w-5 h-5 bg-white rounded-full border-2 border-brand-secondary flex items-center justify-center">
                                            <span className="text-xs font-bold text-brand-secondary">{step.stepNumber}</span>
                                        </div>
                                        <div className="ml-6">
                                            <div className="bg-white p-3 rounded-md shadow-sm border">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <Icon className="w-4 h-4 text-brand-secondary"/>
                                                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{step.type}</span>
                                                </div>
                                                <div className="text-sm text-gray-700"><MathRenderer text={step.activity} /></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};
