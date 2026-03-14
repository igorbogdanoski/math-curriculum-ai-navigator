import React, { useState, useEffect } from 'react';
import { Presentation, Download, Layout, Type, Image as ImageIcon, ChevronLeft, ChevronRight, FileDown, Sparkles, Loader2, BookOpen, Target, Cpu, MousePointer2 } from 'lucide-react';
import { AIGeneratedPresentation, PresentationSlide } from '../../types';
import { Card } from '../common/Card';
import { MathRenderer } from '../common/MathRenderer';
import { geminiService } from '../../services/geminiService';
import { useNotification } from '../../contexts/NotificationContext';

import { useAuth } from '../../contexts/AuthContext';

declare const PptxGenJS: any;

interface GeneratedPresentationProps {
  data: AIGeneratedPresentation;
}

export const GeneratedPresentation: React.FC<GeneratedPresentationProps> = ({ data }) => {
  const { user, updateLocalProfile } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [visuals, setVisuals] = useState<Record<number, { loading: boolean, url?: string }>>({});
  const [theme, setTheme] = useState<'modern' | 'classic' | 'dark' | 'creative'>('modern');
  const [showCurriculumSide, setShowCurriculumSide] = useState(true);
  const { addNotification } = useNotification();

  const handleGenerateImage = async (idx: number, prompt: string) => {
    const cost = 5; // AI_COSTS.ILLUSTRATION
    
    // Credit check
    if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
      if ((user.aiCreditsBalance ?? 0) < cost) {
        window.dispatchEvent(new CustomEvent('openUpgradeModal', { 
            detail: { reason: `Останавте без AI кредити! Генерирањето на илустрација за слајд чини ${cost} кредити. Надградете на Pro пакет.` }
        }));
        return;
      }
    }

    setVisuals(prev => ({ ...prev, [idx]: { loading: true } }));
    try {
      const result = await geminiService.generateIllustration(
        `Educational presentation slide visual for math: ${prompt}. Clean, high quality, vector style.`,
        undefined,
        user ?? undefined
      );

      // Deduct credits
      if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
          const { getFunctions, httpsCallable } = await import('firebase/functions');
          const { app } = await import('../../firebaseConfig');
          const functions = getFunctions(app);
          const deductFn = httpsCallable(functions, 'deductCredits');
          await deductFn({ amount: cost });
          updateLocalProfile({ aiCreditsBalance: (user.aiCreditsBalance || 0) - cost });
      }

      setVisuals(prev => ({ ...prev, [idx]: { loading: false, url: result.imageUrl } }));
      addNotification('Сликата за слајдот е генерирана!', 'success');
    } catch (error) {
      console.error('Slide visual error:', error);
      setVisuals(prev => ({ ...prev, [idx]: { loading: false } }));
      addNotification('Грешка при генерирање на сликата.', 'error');
    }
  };

  const downloadPPTX = () => {
    if (typeof PptxGenJS === 'undefined') {
      addNotification('Библиотеката за PPTX не е вчитана. Ве молиме почекајте или рефреширајте.', 'error');
      return;
    }

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    data.slides.forEach((slide: PresentationSlide, idx: number) => {
      const pptSlide = pptx.addSlide();
      const slideVisual = visuals[idx];
      
      // Theme colors based on selection
      const colors = {
        modern: { bg: 'FFFFFF', text: '0D47A1', body: '333333' },
        classic: { bg: 'F5F5F5', text: '000000', body: '000000' },
        dark: { bg: '1A237E', text: 'FFFFFF', body: 'E0E0E0' },
        creative: { bg: 'FFF9C4', text: 'E65100', body: '424242' }
      }[theme];

      pptSlide.background = { color: colors.bg };

      if (slide.type === 'title') {
        pptSlide.addText(slide.title, { 
          x: 0.5, y: 1.5, w: '90%', h: 1.5, 
          fontSize: 44, bold: true, color: colors.text, align: 'center',
          fontFace: 'Arial'
        });
        pptSlide.addText(data.topic, { 
          x: 0.5, y: 3.5, w: '90%', h: 0.5, 
          fontSize: 24, color: colors.body, align: 'center' 
        });
      } else {
        pptSlide.addText(slide.title, { 
          x: 0.5, y: 0.3, w: '90%', h: 0.8, 
          fontSize: 32, bold: true, color: colors.text,
          border: { pos: 'b', color: 'E0E0E0', size: 1 }
        });

        const contentText = slide.content.join('\n\n');
        pptSlide.addText(contentText, { 
          x: slideVisual?.url ? 4.5 : 0.5, y: 1.5, w: slideVisual?.url ? '55%' : '90%', h: 3.5, 
          fontSize: 18, color: colors.body, 
          bullet: { indent: 20 },
          valign: 'top'
        });

        if (slideVisual?.url) {
            // Note: PptxGenJS supports data URIs for images
            pptSlide.addImage({ data: slideVisual.url, x: 0.5, y: 1.5, w: 3.5, h: 3.5 });
        }
      }

      pptSlide.addText('Генерирано со Math Navigator AI', { 
        x: 0.5, y: 5.2, w: '90%', h: 0.3, 
        fontSize: 10, color: 'CCCCCC', align: 'right' 
      });
    });

    pptx.writeFile({ fileName: `${data.title.replace(/\s+/g, '_')}.pptx` });
  };

  const current = data.slides[currentSlide];
  const currentVisual = visuals[currentSlide];

  return (
    <div className="mt-6 flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Top Bar / Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-primary/10 rounded-2xl text-brand-primary">
            <Presentation className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-xl font-black text-gray-900">{data.title}</h3>
            <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[10px] font-bold rounded-full uppercase tracking-wider">Math Gamma PRO</span>
                <span className="text-xs text-gray-400">• {data.slides.length} слајдови</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
            {/* Theme Selector */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
                {(['modern', 'classic', 'dark', 'creative'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${theme === t ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <button
                onClick={() => setShowCurriculumSide(!showCurriculumSide)}
                className={`p-2 rounded-xl transition-colors ${showCurriculumSide ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                title="Курикулум пано"
            >
                <BookOpen className="w-5 h-5" />
            </button>

            <button
                onClick={downloadPPTX}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-secondary transition-all shadow-lg active:scale-95"
            >
                <FileDown className="w-5 h-5" />
                PPTX
            </button>
        </div>
      </div>

      <div className="flex gap-6 h-[650px]">
        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col gap-4">
            <div className={`flex-1 rounded-3xl shadow-2xl border transition-all duration-500 overflow-hidden relative group flex flex-col ${
                theme === 'dark' ? 'bg-indigo-950 border-indigo-900 text-white' : 
                theme === 'creative' ? 'bg-amber-50 border-amber-100 text-amber-900' :
                theme === 'classic' ? 'bg-gray-50 border-gray-200 text-black font-serif' :
                'bg-white border-gray-100 text-gray-900'
            }`}>
                {/* Slide Header */}
                <div className={`p-10 ${theme === 'modern' ? 'border-b border-gray-50' : ''}`}>
                    <h4 className={`font-black leading-tight ${current.type === 'title' ? 'text-5xl text-center mt-12' : 'text-3xl'}`}>
                        {current.title}
                    </h4>
                </div>

                {/* Slide Content */}
                <div className="flex-1 p-10 flex gap-8">
                    <div className="flex-1 overflow-y-auto">
                        {current.type === 'title' ? (
                            <div className="text-center mt-6">
                                <p className={`text-2xl font-bold ${theme === 'modern' ? 'text-brand-primary' : ''}`}>{data.topic}</p>
                                <div className="mt-8 flex items-center justify-center gap-4">
                                    <span className="px-4 py-2 bg-black/5 rounded-2xl text-sm font-bold uppercase tracking-widest">Одделение {data.gradeLevel}</span>
                                </div>
                            </div>
                        ) : (
                            <ul className="space-y-6">
                                {current.content.map((point, idx) => (
                                    <li key={idx} className="flex items-start gap-4 text-xl">
                                        <div className={`w-3 h-3 rounded-full mt-2.5 flex-shrink-0 ${
                                            theme === 'dark' ? 'bg-indigo-400' :
                                            theme === 'creative' ? 'bg-amber-500' :
                                            'bg-brand-primary'
                                        }`} />
                                        <MathRenderer text={point} />
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* AI Visual Placeholder / Image */}
                    {current.type !== 'title' && (
                        <div className="w-[350px] flex-shrink-0 flex flex-col gap-3">
                            {currentVisual?.url ? (
                                <div className="rounded-2xl overflow-hidden shadow-xl border border-white/20 animate-in zoom-in duration-500">
                                    <img src={currentVisual.url} alt="Slide Visual" className="w-full h-auto object-cover aspect-square" />
                                    <div className="p-3 bg-black/5 backdrop-blur-sm text-[10px] uppercase font-black tracking-widest text-center opacity-50">
                                        AI Generated Visual
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 border-2 border-dashed border-gray-300/50 rounded-2xl flex flex-col items-center justify-center p-6 text-center group/visual">
                                    <div className="p-4 bg-gray-100 rounded-full mb-4 group-hover/visual:scale-110 transition-transform">
                                        <ImageIcon className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-400 mb-4">{current.visualPrompt || 'Нема дефинирана визуелна идеја'}</p>
                                    <button
                                        onClick={() => handleGenerateImage(currentSlide, current.visualPrompt || current.title)}
                                        disabled={currentVisual?.loading}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all"
                                    >
                                        {currentVisual?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                        Генерирај слика
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 flex justify-between items-center opacity-30 text-[10px] font-black uppercase tracking-widest">
                    <span>{data.topic}</span>
                    <span>{currentSlide + 1} / {data.slides.length}</span>
                </div>

                {/* Navigation Controls */}
                <div className="absolute bottom-10 right-10 flex gap-2">
                    <button
                        onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                        disabled={currentSlide === 0}
                        className="w-12 h-12 bg-black/10 backdrop-blur-md rounded-2xl flex items-center justify-center hover:bg-black/20 disabled:opacity-10 transition-all"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        onClick={() => setCurrentSlide(prev => Math.min(data.slides.length - 1, prev + 1))}
                        disabled={currentSlide === data.slides.length - 1}
                        className="w-12 h-12 bg-black/10 backdrop-blur-md rounded-2xl flex items-center justify-center hover:bg-black/20 disabled:opacity-10 transition-all"
                    >
                        <ChevronRight className="w-6 h-6" />
                    </button>
                </div>
            </div>

            {/* Bottom Strip of Slide Previews */}
            <div className="h-24 flex gap-3 overflow-x-auto pb-2 custom-scrollbar no-print">
                {data.slides.map((s, idx) => (
                    <button
                        key={idx}
                        onClick={() => setCurrentSlide(idx)}
                        className={`flex-shrink-0 w-40 rounded-xl border-2 transition-all p-2 text-left relative overflow-hidden ${
                            currentSlide === idx ? 'border-brand-primary bg-brand-primary/5 ring-4 ring-brand-primary/10' : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                    >
                        <span className="text-[10px] font-black text-gray-400 absolute top-1 right-2">{idx + 1}</span>
                        <p className="text-[10px] font-bold line-clamp-2 mt-2 leading-tight">{s.title}</p>
                        <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-primary/20" style={{ width: `${((idx + 1) / data.slides.length) * 100}%` }} />
                        </div>
                    </button>
                ))}
            </div>
        </div>

        {/* Specialized Sidebars (Math Gamma style) */}
        {showCurriculumSide && (
            <div className="w-[300px] flex flex-col gap-4 animate-in slide-in-from-right duration-500">
                {/* Curriculum/Source Card (NotebookLM style) */}
                <div className="bg-indigo-900 rounded-3xl p-6 text-white shadow-xl flex-1 flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-white/10 rounded-xl">
                            <Cpu className="w-5 h-5 text-indigo-200" />
                        </div>
                        <h5 className="font-black text-sm uppercase tracking-widest">Интелигентен контекст</h5>
                    </div>

                    <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <div>
                            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block mb-2">Наставна Тема</span>
                            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                                <p className="text-sm font-bold">{data.topic}</p>
                            </div>
                        </div>

                        <div>
                            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block mb-2">Предлог Активности</span>
                            <div className="space-y-2">
                                {current.type === 'example' ? (
                                    <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20 text-green-200 text-xs italic">
                                        Слајдот е фокусиран на конкретен пример. Обезбедете детално објаснување на табла.
                                    </div>
                                ) : current.type === 'task' ? (
                                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-200 text-xs italic">
                                        Слајдот содржи задача. Овозможете време за индивидуална работа (3-5 мин).
                                    </div>
                                ) : (
                                    <p className="text-xs text-indigo-200 leading-relaxed">
                                        Овој дел од презентацијата служи за воведување на теоретски концепти. Користете го визуелниот приказ за да ја намалите когнитивната побарувачка.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div>
                            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block mb-2">Дигитални Алатки</span>
                            <div className="grid grid-cols-2 gap-2">
                                <button className="p-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-bold flex items-center gap-2 hover:bg-white/10 transition-colors">
                                    <MousePointer2 className="w-3 h-3" /> GeoGebra
                                </button>
                                <button className="p-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-bold flex items-center gap-2 hover:bg-white/10 transition-colors">
                                    <MousePointer2 className="w-3 h-3" /> Desmos
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <Card className="p-4 bg-white border-gray-100 flex flex-col gap-2">
                    <button onClick={() => window.print()} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center gap-3">
                            <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-brand-primary" />
                            <span className="text-xs font-bold text-gray-600">Печати како PDF</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                    <button className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center gap-3">
                            <Sparkles className="w-4 h-4 text-gray-400 group-hover:text-amber-500" />
                            <span className="text-xs font-bold text-gray-600">Авто-генерирај слики</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                </Card>
            </div>
        )}
      </div>
    </div>
  );
};
