import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import { MathRenderer } from '../common/MathRenderer';
import { Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import type { AIGeneratedIdeas, LessonPlan, Concept } from '../../types';
import { usePlanner } from '../../contexts/PlannerContext';
import { useNavigation } from '../../contexts/NavigationContext';
import { useNotification } from '../../contexts/NotificationContext';
import { geminiService } from '../../services/geminiService';

interface GeneratedIdeasProps {
  material: AIGeneratedIdeas;
  onSaveAsNote: () => void;
}

const convertToStandardLatex = (text: string): string => {
    return text.replace(/\\\\/g, '\\');
};

const IdeaSection: React.FC<{
    icon: React.ComponentType<{className?: string}>, 
    title: string, 
    content: string,
    onVisualize?: () => void,
    isVisualizing?: boolean,
    imageUrl?: string
}> = ({icon: Icon, title, content, onVisualize, isVisualizing, imageUrl}) => (
    <div className="mb-6 group">
        <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-bold text-brand-secondary flex items-center">
                <Icon className="w-5 h-5 mr-2" />
                {title}
            </h4>
            {onVisualize && !imageUrl && (
                <button
                    onClick={onVisualize}
                    disabled={isVisualizing}
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200 text-xs font-bold hover:bg-amber-100 disabled:opacity-50 no-print"
                >
                    {isVisualizing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <ImageIcon className="w-3.5 h-3.5" />
                    )}
                    Визуелизирај со AI
                </button>
            )}
        </div>
        
        <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 text-gray-700 pl-7">
                <MathRenderer text={content} />
            </div>
            {imageUrl && (
                <div className="md:w-1/3 flex-shrink-0 animate-in fade-in zoom-in duration-500">
                    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-md bg-white">
                        <img src={imageUrl} alt={title} className="w-full h-auto object-cover" />
                        <div className="p-2 bg-gray-50 text-[10px] text-gray-400 italic text-center">
                            AI Генерирана илустрација
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
);

export const GeneratedIdeas: React.FC<GeneratedIdeasProps> = ({ material, onSaveAsNote }) => {
    const { addLessonPlan } = usePlanner();
    const { navigate } = useNavigation();
    const { addNotification } = useNotification();
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [visualizations, setVisualizations] = useState<Record<string, { loading: boolean, url?: string }>>({});
    const exportMenuRef = useRef<HTMLDivElement>(null);

    const handleVisualize = async (section: string, promptText: string) => {
        setVisualizations(prev => ({ ...prev, [section]: { loading: true } }));
        try {
            const result = await geminiService.generateIllustration(`Educational math illustration for: ${promptText}. Professional, clean style.`);
            setVisualizations(prev => ({ 
                ...prev, 
                [section]: { loading: false, url: result.imageUrl } 
            }));
            addNotification('Илустрацијата е успешно генерирана!', 'success');
        } catch (error) {
            console.error('Visualization error:', error);
            setVisualizations(prev => ({ ...prev, [section]: { loading: false } }));
            addNotification('Грешка при генерирање на илустрацијата.', 'error');
        }
    };

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
                introductory: { text: material.openingActivity },
                main: Array.isArray(material.mainActivity) 
                    ? material.mainActivity.map(item => ({ text: item.text, bloomsLevel: item.bloomsLevel }))
                    : [{ text: String(material.mainActivity), bloomsLevel: 'Understanding' as const }],
                concluding: { text: material.assessmentIdea },
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
    
    const handleExport = (format: 'md' | 'tex' | 'pdf' | 'doc' | 'download-doc' | 'clipboard') => {
        setIsExportMenuOpen(false);
        if (format === 'pdf') {
            addNotification("Се отвора дијалогот за печатење. Изберете 'Save as PDF' за да го зачувате фајлот.", 'info');
            window.print();
            return;
        }
        
        const { title, openingActivity, mainActivity, differentiation, assessmentIdea } = material;
    
        const mainActivitiesStr = Array.isArray(mainActivity) 
            ? mainActivity.map(a => `- ${a.text} [${a.bloomsLevel}]`).join('\n')
            : mainActivity;

        const fullText = `Наслов: ${title}\n\nВоведна активност:\n${openingActivity}\n\nГлавна активност:\n${mainActivitiesStr}\n\nДиференцијација:\n${differentiation}\n\nИдеја за оценување:\n${assessmentIdea}`;
        
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
                content = `# ${title}\n\n### Воведна активност\n${openingActivity}\n\n### Главна активност\n${mainActivitiesStr}\n\n### Диференцијација\n${differentiation}\n\n### Идеја за оценување\n${assessmentIdea}`;
                content = convertToStandardLatex(content);
                break;
            case 'tex':
                mimeType = 'application/x-tex;charset=utf-8';
                extension = 'tex';
                content = `\\documentclass[12pt]{article}\n\\usepackage[utf8]{inputenc}\n\\title{${escapeLatex(title)}}\n\\author{AI Генератор}\n\\date{}\n\\begin{document}\n\\maketitle\n\\section*{Воведна активност}\n${escapeLatex(openingActivity)}\n\\section*{Главна активност}\n${escapeLatex(mainActivitiesStr)}\n\\section*{Диференцијација}\n${escapeLatex(differentiation)}\n\\section*{Идеја за оценување}\n${escapeLatex(assessmentIdea)}\n\\end{document}`;
                break;
            case 'download-doc':
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
                
                if (format === 'download-doc') {
                    const blob = new Blob(['\ufeff', fullHtml], { type: 'application/msword' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${filename}.doc`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    return;
                }

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
                                    <button type="button" onClick={() => handleExport('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <ICONS.download className="w-5 h-5 mr-3" /> Сними како Markdown (.md)
                                    </button>
                                    <button type="button" onClick={() => handleExport('tex')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <ICONS.download className="w-5 h-5 mr-3" /> Сними како LaTeX (.tex)
                                    </button>
                                    <button type="button" onClick={() => handleExport('download-doc')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <ICONS.download className="w-5 h-5 mr-3" /> Експортирај во Word (.doc)
                                    </button>
                                    <button type="button" onClick={() => handleExport('doc')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <ICONS.copy className="w-5 h-5 mr-3" /> Копирај за Word (форматирано)
                                    </button>
                                    <button type="button" onClick={() => handleExport('pdf')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                        <ICONS.printer className="w-5 h-5 mr-3" /> Печати/Сними како PDF
                                    </button>
                                     <button type="button" onClick={() => handleExport('clipboard')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
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
                    {material.illustrationUrl && (
                        <div className="mb-8 rounded-2xl overflow-hidden border-2 border-gray-100 shadow-sm bg-white">
                            <img src={material.illustrationUrl} alt="Контекстуална илустрација" className="w-full h-auto max-h-96 object-cover" />
                            <div className="p-3 bg-gray-50 flex items-center justify-between">
                                <span className="text-xs text-gray-500 italic flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    AI Генерирана контекстуална илустрација
                                </span>
                            </div>
                        </div>
                    )}
                    <IdeaSection 
                        icon={ICONS.sparkles} 
                        title="Воведна активност" 
                        content={material.openingActivity} 
                        onVisualize={() => handleVisualize('opening', material.openingActivity)}
                        isVisualizing={visualizations['opening']?.loading}
                        imageUrl={visualizations['opening']?.url}
                    />
                    <IdeaSection 
                        icon={ICONS.bookOpen} 
                        title="Главна активност" 
                        content={Array.isArray(material.mainActivity) ? material.mainActivity.map(a => '- ' + a.text).join('\n') : String(material.mainActivity)} 
                        onVisualize={() => handleVisualize('main', Array.isArray(material.mainActivity) ? material.mainActivity[0].text : String(material.mainActivity))}
                        isVisualizing={visualizations['main']?.loading}
                        imageUrl={visualizations['main']?.url}
                    />
                    <IdeaSection 
                        icon={ICONS.share} 
                        title="Диференцијација" 
                        content={material.differentiation} 
                        onVisualize={() => handleVisualize('differentiation', material.differentiation)}
                        isVisualizing={visualizations['differentiation']?.loading}
                        imageUrl={visualizations['differentiation']?.url}
                    />
                    <IdeaSection 
                        icon={ICONS.check} 
                        title="Идеја за оценување" 
                        content={material.assessmentIdea} 
                        onVisualize={() => handleVisualize('assessment', material.assessmentIdea)}
                        isVisualizing={visualizations['assessment']?.loading}
                        imageUrl={visualizations['assessment']?.url}
                    />
                </div>
            )}
             <div className="mt-4 flex flex-wrap gap-2 no-print">
                <button type="button" onClick={handleSaveAsPlan} className="flex items-center text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg shadow hover:bg-green-700"><ICONS.plus className="w-4 h-4 mr-1"/> Зачувај како подготовка</button>
                <button type="button" onClick={onSaveAsNote} className="flex items-center text-sm bg-yellow-500 text-white px-3 py-1.5 rounded-lg shadow hover:bg-yellow-600"><ICONS.edit className="w-4 h-4 mr-1"/> Зачувај како белешка</button>
            </div>
        </Card>
    );
};