import React, { useState } from 'react';
import { Presentation, Image as ImageIcon, ChevronLeft, ChevronRight, FileDown, Sparkles, Loader2, BookOpen, Cpu, MousePointer2, Radio, Zap, X, Users, ExternalLink } from 'lucide-react';
import QRCode from 'react-qr-code';
import { AIGeneratedPresentation, PresentationSlide } from '../../types';
import { Card } from '../common/Card';
import { MathRenderer } from '../common/MathRenderer';
import { geminiService } from '../../services/geminiService';
import { useNotification } from '../../contexts/NotificationContext';
import pptxgen from 'pptxgenjs';
import html2canvas from 'html2canvas';
import { useAuth } from '../../contexts/AuthContext';
import { firestoreService } from '../../services/firestoreService';

// ─── Helpers for LaTeX→PNG conversion ────────────────────────────────────────
const HAS_MATH = /\$[\s\S]+?\$/;

/** Renders a bullet text (may contain $...$ / $$...$$) into a PNG data-URI.
 *  Uses KaTeX (loaded via CDN) + html2canvas. Falls back to plain text image. */
const renderBulletToPng = async (text: string, hexColor: string): Promise<string> => {
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed', 'top:-9999px', 'left:-9999px',
    'background:#ffffff', 'padding:6px 14px',
    'font-size:20px', 'font-family:Arial,Helvetica,sans-serif',
    `color:#${hexColor}`, 'max-width:640px',
    'line-height:1.65', 'white-space:pre-wrap',
  ].join(';');

  const katex = (window as any).katex;
  const toHtml = (src: string): string => {
    if (!katex) return src;
    return src
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) =>
        katex.renderToString(f, { throwOnError: false, displayMode: true }))
      .replace(/\$([^$\n]+?)\$/g, (_, f) =>
        katex.renderToString(f, { throwOnError: false, displayMode: false }));
  };

  container.innerHTML = toHtml(text);
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, {
      scale: 2, backgroundColor: '#ffffff', logging: false,
    });
    return canvas.toDataURL('image/png', 1.0);
  } finally {
    document.body.removeChild(container);
  }
};

// ─── Step-by-step slide UI ────────────────────────────────────────────────────
interface StepByStepSlideProps {
  steps: string[];
  theme: 'modern' | 'classic' | 'dark' | 'creative';
  key?: number; // resets active step when slide changes
}

const STEP_ACCENT: Record<string, string[]> = {
  modern:   ['bg-blue-600', 'bg-blue-500', 'bg-blue-400', 'bg-blue-300'],
  classic:  ['bg-gray-700', 'bg-gray-600', 'bg-gray-500', 'bg-gray-400'],
  dark:     ['bg-indigo-500', 'bg-indigo-400', 'bg-indigo-300', 'bg-indigo-200'],
  creative: ['bg-orange-600', 'bg-orange-500', 'bg-amber-500', 'bg-amber-400'],
};

const StepByStepSlide: React.FC<StepByStepSlideProps> = ({ steps, theme }) => {
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const accents = STEP_ACCENT[theme];
  const total = steps.length;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-200/40 rounded-full overflow-hidden mb-1">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: activeStep !== null ? `${((activeStep + 1) / total) * 100}%` : '0%',
            background: theme === 'dark' ? '#818cf8' : theme === 'creative' ? '#f97316' : '#1d4ed8',
          }}
        />
      </div>

      {steps.map((step, idx) => {
        const isActive = activeStep === idx;
        const isDone   = activeStep !== null && idx < activeStep;
        const accent   = accents[idx % accents.length];
        return (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveStep(isActive ? null : idx)}
            className={`flex items-start gap-4 text-left w-full rounded-2xl px-4 py-3 transition-all duration-300 border-2 group ${
              isActive
                ? theme === 'dark'
                  ? 'border-indigo-400 bg-indigo-400/10'
                  : 'border-blue-400 bg-blue-50/80 shadow-md'
                : isDone
                  ? 'border-transparent bg-green-50/30 opacity-70'
                  : 'border-transparent hover:bg-black/5'
            }`}
          >
            {/* Step number badge */}
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white transition-all duration-300 ${
              isDone ? 'bg-green-500' : isActive ? accent : 'bg-gray-300 group-hover:bg-gray-400'
            }`}>
              {isDone ? '✓' : idx + 1}
            </div>

            {/* Step text */}
            <div className={`flex-1 text-lg leading-snug transition-colors duration-200 ${
              isActive
                ? theme === 'dark' ? 'text-white font-bold' : 'text-blue-900 font-bold'
                : theme === 'dark' ? 'text-indigo-200' : 'text-gray-700'
            }`}>
              <MathRenderer text={step} />
            </div>
          </button>
        );
      })}

      <p className="text-[10px] text-gray-400 text-center mt-1 uppercase tracking-widest font-bold">
        {activeStep !== null ? `Чекор ${activeStep + 1} / ${total}` : 'Кликни за да продолжиш'}
      </p>
    </div>
  );
};

// ─── Formula-centered slide UI ────────────────────────────────────────────────
/** Displays a large centred formula + optional sub-points beneath it.
 *  content[0] is the main formula/definition; content[1..] are short notes. */
const FormulaCenteredSlide: React.FC<{ content: string[]; theme: 'modern' | 'classic' | 'dark' | 'creative' }> = ({ content, theme }) => {
  const [formula, ...notes] = content;
  const borderColor = theme === 'dark' ? 'border-indigo-400/50' : theme === 'creative' ? 'border-amber-400/50' : 'border-brand-primary/30';
  const formulaColor = theme === 'dark' ? 'text-indigo-200' : theme === 'creative' ? 'text-orange-700' : 'text-brand-primary';

  return (
    <div className="flex flex-col items-center justify-center w-full h-full gap-6 py-4">
      {/* Central formula box */}
      <div className={`w-full max-w-2xl rounded-3xl border-2 ${borderColor} px-10 py-8 text-center shadow-lg bg-black/3`}>
        <div className={`text-4xl font-black leading-tight tracking-tight ${formulaColor}`}>
          <MathRenderer text={formula} />
        </div>
      </div>

      {/* Supporting notes */}
      {notes.length > 0 && (
        <ul className="space-y-2 w-full max-w-xl">
          {notes.map((note, i) => (
            <li key={i} className={`flex items-start gap-3 text-base ${theme === 'dark' ? 'text-indigo-200' : 'text-gray-600'}`}>
              <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme === 'dark' ? 'bg-indigo-400' : 'bg-brand-primary/60'}`} />
              <MathRenderer text={note} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

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
  const { addNotification } = useNotification();

  // ── Live Quiz from Slide ────────────────────────────────────────────────────
  const [showLivePanel, setShowLivePanel] = useState(false);
  const [quizList, setQuizList] = useState<{ id: string; title: string; conceptId?: string }[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<{ joinCode: string; sessionId: string } | null>(null);

  const handleOpenLivePanel = async () => {
    setShowLivePanel(true);
    if (quizList.length > 0) return;
    setLoadingQuizzes(true);
    try {
      const all = await firestoreService.fetchCachedQuizList();
      // Prefer quizzes matching the conceptId, then show rest
      const matched = conceptId ? all.filter(q => q.conceptId === conceptId) : [];
      const rest = conceptId ? all.filter(q => q.conceptId !== conceptId) : all;
      setQuizList([...matched, ...rest]);
    } catch {
      addNotification('Не може да се вчитаат квизовите.', 'error');
    } finally {
      setLoadingQuizzes(false);
    }
  };

  const handleLaunchLive = async (quiz: { id: string; title: string; conceptId?: string }) => {
    if (!firebaseUser?.uid) { addNotification('Треба да бидете најавени.', 'error'); return; }
    setLaunchingId(quiz.id);
    try {
      const sessionId = await firestoreService.createLiveSession(firebaseUser.uid, quiz.id, quiz.title, quiz.conceptId);
      const unsub = firestoreService.subscribeLiveSession(sessionId, (s) => {
        if (s?.joinCode) {
          setLiveSession({ joinCode: s.joinCode, sessionId });
          unsub();
        }
      });
    } catch {
      addNotification('Грешка при креирање на сесијата.', 'error');
    } finally {
      setLaunchingId(null);
    }
  };

  const handleOpenDisplay = () => {
    if (!liveSession) return;
    window.open(`${window.location.origin}/#/live/display?sid=${liveSession.sessionId}`, '_blank');
  };

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

  const [isExportingPptx, setIsExportingPptx] = useState(false);

  const downloadPPTX = async () => {
    setIsExportingPptx(true);
    addNotification('Генерирам PPTX — формулите се рендерираат…', 'info');
    try {
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';
      // Slide dimensions: 10 × 5.625 inches (16:9)
      const SLIDE_W = 10;

      const THEMES = {
        modern:   { bg: 'FFFFFF', title: '0D47A1', body: '333333', line: 'BBDEFB' },
        classic:  { bg: 'F5F5F5', title: '1A1A1A', body: '222222', line: 'CCCCCC' },
        dark:     { bg: '1A237E', title: 'FFFFFF', body: 'E0E0E0', line: '3949AB' },
        creative: { bg: 'FFF9C4', title: 'E65100', body: '424242', line: 'FFE082' },
      };
      const colors = THEMES[theme];

      // ── Pre-render ALL math strings in parallel ─────────────────────────────
      type MathKey = string; // `${text}::${hexColor}`
      const mathJobs = new Map<MathKey, { text: string; color: string }>();
      for (const slide of data.slides) {
        if (slide.type === 'formula-centered' && slide.content[0] && HAS_MATH.test(slide.content[0])) {
          const k = `${slide.content[0]}::${colors.title}`;
          if (!mathJobs.has(k)) mathJobs.set(k, { text: slide.content[0], color: colors.title });
        }
        if (slide.type === 'step-by-step') {
          for (const s of slide.content) {
            if (HAS_MATH.test(s)) { const k = `${s}::${colors.body}`; if (!mathJobs.has(k)) mathJobs.set(k, { text: s, color: colors.body }); }
          }
        }
        if (slide.type !== 'title' && slide.type !== 'formula-centered' && slide.type !== 'step-by-step') {
          for (const b of slide.content) {
            if (HAS_MATH.test(b)) { const k = `• ${b}::${colors.body}`; if (!mathJobs.has(k)) mathJobs.set(k, { text: `• ${b}`, color: colors.body }); }
          }
        }
      }
      const mathPngMap = new Map<MathKey, string>();
      await Promise.all(
        Array.from(mathJobs.entries()).map(async ([k, { text, color }]) => {
          try { mathPngMap.set(k, await renderBulletToPng(text, color)); } catch { /* key absent = fallback to text */ }
        })
      );
      // ────────────────────────────────────────────────────────────────────────

      for (let idx = 0; idx < data.slides.length; idx++) {
        const slide: PresentationSlide = data.slides[idx];
        const slideVisual = visuals[idx];
        const pptSlide = pptx.addSlide();
        pptSlide.background = { color: colors.bg };

        if (slide.type === 'title') {
          pptSlide.addText(slide.title, {
            x: 0.5, y: 1.4, w: SLIDE_W - 1, h: 1.6,
            fontSize: 44, bold: true, color: colors.title, align: 'center', fontFace: 'Arial',
          });
          pptSlide.addText(data.topic, {
            x: 0.5, y: 3.2, w: SLIDE_W - 1, h: 0.6,
            fontSize: 24, color: colors.body, align: 'center',
          });
        } else if (slide.type === 'formula-centered') {
          // Slide title
          pptSlide.addText(slide.title, {
            x: 0.4, y: 0.25, w: SLIDE_W - 0.8, h: 0.75,
            fontSize: 28, bold: true, color: colors.title, fontFace: 'Arial',
          });
          pptSlide.addShape((pptxgen as any).ShapeType?.line ?? 'line', {
            x: 0.4, y: 1.05, w: SLIDE_W - 0.8, h: 0,
            line: { color: colors.line, width: 1.5 },
          });

          const [mainFormula, ...notes] = slide.content;

          // Central formula box
          if (mainFormula) {
            const boxX = 1.0, boxY = 1.3, boxW = SLIDE_W - 2, boxH = 1.8;
            pptSlide.addShape('roundRect', {
              x: boxX, y: boxY, w: boxW, h: boxH,
              fill: { color: theme === 'dark' ? '1a1a5e' : 'EEF2FF' },
              line: { color: colors.line, width: 2 },
            });
            if (HAS_MATH.test(mainFormula)) {
              const png = mathPngMap.get(`${mainFormula}::${colors.title}`);
              let formulaAdded = false;
              if (png) {
                try {
                  const img = new Image();
                  await Promise.race([
                    new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); img.src = png; }),
                    new Promise<void>(res => setTimeout(res, 5000)),
                  ]);
                  const ratio = img.naturalHeight / img.naturalWidth;
                  const imgW = Math.min(boxW - 0.4, 6.5);
                  const imgH = Math.min(imgW * ratio, boxH - 0.2);
                  pptSlide.addImage({ data: png, x: boxX + (boxW - imgW) / 2, y: boxY + (boxH - imgH) / 2, w: imgW, h: imgH });
                  formulaAdded = true;
                } catch { /* fall through to plain text */ }
              }
              if (!formulaAdded) {
                pptSlide.addText(mainFormula, { x: boxX, y: boxY + 0.4, w: boxW, h: boxH - 0.8, fontSize: 22, bold: true, color: colors.title, align: 'center', fontFace: 'Arial' });
              }
            } else {
              pptSlide.addText(mainFormula, { x: boxX, y: boxY + 0.4, w: boxW, h: boxH - 0.8, fontSize: 22, bold: true, color: colors.title, align: 'center', fontFace: 'Arial' });
            }
          }

          // Supporting notes below the box
          let noteY = 3.3;
          for (const note of notes) {
            pptSlide.addText(`• ${note}`, { x: 1.0, y: noteY, w: SLIDE_W - 2, h: 0.42, fontSize: 14, color: colors.body, fontFace: 'Arial' });
            noteY += 0.44;
            if (noteY > 5.0) break;
          }
        } else if (slide.type === 'step-by-step') {
          // Slide title
          pptSlide.addText(slide.title, {
            x: 0.4, y: 0.25, w: SLIDE_W - 0.8, h: 0.75,
            fontSize: 28, bold: true, color: colors.title, fontFace: 'Arial',
          });
          pptSlide.addShape((pptxgen as any).ShapeType?.line ?? 'line', {
            x: 0.4, y: 1.05, w: SLIDE_W - 0.8, h: 0,
            line: { color: colors.line, width: 1.5 },
          });
          // Numbered steps with circle badge
          const stepColors = ['0D47A1', '1565C0', '1976D2', '1E88E5', '2196F3', '42A5F5', '64B5F6', '90CAF9'];
          let stepY = 1.15;
          const stepH = 0.55;
          for (let si = 0; si < slide.content.length; si++) {
            const stepText = slide.content[si];
            const badgeColor = stepColors[si % stepColors.length];
            // Circle badge
            pptSlide.addShape('ellipse', {
              x: 0.4, y: stepY + 0.04, w: 0.38, h: 0.38,
              fill: { color: badgeColor },
            });
            pptSlide.addText(`${si + 1}`, {
              x: 0.4, y: stepY + 0.04, w: 0.38, h: 0.38,
              fontSize: 13, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
            });
            // Step text (with math rendering if needed)
            if (HAS_MATH.test(stepText)) {
              const png = mathPngMap.get(`${stepText}::${colors.body}`);
              let stepAdded = false;
              if (png) {
                try {
                  const img = new Image();
                  await Promise.race([
                    new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); img.src = png; }),
                    new Promise<void>(res => setTimeout(res, 5000)),
                  ]);
                  const ratio = img.naturalHeight / img.naturalWidth;
                  const imgW = Math.min(SLIDE_W - 1.2, 7.5);
                  const imgH = Math.min(imgW * ratio, stepH + 0.1);
                  pptSlide.addImage({ data: png, x: 0.9, y: stepY, w: imgW, h: imgH });
                  stepY += imgH + 0.1;
                  stepAdded = true;
                } catch { /* fall through */ }
              }
              if (!stepAdded) {
                pptSlide.addText(stepText, { x: 0.9, y: stepY, w: SLIDE_W - 1.3, h: stepH, fontSize: 15, color: colors.body, fontFace: 'Arial' });
                stepY += stepH;
              }
            } else {
              pptSlide.addText(stepText, { x: 0.9, y: stepY, w: SLIDE_W - 1.3, h: stepH, fontSize: 15, color: colors.body, fontFace: 'Arial' });
              stepY += stepH;
            }
            if (stepY > 5.0) break;
          }
          // Progress bar
          const progressW = (SLIDE_W - 0.8) * Math.min(slide.content.length, 8) / 8;
          pptSlide.addShape('rect', { x: 0.4, y: 5.1, w: SLIDE_W - 0.8, h: 0.06, fill: { color: colors.line } });
          pptSlide.addShape('rect', { x: 0.4, y: 5.1, w: progressW, h: 0.06, fill: { color: colors.title } });
        } else {
          // Title bar with bottom line
          pptSlide.addText(slide.title, {
            x: 0.4, y: 0.25, w: SLIDE_W - 0.8, h: 0.75,
            fontSize: 28, bold: true, color: colors.title, fontFace: 'Arial',
          });
          pptSlide.addShape((pptxgen as any).ShapeType?.line ?? 'line', {
            x: 0.4, y: 1.05, w: SLIDE_W - 0.8, h: 0,
            line: { color: colors.line, width: 1.5 },
          });

          // Content area bounds
          const hasAiImage = !!slideVisual?.url;
          const contentX   = 0.4;
          const contentW   = hasAiImage ? SLIDE_W * 0.55 : SLIDE_W - 0.8;
          let   curY       = 1.2;
          const lineH      = 0.52; // inches per plain-text bullet
          const maxImgW    = contentW - 0.1;

          for (const bullet of slide.content) {
            if (HAS_MATH.test(bullet)) {
              const png = mathPngMap.get(`• ${bullet}::${colors.body}`);
              let bulletAdded = false;
              if (png) {
                try {
                  const img = new Image();
                  await Promise.race([
                    new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); img.src = png; }),
                    new Promise<void>(res => setTimeout(res, 5000)),
                  ]);
                  const ratio   = img.naturalHeight / img.naturalWidth;
                  const imgW    = Math.min(maxImgW, SLIDE_W * 0.7);
                  const imgH    = Math.min(imgW * ratio, 1.2);
                  pptSlide.addImage({ data: png, x: contentX, y: curY, w: imgW, h: imgH });
                  curY += imgH + 0.08;
                  bulletAdded = true;
                } catch { /* fall through */ }
              }
              if (!bulletAdded) {
                pptSlide.addText(`• ${bullet}`, {
                  x: contentX, y: curY, w: contentW, h: lineH,
                  fontSize: 16, color: colors.body,
                });
                curY += lineH;
              }
            } else {
              pptSlide.addText(`• ${bullet}`, {
                x: contentX, y: curY, w: contentW, h: lineH,
                fontSize: 16, color: colors.body, fontFace: 'Arial',
              });
              curY += lineH;
            }
            if (curY > 5.1) break; // guard slide overflow
          }

          // AI-generated illustration on the right
          if (hasAiImage) {
            pptSlide.addImage({
              data: slideVisual!.url!,
              x: SLIDE_W * 0.57, y: 1.15,
              w: SLIDE_W * 0.38, h: SLIDE_W * 0.38,
            });
          }
        }

        pptSlide.addText('Генерирано со Math Navigator AI', {
          x: 0.4, y: 5.25, w: SLIDE_W - 0.8, h: 0.28,
          fontSize: 9, color: 'AAAAAA', align: 'right',
        });
      }

      const safeTitle = data.title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/\s+/g, '_').slice(0, 80) || 'prezentacija';
      await pptx.writeFile({ fileName: `${safeTitle}.pptx` });
      addNotification('PPTX успешно генериран! ✅', 'success');
    } catch (err) {
      console.error('PPTX export error:', err);
      addNotification('Грешка при генерирање на PPTX.', 'error');
    } finally {
      setIsExportingPptx(false);
    }
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
                type="button"
                onClick={downloadPPTX}
                disabled={isExportingPptx}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl font-bold hover:bg-brand-secondary transition-all shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                title="Преземи PPTX (формулите се рендерираат во слики)"
            >
                {isExportingPptx
                    ? <><Loader2 className="w-5 h-5 animate-spin" /> Рендерирам…</>
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
                                        onClick={() => { setVisuals(prev => ({ ...prev, [currentSlide]: { loading: false } })); setOpenVisualPrompt(false); }}
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
                            <span className="text-xs font-bold text-gray-600">Печати kako PDF</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300" />
                    </button>
                    <button
                        onClick={handleOpenLivePanel}
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

      {/* ── Live Quiz Panel ──────────────────────────────────────────────── */}
      {showLivePanel && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-rose-500 p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black">Пушти квиз во живо</h3>
                    <p className="text-red-100 text-xs">Изберете квиз за презентацијата „{data.title}"</p>
                  </div>
                </div>
                <button type="button" onClick={() => { setShowLivePanel(false); setLiveSession(null); }} aria-label="Затвори" className="p-2 rounded-xl hover:bg-white/20 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {liveSession ? (
                /* ── Active session — show join code + QR ── */
                <div className="flex flex-col items-center gap-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500 mb-2 font-medium">Кодот за приклучување е</p>
                    <div className="text-7xl font-black tracking-[0.25em] text-red-600 font-mono">{liveSession.joinCode}</div>
                    <p className="text-xs text-gray-400 mt-2">Учениците го внесуваат на <span className="font-bold text-gray-600">/live</span></p>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <QRCode
                      value={`${window.location.origin}/#/live?code=${liveSession.joinCode}`}
                      size={160}
                      style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                    />
                  </div>

                  <div className="flex gap-3 w-full">
                    <button
                      type="button"
                      onClick={handleOpenDisplay}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Отвори табла
                    </button>
                    <button
                      type="button"
                      onClick={() => setLiveSession(null)}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                    >
                      Нова сесија
                    </button>
                  </div>
                </div>
              ) : loadingQuizzes ? (
                /* ── Loading ── */
                <div className="flex flex-col items-center gap-4 py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-red-500" />
                  <p className="text-sm text-gray-500">Вчитувам квизови…</p>
                </div>
              ) : quizList.length === 0 ? (
                /* ── No quizzes ── */
                <div className="text-center py-8">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-7 h-7 text-gray-400" />
                  </div>
                  <p className="font-bold text-gray-700 mb-1">Нема зачувани квизови</p>
                  <p className="text-sm text-gray-400">Прво генерирајте и зачувајте квиз во библиотеката.</p>
                </div>
              ) : (
                /* ── Quiz list ── */
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                  {conceptId && quizList.some(q => q.conceptId === conceptId) && (
                    <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-1 mb-1">Квизови за овој концепт</p>
                  )}
                  {quizList.map((quiz, idx) => {
                    const isMatch = conceptId && quiz.conceptId === conceptId;
                    const isLaunching = launchingId === quiz.id;
                    const prevWasMatch = idx > 0 && conceptId && quizList[idx - 1].conceptId === conceptId;
                    const showDivider = !isMatch && prevWasMatch;
                    return (
                      <React.Fragment key={quiz.id}>
                        {showDivider && (
                          <div className="border-t border-gray-100 my-1" />
                        )}
                        <button
                          type="button"
                          onClick={() => handleLaunchLive(quiz)}
                          disabled={!!launchingId}
                          className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left disabled:opacity-60 ${
                            isMatch
                              ? 'border-red-200 bg-red-50 hover:bg-red-100'
                              : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {isMatch && <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />}
                            <span className="text-sm font-semibold text-gray-800 truncate">{quiz.title}</span>
                          </div>
                          {isLaunching
                            ? <Loader2 className="w-4 h-4 animate-spin text-red-500 flex-shrink-0" />
                            : <Zap className={`w-4 h-4 flex-shrink-0 ${isMatch ? 'text-red-400' : 'text-gray-300'}`} />
                          }
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
