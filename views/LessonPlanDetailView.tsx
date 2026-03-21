import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePlanner } from '../contexts/PlannerContext';
import { ICONS } from '../constants';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { useNotification } from '../contexts/NotificationContext';
import { shareService } from '../services/shareService';
import { LessonPlanDisplay } from '../components/planner/LessonPlanDisplay';
import { useNavigation } from '../contexts/NavigationContext';
import type { LessonPlan } from '../types';
import { useLastVisited } from '../contexts/LastVisitedContext';
import { useCurriculum } from '../hooks/useCurriculum';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/common/Card';
import { exportLessonPlanToWord } from '../utils/wordExport';
const LessonPlanPDFButton = React.lazy(() =>
  import('../components/lesson-plan-editor/LessonPlanPDF').then(m => ({ default: m.LessonPlanPDFButton }))
);

interface LessonPlanDetailViewProps {
  id: string;
}

declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

// Helper to dynamically load PDF libraries only when needed to save bandwidth
const ensurePdfLibs = async () => {
    if (window.jspdf && window.html2canvas) return;

    return Promise.all([
        new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        }),
        new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        })
    ]);
};

const convertToStandardLatex = (text: string): string => {
    return text.replace(/\\\\/g, '\\');
};

const escapeLatexAware = (str: string | undefined): string => {
    if (!str) return '';
    const standardStr = convertToStandardLatex(str);
    const parts = standardStr.split(/(\$.*?\$|\$\$[\s\S]*?\$\$|\\\(.*?\\\)|\\[[\s\S]*?\\])/g);
    
    return parts.map((part, index) => {
        if (index % 2 === 0) {
            return part
                .replace(/\\/g, '\\textbackslash{}')
                .replace(/([&%$#_{}])/g, '\\$1')
                .replace(/~/g, '\\textasciitilde{}')
                .replace(/\^/g, '\\textasciicircum{}');
        } else {
            return part;
        }
    }).join('');
};

export const LessonPlanDetailView: React.FC<LessonPlanDetailViewProps> = ({ id }) => {
  const { navigate } = useNavigation();
  const { getLessonPlan, isUserPlan, importCommunityPlan, addCommentToCommunityPlan } = usePlanner();
  const { isFavoriteLessonPlan, toggleFavoriteLessonPlan } = useUserPreferences();
  const { addNotification } = useNotification();
  const { setLastVisited } = useLastVisited();
  const { getConceptDetails } = useCurriculum();
  const { user } = useAuth();
  
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const printableRef = useRef<HTMLDivElement>(null);
  
  const plan = getLessonPlan(id);
  const isOwned = plan ? isUserPlan(plan.id) : false;

  useEffect(() => {
    if (plan) {
      setLastVisited({ path: `/planner/lesson/view/${id}`, label: plan.title, type: 'lesson' });
    }
  }, [plan, id, setLastVisited]);
  
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

  const handleShare = () => {
    if (!plan) return;
    const shareData = shareService.generateShareData(plan);
    const url = `${window.location.origin}${window.location.pathname}#/share/${shareData}`;
    setShareUrl(url);
    setIsShareDialogOpen(true);
  };

  const handleRemix = async () => {
    if (plan) {
      try {
        const newPlanId = await importCommunityPlan(plan as LessonPlan);
        addNotification(`Успешен Remix! Креирана е копија во "Мои подготовки".`, 'success');
        navigate(`/planner/lesson/${newPlanId}`); // Go directly to editor
      } catch (error) {
        addNotification('Грешка при креирање на копија.', 'error');
        console.error("Import failed:", error);
      }
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) {
          addNotification('Мора да сте најавени за да коментирате.', 'info');
          return;
      }
      if (!commentText.trim()) return;

      setIsSubmittingComment(true);
      try {
          await addCommentToCommunityPlan(id, {
              authorName: user.name,
              text: commentText,
              date: new Date().toISOString()
          });
          setCommentText('');
          addNotification('Коментарот е објавен.', 'success');
      } catch (error) {
          addNotification('Грешка при објавување на коментарот.', 'error');
      } finally {
          setIsSubmittingComment(false);
      }
  };
  
  const handleExport = async (format: 'md' | 'tex' | 'pdf' | 'doc' | 'clipboard') => {
    if (!plan) return;
    setIsExportMenuOpen(false);
    
    const { title, grade, theme, objectives, assessmentStandards, scenario, materials, progressMonitoring, differentiation, reflectionPrompt, selfAssessmentPrompt } = plan;

    // Modern Client-Side PDF Generation
    if (format === 'pdf') {
        setIsGeneratingPDF(true);
        try {
            // Dynamic import of libraries
            await ensurePdfLibs();
            
            if (!window.jspdf || !window.html2canvas) {
                throw new Error("PDF libraries failed to load. Please check internet connection.");
            }

            const element = printableRef.current;
            if (!element) throw new Error("Printable element not found");

            // Wait for any potential images/math to render
            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await window.html2canvas(element, {
                scale: 2, // Higher scale for better quality
                useCORS: true,
                logging: false,
                windowWidth: 1200 // Force desktop width for consistent layout
            });

            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            pdf.save(`${title.replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_')}.pdf`);
            addNotification('PDF фајлот е успешно генериран.', 'success');

        } catch (error) {
            console.error("PDF Generation Error:", error);
            addNotification('Грешка при генерирање на PDF. Пробајте со "Печати" опцијата ако ова не успее.', 'error');
        } finally {
            setIsGeneratingPDF(false);
        }
        return;
    }
    
    const arrayToLines = (arr: any[] = []) => arr.map(item => `- ${typeof item === 'string' ? item : item.text}${item.bloomsLevel ? ` [${item.bloomsLevel}]` : ''}`).join('\n');
    
    const introductoryText = typeof scenario?.introductory === 'string' ? scenario.introductory : scenario?.introductory?.text || '';
    const concludingText = typeof scenario?.concluding === 'string' ? scenario.concluding : scenario?.concluding?.text || '';
    const mainActivitiesText = (scenario?.main || []).map((a: any) => typeof a === 'string' ? a : `${a.text}${a.bloomsLevel ? ` [${a.bloomsLevel}]` : ''}`).join('; ');

    const fullText = `Наслов: ${title}\nОдделение: ${grade}\nТема: ${theme}\n\nЦЕЛИ:\n${arrayToLines(objectives || [])}\n\nСТАНДАРДИ ЗА ОЦЕНУВАЊЕ:\n${(assessmentStandards || []).join('\n')}\n\nСЦЕНАРИО:\nВовед: ${introductoryText}\nГлавни: ${mainActivitiesText}\nЗавршна: ${concludingText}\n\nМАТЕРИЈАЛИ:\n${(materials || []).join('\n')}\n\nСЛЕДЕЊЕ НА НАПРЕДОК:\n${(progressMonitoring || []).join('\n')}\n`;
    
    const standardLatexText = convertToStandardLatex(fullText);

    if (format === 'clipboard') {
        navigator.clipboard.writeText(standardLatexText)
            .then(() => addNotification('Подготовката е копирана како обичен текст.', 'success'))
            .catch(() => addNotification('Грешка при копирање.', 'error'));
        return;
    }

    let content = '';
    let mimeType = '';
    let extension = '';
    const filename = `${(title || 'plan').replace(/[^a-z0-9а-шѓѕјљњќџч]/gi, '_').toLowerCase()}`;
    const escapeHtml = (unsafe: string = '') => unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    switch(format) {
        case 'md':
            mimeType = 'text/markdown;charset=utf-8';
            extension = 'md';
            content = `# ${title}\n\n**Одделение:** ${grade}\n**Тема:** ${theme}\n\n---\n\n## Цели\n${arrayToLines(objectives)}\n\n## Стандарди за оценување\n${arrayToLines(assessmentStandards)}\n\n## Сценарио\n### Вовед\n${introductoryText}\n### Главни активности\n${arrayToLines(scenario.main)}\n### Завршна активност\n${concludingText}\n\n---\n\n## Материјали\n${arrayToLines(materials)}\n\n## Следење на напредокот\n${arrayToLines(progressMonitoring)}`;
            content = convertToStandardLatex(content);
            break;
        case 'tex':
            mimeType = 'application/x-tex;charset=utf-8';
            extension = 'tex';
            content = `\\documentclass[12pt, a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n\\usepackage{amssymb}\n\\title{${escapeLatexAware(title)}}\n\\author{${escapeLatexAware(String(grade))}. одделение}\n\\date{}\n\\begin{document}\n\\maketitle\n\\section*{Цели}\n\\begin{itemize}\n${(objectives || []).map((item: any) => `\\item ${escapeLatexAware(typeof item === 'string' ? item : item.text)}`).join('\n')}\n\\end{itemize}\n\\section*{Сценарио}\n\\subsection*{Вовед}\n${escapeLatexAware(introductoryText)}\n\\subsection*{Главни активности}\n\\begin{enumerate}\n${(scenario.main || []).map((item: any) => `\\item ${escapeLatexAware(typeof item === 'string' ? item : item.text)}`).join('\n')}\n\\end{enumerate}\n\\subsection*{Завршна активност}\n${escapeLatexAware(concludingText)}\n\\end{document}`;
            break;
        case 'doc': {
            setIsGeneratingWord(true);
            try {
                await exportLessonPlanToWord(plan as LessonPlan, user);
                addNotification('Документот е успешно зачуван како Word (.docx).', 'success');
            } catch (error) {
                console.error('Word export failed:', error);
                addNotification('Грешка при експортирање во Word.', 'error');
            } finally {
                setIsGeneratingWord(false);
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


  if (!plan) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600">Подготовката не е пронајдена.</h2>
        <button onClick={() => navigate('/my-lessons')} className="mt-4 px-4 py-2 bg-brand-primary text-white rounded">
          Назад кон моите подготовки
        </button>
      </div>
    );
  }

  const isFavorite = isFavoriteLessonPlan(plan.id);

  return (
    <div className="p-8 animate-fade-in">
      <header className="no-print flex flex-col md:flex-row justify-between items-start mb-6 gap-4">
        <div>
            <button onClick={() => navigate(isOwned ? '/my-lessons' : '/gallery')} className="text-brand-secondary hover:underline mb-2 flex items-center text-sm">
                <ICONS.chevronRight className="w-4 h-4 rotate-180 mr-1"/> Назад кон {isOwned ? 'моите подготовки' : 'галеријата'}
            </button>
            <div className="flex items-center gap-4">
              <h1 className="text-4xl font-bold text-brand-primary">{plan.title}</h1>
              <button 
                onClick={() => toggleFavoriteLessonPlan(plan.id)} 
                title={isFavorite ? 'Отстрани од омилени' : 'Додади во омилени'} 
                aria-label={isFavorite ? 'Отстрани од омилени' : 'Додади во омилени'}
                className="text-yellow-500 hover:text-yellow-600 transition-transform hover:scale-110"
              >
                {isFavorite ? <ICONS.starSolid className="w-8 h-8" /> : <ICONS.star className="w-8 h-8" />}
              </button>
            </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
            {isOwned ? (
                <>
                    <button onClick={handleShare} className="flex items-center bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 shadow-sm transition-colors">
                        <ICONS.share className="w-5 h-5 mr-2"/> Сподели
                    </button>
                    <button onClick={() => navigate(`/planner/lesson/${plan.id}`)} className="flex items-center bg-brand-secondary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-primary transition-colors">
                        <ICONS.edit className="w-5 h-5 mr-2"/> Уреди
                    </button>
                </>
            ) : (
                <button onClick={handleRemix} className="flex items-center bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors transform hover:scale-105 font-bold">
                    <ICONS.sparkles className="w-5 h-5 mr-2" /> Remix & Adapt
                </button>
            )}
             
             {/* Export Dropdown */}
             <div className="relative" ref={exportMenuRef}>
                <button type="button" onClick={() => setIsExportMenuOpen((prev: boolean) => !prev)} className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-blue-800 transition-colors">
                    <ICONS.download className="w-5 h-5" />
                    Извези
                    <ICONS.chevronDown className={`w-4 h-4 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isExportMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-md shadow-xl bg-white ring-1 ring-black ring-opacity-5 z-20 animate-fade-in-up">
                        <div className="py-1">
                            <React.Suspense fallback={null}>
                              <LessonPlanPDFButton plan={plan as LessonPlan} />
                            </React.Suspense>
                            <button onClick={() => handleExport('pdf')} disabled={isGeneratingPDF || isGeneratingWord} className="w-full text-left flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-100">
                                {isGeneratingPDF ? <ICONS.spinner className="w-5 h-5 mr-3 animate-spin" /> : <ICONS.printer className="w-5 h-5 mr-3" />}
                                {isGeneratingPDF ? 'Генерирам PDF...' : 'Сними како PDF (Screenshot)'}
                            </button>
                            <div className="border-t my-1"></div>
                            <button onClick={() => handleExport('doc')} disabled={isGeneratingPDF || isGeneratingWord} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                {isGeneratingWord ? <ICONS.spinner className="w-5 h-5 mr-3 animate-spin" /> : <ICONS.edit className="w-5 h-5 mr-3" />} 
                                {isGeneratingWord ? 'Генерирам Word...' : 'Сними како Word (Напреден Експорт)'}
                            </button>
                            <button onClick={() => handleExport('md')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <ICONS.download className="w-5 h-5 mr-3" /> Сними како Markdown (.md)
                            </button>
                            <button onClick={() => handleExport('tex')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <ICONS.download className="w-5 h-5 mr-3" /> Сними како LaTeX (.tex)
                            </button>
                             <button onClick={() => handleExport('clipboard')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <ICONS.edit className="w-5 h-5 mr-3" /> Копирај како обичен текст
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
      </header>

      {/* Printable Area Wrapper */}
      <div ref={printableRef} id="printable-area" className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 print:shadow-none print:p-0 print:border-none">
         {/* Header shown only in print/pdf export */}
        <div className="hidden print:block mb-6 border-b pb-4">
             <div className="flex justify-between items-end">
                 <div>
                    <h1 className="text-3xl font-bold text-brand-primary mt-2">{plan.title}</h1>
                    <p className="text-lg text-gray-600">{plan.grade}. Одделение</p>
                 </div>
                 <div className="text-right">
                     <p className="text-md text-gray-500">Предмет: {plan.subject}</p>
                     <p className="text-md text-gray-500">Тема: {plan.theme}</p>
                 </div>
             </div>
        </div>

        <LessonPlanDisplay plan={plan} />
      </div>

      {/* Community & Collaboration Section - Modernized */}
      {plan.isPublished && (
          <div className="mt-12 no-print max-w-4xl mx-auto">
              <div className="flex items-center gap-3 mb-6 border-b pb-2">
                  <div className="p-2 bg-indigo-100 rounded-full text-indigo-600">
                    <ICONS.chatBubble className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">Дискусија и Соработка</h3>
              </div>
              
              {/* New Comment Input - Chat Style */}
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 mb-8 flex gap-4 items-start">
                  <div className="flex-shrink-0">
                      {user?.photoURL ? (
                          <img src={user.photoURL} alt={user.name} className="w-10 h-10 rounded-full object-cover ring-2 ring-offset-2 ring-indigo-100" />
                      ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 font-bold ring-2 ring-offset-2 ring-indigo-100">
                              {user?.name ? user.name.charAt(0) : '?'}
                          </div>
                      )}
                  </div>
                  <form onSubmit={handlePostComment} className="flex-grow relative">
                      <textarea
                          value={commentText}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCommentText(e.target.value)}
                          placeholder={user ? "Споделете го вашето мислење, искуство или предлог за подобрување..." : "Најавете се за да се приклучите на дискусијата"}
                          className="w-full p-4 rounded-2xl bg-gray-50 border-transparent focus:border-brand-secondary focus:bg-white focus:ring-0 resize-none text-sm transition-all duration-200 min-h-[100px]"
                          disabled={!user || isSubmittingComment}
                      />
                      <div className="absolute bottom-3 right-3">
                          <button
                              type="submit"
                              disabled={!user || !commentText.trim() || isSubmittingComment}
                              className="p-2 bg-brand-primary text-white rounded-full hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95 shadow-sm"
                              title="Испрати коментар"
                          >
                              {isSubmittingComment ? <ICONS.spinner className="animate-spin w-5 h-5" /> : <ICONS.share className="w-5 h-5 transform rotate-90" />}
                          </button>
                      </div>
                  </form>
              </div>

              {/* Comments Feed */}
              <div className="space-y-6">
                  {plan.comments && plan.comments.length > 0 ? (
                      plan.comments.slice().reverse().map((comment: { authorName: string; text: string; date: string }, index: number) => (
                          <div key={index} className="flex gap-4 animate-fade-in group">
                              <div className="flex-shrink-0">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                      {comment.authorName.charAt(0)}
                                  </div>
                              </div>
                              <div className="flex-grow">
                                  <div className="flex items-baseline gap-2 mb-1">
                                      <span className="font-bold text-gray-900 text-sm">{comment.authorName}</span>
                                      <span className="text-xs text-gray-400">• {new Date(comment.date).toLocaleDateString('mk-MK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <div className="bg-gray-50 p-3 rounded-2xl rounded-tl-none text-gray-700 text-sm leading-relaxed whitespace-pre-wrap shadow-sm border border-gray-100 group-hover:bg-white group-hover:shadow-md transition-all duration-200">
                                      {comment.text}
                                  </div>
                              </div>
                          </div>
                      ))
                  ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                          <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 shadow-sm">
                             <ICONS.chatBubble className="w-8 h-8 text-indigo-300" />
                          </div>
                          <h4 className="text-gray-900 font-medium">Се уште нема коментари</h4>
                          <p className="text-gray-500 text-sm mt-1">Бидете првиот што ќе започне дискусија за оваа подготовка!</p>
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* П-И: Share Dialog */}
      {isShareDialogOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setIsShareDialogOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-brand-primary">Сподели со колега</h3>
              <button type="button" aria-label="Затвори" onClick={() => setIsShareDialogOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <ICONS.close className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Испрати ја оваа подготовка на колега — тие можат да ја прегледаат и да направат своја копија.
            </p>
            {/* Link field */}
            <div className="flex gap-2 mb-5">
              <input
                type="text"
                readOnly
                aria-label="Линк за споделување"
                value={shareUrl}
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2.5 bg-gray-50 text-gray-700 select-all focus:outline-none focus:ring-2 focus:ring-brand-primary"
                onFocus={e => e.target.select()}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl)
                    .then(() => addNotification('Линкот е копиран!', 'success'))
                    .catch(() => addNotification('Грешка при копирање.', 'error'));
                }}
                className="flex items-center gap-1.5 bg-brand-primary text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-brand-secondary transition-colors whitespace-nowrap"
              >
                <ICONS.copy className="w-4 h-4" /> Копирај
              </button>
            </div>
            {/* Share channels */}
            <div className="grid grid-cols-2 gap-3">
              <a
                href={`mailto:?subject=${encodeURIComponent('Подготовка: ' + plan.title)}&body=${encodeURIComponent('Поздрав,\n\nТе споделувам оваа наставна подготовка по математика:\n\n' + plan.title + '\n\n' + shareUrl + '\n\nСо почит')}`}
                className="flex items-center justify-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors"
              >
                <ICONS.email className="w-4 h-4" /> Испрати Email
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent('Подготовка: ' + plan.title + '\n' + shareUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm font-medium hover:bg-green-100 transition-colors"
              >
                <ICONS.share className="w-4 h-4" /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};