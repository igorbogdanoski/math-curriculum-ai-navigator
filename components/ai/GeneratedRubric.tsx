import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../common/Card';
import type { AIGeneratedRubric, RubricCriterion, RubricLevel } from '../../types';
import { ICONS } from '../../constants';
import { useNotification } from '../../contexts/NotificationContext';

interface GeneratedRubricProps {
  material: AIGeneratedRubric;
}

export const GeneratedRubric: React.FC<GeneratedRubricProps> = ({ material }) => {
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
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleExport = (format: 'md' | 'tex' | 'pdf' | 'doc' | 'clipboard') => {
        setIsExportMenuOpen(false);
        if (format === 'pdf') {
            addNotification("Се отвора дијалогот за печатење. Изберете 'Save as PDF' за да го зачувате фајлот.", 'info');
            window.print();
            return;
        }

        let fullContent = `${material.title}\n\n`;
        material.criteria?.forEach((c: RubricCriterion) => {
            fullContent += `${c.criterion}\n`;
            c.levels.forEach((l: RubricLevel) => {
                fullContent += `- ${l.levelName} (${l.points} поени): ${l.description}\n`;
            });
            fullContent += '\n';
        });

        if (format === 'clipboard') {
            navigator.clipboard.writeText(fullContent).then(() => addNotification('Рубриката е копирана како обичен текст.', 'success')).catch(() => addNotification('Грешка при копирање.', 'error'));
            return;
        }
        
        let content = '';
        let mimeType = '';
        let extension = '';
        const filename = `${material.title.replace(/ /g, '_')}`;
        const escapeLatex = (str: string) => str.replace(/([&%$#_{}])/g, '\\$1');

        switch(format) {
            case 'md':
                mimeType = 'text/markdown;charset=utf-8';
                extension = 'md';
                content = `# ${material.title}\n\n`;
                material.criteria?.forEach((c: RubricCriterion) => {
                    content += `## ${c.criterion}\n\n| Ниво | Опис | Поени |\n|:---|:---|:---|\n`;
                    c.levels.forEach((l: RubricLevel) => { content += `| ${l.levelName} | ${l.description} | ${l.points} |\n`; });
                });
                break;
            case 'tex':
                mimeType = 'application/x-tex;charset=utf-8';
                extension = 'tex';
                content = `\\documentclass{article}\\usepackage[utf8]{inputenc}\\title{${escapeLatex(material.title)}}\\begin{document}\\maketitle\n`;
                material.criteria?.forEach((c: RubricCriterion) => {
                    content += `\\section*{${escapeLatex(c.criterion)}}\n\\begin{tabular}{|l|p{8cm}|l|}\\hline\n`;
                    c.levels.forEach((l: RubricLevel) => { content += `${escapeLatex(l.levelName)} & ${escapeLatex(l.description)} & ${escapeLatex(l.points)} \\\\ \\hline\n`; });
                    content += `\\end{tabular}\n`;
                });
                content += `\\end{document}`;
                break;
            case 'doc': {
                const printableElement = document.getElementById('printable-area');
                if (!printableElement) {
                    addNotification('Грешка: Елементот за печатење не е пронајден.', 'error');
                    return;
                }
                const renderedHtml = printableElement.innerHTML;

                const fullHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css">
                        <style>
                            body { font-family: Calibri, sans-serif; font-size: 11pt; }
                            h1, h2, h3, h4 { font-family: 'Calibri Light', sans-serif; }
                            table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
                            th, td { border: 1px solid black; padding: 8px; text-align: left; vertical-align: top; }
                            thead { background-color: #f2f2f2; }
                        </style>
                    </head>
                    <body>
                        ${renderedHtml}
                    </body>
                    </html>
                `;
                 try {
                    const blob = new Blob([fullHtml], { type: 'text/html' });
                    const clipboardItem = new ClipboardItem({ 'text/html': blob });
                    navigator.clipboard.write([clipboardItem]).then(() => addNotification('Рубриката е копирана со форматирање за Word.', 'success')).catch(() => addNotification('Грешка при копирање.', 'error'));
                } catch (error) {
                    addNotification('Копирањето со форматирање не е поддржано.', 'error');
                }
                return;
            }
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

    if (material.error) {
        return <p className="text-red-500">{material.error}</p>;
    }

    return (
        <Card id="printable-area" className="border-l-4 border-purple-500">
             <div className="flex justify-between items-start mb-4">
                <h3 className="text-2xl font-bold">{material.title}</h3>
                <div className="flex space-x-2 no-print">
                     <div className="relative" ref={exportMenuRef}>
                        <button type="button" onClick={() => setIsExportMenuOpen((prev: boolean) => !prev)} className="flex items-center gap-2 bg-gray-600 text-white px-3 py-2 rounded-lg shadow hover:bg-gray-700 transition-colors text-sm">
                            <ICONS.download className="w-5 h-5" />
                            Извези
                            <ICONS.chevronDown className={`w-4 h-4 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isExportMenuOpen && (
                            <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 animate-fade-in-up">
                                <div className="py-1">
                                    <button onClick={() => handleExport('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <ICONS.download className="w-5 h-5 mr-3" /> Сними како Markdown (.md)
                                    </button>
                                    <button onClick={() => handleExport('tex')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <ICONS.download className="w-5 h-5 mr-3" /> Сними како LaTeX (.tex)
                                    </button>
                                    <button onClick={() => handleExport('doc')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <ICONS.edit className="w-5 h-5 mr-3" /> Копирај за Word (форматирано)
                                    </button>
                                    <button onClick={() => handleExport('pdf')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <ICONS.printer className="w-5 h-5 mr-3" /> Печати/Сними како PDF
                                    </button>
                                     <button onClick={() => handleExport('clipboard')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <ICONS.edit className="w-5 h-5 mr-3" /> Копирај како обичен текст
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="space-y-6">
                {material.criteria?.map((criterion: RubricCriterion, index: number) => (
                    <div key={index}>
                        <h4 className="text-lg font-semibold text-brand-secondary mb-2">{criterion.criterion}</h4>
                        <div className="overflow-x-auto border rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {criterion.levels.map((level: RubricLevel, i: number) => (
                                            <th key={i} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{level.levelName} ({level.points} поени)</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white">
                                    <tr>
                                        {criterion.levels.map((level: RubricLevel, i: number) => (
                                            <td key={i} className="px-4 py-3 whitespace-normal text-sm text-gray-600 align-top border-r last:border-r-0">{level.description}</td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};