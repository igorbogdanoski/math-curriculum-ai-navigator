import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import { MathRenderer } from '../common/MathRenderer';
import type { AIGeneratedIdeas, LessonPlan, Concept } from '../../types';
import { usePlanner } from '../../contexts/PlannerContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useNotification } from '../../contexts/NotificationContext';

interface GeneratedIdeasProps {
  material: AIGeneratedIdeas;
  onSaveAsNote: () => void;
}

const convertToStandardLatex = (text: string): string => {
    return text.replace(/\\\\/g, '\\');
};

const IdeaSection: React.FC<{icon: React.ComponentType<{className?: string}>, title: string, content: string}> = ({icon: Icon, title, content}) => (
    <div className="mb-4">
        <h4 className="text-lg font-semibold text-brand-secondary flex items-center mb-1">
            <Icon className="w-5 h-5 mr-2" />
            {title}
        </h4>
        <div className="text-gray-700 pl-7"><MathRenderer text={content} /></div>
    </div>
);

export const GeneratedIdeas: React.FC<GeneratedIdeasProps> = ({ material, onSaveAsNote }) => {
    const { addLessonPlan } = usePlanner();
    const { navigate } = useNavigation();
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
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleSaveAsPlan = async () => {
        const context = material.generationContext;
    
        const newPlan: Omit<LessonPlan, 'id'> = {
            title: material.title,
            grade: context?.grade?.level ?? 6,
            topicId: context?.topic?.id ?? '',
            conceptIds: context?.concepts?.map((c: Concept) => c.id) ?? [],
            subject: 'Математика',
            theme: context?.topic?.title ?? '',
            objectives: [],
            assessmentStandards: [],
            scenario: {
                introductory: material.openingActivity,
                main: material.mainActivity.split('\n').filter((line: string) => line.trim() !== ''),
                concluding: material.assessmentIdea,
            },
            materials: [],
            progressMonitoring: [material.assessmentIdea].filter(Boolean),
            differentiation: material.differentiation,
        };
    
        try {
            const newPlanId = await addLessonPlan(newPlan);
            addNotification('Подготовката е успешно зачувана! Сега можете да ја доуредите.', 'success');
            navigate(`/planner/lesson/${newPlanId}`);
        } catch (error) {
            addNotification('Грешка при зачувување на подготовката.', 'error');
        }
    };
    
    const handleExport = (format: 'md' | 'tex' | 'pdf' | 'doc' | 'clipboard') => {
        setIsExportMenuOpen(false);
        if (format === 'pdf') {
            addNotification("За да испечатите, користете го копчето за печатење на прелистувачот (Ctrl/Cmd + P).", 'info');
            return;
        }
        
        const { title, openingActivity, mainActivity, differentiation, assessmentIdea } = material;
    
        const fullText = `Наслов: ${title}\n\nВоведна активност:\n${openingActivity}\n\nГлавна активност:\n${mainActivity}\n\nДиференцијација:\n${differentiation}\n\nИдеја за оценување:\n${assessmentIdea}`;
        
        const standardLatexText = convertToStandardLatex(fullText);
    
        if (format === 'clipboard') {
            navigator.clipboard.writeText(standardLatexText)
                .then(() => addNotification('Идеите се копирани како обичен текст.', 'success'))
                .catch(() => addNotification('Грешка при копирање.', 'error'));
            return;
        }
    
        let content = '';
        let mimeType = '';
        let extension = '';
        const filename = `${(title || 'ai-ideas').replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_').toLowerCase()}`;
        const escapeLatex = (str: string) => convertToStandardLatex(str).replace(/([&%$#_{}])/g, '\\$1');
        
        switch(format) {
            case 'md':
                mimeType = 'text/markdown;charset=utf-8';
                extension = 'md';
                content = `# ${title}\n\n### Воведна активност\n${openingActivity}\n\n### Главна активност\n${mainActivity.replace(/\n/g, '\n- ')}\n\n### Диференцијација\n${differentiation}\n\n### Идеја за оценување\n${assessmentIdea}`;
                content = convertToStandardLatex(content);
                break;
            case 'tex':
                mimeType = 'application/x-tex;charset=utf-8';
                extension = 'tex';
                content = `\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\title{${escapeLatex(title)}}\n\\author{AI Генератор}\n\\date{}\n\\begin{document}\n\\maketitle\n\\section*{Воведна активност}\n${escapeLatex(openingActivity)}\n\\section*{Главна активност}\n${escapeLatex(mainActivity)}\n\\section*{Диференцијација}\n${escapeLatex(differentiation)}\n\\section*{Идеја за оценување}\n${escapeLatex(assessmentIdea)}\n\\end{document}`;
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
                    navigator.clipboard.write([clipboardItem]).then(() => addNotification('Идеите се копирани со форматирање за Word.', 'success')).catch(() => addNotification('Грешка при копирање.', 'error'));
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

    return (
        <Card id="printable-area" className="mt-6 border-l-4 border-yellow-500">
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
            {material.error ? (
                <p className="text-red-500">{material.error}</p>
            ) : (
                <div className="prose prose-sm max-w-none">
                    <IdeaSection icon={ICONS.sparkles} title="Воведна активност" content={material.openingActivity} />
                    <IdeaSection icon={ICONS.bookOpen} title="Главна активност" content={material.mainActivity} />
                    <IdeaSection icon={ICONS.share} title="Диференцијација" content={material.differentiation} />
                    <IdeaSection icon={ICONS.check} title="Идеја за оценување" content={material.assessmentIdea} />
                </div>
            )}
             <div className="mt-4 flex flex-wrap gap-2 no-print">
                <button onClick={handleSaveAsPlan} className="flex items-center text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg shadow hover:bg-green-700"><ICONS.plus className="w-4 h-4 mr-1"/> Зачувај како подготовка</button>
                <button onClick={onSaveAsNote} className="flex items-center text-sm bg-yellow-500 text-white px-3 py-1.5 rounded-lg shadow hover:bg-yellow-600"><ICONS.edit className="w-4 h-4 mr-1"/> Зачувај како белешка</button>
            </div>
        </Card>
    );
};