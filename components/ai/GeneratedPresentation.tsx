import { logger } from '../../utils/logger';
import React, { useState } from 'react';
import { Presentation, Image as ImageIcon, ChevronLeft, ChevronRight, FileDown, Sparkles, Loader2, BookOpen, Cpu, MousePointer2, Radio, Maximize2, Minimize2, PenLine, Plus, Trash2, Save, Check, Play, ArrowUp, ArrowDown, FileText, X, Zap } from 'lucide-react';
import { LiveQuizPanel } from './presentation/LiveQuizPanel';
import { downloadPresentationPPTX } from './presentation/presentationPptxExport';
import { AIGeneratedPresentation, PresentationSlide } from '../../types';
import { GammaModeModal } from './GammaModeModal';
import { SilentErrorBoundary } from '../common/SilentErrorBoundary';
import { Card } from '../common/Card';
import { MathRenderer } from '../common/MathRenderer';
import { geminiService } from '../../services/geminiService';
import { AI_COSTS } from '../../services/gemini/core';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { firestoreService } from '../../services/firestoreService';
import { trackCreditConsumed } from '../../services/telemetryService';
export { isPureMathExpr } from './presentation/presentationMathUtils';
import {
  StepByStepSlide, FormulaCenteredSlide, ProofSlide,
  ComparisonSlide, ExampleSlide, SummarySlide,
} from './presentation/PresentationSlideTypes';

interface GeneratedPresentationProps {
  data: AIGeneratedPresentation;
  conceptId?: string;
}

export const GeneratedPresentation: React.FC<GeneratedPresentationProps> = ({ data, conceptId }) => {
  const { user, firebaseUser, updateLocalProfile } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [visuals, setVisuals] = useState<Record<number, { loading: boolean, url?: string }>>({});
  const [openVisualPrompt, setOpenVisualPrompt] = useState(false);
  const [visualCustomPrompt, setVisualCustomPrompt] = useState('');
  const [theme, setTheme] = useState<'modern' | 'classic' | 'dark' | 'creative'>('modern');
  const [showCurriculumSide, setShowCurriculumSide] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gammaMode, setGammaMode] = useState(false);
  const [editedSlides, setEditedSlides] = useState<PresentationSlide[]>(() => data.slides.map(s => ({ ...s, content: [...s.content] })));
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showAiContentModal, setShowAiContentModal] = useState(false);
  const [aiContentText, setAiContentText] = useState('');
  const [isGeneratingFromContent, setIsGeneratingFromContent] = useState(false);
  const { addNotification } = useNotification();

  const trackFeedback = (
    action: 'edit_regenerated' | 'reject_visual' | 'accept_saved',
    context?: string,
  ) => {
    if (!firebaseUser?.uid) return;
    firestoreService.logAIMaterialFeedbackEvent({
      teacherUid: firebaseUser.uid,
      materialType: 'presentation',
      action,
      context,
    }).catch(() => undefined);
  };

  const updateSlideTitle = (idx: number, title: string) =>
    setEditedSlides(prev => prev.map((s, i) => i === idx ? { ...s, title } : s));
  const updateSlideBullet = (slideIdx: number, bulletIdx: number, text: string) =>
    setEditedSlides(prev => prev.map((s, i) => i === slideIdx ? { ...s, content: s.content.map((c, j) => j === bulletIdx ? text : c) } : s));
  const addSlideBullet = (slideIdx: number) =>
    setEditedSlides(prev => prev.map((s, i) => i === slideIdx ? { ...s, content: [...s.content, ''] } : s));
  const removeSlideBullet = (slideIdx: number, bulletIdx: number) =>
    setEditedSlides(prev => prev.map((s, i) => i === slideIdx ? { ...s, content: s.content.filter((_, j) => j !== bulletIdx) } : s));

  const addSlide = (afterIdx: number) => {
    setEditedSlides(prev => {
      const copy = [...prev];
      copy.splice(afterIdx + 1, 0, { type: 'content', title: 'Нов слајд', content: [''] });
      return copy;
    });
    setCurrentSlide(afterIdx + 1);
  };

  const deleteSlide = (idx: number) => {
    setEditedSlides(prev => {
      if (prev.length <= 1) return prev;
      const copy = prev.filter((_, i) => i !== idx);
      setCurrentSlide(s => Math.min(s, copy.length - 1));
      return copy;
    });
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    setEditedSlides(prev => {
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
    setCurrentSlide(target);
  };

  const handleGenerateFromContent = async () => {
    if (!aiContentText.trim() || isGeneratingFromContent) return;
    setIsGeneratingFromContent(true);
    try {
      const result = await geminiService.generatePresentation(
        data.topic, data.gradeLevel, [],
        `Генерирај слајдови врз основа на следната содржина:\n\n${aiContentText}`,
        user ?? undefined,
      );
      setEditedSlides(result.slides.map(s => ({ ...s, content: [...s.content] })));
      setCurrentSlide(0);
      setShowAiContentModal(false);
      setAiContentText('');
      trackFeedback('edit_regenerated', 'source:ai_content_modal');
      addNotification('Слајдовите се генерирани од содржината!', 'success');
    } catch {
      addNotification('Грешка при генерирање на слајдови.', 'error');
    } finally {
      setIsGeneratingFromContent(false);
    }
  };

  const handleSavePresentation = async () => {
    if (!firebaseUser) return;
    setIsSaving(true);
    try {
      const { db } = await import('../../firebaseConfig');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'saved_presentations'), {
        ...data,
        slides: editedSlides,
        teacherUid: firebaseUser.uid,
        savedAt: serverTimestamp(),
        visuals: Object.fromEntries(
          Object.entries(visuals).filter(([, v]) => v.url).map(([k, v]) => [k, v.url])
        ),
      });
      setIsSaved(true);
      trackFeedback('accept_saved', 'target:saved_presentation');
    } catch (err) {
      logger.error('[save-presentation]', err);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Live Quiz from Slide ────────────────────────────────────────────────────
  const [showLivePanel, setShowLivePanel] = useState(false);
  const handleGenerateImage = async (idx: number, prompt: string) => {
    const cost = AI_COSTS.ILLUSTRATION;
    
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

      // Credit deduction now happens server-side (api/imagen.ts defaults to
      // ILLUSTRATION when no costKey is sent) — no separate client-side call
      // needed. Local balance is refreshed optimistically only.
      if (user && user.role !== 'admin' && !user.isPremium && !user.hasUnlimitedCredits) {
          const previousBalance = user.aiCreditsBalance || 0;
          const newBalance = Math.max(0, previousBalance - cost);
          updateLocalProfile({ aiCreditsBalance: newBalance });
          // S39-F2: telemetry
          trackCreditConsumed({
              uid: firebaseUser?.uid, amount: cost, previousBalance, newBalance,
              reason: 'presentation_slide_visual',
          });
      }

      setVisuals(prev => ({ ...prev, [idx]: { loading: false, url: result.imageUrl } }));
      trackFeedback('edit_regenerated', `slide_index:${idx}`);
      addNotification('Сликата за слајдот е генерирана!', 'success');
    } catch (error) {
      logger.error('Slide visual error:', error);
      setVisuals(prev => ({ ...prev, [idx]: { loading: false } }));
      addNotification('Грешка при генерирање на сликата.', 'error');
    }
  };

  const [isExportingPptx, setIsExportingPptx] = useState(false);
  const [pptxProgress, setPptxProgress] = useState(0);

  const downloadPPTX = () => downloadPresentationPPTX({ data, theme, visuals, setIsExportingPptx, setPptxProgress, addNotification });

  const slides = editedSlides;
  const current = slides[currentSlide];
  const currentVisual = visuals[currentSlide];

  // ── Fullscreen slide body (shared between normal + fullscreen render) ──────
  const renderSlideBody = (slide: PresentationSlide, slideIdx: number, fullscreen = false) => {
    const visual = visuals[slideIdx];
    const textSize = fullscreen ? 'text-2xl' : 'text-xl';
    return (
      <div className={`flex gap-8 ${fullscreen ? 'flex-1 p-8 overflow-hidden' : 'flex-1 p-10 flex'}`}>
        <div className="flex-1 overflow-y-auto">
          {slide.type === 'title' ? (
            <div className="text-center mt-6">
              <p className={`text-2xl font-bold ${theme === 'modern' ? 'text-brand-primary' : ''}`}>{data.topic}</p>
              <div className="mt-8 flex items-center justify-center gap-4">
                <span className="px-4 py-2 bg-black/5 rounded-2xl text-sm font-bold uppercase tracking-widest">Одделение {data.gradeLevel}</span>
              </div>
            </div>
          ) : slide.type === 'step-by-step' ? (
            <StepByStepSlide steps={slide.content} theme={theme} key={slideIdx} />
          ) : slide.type === 'formula-centered' ? (
            <FormulaCenteredSlide content={slide.content} theme={theme} />
          ) : slide.type === 'proof' ? (
            <ProofSlide steps={slide.content} theme={theme} key={slideIdx} />
          ) : slide.type === 'comparison' ? (
            <ComparisonSlide left={slide.content} right={slide.rightContent ?? []} theme={theme} />
          ) : slide.type === 'example' ? (
            <ExampleSlide content={slide.content} solution={slide.solution} theme={theme} />
          ) : slide.type === 'task' ? (
            <ExampleSlide content={slide.content} solution={slide.solution} theme={theme} isTask />
          ) : slide.type === 'summary' ? (
            <SummarySlide content={slide.content} theme={theme} />
          ) : (
            <ul className="space-y-6">
              {slide.content.map((point, idx) => (
                <li key={idx} className={`flex items-start gap-4 ${textSize}`}>
                  <div className={`w-3 h-3 rounded-full mt-2.5 flex-shrink-0 ${
                    theme === 'dark' ? 'bg-indigo-400' : theme === 'creative' ? 'bg-amber-500' : 'bg-brand-primary'
                  }`} />
                  <MathRenderer text={point} />
                </li>
              ))}
            </ul>
          )}
        </div>
        {slide.type !== 'title' && (
          <div className="w-[280px] flex-shrink-0 flex flex-col gap-3">
            {visual?.url ? (
              <div className="rounded-2xl overflow-hidden shadow-xl border border-white/20 relative group/img">
                <img src={visual.url} alt="Slide Visual" className="w-full h-auto object-cover aspect-square" />
                <button
                  type="button"
                  title="Избриши слика"
                  onClick={() => {
                    setVisuals(prev => ({ ...prev, [slideIdx]: { loading: false } }));
                    trackFeedback('reject_visual', `slide_index:${slideIdx}`);
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity shadow">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex-1 border-2 border-dashed border-gray-300/50 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
                <ImageIcon className="w-8 h-8 text-gray-400 mb-3" />
                <p className="text-xs text-gray-400 mb-3">{slide.visualPrompt || slide.title}</p>
                <button type="button" onClick={() => handleGenerateImage(slideIdx, slide.visualPrompt || slide.title)}
                  disabled={visual?.loading}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
                  {visual?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Генерирај слика
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

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
                        type="button"
                        key={t}
                        onClick={() => setTheme(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${theme === t ? 'bg-white text-brand-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {t}
                    </button>
                ))}
            </div>

            <button
                        type="button"
                onClick={() => setShowCurriculumSide(!showCurriculumSide)}
                className={`p-2 rounded-xl transition-colors ${showCurriculumSide ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}
                title="Курикулум пано"
            >
                <BookOpen className="w-5 h-5" />
            </button>

            <button
                type="button"
                onClick={() => setShowAiContentModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold hover:bg-emerald-100 transition-all active:scale-95"
                title="AI генерирај слајдови од содржина"
            >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">AI од содржина</span>
            </button>

            <button
                type="button"
                onClick={() => setGammaMode(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold hover:from-indigo-700 hover:to-violet-700 transition-all shadow-md active:scale-95"
                title="Gamma Mode — Наставно предавање со решенија"
            >
                <Play className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Gamma Mode</span>
            </button>

            <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="p-2 rounded-xl bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                title="Цел екран — Уредувач"
            >
                <Maximize2 className="w-5 h-5" />
            </button>

            <button
                type="button"
                onClick={handleSavePresentation}
                disabled={isSaving || isSaved}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-60 ${
                  isSaved ? 'bg-green-500 text-white' : 'bg-gray-50 text-gray-600 hover:bg-green-50 hover:text-green-700 border border-gray-200'
                }`}
                title="Зачувај во библиотека"
            >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {isSaved ? 'Зачувана' : 'Зачувај'}
            </button>

            <button
                type="button"
                onClick={downloadPPTX}
                disabled={isExportingPptx}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-secondary transition-all shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                title="Преземи PPTX (формулите се рендерираат во слики)"
            >
                {isExportingPptx
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> {pptxProgress > 0 ? `${pptxProgress}%` : 'Рендерирам…'}</>
                    : <><FileDown className="w-5 h-5" /> PPTX</>}
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
                        ) : current.type === 'step-by-step' ? (
                            <StepByStepSlide
                                steps={current.content}
                                theme={theme}
                                key={currentSlide}
                            />
                        ) : current.type === 'formula-centered' ? (
                            <FormulaCenteredSlide
                                content={current.content}
                                theme={theme}
                            />
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
                                <div className="rounded-2xl overflow-hidden shadow-xl border border-white/20 animate-in zoom-in duration-500 relative group/img">
                                    <img src={currentVisual.url} alt="Slide Visual" className="w-full h-auto object-cover aspect-square" />
                                    {/* Delete button */}
                                    <button
                                        type="button"
                                      onClick={() => {
                                        setVisuals(prev => ({ ...prev, [currentSlide]: { loading: false } }));
                                        trackFeedback('reject_visual', `slide_index:${currentSlide}`);
                                        setOpenVisualPrompt(false);
                                      }}
                                        title="Избриши слика"
                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity shadow hover:bg-red-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                    <div className="p-2 bg-black/5 backdrop-blur-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] uppercase font-black tracking-widest opacity-50">AI Generated Visual</span>
                                            <button
                                                type="button"
                                                onClick={() => { setOpenVisualPrompt(o => !o); setVisualCustomPrompt(''); }}
                                                title="Промени со наоки"
                                                className="text-[10px] text-indigo-400 hover:text-indigo-200 font-bold flex items-center gap-0.5"
                                            >
                                                <Zap className="w-2.5 h-2.5" /> Промени
                                            </button>
                                        </div>
                                        {openVisualPrompt && (
                                            <div className="mt-1.5 flex flex-col gap-1">
                                                <textarea
                                                    value={visualCustomPrompt}
                                                    onChange={e => setVisualCustomPrompt(e.target.value)}
                                                    placeholder="Опис за нова илустрација..."
                                                    className="w-full text-xs p-1.5 border rounded resize-none bg-white/10 text-white placeholder:text-white/40 focus:outline-none"
                                                    rows={2}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleGenerateImage(currentSlide, visualCustomPrompt || current.visualPrompt || current.title);
                                                        setOpenVisualPrompt(false);
                                                    }}
                                                    disabled={currentVisual?.loading}
                                                    className="text-xs bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1 justify-center"
                                                >
                                                    {currentVisual?.loading && <Loader2 className="w-3 h-3 animate-spin" />}
                                                    Регенерирај
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 border-2 border-dashed border-gray-300/50 rounded-2xl flex flex-col items-center justify-center p-6 text-center group/visual">
                                    <div className="p-4 bg-gray-100 rounded-full mb-4 group-hover/visual:scale-110 transition-transform">
                                        <ImageIcon className="w-8 h-8 text-gray-400" />
                                    </div>
                                    <p className="text-sm font-bold text-gray-400 mb-4">{current.visualPrompt || 'Нема дефинирана визуелна идеја'}</p>
                                    <button
                        type="button"
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
                        type="button"
                        title="Претходен слајд"
                        onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                        disabled={currentSlide === 0}
                        className="w-12 h-12 bg-black/10 backdrop-blur-md rounded-2xl flex items-center justify-center hover:bg-black/20 disabled:opacity-10 transition-all"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <button
                        type="button"
                        title="Следен слајд"
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
                        type="button"
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
                                {current.type === 'formula-centered' ? (
                                    <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-200 text-xs italic">
                                        Слајд со централна формула/дефиниција. Идеален за теореми и клучни равенства.
                                    </div>
                                ) : current.type === 'step-by-step' ? (
                                    <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-200 text-xs italic">
                                        Постапка чекор-по-чекор. Кликнете на секој чекор за да го истакнете. Идеално за доказ или алгоритам.
                                    </div>
                                ) : current.type === 'example' ? (
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
                                <button type="button"
                  onClick={() => window.open(`https://www.geogebra.org/calculator`, '_blank')}
                  className="p-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-bold flex items-center gap-2 hover:bg-white/10 transition-colors">
                                    <MousePointer2 className="w-3 h-3" /> GeoGebra
                                </button>
                                <button type="button"
                  onClick={() => window.open(`https://www.desmos.com/calculator`, '_blank')}
                  className="p-2 bg-white/5 rounded-xl border border-white/10 text-[10px] font-bold flex items-center gap-2 hover:bg-white/10 transition-colors">
                                    <MousePointer2 className="w-3 h-3" /> Desmos
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <Card className="p-4 bg-white border-gray-100 flex flex-col gap-2">
                    <button type="button" onClick={() => window.print()} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group">
                        <div className="flex items-center gap-3">
                            <ImageIcon className="w-4 h-4 text-gray-400 group-hover:text-brand-primary" />
                            <span className="text-xs font-bold text-gray-600">Печати kako PDF</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                    <button
                        type="button"
                        onClick={() => setShowLivePanel(true)}
                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-red-50 transition-colors group border border-red-100"
                    >
                        <div className="flex items-center gap-3">
                            <Radio className="w-4 h-4 text-red-400 group-hover:text-red-600 animate-pulse" />
                            <span className="text-xs font-bold text-red-600">Пушти квиз во живо</span>
                        </div>
                        <Zap className="w-4 h-4 text-red-300 group-hover:text-red-500" />
                    </button>
                </Card>
            </div>
        )}
      </div>

      {/* ── Fullscreen Editor Overlay ────────────────────────────────────── */}
      {isFullscreen && (
        <div className="fixed inset-0 z-[100] flex bg-gray-900 text-white animate-in fade-in duration-200">
          {/* Left: Thumbnails */}
          <div className="w-48 flex flex-col bg-gray-950 border-r border-gray-800 overflow-y-auto p-3 gap-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Слајдови</span>
              <button type="button" onClick={() => setIsFullscreen(false)} title="Затвори" className="p-1 hover:bg-gray-800 rounded-lg">
                <Minimize2 className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            {slides.map((s, idx) => (
              <div key={idx} className={`rounded-xl border-2 transition-all ${
                currentSlide === idx ? 'border-indigo-500 bg-indigo-900/40' : 'border-gray-800 bg-gray-900'
              }`}>
                <button
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className="w-full text-left p-2"
                >
                  <span className="text-[9px] font-black text-gray-500 block">{idx + 1}</span>
                  <p className="text-[10px] font-bold line-clamp-2 mt-0.5 leading-tight text-gray-300">{s.title}</p>
                </button>
                {currentSlide === idx && (
                  <div className="flex items-center gap-0.5 px-1.5 pb-1.5">
                    <button type="button" title="Помести горе" onClick={() => moveSlide(idx, -1)} disabled={idx === 0}
                      className="p-1 hover:bg-gray-700 rounded disabled:opacity-20 transition-colors">
                      <ArrowUp className="w-3 h-3 text-gray-400" />
                    </button>
                    <button type="button" title="Помести долу" onClick={() => moveSlide(idx, 1)} disabled={idx === slides.length - 1}
                      className="p-1 hover:bg-gray-700 rounded disabled:opacity-20 transition-colors">
                      <ArrowDown className="w-3 h-3 text-gray-400" />
                    </button>
                    <button type="button" title="Додај слајд по овој" onClick={() => addSlide(idx)}
                      className="p-1 hover:bg-indigo-800 rounded transition-colors ml-auto">
                      <Plus className="w-3 h-3 text-indigo-400" />
                    </button>
                    <button type="button" title="Избриши слајд" onClick={() => deleteSlide(idx)} disabled={slides.length <= 1}
                      className="p-1 hover:bg-red-900/40 rounded disabled:opacity-20 transition-colors">
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            <button type="button" onClick={() => addSlide(slides.length - 1)}
              className="w-full flex items-center justify-center gap-1.5 py-2 mt-1 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:border-indigo-500 hover:text-indigo-400 transition-colors text-[10px] font-bold">
              <Plus className="w-3 h-3" /> Додај слајд
            </button>
          </div>

          {/* Center: Slide Canvas */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Header bar */}
            <div className="h-12 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 flex-shrink-0">
              <span className="text-sm font-bold text-gray-300 truncate">{current.title}</span>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button type="button" title="Претходен" onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))} disabled={currentSlide === 0} className="p-1.5 hover:bg-gray-800 rounded-lg disabled:opacity-30">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-500">{currentSlide + 1} / {slides.length}</span>
                <button type="button" title="Следен" onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))} disabled={currentSlide === slides.length - 1} className="p-1.5 hover:bg-gray-800 rounded-lg disabled:opacity-30">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setIsFullscreen(false)} title="Излез" className="p-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg ml-2">
                  <Minimize2 className="w-4 h-4 text-gray-300" />
                </button>
              </div>
            </div>

            {/* Slide */}
            <div className="flex-1 p-6 flex flex-col min-h-0">
              <div className={`flex-1 flex flex-col rounded-3xl shadow-2xl border overflow-hidden ${
                theme === 'dark' ? 'bg-indigo-950 border-indigo-900 text-white' :
                theme === 'creative' ? 'bg-amber-50 border-amber-100 text-amber-900' :
                theme === 'classic' ? 'bg-gray-50 border-gray-200 text-black font-serif' :
                'bg-white border-gray-100 text-gray-900'
              }`}>
                <div className={`p-10 flex-shrink-0 ${theme === 'modern' ? 'border-b border-gray-50' : ''}`}>
                  <h4 className={`font-black leading-tight ${current.type === 'title' ? 'text-5xl text-center mt-12' : 'text-3xl'}`}>
                    {current.title}
                  </h4>
                </div>
                {renderSlideBody(current, currentSlide, true)}
                <div className="p-6 flex justify-between items-center opacity-30 text-[10px] font-black uppercase tracking-widest flex-shrink-0">
                  <span>{data.topic}</span>
                  <span>{currentSlide + 1} / {slides.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Edit Panel */}
          <div className="w-80 flex flex-col bg-gray-950 border-l border-gray-800 overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b border-gray-800">
              <div className="flex items-center gap-2 mb-4">
                <PenLine className="w-4 h-4 text-indigo-400" />
                <h4 className="text-sm font-black text-gray-200 uppercase tracking-widest">Уредување</h4>
              </div>
              <label htmlFor="slide-title-input" className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-1">Наслов</label>
              <input
                id="slide-title-input"
                type="text"
                value={current.title}
                onChange={e => updateSlideTitle(currentSlide, e.target.value)}
                placeholder="Наслов на слајд"
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {current.type !== 'title' && (
              <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    {current.type === 'formula-centered' ? 'Формула и белешки' : current.type === 'step-by-step' ? 'Чекори' : 'Содржина'}
                  </label>
                  <button type="button" onClick={() => addSlideBullet(currentSlide)} title="Додај ред" className="p-1 hover:bg-gray-800 rounded-lg text-indigo-400">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {current.type === 'formula-centered' && (
                  <p className="text-[9px] text-indigo-400 mb-2">Прв ред = главна формула; следните = белешки</p>
                )}
                <div className="flex flex-col gap-3">
                  {current.content.map((bullet, bIdx) => (
                    <div key={bIdx} className="flex flex-col gap-1">
                      <div className="flex gap-2 items-start">
                        {current.type === 'step-by-step' && (
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-700 text-white text-[9px] font-black flex items-center justify-center mt-2">{bIdx + 1}</span>
                        )}
                        {current.type === 'formula-centered' && bIdx === 0 && (
                          <span className="flex-shrink-0 text-[9px] font-bold text-blue-400 mt-2.5 w-5 text-center">Σ</span>
                        )}
                        <textarea
                          value={bullet}
                          onChange={e => updateSlideBullet(currentSlide, bIdx, e.target.value)}
                          rows={2}
                          aria-label={`Содржина ${bIdx + 1}`}
                          placeholder={
                            current.type === 'formula-centered' && bIdx === 0 ? 'Пр. $a^2 + b^2 = c^2$'
                            : current.type === 'step-by-step' ? `Чекор ${bIdx + 1}…`
                            : 'Содржина…'
                          }
                          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 resize-none font-mono"
                        />
                        <button type="button" onClick={() => removeSlideBullet(currentSlide, bIdx)} title="Избриши" className="p-1.5 hover:bg-red-900/40 rounded-lg text-gray-600 hover:text-red-400 mt-1 flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {bullet.includes('$') && (
                        <div className="ml-7 px-2 py-1 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200">
                          <MathRenderer text={bullet} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {current.type !== 'title' && (
              <div className="p-4">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block mb-2">AI Илустрација</label>
                {visuals[currentSlide]?.url ? (
                  <div className="relative group/img rounded-xl overflow-hidden">
                    <img src={visuals[currentSlide].url} alt="Visual" className="w-full rounded-xl" />
                    <button
                      type="button"
                      title="Избриши слика"
                      onClick={() => {
                        setVisuals(prev => ({ ...prev, [currentSlide]: { loading: false } }));
                        trackFeedback('reject_visual', `slide_index:${currentSlide}`);
                      }}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity shadow">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button type="button"
                    onClick={() => handleGenerateImage(currentSlide, current.visualPrompt || current.title)}
                    disabled={visuals[currentSlide]?.loading}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 transition-all">
                    {visuals[currentSlide]?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Генерирај слика
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Live Quiz Panel ──────────────────────────────────────────────── */}
      <LiveQuizPanel
        isOpen={showLivePanel}
        onClose={() => setShowLivePanel(false)}
        presentationTitle={data.title}
        conceptId={conceptId}
        firebaseUser={firebaseUser}
        addNotification={addNotification}
      />

      {/* ── AI from content modal ───────────────────────────────────────────── */}
      {showAiContentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">AI од содржина</h3>
                    <p className="text-emerald-100 text-xs">Залепете текст — AI генерира слајдови</p>
                  </div>
                </div>
                <button type="button" onClick={() => setShowAiContentModal(false)} aria-label="Затвори" className="p-2 rounded-xl hover:bg-white/20 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <textarea
                value={aiContentText}
                onChange={e => setAiContentText(e.target.value)}
                placeholder={`Залепете или напишете содржина за темата „${data.topic}"…\n\nПр. белешки, учебничка страница, список на концепти…`}
                rows={8}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              />
              <p className="text-xs text-gray-400">Постојните слајдови ќе бидат заменети со ново генерирани.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAiContentModal(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors">
                  Откажи
                </button>
                <button type="button" onClick={handleGenerateFromContent} disabled={!aiContentText.trim() || isGeneratingFromContent}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-bold hover:opacity-90 disabled:opacity-50 transition-all">
                  {isGeneratingFromContent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {isGeneratingFromContent ? 'Генерирам…' : 'Генерирај слајдови'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Gamma Mode fullscreen overlay ──────────────────────────────────── */}
      {gammaMode && (
        <SilentErrorBoundary name="GammaMode" fallback={<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950 text-white" onClick={() => setGammaMode(false)}><p className="text-slate-400">Gamma Mode не можеше да се вчита. Кликни за да затвориш.</p></div>}>
          <GammaModeModal
            data={{ ...data, slides: editedSlides }}
            startIndex={currentSlide}
            onClose={() => setGammaMode(false)}
          />
        </SilentErrorBoundary>
      )}
    </div>
  );
};