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
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
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
    navigator.clipboard.writeText(url)
      .then(() => {
        addNotification('Линкот за споделување е копиран!', 'success');
      })
      .catch(() => {
        addNotification('Грешка при копирање на линкот.', 'error');
      });
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
    
    const arrayToLines = (arr: string[] = []) => arr.map(item => `- ${item}`).join('\n');
    const fullText = `Наслов: ${title}\nОдделение: ${grade}\nТема: ${theme}\n\nЦЕЛИ:\n${(objectives || []).join('\n')}\n\nСТАНДАРДИ ЗА ОЦЕНУВАЊЕ:\n${(assessmentStandards || []).join('\n')}\n\nСЦЕНАРИО:\nВовед: ${scenario.introductory}\nГлавни: ${(scenario.main || []).join('; ')}\nЗавршна: ${scenario.concluding}\n\nМАТЕРИЈАЛИ:\n${(materials || []).join('\n')}\n\nСЛЕДЕЊЕ НА НАПРЕДОК:\n${(progressMonitoring || []).join('\n')}\n`;
    
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
            content = `# ${title}\n\n**Одделение:** ${grade}\n**Тема:** ${theme}\n\n---\n\n## Цели\n${arrayToLines(objectives)}\n\n## Стандарди за оценување\n${arrayToLines(assessmentStandards)}\n\n## Сценарио\n### Вовед\n${scenario.introductory}\n### Главни активности\n${arrayToLines(scenario.main)}\n### Завршна активност\n${scenario.concluding}\n\n---\n\n## Материјали\n${arrayToLines(materials)}\n\n## Следење на напредокот\n${arrayToLines(progressMonitoring)}`;
            content = convertToStandardLatex(content);
            break;
        case 'tex':
            mimeType = 'application/x-tex;charset=utf-8';
            extension = 'tex';
            content = `\\documentclass[12pt, a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amsmath}\n\\usepackage{amssymb}\n\\title{${escapeLatexAware(title)}}\n\\author{${escapeLatexAware(String(grade))}. одделение}\n\\date{}\n\\begin{document}\n\\maketitle\n\\section*{Цели}\n\\begin{itemize}\n${(objectives || []).map((item: string) => `\\item ${escapeLatexAware(item)}`).join('\n')}\n\\end{itemize}\n\\section*{Сценарио}\n\\subsection*{Вовед}\n${escapeLatexAware(scenario.introductory)}\n\\subsection*{Главни активности}\n\\begin{enumerate}\n${(scenario.main || []).map((item: string) => `\\item ${escapeLatexAware(item)}`).join('\n')}\n\\end{enumerate}\n\\subsection*{Завршна активност}\n${escapeLatexAware(scenario.concluding)}\n\\end{document}`;
            break;
        case 'doc': {
            const listHtml = (items: string[] = []) => items.length ? `<ul>${items.map(i => `<li>${escapeHtml(i)}</li>`).join('')}</ul>` : '<p><i>Нема</i></p>';
            
            const htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>${escapeHtml(title)}</title>
                <style>
                    body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; }
                    h1 { font-size: 18pt; color: #2E74B5; margin-bottom: 10px; border-bottom: 2px solid #2E74B5; padding-bottom: 5px; }
                    h2 { font-size: 14pt; color: #2E74B5; border-bottom: 1px solid #ddd; padding-bottom: 2px; margin-top: 20px; margin-bottom: 10px; }
                    h3 { font-size: 12pt; font-weight: bold; margin-top: 15px; margin-bottom: 5px; color: #444; }
                    p { margin-bottom: 10px; }
                    ul, ol { margin-bottom: 10px; padding-left: 30px; }
                    li { margin-bottom: 5px; }
                    .meta { color: #666; font-size: 10pt; margin-bottom: 20px; background: #f9f9f9; padding: 10px; border-radius: 5px; }
                    .meta p { margin: 2px 0; }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(title || 'Без наслов')}</h1>
                <div class="meta">
                    <p><b>Одделение:</b> ${grade || ''}</p>
                    <p><b>Тема:</b> ${escapeHtml(theme || '')}</p>
                    <p><b>Предмет:</b> ${escapeHtml(plan.subject || 'Математика')}</p>
                </div>

                <h2>Наставни цели</h2>
                ${listHtml(objectives)}

                <h2>Стандарди за оценување</h2>
                ${listHtml(assessmentStandards)}

                <h2>Сценарио</h2>
                <h3>Воведна активност</h3>
                <p>${escapeHtml(scenario?.introductory)}</p>
                
                <h3>Главни активности</h3>
                <ol>
                    ${(scenario?.main || []).map((m: string) => `<li>${escapeHtml(m)}</li>`).join('')}
                </ol>

                <h3>Завршна активност</h3>
                <p>${escapeHtml(scenario?.concluding)}</p>

                <h2>Средства и Материјали</h2>
                ${listHtml(materials)}

                <h2>Следење на напредокот</h2>
                ${listHtml(progressMonitoring)}

                ${differentiation ? `<h2>Диференцијација</h2><p>${escapeHtml(differentiation)}</p>` : ''}
                ${reflectionPrompt ? `<h2>Рефлексија за наставникот</h2><p>${escapeHtml(reflectionPrompt)}</p>` : ''}
                ${selfAssessmentPrompt ? `<h2>Самооценување за ученици</h2><p>${escapeHtml(selfAssessmentPrompt)}</p>` : ''}
            </body>
            </html>`;

             try {
                const blob = new Blob([htmlContent], { type: 'text/html' }); // Using text/html makes word open it correctly with styles
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.doc`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                addNotification('Документот е преземен.', 'success');
            } catch (error) {
                console.error('Doc export failed:', error);
                addNotification('Грешка при извоз.', 'error');
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
                            <button onClick={() => handleExport('pdf')} disabled={isGeneratingPDF} className="w-full text-left flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-100">
                                {isGeneratingPDF ? <ICONS.spinner className="w-5 h-5 mr-3 animate-spin" /> : <ICONS.printer className="w-5 h-5 mr-3" />}
                                {isGeneratingPDF ? 'Генерирам PDF...' : 'Сними како PDF (High Res)'}
                            </button>
                            <div className="border-t my-1"></div>
                            <button onClick={() => handleExport('doc')} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                <ICONS.edit className="w-5 h-5 mr-3" /> Сними како Word (.doc)
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
    </div>
  );
};