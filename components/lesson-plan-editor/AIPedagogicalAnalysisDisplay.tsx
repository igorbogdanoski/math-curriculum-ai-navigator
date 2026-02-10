import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import { SkeletonLoader } from '../common/SkeletonLoader';
import { MathRenderer } from '../common/MathRenderer';
import type { AIPedagogicalAnalysis, PedagogicalAnalysisCriteria } from '../../types';
import { useNotification } from '../../contexts/NotificationContext';

interface AIPedagogicalAnalysisDisplayProps {
    analysis: AIPedagogicalAnalysis | null;
    onAnalyze: () => void;
    isAnalyzing: boolean;
    planTitle?: string;
}

const statusConfig: Record<string, { icon: React.ComponentType<{className?: string}>, color: string }> = {
    'одлична': { icon: ICONS.check, color: 'text-green-600' },
    'добра': { icon: ICONS.check, color: 'text-green-600' },
    'добро': { icon: ICONS.check, color: 'text-green-600' },
    'високо ниво': { icon: ICONS.sparkles, color: 'text-blue-600' },
    'добро ниво': { icon: ICONS.sparkles, color: 'text-blue-600' },
    'добро избалансирани': { icon: ICONS.check, color: 'text-green-600' },
    'потребно е подобрување': { icon: ICONS.lightbulb, color: 'text-yellow-600' },
    'простор за подобрување': { icon: ICONS.lightbulb, color: 'text-yellow-600' },
    'фокус на пониски нивоа': { icon: ICONS.lightbulb, color: 'text-yellow-600' },
    'фокус на повисоки нивоа': { icon: ICONS.lightbulb, color: 'text-yellow-600' },
};

const AnalysisCriteriaDisplay: React.FC<{ title: string; data: PedagogicalAnalysisCriteria }> = ({ title, data }) => {
    const lowerCaseStatus = data.status.toLowerCase();
    const configKey = Object.keys(statusConfig).find(key => lowerCaseStatus.includes(key));
    const { icon: Icon, color } = configKey ? statusConfig[configKey] : { icon: ICONS.assistant, color: 'text-gray-600' };

    return (
        <div>
            <h4 className="font-semibold text-gray-800">{title}</h4>
            <div className={`flex items-center gap-2 text-sm font-semibold mt-1 ${color}`}>
                <Icon className="w-5 h-5" />
                <span>{data.status}</span>
            </div>
            <div className="text-sm text-gray-600 mt-1 pl-1 border-l-2 ml-2.5 prose prose-sm max-w-none">
                <MathRenderer text={data.details} />
            </div>
        </div>
    );
};

export const AIPedagogicalAnalysisDisplay: React.FC<AIPedagogicalAnalysisDisplayProps> = ({ analysis, onAnalyze, isAnalyzing, planTitle }) => {
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const { addNotification } = useNotification();
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const handleExport = (format: 'md' | 'tex' | 'pdf' | 'doc' | 'clipboard') => {
        if (!analysis?.pedagogicalAnalysis) return;
        setIsExportMenuOpen(false);

        const { pedagogicalAnalysis } = analysis;
        const finalPlanTitle = planTitle || 'Без наслов';
        const { overallImpression, alignment, engagement, cognitiveLevels } = pedagogicalAnalysis;
        
        const escapeHtml = (unsafe: string | undefined): string => {
            if (!unsafe) return '';
            return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        };
        const escapeLatex = (str: string | undefined): string => {
            if (!str) return '';
            return str.replace(/([&%$#_{}])/g, '\\$1').replace(/\\/g, '\\textbackslash{}').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}');
        };

        if (format === 'pdf') {
            addNotification("Се отвора дијалогот за печатење. Изберете 'Save as PDF' за да го зачувате фајлот.", 'info');
            window.print();
            return;
        }
        
        let content = '';
        if (format === 'clipboard') {
            content += `AI Педагошка Анализа за: ${finalPlanTitle}\n\n`;
            content += `Сумарен впечаток:\n${overallImpression}\n\n---\n\n`;
            content += `Усогласеност\nСтатус: ${alignment.status}\n${alignment.details}\n\n`;
            content += `Ангажман на ученици\nСтатус: ${engagement.status}\n${engagement.details}\n\n`;
            content += `Когнитивни нивоа\nСтатус: ${cognitiveLevels.status}\n${cognitiveLevels.details}\n\n`;
            
            navigator.clipboard.writeText(content)
                .then(() => addNotification('Анализата е копирана како обичен текст.', 'success'))
                .catch(() => addNotification('Грешка при копирање.', 'error'));
            return;
        }
        
        let mimeType = '';
        let extension = '';
        const filename = `AI_Analiza_${finalPlanTitle.replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_').toLowerCase()}`;

        if (format === 'md') {
            mimeType = 'text/markdown;charset=utf-8';
            extension = 'md';
            content += `# AI Педагошка Анализа за: ${finalPlanTitle}\n\n`;
            content += `## Сумарен впечаток\n${overallImpression}\n\n`;
            content += `## Усогласеност\n**Статус:** ${alignment.status}\n\n${alignment.details}\n\n`;
            content += `## Ангажман на ученици\n**Статус:** ${engagement.status}\n\n${engagement.details}\n\n`;
            content += `## Когнитивни нивоа\n**Статус:** ${cognitiveLevels.status}\n\n${cognitiveLevels.details}\n\n`;
        } else if (format === 'tex') {
            mimeType = 'application/x-tex;charset=utf-8';
            extension = 'tex';
            content += `\\documentclass[12pt, a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n\\usepackage{amssymb}\n\n`;
            content += `\\title{AI Педагошка Анализа за: ${escapeLatex(finalPlanTitle)}}\n\\author{Math Curriculum AI Navigator}\\date{}\n`;
            content += `\\begin{document}\n\\maketitle\n\n`;
            content += `\\section*{Сумарен впечаток}\n${escapeLatex(overallImpression)}\n\n`;
            content += `\\subsection*{Усогласеност}\n\\textbf{Статус:} ${escapeLatex(alignment.status)}\\par\n${escapeLatex(alignment.details)}\n\n`;
            content += `\\subsection*{Ангажман на ученици}\n\\textbf{Статус:} ${escapeLatex(engagement.status)}\\par\n${escapeLatex(engagement.details)}\n\n`;
            content += `\\subsection*{Когнитивни нивоа}\n\\textbf{Статус:} ${escapeLatex(cognitiveLevels.status)}\\par\n${escapeLatex(cognitiveLevels.details)}\n\n`;
            content += `\\end{document}`;
        } else if (format === 'doc') {
            let htmlBody = `<h1>AI Педагошка Анализа за: ${escapeHtml(finalPlanTitle)}</h1>`;
            htmlBody += `<h2>Сумарен впечаток</h2><p>${escapeHtml(overallImpression)}</p>`;
            htmlBody += `<h2>Усогласеност</h2><p><b>Статус:</b> ${escapeHtml(alignment.status)}</p><p>${escapeHtml(alignment.details)}</p>`;
            htmlBody += `<h2>Ангажман на ученици</h2><p><b>Статус:</b> ${escapeHtml(engagement.status)}</p><p>${escapeHtml(engagement.details)}</p>`;
            htmlBody += `<h2>Когнитивни нивоа</h2><p><b>Статус:</b> ${escapeHtml(cognitiveLevels.status)}</p><p>${escapeHtml(cognitiveLevels.details)}</p>`;
            
            try {
                const blob = new Blob([htmlBody], { type: 'text/html' });
                const clipboardItem = new ClipboardItem({ 'text/html': blob });
                navigator.clipboard.write([clipboardItem]).then(() => addNotification('Анализата е копирана со форматирање.', 'success')).catch(() => addNotification('Грешка при копирање.', 'error'));
            } catch (error) {
                addNotification('Копирањето со форматирање не е поддржано.', 'error');
            }
            return;
        }
        
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <fieldset className="p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-4">
            <legend className="text-xl font-bold text-purple-800 px-2">AI Анализа на Подготовката</legend>
            <div className="flex justify-between items-center flex-wrap gap-4">
                <p className="text-sm text-gray-700 max-w-2xl">
                    Откако ќе ја пополните подготовката, кликнете на ова копче за да добиете повратна информација од AI. Асистентот ќе ја анализира усогласеноста на целите и активностите, ќе понуди предлози за подобрување на ангажманот и ќе провери дали се покриени различни нивоа на знаење.
                </p>
                <button 
                    type="button" 
                    onClick={onAnalyze} 
                    disabled={isAnalyzing}
                    className="bg-purple-600 text-white font-semibold px-5 py-2.5 rounded-lg shadow-md hover:bg-purple-700 transition-all duration-300 disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isAnalyzing ? (
                        <><ICONS.spinner className="animate-spin w-5 h-5"/>Анализирам...</>
                    ) : (
                        <><ICONS.assistant className="w-5 h-5"/>Анализирај со AI</>
                    )}
                </button>
            </div>
            {isAnalyzing && <SkeletonLoader type="paragraph" />}
            {analysis?.pedagogicalAnalysis && (
                <div id="printable-analysis" className="mt-4">
                    <Card className="border-purple-200 bg-white">
                        <div className="flex justify-between items-start mb-4">
                            <h3 className="font-bold text-purple-800 flex items-center gap-2 text-lg">
                                <ICONS.assistant className="w-6 h-6"/> AI Педагошка Анализа
                            </h3>
                            <div className="relative" ref={exportMenuRef}>
                                <button type="button" onClick={() => setIsExportMenuOpen((prev: boolean) => !prev)} className="no-print flex items-center gap-2 bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium">
                                    <ICONS.download className="w-5 h-5" /> Извези
                                    <ICONS.chevronDown className={`w-4 h-4 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isExportMenuOpen && (
                                    <div className="no-print absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 animate-fade-in-up">
                                        <div className="py-1">
                                            {/* Export buttons */}
                                            <button onClick={() => handleExport('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><ICONS.download className="w-5 h-5 mr-3" /> Сними како Markdown (.md)</button>
                                            <button onClick={() => handleExport('tex')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><ICONS.download className="w-5 h-5 mr-3" /> Сними како LaTeX (.tex)</button>
                                            <button onClick={() => handleExport('doc')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><ICONS.edit className="w-5 h-5 mr-3"/>Копирај за Word (форматирано)</button>
                                            <button onClick={() => handleExport('pdf')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><ICONS.printer className="w-5 h-5 mr-3" /> Печати/Сними како PDF</button>
                                            <button onClick={() => handleExport('clipboard')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><ICONS.edit className="w-5 h-5 mr-3" /> Копирај како обичен текст</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-gray-800">Сумарен впечаток</h4>
                                <div className="text-sm text-gray-600 mt-1 prose prose-sm max-w-none"><MathRenderer text={analysis.pedagogicalAnalysis.overallImpression} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                                <AnalysisCriteriaDisplay title="Усогласеност" data={analysis.pedagogicalAnalysis.alignment} />
                                <AnalysisCriteriaDisplay title="Ангажман на ученици" data={analysis.pedagogicalAnalysis.engagement} />
                                <AnalysisCriteriaDisplay title="Когнитивни нивоа" data={analysis.pedagogicalAnalysis.cognitiveLevels} />
                            </div>
                        </div>
                    </Card>
                </div>
            )}
            {analysis?.error && (
                <Card className="border-red-300 bg-red-50 text-red-700"><p>{analysis.error}</p></Card>
            )}
        </fieldset>
    );
};