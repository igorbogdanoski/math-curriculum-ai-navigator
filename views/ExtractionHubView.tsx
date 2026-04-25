import React, { useState, useRef, useCallback } from 'react';
import {
  Sparkles, Globe, ChevronDown, ChevronUp, Loader2, AlertTriangle,
  Check, Copy, Save, Image as ImageIcon, Wand2, X, BookOpen,
  Play, Tag, ExternalLink, FileText, Upload, Link,
} from 'lucide-react';
import { DokBadge } from '../components/common/DokBadge';
import { getAuth } from 'firebase/auth';
import { MathRenderer } from '../components/common/MathRenderer';
import { Card } from '../components/common/Card';
import {
  webTaskExtractionContract,
  chunkAndExtractTasks,
  extractTextFromDocument,
  extractTextFromImage,
  OCR_SUPPORTED_LANGUAGES,
  type OcrLanguage,
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
  fetchVimeoCaptions,
  type VideoPreviewData,
  type VideoCaptionsResult,
} from '../utils/videoPreview';
import { app } from '../firebaseConfig';
import {
  isYouTubeUrl,
  isVimeoUrl,
  isVideoUrl,
  applyTimeRange,
  toBase64,
  detectImageMime,
  classifyClipboard,
  isOcrLanguage,
} from './extractionHubHelpers';

// ─── OCR language labels (МК) ─────────────────────────────────────────────────

const OCR_LANG_MK: Record<OcrLanguage, string> = {
  auto: 'Автоматски (препорачано)',
  mk:   'Македонски (Кирилица)',
  sr:   'Српски (Кирилица / Латиница)',
  hr:   'Хрватски (Латиница, čćžšđ)',
  ru:   'Руски (Кирилица)',
  tr:   'Турски (Латиница, ğşıçöü)',
  en:   'Англиски (Латиница)',
};

// ─── Model options ────────────────────────────────────────────────────────────

type ModelOption = { id: string; label: string };

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (World-Class)' },
];

// ─── Source modes ─────────────────────────────────────────────────────────────

type SourceMode = 'url' | 'document';

// ─── Difficulty badge ─────────────────────────────────────────────────────────

const DIFF_STYLE: Record<ExtractedWebTask['difficulty'], string> = {
  basic: 'bg-emerald-100 text-emerald-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-violet-100 text-violet-700',
};
const DIFF_MK: Record<ExtractedWebTask['difficulty'], string> = {
  basic: 'Основно', intermediate: 'Средно', advanced: 'Напредно',
};

// ─── Progress bar ─────────────────────────────────────────────────────────────

const ExtractionProgress: React.FC<{ label: string; pct: number }> = ({ label, pct }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-xs text-white/70">
      <span className="flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" />
        {label}
      </span>
      <span>{Math.round(pct)}%</span>
    </div>
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-400 transition-all duration-700 ease-out"
        style={{ width: `${pct}%` }}
      />
    </div>
  </div>
);

// ─── Per-task card ────────────────────────────────────────────────────────────

const TaskCard: React.FC<{ task: ExtractedWebTask; index: number }> = ({ task, index }) => {
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
      if (res.inlineData) setImgDataUrl(`data:${res.inlineData.mimeType};base64,${res.inlineData.data}`);
    } catch { setImgError('Грешка при генерирање на слика.'); }
    finally { setIsGenerating(false); }
  };

  const copyLatex = async () => {
    await navigator.clipboard.writeText(task.latexStatement);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <Card className="p-5 space-y-3">
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

      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed">
        <MathRenderer text={task.latexStatement || task.statement} />
      </div>

      {imgDataUrl && (
        <div className="relative overflow-hidden rounded-xl border border-slate-200">
          <img src={imgDataUrl} alt={task.imagenPrompt} className="w-full object-cover" />
          <button
            type="button"
            aria-label="Отстрани слика"
            onClick={() => setImgDataUrl(null)}
            className="absolute right-2 top-2 rounded-full bg-slate-800/60 p-1 text-white hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {imgError && <p className="text-xs text-red-500">{imgError}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={copyLatex}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          {isCopied ? <><Check className="h-3 w-3 text-emerald-600" /> Копирано</> : <><Copy className="h-3 w-3" /> LaTeX</>}
        </button>
        {!imgDataUrl && (
          <button
            type="button"
            onClick={generateImage}
            disabled={isGenerating}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
            {isGenerating ? 'Генерира...' : 'Слика'}
          </button>
        )}
      </div>
    </Card>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildAuthHeaders(): Promise<HeadersInit> {
  const currentUser = getAuth(app).currentUser;
  if (!currentUser) return {};
  const token = await currentUser.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Main view ────────────────────────────────────────────────────────────────

export const ExtractionHubView: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { addNotification } = useNotification();
  const { navigate } = useNavigation();

  // ── Source mode ───────────────────────────────────────────────────────────
  const [sourceMode, setSourceMode] = useState<SourceMode>('url');

  // ── URL mode ──────────────────────────────────────────────────────────────
  const [url, setUrl] = useState('');
  const [manualTranscript, setManualTranscript] = useState('');
  const [noTranscriptDetected, setNoTranscriptDetected] = useState(false);

  // ── Document mode ─────────────────────────────────────────────────────────
  const [uploadedDoc, setUploadedDoc] = useState<{
    name: string;
    size: number;
    kind: 'docx' | 'pdf' | 'txt' | 'image';
    text?: string;
    base64?: string;
    mimeType?: string;
    images?: Array<{ mimeType: string; data: string }>;
  } | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>('auto');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-pro-preview');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [timeRange, setTimeRange] = useState('');
  const [specificInstructions, setSpecificInstructions] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [videoPreview, setVideoPreview] = useState<VideoPreviewData | null>(null);
  const [captions, setCaptions] = useState<VideoCaptionsResult | null>(null);
  const [result, setResult] = useState<WebTaskExtractionOutput | null>(null);
  const [chunksInfo, setChunksInfo] = useState<{ processed: number; total: number; beforeDedup: number } | null>(null);
  const [docLabel, setDocLabel] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingToBank, setIsSavingToBank] = useState(false);
  const [isCopiedAll, setIsCopiedAll] = useState(false);

  const urlInputRef = useRef<HTMLInputElement>(null);

  // ── Document loading ──────────────────────────────────────────────────────

  const loadFile = useCallback(async (file: File) => {
    const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
    if (file.size > MAX_SIZE) {
      setError('Датотеката е поголема од 20 MB. Изберете помала датотека.');
      return;
    }
    const name = file.name;
    const size = file.size;
    setError(null);
    setResult(null);
    setUploadedDoc(null);
    setChunksInfo(null);
    setDocLabel(null);

    const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx');
    const isTxt = file.type === 'text/plain' || name.endsWith('.txt');
    const imageMime = detectImageMime(name, file.type);

    if (imageMime) {
      const ab = await file.arrayBuffer();
      const base64 = toBase64(ab);
      setUploadedDoc({ name, size, kind: 'image', base64, mimeType: imageMime });
    } else if (isPdf) {
      const ab = await file.arrayBuffer();
      const base64 = toBase64(ab);
      setUploadedDoc({ name, size, kind: 'pdf', base64 });
    } else if (isDocx) {
      try {
        const ab = await file.arrayBuffer();
        const mammoth = await import('mammoth');
        const extractedImages: Array<{ mimeType: string; data: string }> = [];
        const { value: html } = await mammoth.convertToHtml(
          { arrayBuffer: ab },
          {
            convertImage: mammoth.images.imgElement(async (image) => {
              try {
                const ab2 = await image.read();
                const bytes = new Uint8Array(ab2);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
                const b64 = btoa(binary);
                const mime = image.contentType ?? 'image/png';
                if (extractedImages.length < 5) extractedImages.push({ mimeType: mime, data: b64 });
              } catch { /* skip unreadable images */ }
              return { src: '' };
            }),
          },
        );
        // Strip HTML tags to get plain text
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        setUploadedDoc({ name, size, kind: 'docx', text, images: extractedImages });
      } catch {
        setError('Не може да се отвори .docx датотеката. Проверете дали е валидна.');
      }
    } else if (isTxt) {
      const text = await file.text();
      setUploadedDoc({ name, size, kind: 'txt', text });
    } else {
      setError('Поддржани формати: PDF, DOCX, TXT, PNG, JPG, WEBP');
    }
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await loadFile(file);
  }, [loadFile]);

  // ── S42-E2b: Clipboard paste handler ──────────────────────────────────────
  const onPaste = useCallback(async (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (isLoading) return;
    const text = e.clipboardData?.getData('text/plain') ?? null;
    const cls = classifyClipboard(e.clipboardData?.items ?? null, text);
    if (cls.kind === 'image') {
      e.preventDefault();
      setSourceMode('document');
      await loadFile(cls.file);
    } else if (cls.kind === 'text' && sourceMode === 'url') {
      e.preventDefault();
      setManualTranscript(cls.text);
      setShowAdvanced(true);
    }
  }, [loadFile, isLoading, sourceMode]);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await loadFile(file);
    e.target.value = '';
  }, [loadFile]);

  // ── Extraction pipeline ───────────────────────────────────────────────────

  const extract = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setVideoPreview(null);
    setCaptions(null);
    setChunksInfo(null);
    setDocLabel(null);
    setProgressPct(5);

    try {
      if (sourceMode === 'url') {
        await extractFromUrl();
      } else {
        await extractFromDocument();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Грешка при извлекување. Обидете се повторно.';
      setError(msg);
    } finally {
      setIsLoading(false);
      setProgressLabel('');
      setProgressPct(0);
    }
  };

  // ── URL extraction ────────────────────────────────────────────────────────

  const extractFromUrl = async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError('Внесете URL.'); return; }
    if (!trimmed.startsWith('http')) { setError('Внесете валиден URL (http:// или https://)'); return; }

    let rawText = '';
    let sourceType: 'youtube' | 'webpage' = 'webpage';
    setNoTranscriptDetected(false);

    if (isVideoUrl(trimmed)) {
      sourceType = 'youtube';
      setProgressLabel('Вадење преглед на видеото...');
      setProgressPct(10);
      let preview = videoPreview;
      if (!preview) {
        preview = await fetchVideoPreview(trimmed);
        setVideoPreview(preview);
      }

      // Manual transcript overrides auto-fetch
      if (manualTranscript.trim()) {
        rawText = manualTranscript.trim();
      } else if (isYouTubeUrl(trimmed) && preview.videoId) {
        setProgressLabel('Вадење транскрипт...');
        setProgressPct(20);
        const caps = await fetchYouTubeCaptions(preview.videoId, 'mk');
        setCaptions(caps);
        if (caps.available && caps.transcript) {
          rawText = applyTimeRange(caps, timeRange);
        } else {
          setNoTranscriptDetected(true);
        }
      } else if (isVimeoUrl(trimmed) && preview.videoId) {
        setProgressLabel('Вадење Vimeo транскрипт...');
        setProgressPct(20);
        const caps = await fetchVimeoCaptions(preview.videoId, 'mk');
        setCaptions(caps);
        if (caps.available && caps.transcript) {
          rawText = applyTimeRange(caps, timeRange);
        } else {
          setNoTranscriptDetected(true);
        }
      } else {
        setNoTranscriptDetected(!manualTranscript.trim());
      }

      // If still no text and no manual transcript → use title as last resort
      if (!rawText && !manualTranscript.trim()) {
        rawText = `Video title: ${preview.title}\nAuthor: ${preview.authorName ?? 'unknown'}`;
      }
    } else {
      setProgressLabel('Вадење содржина на страната...');
      setProgressPct(15);
      const headers = await buildAuthHeaders();
      const params = new URLSearchParams({ url: trimmed });
      const res = await fetch(`/api/webpage-extract?${params.toString()}`, { headers });
      const data = await res.json() as { available: boolean; text?: string; reason?: string };
      if (!data.available) throw new Error(data.reason ?? 'Страната не е достапна.');
      rawText = data.text ?? '';
    }

    // If no transcript and no manual input, surface message instead of running AI on just a title
    if (!rawText.trim() || (noTranscriptDetected && !manualTranscript.trim() && rawText.length < 200)) {
      setError('Транскриптот не е достапен автоматски. Внесете го рачно во „Напредни параметри → Рачен транскрипт".');
      setShowAdvanced(true);
      return;
    }

    await runChunkedExtraction(rawText, sourceType, trimmed);
  };

  // ── Document extraction ───────────────────────────────────────────────────

  const extractFromDocument = async () => {
    if (!uploadedDoc) { setError('Изберете документ.'); return; }

    let rawText = '';
    setDocLabel(uploadedDoc.name);

    if (uploadedDoc.kind === 'txt' || uploadedDoc.kind === 'docx') {
      rawText = uploadedDoc.text ?? '';
      if (!rawText.trim()) { setError('Документот е празен или не може да се прочита.'); return; }
    } else if (uploadedDoc.kind === 'pdf') {
      setProgressLabel('Gemini Vision: Читање на PDF...');
      setProgressPct(15);
      rawText = await extractTextFromDocument(uploadedDoc.base64 ?? '', { language: ocrLanguage });
      if (!rawText.trim()) { setError('PDF-от е празен или не содржи читлив текст.'); return; }
    } else if (uploadedDoc.kind === 'image') {
      setProgressLabel('Gemini Vision: OCR на сликата...');
      setProgressPct(20);
      rawText = await extractTextFromImage(
        uploadedDoc.base64 ?? '',
        uploadedDoc.mimeType ?? 'image/png',
        { language: ocrLanguage },
      );
      if (!rawText.trim()) { setError('Сликата не содржи читлив текст.'); return; }
    }

    const docMediaParts = uploadedDoc.images?.map(img => ({ inlineData: img }));
    await runChunkedExtraction(rawText, 'webpage', uploadedDoc.name, docMediaParts);
  };

  // ── Shared chunked extraction ─────────────────────────────────────────────

  const runChunkedExtraction = async (
    text: string,
    sourceType: 'youtube' | 'webpage',
    sourceRef: string,
    mediaParts?: Array<{ inlineData: { mimeType: string; data: string } }>,
  ) => {
    const isLong = text.length > 10_000;

    if (!isLong) {
      setProgressLabel('Gemini AI: Изолација на математички задачи...');
      setProgressPct(60);
      const { output, fallback } = await webTaskExtractionContract({
        text, sourceType, sourceRef,
        specificInstructions: specificInstructions.trim() || undefined,
        model: selectedModel,
        mediaParts,
      });
      setProgressPct(95);
      if (fallback || output.tasks.length === 0) {
        setError(fallback
          ? 'AI не успеа да ги извлече задачите. Пробајте со поинакви инструкции.'
          : 'Не се пронајдени математички задачи во оваа содржина.');
      } else {
        setResult(output);
        setChunksInfo({ processed: 1, total: 1, beforeDedup: output.tasks.length });
      }
      return;
    }

    // Long text → chunked
    const totalChunks = Math.ceil((text.length - 400) / (10_000 - 400)) || 1;
    setProgressLabel(`Дел 1/${totalChunks} — Анализа на содржина...`);
    setProgressPct(30);

    const chunkResult = await chunkAndExtractTasks({
      text, sourceType, sourceRef,
      specificInstructions: specificInstructions.trim() || undefined,
      model: selectedModel,
      mediaParts,
      onChunkProgress: (current, total) => {
        setProgressLabel(`Дел ${current}/${total} — Анализа на содржина...`);
        setProgressPct(30 + Math.round((current / total) * 60));
      },
    });

    setProgressPct(95);

    if (chunkResult.fallback || chunkResult.output.tasks.length === 0) {
      setError(chunkResult.fallback
        ? 'AI не успеа да ги извлече задачите. Пробајте со поинакви инструкции.'
        : 'Не се пронајдени математички задачи во оваа содржина.');
    } else {
      setResult(chunkResult.output);
      setChunksInfo({
        processed: chunkResult.chunksProcessed,
        total: chunkResult.chunksProcessed,
        beforeDedup: chunkResult.tasksBeforeDedup,
      });
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

  // ── Save ──────────────────────────────────────────────────────────────────

  const saveAll = async () => {
    if (!result || !firebaseUser) { addNotification('Треба да сте најавени.', 'warning'); return; }
    setIsSaving(true);
    try {
      const label = sourceMode === 'document' ? (docLabel ?? 'Документ') : url.slice(0, 60);
      await saveToLibrary(result, {
        title: `Екстракција: ${label}`,
        type: 'problems',
        teacherUid: firebaseUser.uid,
      });
      addNotification(`Зачувани ${result.tasks.length} задачи во библиотека! ✓`, 'success');
    } catch { addNotification('Зачувувањето не успеа.', 'error'); }
    finally { setIsSaving(false); }
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
    } catch { addNotification('Зачувувањето не успеа.', 'error'); }
    finally { setIsSavingToBank(false); }
  };

  const sendToGenerator = () => {
    if (!result) return;
    const scenarioText = result.tasks
      .map((t, i) => `${i + 1}. ${t.title}\n${t.latexStatement || t.statement}`)
      .join('\n\n');
    try {
      sessionStorage.setItem('generator_extraction_context', JSON.stringify({
        contextType: 'SCENARIO',
        scenarioText: `[Извлечено од: ${sourceMode === 'url' ? url : (docLabel ?? 'документ')}]\n\n${scenarioText}`,
      }));
    } catch { /* ignore */ }
    navigate('/generator');
  };

  const reset = () => {
    setUrl('');
    setManualTranscript('');
    setNoTranscriptDetected(false);
    setUploadedDoc(null);
    setResult(null);
    setError(null);
    setVideoPreview(null);
    setCaptions(null);
    setChunksInfo(null);
    setDocLabel(null);
    setProgressPct(0);
    setProgressLabel('');
    urlInputRef.current?.focus();
  };

  // ── Quality label ─────────────────────────────────────────────────────────

  const qualityMk: Record<string, string> = {
    poor: 'Слабо', fair: 'Добро', good: 'Многу добро', excellent: 'Одлично',
  };

  const canExtract = isLoading
    ? false
    : sourceMode === 'url'
      ? url.trim().startsWith('http')
      : uploadedDoc !== null;

  // ─────────────────────────────────────────────────────────────────────────────
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

          {/* Icon trio */}
          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 backdrop-blur-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20">
                <Play className="h-5 w-5 fill-red-400 text-red-400" />
              </div>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/20">
                <Globe className="h-5 w-5 text-blue-400" />
              </div>
              <div className="h-6 w-px bg-white/20" />
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20">
                <FileText className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              YouTube, Веб &amp; Документ Екстрактор
            </h1>
            <p className="mt-3 text-base text-white/60">
              Претворете YouTube туторијал, веб страна или документ (PDF, DOCX, TXT)<br className="hidden sm:block" />
              во структурирани математички задачи со помош на Gemini AI.
            </p>
          </div>

          {/* Source mode toggle */}
          <div className="flex justify-center gap-2">
            {[
              { mode: 'url' as SourceMode, icon: Link, label: 'URL (YouTube / Веб)' },
              { mode: 'document' as SourceMode, icon: FileText, label: 'Документ (PDF / DOCX / TXT)' },
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => { setSourceMode(mode); setError(null); setResult(null); }}
                disabled={isLoading}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                  sourceMode === mode
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                    : 'border border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Input card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">

            {/* ── URL mode ── */}
            {sourceMode === 'url' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40">🔗</span>
                    <input
                      ref={urlInputRef}
                      type="url"
                      value={url}
                      onChange={(e) => { setUrl(e.target.value); setError(null); setResult(null); setNoTranscriptDetected(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && canExtract) extract(); }}
                      placeholder="YouTube, Vimeo или веб-адреса..."
                      disabled={isLoading}
                      className="w-full rounded-xl border border-white/10 bg-white/10 py-3.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 disabled:opacity-60"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={extract}
                    disabled={!canExtract}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-3.5 font-bold text-white transition hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    Екстрахирај
                  </button>
                </div>
                {/* Vimeo real-time hint */}
                {isVimeoUrl(url) && (
                  <p className="flex items-center gap-1.5 text-xs text-purple-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-400 shrink-0" />
                    Vimeo — транскриптот се вчитува автоматски (доколку видеото има субтитли).
                  </p>
                )}
                {/* No-transcript prompt (after failed auto-fetch) */}
                {noTranscriptDetected && !manualTranscript.trim() && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Транскриптот не е достапен автоматски.
                    <button
                      type="button"
                      onClick={() => setShowAdvanced(true)}
                      className="ml-auto font-bold underline hover:text-amber-200 transition"
                    >
                      Внесете рачно →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Document mode ── */}
            {sourceMode === 'document' && (
              <div className="space-y-3">
                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  className={`relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition cursor-pointer ${
                    isDragging
                      ? 'border-indigo-400 bg-indigo-500/10'
                      : uploadedDoc
                        ? 'border-emerald-400/50 bg-emerald-500/10'
                        : 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/8'
                  }`}
                  onClick={() => !isLoading && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                    className="sr-only"
                    aria-label="Изберете документ (PDF, DOCX, TXT, PNG, JPG, WEBP)"
                    title="Изберете документ"
                    onChange={onFileChange}
                    disabled={isLoading}
                  />

                  {uploadedDoc ? (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20">
                        <FileText className="h-6 w-6 text-emerald-400" />
                      </div>
                      <div>
                        <p className="font-bold text-white">{uploadedDoc.name}</p>
                        <p className="text-xs text-white/50 mt-0.5">
                          {(uploadedDoc.size / 1024).toFixed(0)} KB
                          {uploadedDoc.kind === 'docx' && uploadedDoc.text
                            ? ` · ${uploadedDoc.text.length.toLocaleString()} знаци извлечени${uploadedDoc.images?.length ? ` · ${uploadedDoc.images.length} слики` : ''}`
                            : uploadedDoc.kind === 'pdf' ? ' · PDF — Gemini Vision ќе чита' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Отстрани документ"
                        onClick={(e) => { e.stopPropagation(); setUploadedDoc(null); setResult(null); setError(null); }}
                        className="absolute right-3 top-3 rounded-lg p-1 text-white/40 hover:text-white/80 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                        <Upload className="h-6 w-6 text-white/60" />
                      </div>
                      <div>
                        <p className="font-semibold text-white/80">Повлечете датотека тука</p>
                        <p className="text-xs text-white/40 mt-1">или кликнете за да изберете</p>
                      </div>
                      <div className="flex flex-wrap justify-center gap-2">
                        {['PDF', 'DOCX', 'TXT', 'PNG', 'JPG', 'WEBP'].map(fmt => (
                          <span key={fmt} className="rounded-lg bg-white/10 px-2.5 py-1 text-xs font-bold text-white/60">{fmt}</span>
                        ))}
                      </div>
                      <p className="text-xs text-white/30">Максимум 20 MB · Ctrl+V за залепување слика</p>
                    </>
                  )}
                </div>

                {/* Extract button */}
                <button
                  type="button"
                  onClick={extract}
                  disabled={!canExtract}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-3.5 font-bold text-white transition hover:from-indigo-600 hover:to-violet-600 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Екстрахирај задачи
                </button>
              </div>
            )}

            {/* ── Model + advanced (shared) ── */}
            <div className="mt-3 flex items-center justify-between gap-3">
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isLoading}
                aria-label="Избери AI модел"
                title="Избери AI модел"
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

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                {sourceMode === 'url' && (
                  <>
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
                      <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                        <FileText className="h-3.5 w-3.5" />
                        Рачен транскрипт
                        <span className="text-white/40 font-normal">(за Vimeo, приватни или видеа без субтитли)</span>
                      </label>
                      <textarea
                        value={manualTranscript}
                        onChange={(e) => setManualTranscript(e.target.value)}
                        placeholder="Заалепете го транскриптот или текстот на видеото тука..."
                        rows={4}
                        className="w-full resize-y rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                      />
                      {manualTranscript.trim() && (
                        <p className="mt-1 text-xs text-amber-300/70">
                          ✓ {manualTranscript.trim().length.toLocaleString()} знаци — ќе се користи наместо автоматски транскрипт
                        </p>
                      )}
                    </div>
                  </>
                )}
                {sourceMode === 'document' && (
                  <div>
                    <label className="block text-xs font-semibold text-white/60 mb-1">
                      Јазик на документот (OCR hint)
                    </label>
                    <select
                      value={ocrLanguage}
                      onChange={(e) => { if (isOcrLanguage(e.target.value)) setOcrLanguage(e.target.value); }}
                      disabled={isLoading}
                      aria-label="Јазик на OCR"
                      title="Јазик на OCR"
                      className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                    >
                      {OCR_SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang} value={lang} className="bg-slate-900 text-white">
                          {OCR_LANG_MK[lang]}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
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
            {isLoading && progressLabel && (
              <div className="mt-4">
                <ExtractionProgress label={progressLabel} pct={progressPct} />
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
                      captions.available ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {captions.available
                        ? `✓ Транскрипт: ${(captions.charCount ?? 0).toLocaleString()} знаци`
                        : '⚠ Нема субтитли'}
                    </span>
                    {captions.truncated && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                        Скратен (&gt;80K)
                      </span>
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
              <button type="button" aria-label="Затвори" onClick={reset} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </Card>
          )}

          {/* Document source label */}
          {docLabel && !videoPreview && (
            <Card className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50">
                <FileText className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">{docLabel}</p>
                <p className="text-xs text-slate-400">Документ</p>
              </div>
              <button type="button" aria-label="Затвори" onClick={reset} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600">
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
                  {/* Chunks badge */}
                  {chunksInfo && chunksInfo.processed > 1 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                        <Wand2 className="h-3 w-3" />
                        {chunksInfo.processed} делови анализирани
                      </span>
                      {chunksInfo.beforeDedup > result.tasks.length && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                          {chunksInfo.beforeDedup - result.tasks.length} дупликати отстранети
                        </span>
                      )}
                    </div>
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
                    title="Зачувај сите задачи во банка на задачи"
                    className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition"
                  >
                    {isSavingToBank ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                    Банка
                  </button>
                  <button
                    type="button"
                    onClick={sendToGenerator}
                    title="Испрати ги извлечените задачи во Генератор за AI материјали"
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    Генератор
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
