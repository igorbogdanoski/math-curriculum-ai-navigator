import React, { useState, useRef, useCallback } from 'react';
import {
  Sparkles, Globe, ChevronDown, ChevronUp, Loader2, AlertTriangle,
  Check, Copy, Save, Image as ImageIcon, Wand2, X, BookOpen,
  Play, Tag, ExternalLink,
} from 'lucide-react';
import { DokBadge } from '../components/common/DokBadge';
import { getAuth } from 'firebase/auth';
import { MathRenderer } from '../components/common/MathRenderer';
import { Card } from '../components/common/Card';
import {
  webTaskExtractionContract,
  type ExtractedWebTask,
  type WebTaskExtractionOutput,
} from '../services/gemini/visionContracts';
import { callImagenProxy } from '../services/gemini/core';
import { saveToLibrary, saveQuestion } from '../services/firestoreService.materials';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { useNavigation } from '../contexts/NavigationContext';
import {
  fetchVideoPreview,
  fetchYouTubeCaptions,
  type VideoPreviewData,
  type VideoCaptionsResult,
} from '../utils/videoPreview';
import { app } from '../firebaseConfig';

// ─── Model options ────────────────────────────────────────────────────────────

type ModelOption = { id: string; label: string };

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (World-Class)' },
];

// ─── Progress stages ──────────────────────────────────────────────────────────

const STAGES = [
  'Поврзување со серверите...',
  'Вадење на скрипти и рамки...',
  'Gemini AI: Изолација на математички задачи...',
  'Форматирање на резултатите...',
];

// ─── Difficulty badge ─────────────────────────────────────────────────────────

const DIFF_STYLE: Record<ExtractedWebTask['difficulty'], string> = {
  basic: 'bg-emerald-100 text-emerald-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-violet-100 text-violet-700',
};
const DIFF_MK: Record<ExtractedWebTask['difficulty'], string> = {
  basic: 'Основно', intermediate: 'Средно', advanced: 'Напредно',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildAuthHeaders(): Promise<HeadersInit> {
  const currentUser = getAuth(app).currentUser;
  if (!currentUser) return {};
  const token = await currentUser.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function isYouTubeUrl(url: string) {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return h === 'youtube.com' || h === 'youtu.be' || h === 'm.youtube.com';
  } catch { return false; }
}

// ─── Per-task card ────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: ExtractedWebTask;
  index: number;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, index }) => {
  const [imgDataUrl, setImgDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const generateImage = async () => {
    setIsGenerating(true);
    setImgError(null);
    try {
      const res = await callImagenProxy({ prompt: task.imagenPrompt });
      if (res.error) { setImgError('Сликата не може да се генерира. Обидете се повторно.'); return; }
      if (res.inlineData) {
        setImgDataUrl(`data:${res.inlineData.mimeType};base64,${res.inlineData.data}`);
      }
    } catch {
      setImgError('Грешка при генерирање на слика.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyLatex = async () => {
    await navigator.clipboard.writeText(task.latexStatement);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <Card className="p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            {index + 1}
          </span>
          <h3 className="font-semibold text-slate-800 truncate">{task.title}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${DIFF_STYLE[task.difficulty]}`}>
            {DIFF_MK[task.difficulty]}
          </span>
          {task.dokLevel && <DokBadge level={task.dokLevel} size="compact" />}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {task.topicMk}
          </span>
        </div>
      </div>

      {/* Task statement */}
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed">
        <MathRenderer text={task.latexStatement || task.statement} />
      </div>

      {/* Generated image */}
      {imgDataUrl && (
        <div className="relative overflow-hidden rounded-xl border border-slate-200">
          <img src={imgDataUrl} alt={task.imagenPrompt} className="w-full object-cover" />
          <button
            type="button"
            onClick={() => setImgDataUrl(null)}
            className="absolute right-2 top-2 rounded-full bg-slate-800/60 p-1 text-white hover:bg-slate-800"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {imgError && (
        <p className="flex items-center gap-1.5 text-xs text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />{imgError}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copyLatex}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          {isCopied ? <><Check className="h-3 w-3 text-emerald-600" /> Копирано</> : <><Copy className="h-3 w-3" /> LaTeX</>}
        </button>
        {!imgDataUrl && (
          <button
            type="button"
            onClick={generateImage}
            disabled={isGenerating}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:from-violet-700 hover:to-indigo-700 disabled:opacity-60 transition"
          >
            {isGenerating
              ? <><Loader2 className="h-3 w-3 animate-spin" /> Генерирам...</>
              : <><Wand2 className="h-3 w-3" /> Генерирај визуелизација</>}
          </button>
        )}
        {imgDataUrl && (
          <button
            type="button"
            onClick={generateImage}
            disabled={isGenerating}
            className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-60 transition"
          >
            {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            Регенерирај
          </button>
        )}
      </div>
    </Card>
  );
};

// ─── Progress bar component ───────────────────────────────────────────────────

const ExtractionProgress: React.FC<{ stage: number }> = ({ stage }) => {
  const pct = Math.min(100, Math.round((stage / STAGES.length) * 100));
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-white/90">
          {stage < STAGES.length ? STAGES[stage] : 'Завршено!'}
        </span>
        <span className="font-mono text-white/60">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-1.5">
        {STAGES.map((s, i) => (
          <div
            key={i}
            title={s}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i < stage ? 'bg-indigo-400' : i === stage ? 'bg-indigo-400/60 animate-pulse' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Main view ────────────────────────────────────────────────────────────────

export const ExtractionHubView: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { addNotification } = useNotification();
  const { navigate } = useNavigation();

  const [url, setUrl] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-pro-preview');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timeRange, setTimeRange] = useState('');
  const [specificInstructions, setSpecificInstructions] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [progressStage, setProgressStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [videoPreview, setVideoPreview] = useState<VideoPreviewData | null>(null);
  const [captions, setCaptions] = useState<VideoCaptionsResult | null>(null);
  const [result, setResult] = useState<WebTaskExtractionOutput | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingToBank, setIsSavingToBank] = useState(false);
  const [isCopiedAll, setIsCopiedAll] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // ── Stage ticker ──────────────────────────────────────────────────────────

  const stopProgressTicker = useCallback(() => {
    setProgressStage(STAGES.length);
  }, []);

  // ── Extraction pipeline ───────────────────────────────────────────────────

  const extract = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http')) { setError('Внесете валиден URL (http:// или https://)'); return; }

    setIsLoading(true);
    setError(null);
    setResult(null);
    setVideoPreview(null);
    setCaptions(null);
    setProgressStage(0);

    let rawText = '';
    let sourceType: 'youtube' | 'webpage' = 'webpage';

    try {
      if (isYouTubeUrl(trimmed)) {
        sourceType = 'youtube';

        // Stage 0: fetch preview
        setProgressStage(0);
        const preview = await fetchVideoPreview(trimmed);
        setVideoPreview(preview);

        // Stage 1: fetch captions
        setProgressStage(1);
        if (preview.videoId) {
          const caps = await fetchYouTubeCaptions(preview.videoId, 'mk');
          setCaptions(caps);
          if (caps.available && caps.transcript) {
            rawText = applyTimeRange(caps, timeRange);
          }
        }
        if (!rawText) rawText = `Video title: ${preview.title}\nAuthor: ${preview.authorName ?? 'unknown'}`;

      } else {
        // Stage 0-1: fetch webpage
        setProgressStage(0);
        const headers = await buildAuthHeaders();
        const params = new URLSearchParams({ url: trimmed });
        setProgressStage(1);
        const res = await fetch(`/api/webpage-extract?${params.toString()}`, { headers });
        const data = await res.json() as { available: boolean; text?: string; title?: string; reason?: string };
        if (!data.available) throw new Error(data.reason ?? 'Страната не е достапна.');
        rawText = data.text ?? '';
      }

      // Stage 2: Gemini extraction
      setProgressStage(2);
      const { output, fallback } = await webTaskExtractionContract({
        text: rawText,
        sourceType,
        sourceRef: trimmed,
        specificInstructions: specificInstructions.trim() || undefined,
        model: selectedModel,
      });

      // Stage 3: format
      setProgressStage(3);
      await new Promise(r => setTimeout(r, 400));
      stopProgressTicker();

      if (fallback || output.tasks.length === 0) {
        setError(
          fallback
            ? 'AI не успеа да ги извлече задачите. Обидете се со поконкретен URL или поинакви инструкции.'
            : 'Не се пронајдени математички задачи во оваа содржина.',
        );
      } else {
        setResult(output);
      }
    } catch (err: unknown) {
      stopProgressTicker();
      const msg = err instanceof Error ? err.message : 'Грешка при извлекување. Обидете се повторно.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Copy all ──────────────────────────────────────────────────────────────

  const copyAll = async () => {
    if (!result) return;
    const txt = result.tasks.map((t, i) =>
      `${i + 1}. ${t.title}\n${t.latexStatement || t.statement}`
    ).join('\n\n');
    await navigator.clipboard.writeText(txt);
    setIsCopiedAll(true);
    setTimeout(() => setIsCopiedAll(false), 2000);
  };

  // ── Save all to library ───────────────────────────────────────────────────

  const saveAll = async () => {
    if (!result || !firebaseUser) { addNotification('Треба да сте најавени.', 'warning'); return; }
    setIsSaving(true);
    try {
      await saveToLibrary(result, {
        title: `Екстракција: ${url.slice(0, 60)}`,
        type: 'problems',
        teacherUid: firebaseUser.uid,
      });
      addNotification(`Зачувани ${result.tasks.length} задачи во библиотека! ✓`, 'success');
    } catch {
      addNotification('Зачувувањето не успеа.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const saveAllToBank = async () => {
    if (!result || !firebaseUser) { addNotification('Треба да сте најавени.', 'warning'); return; }
    setIsSavingToBank(true);
    try {
      await Promise.all(result.tasks.map(task =>
        saveQuestion({
          question: task.latexStatement || task.statement,
          type: 'open',
          answer: '',
          teacherUid: firebaseUser.uid,
          topicId: task.topicMk,
          dokLevel: task.dokLevel,
          isVerified: false,
          isPublic: false,
        })
      ));
      addNotification(`${result.tasks.length} задачи зачувани во банка! ✓`, 'success');
    } catch {
      addNotification('Зачувувањето не успеа.', 'error');
    } finally {
      setIsSavingToBank(false);
    }
  };

  const reset = () => {
    setUrl('');
    setResult(null);
    setError(null);
    setVideoPreview(null);
    setCaptions(null);
    setProgressStage(0);
    inputRef.current?.focus();
  };

  // ── Quality colour ────────────────────────────────────────────────────────

  const qualityMk: Record<string, string> = {
    poor: 'Слабо', fair: 'Добро', good: 'Многу добро', excellent: 'Одлично',
  };

  return (
    <div className="min-h-screen">

      {/* ══ Dark glassmorphism hero ══ */}
      <div
        className="relative overflow-hidden px-4 py-16 text-center"
        style={{ background: 'linear-gradient(135deg, #0f0c29 0%, #1a1648 45%, #24243e 100%)' }}
      >
        {/* Background glow orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
          <div className="absolute -right-32 -bottom-16 h-80 w-80 rounded-full bg-violet-600/20 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl space-y-8">
          {/* Icon duo */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20">
                <Play className="h-5 w-5 fill-red-400 text-red-400" />
              </div>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20">
                <Globe className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              YouTube &amp; Веб Екстрактор
            </h1>
            <p className="mt-3 text-base text-white/60">
              Претворете каков било YouTube туторијал или веб страна во<br className="hidden sm:block" />
              структурирани дигитални задачи со помош на Gemini 3.1 Pro.
            </p>
          </div>

          {/* URL input card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">🔗</span>
                <input
                  ref={inputRef}
                  type="url"
                  value={url}
                  onChange={(e) => { setUrl(e.target.value); setError(null); setResult(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) extract(); }}
                  placeholder="Вметнете YouTube линк или било која веб-адреса..."
                  disabled={isLoading}
                  className="w-full rounded-xl border border-white/10 bg-white/10 py-3.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 disabled:opacity-60"
                />
              </div>
              <button
                type="button"
                onClick={extract}
                disabled={!url.trim() || isLoading}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-3.5 font-bold text-white transition hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Екстрахирај
              </button>
            </div>

            {/* Row 2: model + advanced */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isLoading}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">{m.label}</option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-sm font-medium text-white/50 hover:text-white/80 transition"
              >
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Напредни параметри
              </button>
            </div>

            {/* Advanced options */}
            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <div>
                  <label className="block text-xs font-semibold text-white/60 mb-1">
                    Временски опсег (само за YouTube, пр. 5:30 - 12:45)
                  </label>
                  <input
                    type="text"
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    placeholder="пр. 3:00 - 18:30"
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/60 mb-1">
                    Специфични инструкции (опционално)
                  </label>
                  <textarea
                    value={specificInstructions}
                    onChange={(e) => setSpecificInstructions(e.target.value)}
                    placeholder="пр. Игнорирај геометрија, фокус само на алгебра и тригонометрија"
                    rows={2}
                    className="w-full resize-none rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                </div>
              </div>
            )}

            {/* Progress */}
            {isLoading && (
              <div className="mt-4">
                <ExtractionProgress stage={progressStage} />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Jump to SmartOCR */}
          <p className="text-sm text-white/40">
            Барате OCR дигитализација на слика или ракопис?{' '}
            <button
              type="button"
              onClick={() => navigate('/smart-ocr')}
              className="font-semibold text-indigo-400 hover:text-indigo-300 underline transition"
            >
              Отвори Smart OCR 2.0 →
            </button>
          </p>
        </div>
      </div>

      {/* ══ Results section ══ */}
      {(videoPreview || result) && (
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">

          {/* Video preview card */}
          {videoPreview && (
            <Card className="flex items-start gap-4 p-4">
              {videoPreview.thumbnailUrl && (
                <img
                  src={videoPreview.thumbnailUrl}
                  alt={videoPreview.title}
                  className="h-20 w-32 shrink-0 rounded-xl border border-slate-200 object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800 line-clamp-1">{videoPreview.title}</p>
                {videoPreview.authorName && (
                  <p className="mt-0.5 text-sm text-slate-500">{videoPreview.authorName}</p>
                )}
                {captions && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      captions.available
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {captions.available
                        ? `✓ Транскрипт: ${(captions.charCount ?? 0).toLocaleString()} знаци`
                        : '⚠ Нема субтитли'}
                    </span>
                    {captions.truncated && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">Скратен</span>
                    )}
                  </div>
                )}
                <a
                  href={videoPreview.normalizedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                >
                  <ExternalLink className="h-3 w-3" /> Отвори видео
                </a>
              </div>
              <button type="button" onClick={reset} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </Card>
          )}

          {/* Result summary + actions */}
          {result && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {result.tasks.length} извлечени задачи
                  </h2>
                  {result.topicsSummary && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <Tag className="h-3.5 w-3.5" />
                      {result.topicsSummary}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    result.quality.label === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
                    result.quality.label === 'good' ? 'bg-blue-100 text-blue-700' :
                    result.quality.label === 'fair' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {result.quality.score}% · {qualityMk[result.quality.label] ?? result.quality.label}
                  </span>
                  <button
                    type="button"
                    onClick={copyAll}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                  >
                    {isCopiedAll ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Копирано</> : <><Copy className="h-3.5 w-3.5" /> Копирај сè</>}
                  </button>
                  <button
                    type="button"
                    onClick={saveAll}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Библиотека
                  </button>
                  <button
                    type="button"
                    onClick={saveAllToBank}
                    disabled={isSavingToBank}
                    title="Зачувај сите задачи во банка на задачи (saved_questions)"
                    className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition"
                  >
                    {isSavingToBank ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                    Банка
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition"
                  >
                    Ново барање
                  </button>
                </div>
              </div>

              {/* Task cards grid */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {result.tasks.map((task, i) => (
                  <TaskCard key={i} task={task} index={i} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseTimestamp(s: string): number | null {
  const parts = s.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return null;
}

function applyTimeRange(caps: VideoCaptionsResult, timeRange: string): string {
  if (!timeRange.trim() || !caps.segments?.length) return caps.transcript ?? '';
  const [startStr, endStr] = timeRange.split(/\s*[-–]\s*/);
  const startMs = startStr ? parseTimestamp(startStr) : null;
  const endMs = endStr ? parseTimestamp(endStr) : null;
  if (startMs === null && endMs === null) return caps.transcript ?? '';
  const filtered = caps.segments.filter((seg) => {
    const after = startMs === null || seg.startMs >= startMs;
    const before = endMs === null || seg.endMs <= endMs;
    return after && before;
  });
  return filtered.length ? filtered.map((s) => s.text).join(' ') : (caps.transcript ?? '');
}
