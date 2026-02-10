import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import { MathRenderer } from '../common/MathRenderer';
import type { AIGeneratedAssessment, AssessmentQuestion, DifferentiationLevel } from '../../types';
import { FlashcardViewer } from './FlashcardViewer';
import { QuizViewer } from './QuizViewer';
import { useNotification } from '../../contexts/NotificationContext';

type DifferentiatedVersion = { profileName: string; questions: AssessmentQuestion[] };

interface GeneratedAssessmentProps {
  material: AIGeneratedAssessment;
}

const convertToStandardLatex = (text: string): string => {
    return text.replace(/\\\\/g, '\\');
};

const cognitiveLevelConfig: Record<string, { label: string; color: string; }> = {
    Remembering: { label: 'Помнење', color: 'bg-gray-100 text-gray-800' },
    Understanding: { label: 'Разбирање', color: 'bg-blue-100 text-blue-800' },
    Applying: { label: 'Примена', color: 'bg-green-100 text-green-800' },
    Analyzing: { label: 'Анализа', color: 'bg-yellow-100 text-yellow-800' },
    Evaluating: { label: 'Евалуација', color: 'bg-purple-100 text-purple-800' },
    Creating: { label: 'Креирање', color: 'bg-pink-100 text-pink-800' },
};

const QuestionList: React.FC<{ 
    questions: AssessmentQuestion[];
    isEditing: boolean;
    handleQuestionFieldChange: (qIndex: number, field: keyof AssessmentQuestion, value: string) => void;
    handleOptionChange: (qIndex: number, optIndex: number, value: string) => void;
}> = ({ questions, isEditing, handleQuestionFieldChange, handleOptionChange }) => {
    const questionTypeIcons: Record<string, React.ComponentType<{className?: string}>> = {
        MULTIPLE_CHOICE: ICONS.myLessons,
        SHORT_ANSWER: ICONS.edit,
        TRUE_FALSE: ICONS.check,
        ESSAY: ICONS.generator,
        FILL_IN_THE_BLANK: ICONS.chatBubble,
    };
    
    return (
        <div>
            {questions?.map((q: AssessmentQuestion, index: number) => {
                const Icon = questionTypeIcons[q.type] || ICONS.lightbulb;
                const levelInfo = cognitiveLevelConfig[q.cognitiveLevel] || cognitiveLevelConfig['Understanding'];
                return (
                    <div key={q.id || index} className="mb-4 pb-4 border-b last:border-b-0">
                        <div className="font-semibold flex items-start gap-2 mb-2">
                            <Icon className="w-4 h-4 text-brand-secondary mt-1 flex-shrink-0" />
                            <div className="flex-1">
                                {isEditing ? (
                                    <textarea 
                                        value={q.question}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleQuestionFieldChange(index, 'question', e.target.value)}
                                        className="w-full p-2 border rounded-md"
                                        rows={2}
                                    />
                                ) : (
                                    <span>{index + 1}. <MathRenderer text={q.question} /></span>
                                )}
                            </div>
                        </div>
                        
                        <div className="ml-8 mt-1 space-y-2">
                            {q.type === 'MULTIPLE_CHOICE' && q.options && (
                                <ul className={`list-['A)_'] list-inside space-y-2`}>
                                    {q.options.map((opt: string, i: number) => (
                                        <li key={i} className="flex items-center">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={opt}
                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleOptionChange(index, i, e.target.value)}
                                                    className="w-full text-sm p-1 border-b"
                                                />
                                            ) : (
                                                <MathRenderer text={opt} />
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                             {(q.type === 'SHORT_ANSWER' || q.type === 'FILL_IN_THE_BLANK' || q.type === 'ESSAY') && !isEditing && (
                                <div className="h-16 border-b-2 border-dotted border-gray-400"></div>
                            )}
                            <div className={`p-2 rounded-md mt-2 no-print ${isEditing ? 'bg-gray-50' : 'bg-gray-100'}`}>
                                <span className="font-semibold text-sm">Точен одговор:</span>
                                {isEditing ? (
                                    <input 
                                        type="text"
                                        value={q.answer}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleQuestionFieldChange(index, 'answer', e.target.value)}
                                        className="w-full text-sm p-1 border-b"
                                    />
                                ) : (
                                    <span className="text-sm ml-2"><MathRenderer text={q.answer} /></span>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="mt-2">
                                    <span className="font-semibold text-sm">Решение чекор-по-чекор:</span>
                                    <textarea 
                                        value={q.solution || ''}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleQuestionFieldChange(index, 'solution', e.target.value)}
                                        className="w-full p-2 border rounded-md text-sm mt-1"
                                        rows={3}
                                        placeholder="Внесете детално решение..."
                                    />
                                </div>
                            ) : q.solution && (
                                <div className="mt-2 p-3 bg-blue-50 border-l-4 border-blue-400 text-sm">
                                    <span className="font-semibold block mb-1 text-blue-800">Решение чекор-по-чекор:</span>
                                    <div className="text-gray-700 italic">
                                        <MathRenderer text={q.solution} />
                                    </div>
                                </div>
                            )}
                        </div>

                        {!isEditing && (
                            <div className="ml-8 mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs no-print">
                                <span className={`px-2 py-0.5 rounded-full font-medium ${levelInfo.color}`}>{levelInfo.label}</span>
                                {q.difficulty_level && <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">Тежина: {q.difficulty_level}</span>}
                                {q.concept_evaluated && <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Поим: {q.concept_evaluated}</span>}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};


export const GeneratedAssessment: React.FC<GeneratedAssessmentProps> = ({ material }) => {
    const [editableMaterial, setEditableMaterial] = useState<AIGeneratedAssessment>(material);
    const [isEditing, setIsEditing] = useState(false);
    const [showFlashcards, setShowFlashcards] = useState(false);
    const [showQuiz, setShowQuiz] = useState(false);
    const [activeTab, setActiveTab] = useState('standard');
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const actionsMenuRef = useRef<HTMLDivElement>(null);
    const { addNotification } = useNotification();


    useEffect(() => {
        setEditableMaterial(material);
        setIsEditing(false);
        setActiveTab('standard');
    }, [material]);
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
                setIsActionsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditableMaterial((prev: AIGeneratedAssessment) => ({ ...prev, title: e.target.value }));
    };
    
    const handleQuestionFieldChangeForVersion = (versionName: string, qIndex: number, field: keyof AssessmentQuestion, value: string) => {
        setEditableMaterial((prev: AIGeneratedAssessment) => {
            if (versionName === 'standard') {
                const newQuestions = [...prev.questions];
                newQuestions[qIndex] = { ...newQuestions[qIndex], [field]: value };
                return { ...prev, questions: newQuestions };
            }
            const newVersions = prev.differentiatedVersions?.map((v: DifferentiatedVersion) => {
                if (v.profileName === versionName) {
                    const newQuestions = [...v.questions];
                    newQuestions[qIndex] = { ...newQuestions[qIndex], [field]: value };
                    return { ...v, questions: newQuestions };
                }
                return v;
            }) || [];
            return { ...prev, differentiatedVersions: newVersions };
        });
    };

    const handleOptionChangeForVersion = (versionName: string, qIndex: number, optIndex: number, value: string) => {
        setEditableMaterial((prev: AIGeneratedAssessment) => {
            const updateOptions = (questions: AssessmentQuestion[]) => {
                const newQuestions = [...questions];
                const oldQuestion = newQuestions[qIndex];
                const newOptions = [...(oldQuestion.options || [])];
                newOptions[optIndex] = value;
                newQuestions[qIndex] = { ...oldQuestion, options: newOptions };
                return newQuestions;
            };

            if (versionName === 'standard') {
                return { ...prev, questions: updateOptions(prev.questions) };
            }
            
            const newVersions = prev.differentiatedVersions?.map((v: DifferentiatedVersion) => 
                v.profileName === versionName ? { ...v, questions: updateOptions(v.questions) } : v
            ) || [];

            return { ...prev, differentiatedVersions: newVersions };
        });
    };
    
    const handleSaveEdit = () => setIsEditing(false);

    const handleCancelEdit = () => {
        setEditableMaterial(material);
        setIsEditing(false);
    };

    const handleExport = (format: 'md' | 'tex' | 'pdf' | 'doc' | 'clipboard') => {
        setIsActionsMenuOpen(false);
        if (format === 'pdf') {
            addNotification("Се отвора дијалогот за печатење. Изберете 'Save as PDF' за да го зачувате фајлот.", 'info');
            window.print();
            return;
        }

        const filename = `${editableMaterial.title.replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_').toLowerCase()}`;
        let content = '';
        let mimeType = 'text/plain;charset=utf-8';
        let extension = format;
        
        const formatVersionForText = (title: string, questions: AssessmentQuestion[], selfAssessment?: string[]) => {
            let textContent = `${title}\n\n`;
            questions.forEach((q, i) => {
                textContent += `${i + 1}. ${q.question}\n`;
                if (q.options) textContent += q.options.map(o => `   - ${o}`).join('\n') + '\n';
                textContent += `Одговор: ${q.answer}\n\n`;
            });
            if (selfAssessment && selfAssessment.length > 0) {
                textContent += `Прашања за самооценување:\n${selfAssessment.map((sq, i) => `${i+1}. ${sq}`).join('\n')}\n\n`;
            }
            return textContent;
        };

        content += formatVersionForText('Стандардна верзија', editableMaterial.questions, editableMaterial.selfAssessmentQuestions);
        editableMaterial.differentiatedVersions?.forEach((v: DifferentiatedVersion) => {
            content += '\n---\n';
            content += formatVersionForText(`Верзија за ${v.profileName}`, v.questions);
        });

        if (format === 'clipboard') {
            navigator.clipboard.writeText(convertToStandardLatex(content)).then(() => addNotification('Тестот е копиран како обичен текст.', 'success')).catch(() => addNotification('Грешка при копирање.', 'error'));
            return;
        }

        if (format === 'doc') {
            const printableElement = document.getElementById('full-printable-assessment');
            if (!printableElement) {
                addNotification('Грешка: Содржината за извоз не е пронајдена.', 'error');
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
                        body { font-family: 'Segoe UI', Calibri, sans-serif; font-size: 11pt; line-height: 1.5; color: #333; }
                        h1, h2, h3, h4 { color: #0D47A1; }
                        .katex { font-size: 1.1em !important; }
                        .mb-4 { margin-bottom: 1rem; }
                        .pb-4 { padding-bottom: 1rem; }
                        .border-b { border-bottom: 1px solid #eee; }
                        ul { list-style-type: none; padding-left: 20px; }
                        li { margin-bottom: 8px; }
                    </style>
                </head>
                <body>
                    <div style="max-width: 800px; margin: 0 auto;">
                        ${renderedHtml}
                    </div>
                </body>
                </html>
            `;
            try {
                const blob = new Blob([fullHtml], { type: 'text/html' });
                const clipboardItem = new ClipboardItem({ 'text/html': blob });
                navigator.clipboard.write([clipboardItem]).then(() => addNotification('Тестот е копиран со форматирање за Word.', 'success')).catch(() => addNotification('Грешка при копирање.', 'error'));
            } catch (error) {
                addNotification('Копирањето со форматирање не е поддржано.', 'error');
            }
            return;
        } else { // md, tex
            content = convertToStandardLatex(content);
            if(format === 'md') mimeType = 'text/markdown;charset=utf-8';
            if(format === 'tex') mimeType = 'application/x-tex;charset=utf-8';
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
    
    const levelLabels: Record<DifferentiationLevel, string> = {
        standard: 'Стандардна верзија',
        support: 'Верзија за поддршка',
        advanced: 'Верзија за напредни ученици',
    };

    const levelColors: Record<DifferentiationLevel, string> = {
        standard: 'bg-gray-100 text-gray-800',
        support: 'bg-green-100 text-green-800',
        advanced: 'bg-purple-100 text-purple-800',
    };
    
    const hasDifferentiatedVersions = editableMaterial.differentiatedVersions && editableMaterial.differentiatedVersions.length > 0;
    const currentQuestions = activeTab === 'standard' 
        ? editableMaterial.questions 
        : editableMaterial.differentiatedVersions?.find((v: DifferentiatedVersion) => v.profileName === activeTab)?.questions || [];

    const selfAssessmentSection = (questions?: string[]) => {
        if (!questions || questions.length === 0) return null;
        return (
            <div className="mt-6 pt-4 border-t">
                <h4 className="text-lg font-semibold text-brand-secondary mb-2">Прашања за самооценување</h4>
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                    {questions.map((sq, i) => (
                        <li key={i}>
                            <MathRenderer text={sq} />
                            <div className="h-12 border-b-2 border-dotted border-gray-400 mt-2"></div>
                        </li>
                    ))}
                </ul>
            </div>
        );
    };

    return (
        <>
        <Card id="printable-area" className="mt-6 border-l-4 border-brand-accent">
            <div className="flex justify-between items-start mb-4">
                <div className='flex-1 pr-4'>
                    {isEditing ? (
                        <input 
                            type="text" 
                            value={editableMaterial.title}
                            onChange={handleTitleChange}
                            className="text-2xl font-bold w-full p-1 border rounded-md"
                        />
                    ) : (
                        <h3 className="text-2xl font-bold">{editableMaterial.title}</h3>
                    )}
                    {!hasDifferentiatedVersions && editableMaterial.differentiationLevel && editableMaterial.differentiationLevel !== 'standard' && (
                        <span className={`mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full inline-block ${levelColors[editableMaterial.differentiationLevel]}`}>
                            {levelLabels[editableMaterial.differentiationLevel]}
                        </span>
                    )}
                </div>
                <div className="flex space-x-2 no-print">
                    {isEditing ? (
                        <>
                            <button onClick={handleCancelEdit} className="flex items-center bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 transition-colors text-sm">
                                <ICONS.close className="w-5 h-5 mr-1" /> Откажи
                            </button>
                             <button onClick={handleSaveEdit} className="flex items-center bg-green-600 text-white px-3 py-2 rounded-lg shadow hover:bg-green-700 transition-colors text-sm">
                                <ICONS.check className="w-5 h-5 mr-1" /> Зачувај
                            </button>
                        </>
                    ) : (
                         <div className="relative" ref={actionsMenuRef}>
                            <button type="button" onClick={() => setIsActionsMenuOpen((prev: boolean) => !prev)} className="flex items-center gap-2 bg-brand-primary text-white px-3 py-2 rounded-lg shadow hover:bg-brand-secondary">
                                <ICONS.menu className="w-5 h-5" />
                                Акции
                                <ICONS.chevronDown className={`w-4 h-4 transition-transform ${isActionsMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isActionsMenuOpen && (
                                <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-20 animate-fade-in-up">
                                    <div className="py-1">
                                         <button onClick={() => { setIsEditing(true); setIsActionsMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.edit className="w-5 h-5 mr-3" /> Уреди го тестот
                                        </button>
                                        <button onClick={() => { setShowFlashcards(true); setIsActionsMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.flashcards className="w-5 h-5 mr-3" /> Отвори флеш-картички
                                        </button>
                                        <button onClick={() => { setShowQuiz(true); setIsActionsMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            <ICONS.quiz className="w-5 h-5 mr-3" /> Започни квиз
                                        </button>
                                        <div className="border-t my-1"></div>
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
                    )}
                </div>
            </div>
            <div className="hidden print:block mb-4">
                <h3 className="text-xl font-bold">{editableMaterial.title}</h3>
                <p>Име и презиме: ____________________________</p>
                <p>Дата: ____________</p>
            </div>
            {editableMaterial.alignment_goal && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 no-print">
                    <strong>Цел на тестот:</strong> {editableMaterial.alignment_goal}
                </div>
            )}
            
            {hasDifferentiatedVersions && (
                <div className="border-b border-gray-200 mb-4 no-print">
                    <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                        <button onClick={() => setActiveTab('standard')} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === 'standard' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Стандардна верзија</button>
                        {editableMaterial.differentiatedVersions?.map((v: DifferentiatedVersion) => (
                            <button key={v.profileName} onClick={() => setActiveTab(v.profileName)} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeTab === v.profileName ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>За {v.profileName}</button>
                        ))}
                    </nav>
                </div>
            )}

            <div className="print:hidden">
                <QuestionList
                    questions={currentQuestions}
                    isEditing={isEditing}
                    handleQuestionFieldChange={(qIndex: number, field: keyof AssessmentQuestion, value: string) => handleQuestionFieldChangeForVersion(activeTab, qIndex, field, value)}
                    handleOptionChange={(qIndex: number, optIndex: number, value: string) => handleOptionChangeForVersion(activeTab, qIndex, optIndex, value)}
                />
                {selfAssessmentSection(editableMaterial.selfAssessmentQuestions)}
            </div>

            <div className="hidden print:block" id="full-printable-assessment">
                {/* Printable view */}
                <h3 className="text-xl font-bold">{editableMaterial.title}</h3>
                { hasDifferentiatedVersions ? (
                    <>
                        <h4 className="text-lg font-semibold mt-4">Стандардна верзија</h4>
                        <QuestionList questions={editableMaterial.questions} isEditing={false} handleQuestionFieldChange={()=>{}} handleOptionChange={()=>{}} />
                        {selfAssessmentSection(editableMaterial.selfAssessmentQuestions)}
                        {editableMaterial.differentiatedVersions?.map((v: DifferentiatedVersion) => (
                            <div key={v.profileName} className="mt-6 pt-6 border-t" style={{pageBreakBefore: 'always'}}>
                                <h4 className="text-lg font-semibold">Верзија за: {v.profileName}</h4>
                                <QuestionList questions={v.questions} isEditing={false} handleQuestionFieldChange={()=>{}} handleOptionChange={()=>{}} />
                            </div>
                        ))}
                    </>
                ) : (
                    <>
                        <QuestionList questions={editableMaterial.questions} isEditing={false} handleQuestionFieldChange={()=>{}} handleOptionChange={()=>{}} />
                        {selfAssessmentSection(editableMaterial.selfAssessmentQuestions)}
                    </>
                )}
            </div>
        </Card>
        {showFlashcards && <FlashcardViewer questions={editableMaterial.questions} title={editableMaterial.title} onClose={() => setShowFlashcards(false)} />}
        {showQuiz && <QuizViewer questions={editableMaterial.questions} onClose={() => setShowQuiz(false)} />}
        </>
    );
};