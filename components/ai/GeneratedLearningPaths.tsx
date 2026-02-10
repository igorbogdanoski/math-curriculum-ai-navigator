import React from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import { MathRenderer } from '../common/MathRenderer';
import type { AIGeneratedLearningPaths, LearningPath, LearningPathStep } from '../../types';

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
                <button 
                    onClick={() => window.print()}
                    className="no-print flex items-center bg-gray-600 text-white px-3 py-2 rounded-lg shadow hover:bg-gray-700 transition-colors text-sm"
                    title="Печати/Сними ги патеките"
                >
                    <ICONS.printer className="w-5 h-5 mr-1" />
                    Печати
                </button>
            </div>
             <div className="hidden print:visible mb-6 border-b pb-4">
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