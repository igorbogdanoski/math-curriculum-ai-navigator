import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import { getAuth } from 'firebase/auth';
import {
  webTaskExtractionContract,
  chunkAndExtractTasks,
  extractTextFromDocument,
  extractTextFromImage,
  enrichExtractedPedagogy,
  type OcrLanguage,
  type WebTaskExtractionOutput,
} from '../services/gemini/visionContracts';
import { saveExtractedToBank } from '../services/firestoreService.scenarioBank';
import { PublishScenarioDialog, type PublishScenarioOptions } from '../components/scenario-bank/PublishScenarioDialog';
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
} from './extractionHubHelpers';
import { ExtractionSourceHero, type SourceMode, type UploadedDoc } from '../components/extraction/ExtractionSourceHero';
import { ExtractionResultsPanel } from '../components/extraction/ExtractionResultsPanel';

// ─── Quick-generate material types ───────────────────────────────────────────

type QuickGenType = 'SCENARIO' | 'QUIZ' | 'FLASHCARDS' | 'ASSESSMENT';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildAuthHeaders(): Promise<HeadersInit> {
  const currentUser = getAuth(app).currentUser;
  if (!currentUser) return {};
  const token = await currentUser.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Main view ────────────────────────────────────────────────────────────────

export const ExtractionHubView: React.FC = () => {
  const { firebaseUser, user } = useAuth();
  const isPro = user?.isPremium || user?.tier === 'Pro' || user?.tier === 'School' || user?.tier === 'Unlimited';
  const { addNotification } = useNotification();
  const { navigate } = useNavigation();

  // ── Source mode ───────────────────────────────────────────────────────────
  const [sourceMode, setSourceMode] = useState<SourceMode>('url');

  // ── URL mode ──────────────────────────────────────────────────────────────
  const [url, setUrl] = useState('');
  const [manualTranscript, setManualTranscript] = useState('');
  const [noTranscriptDetected, setNoTranscriptDetected] = useState(false);

  // ── YouTube mode ──────────────────────────────────────────────────────────
  const [ytUrl, setYtUrl] = useState('');
  const [ytTimeStart, setYtTimeStart] = useState('');
  const [ytTimeEnd, setYtTimeEnd] = useState('');
  const [ytLang, setYtLang] = useState<OcrLanguage>('mk');

  // ── Document mode ─────────────────────────────────────────────────────────
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDoc | null>(null);
  const [ocrLanguage, setOcrLanguage] = useState<OcrLanguage>('auto');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<Set<number>>(new Set());
  const toggleTaskSelection = (idx: number) =>
    setSelectedTaskIndices(prev => { const s = new Set(prev); s.has(idx) ? s.delete(idx) : s.add(idx); return s; });

  const [printWithSolutions, setPrintWithSolutions] = useState(false);
  const worksheetPrintRef = useRef<HTMLDivElement>(null);
  const handleWorksheetPrint = useReactToPrint({
    contentRef: worksheetPrintRef,
    documentTitle: 'Raboten_List',
    pageStyle: '@page { size: A4 portrait; margin: 1.5cm 1.2cm; }',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isCopiedAll, setIsCopiedAll] = useState(false);
  // S96.3 — curriculum tagging before save
  const [saveGrade, setSaveGrade] = useState<number | ''>('');
  const [saveTopicId, setSaveTopicId] = useState('');

  const [enriching, setEnriching] = useState(false);
  const [genMaterialType, setGenMaterialType] = useState<QuickGenType>('SCENARIO');
  const [showGenDropdown, setShowGenDropdown] = useState(false);
  const genDropdownRef = useRef<HTMLDivElement>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOut = (e: MouseEvent) => {
      if (genDropdownRef.current && !genDropdownRef.current.contains(e.target as Node)) {
        setShowGenDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOut);
    return () => document.removeEventListener('mousedown', handleClickOut);
  }, []);

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
    } else if (cls.kind === 'text' && (sourceMode === 'url' || sourceMode === 'youtube')) {
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

  const onCameraCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      } else if (sourceMode === 'youtube') {
        await extractFromYouTube();
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

  // ── YouTube extraction (S48) ──────────────────────────────────────────────

  const extractFromYouTube = async () => {
    const trimmed = ytUrl.trim();
    if (!trimmed) { setError('Внесете YouTube URL.'); return; }

    setProgressLabel('Вадење преглед на видеото...');
    setProgressPct(10);

    let preview = videoPreview;
    if (!preview || !isYouTubeUrl(trimmed)) {
      preview = await fetchVideoPreview(trimmed);
      setVideoPreview(preview);
    }

    let rawText = '';
    setNoTranscriptDetected(false);

    if (preview.videoId) {
      setProgressLabel('Вадење транскрипт...');
      setProgressPct(20);
      const timeRange = [ytTimeStart.trim(), ytTimeEnd.trim()].filter(Boolean).join(' - ');
      const caps = await fetchYouTubeCaptions(preview.videoId, ytLang);
      setCaptions(caps);
      if (caps.available && caps.transcript) {
        rawText = applyTimeRange(caps, timeRange);
      } else {
        setNoTranscriptDetected(true);
      }
    }

    if (!rawText && manualTranscript.trim()) rawText = manualTranscript.trim();
    if (!rawText) {
      setError('Транскриптот не е достапен автоматски. Внесете го рачно во полето подолу.');
      return;
    }

    const chunkResult = await chunkAndExtractTasks({
      text: rawText,
      sourceType: 'youtube',
      sourceRef: trimmed,
      specificInstructions: specificInstructions.trim() || undefined,
      model: selectedModel,
      onChunkProgress: (current, total) => {
        setProgressLabel(`Дел ${current}/${total} — Анализа...`);
        setProgressPct(30 + Math.round((current / total) * 60));
      },
    });

    setProgressPct(95);

    if (chunkResult.fallback || chunkResult.output.tasks.length === 0) {
      setError(chunkResult.fallback
        ? 'AI не успеа да ги извлече задачите. Пробајте со поинакви инструкции.'
        : 'Не се пронајдени математички задачи во ова видео.');
    } else {
      setResult(chunkResult.output);
      setChunksInfo({ processed: chunkResult.chunksProcessed, total: chunkResult.chunksProcessed, beforeDedup: chunkResult.tasksBeforeDedup });
      setEnriching(true);
      enrichExtractedPedagogy(chunkResult.output.tasks).then(enriched => {
        setResult(prev => prev ? { ...prev, tasks: enriched } : prev);
      }).finally(() => setEnriching(false));
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
        // S45-C: pedagogy enrichment in background — does not block the UI
        setEnriching(true);
        enrichExtractedPedagogy(output.tasks).then(enriched => {
          setResult(prev => prev ? { ...prev, tasks: enriched } : prev);
        }).finally(() => setEnriching(false));
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
      // S45-C: pedagogy enrichment in background
      setEnriching(true);
      enrichExtractedPedagogy(chunkResult.output.tasks).then(enriched => {
        setResult(prev => prev ? { ...prev, tasks: enriched } : prev);
      }).finally(() => setEnriching(false));
    }
  };

  // ── Active tasks (selection-aware) ───────────────────────────────────────
  // When tasks are selected (checkboxes), all operations use only those tasks.

  const getActiveTasks = () => {
    if (!result) return [];
    return selectedTaskIndices.size > 0
      ? result.tasks.filter((_, i) => selectedTaskIndices.has(i))
      : result.tasks;
  };

  // ── Copy all ──────────────────────────────────────────────────────────────

  const copyAll = async () => {
    if (!result) return;
    const tasks = getActiveTasks();
    const txt = tasks.map((t, i) =>
      `${i + 1}. ${t.title}\n${t.latexStatement || t.statement}`
    ).join('\n\n');
    await navigator.clipboard.writeText(txt);
    setIsCopiedAll(true);
    setTimeout(() => setIsCopiedAll(false), 2000);
  };

  // ── Save ──────────────────────────────────────────────────────────────────

  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const confirmSaveAll = async (opts: PublishScenarioOptions) => {
    if (!result || !firebaseUser) { addNotification('Треба да сте најавени.', 'warning'); return; }
    setIsSaving(true);
    try {
      const tasks = getActiveTasks();
      const label = sourceMode === 'document' ? (docLabel ?? 'Документ') : url.slice(0, 60);
      await saveExtractedToBank({
        title: `Екстракција: ${label}`,
        grade: saveGrade,
        topicId: saveTopicId.trim() || undefined,
        authorUid: firebaseUser.uid,
        authorName: firebaseUser.displayName ?? 'Наставник',
        isPublic: opts.isPublic,
      });
      addNotification(
        `${tasks.length} задач${tasks.length === 1 ? 'а зачувана' : 'и зачувани'} во Банката на Сценарија! ✓`,
        'success',
      );
      setShowSaveDialog(false);
    } catch { addNotification('Зачувувањето не успеа.', 'error'); }
    finally { setIsSaving(false); }
  };

  const sendToGenerator = (materialType: QuickGenType = genMaterialType) => {
    if (!result) return;
    const tasks = getActiveTasks();
    const scenarioText = tasks
      .map((t, i) => `${i + 1}. ${t.title}\n${t.latexStatement || t.statement}`)
      .join('\n\n');
    try {
      sessionStorage.setItem('generator_extraction_context', JSON.stringify({
        contextType: 'SCENARIO',
        materialType,
        scenarioText: `[Извлечено од: ${sourceMode === 'url' ? url : (docLabel ?? 'документ')}]\n\n${scenarioText}`,
      }));
    } catch { /* ignore */ }
    navigate('/generator');
  };

  const sendToKahoot = () => {
    if (!result) return;
    const tasks = getActiveTasks();
    try {
      sessionStorage.setItem('kahoot_tasks', JSON.stringify(tasks));
    } catch { /* quota */ }
    navigate('/kahoot/make');
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

  const canExtract = isLoading
    ? false
    : sourceMode === 'url'
      ? url.trim().startsWith('http')
      : sourceMode === 'youtube'
      ? ytUrl.trim().startsWith('http')
      : uploadedDoc !== null;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen">

      {/* ══ Dark glassmorphism hero ══ */}
      <ExtractionSourceHero
        sourceMode={sourceMode} setSourceMode={setSourceMode}
        isLoading={isLoading} error={error} setError={setError} setResult={setResult}
        canExtract={canExtract} extract={extract} navigate={navigate}
        url={url} setUrl={setUrl} urlInputRef={urlInputRef}
        noTranscriptDetected={noTranscriptDetected} setNoTranscriptDetected={setNoTranscriptDetected}
        manualTranscript={manualTranscript} setManualTranscript={setManualTranscript}
        setShowAdvanced={setShowAdvanced}
        ytUrl={ytUrl} setYtUrl={setYtUrl}
        ytTimeStart={ytTimeStart} setYtTimeStart={setYtTimeStart}
        ytTimeEnd={ytTimeEnd} setYtTimeEnd={setYtTimeEnd}
        ytLang={ytLang} setYtLang={setYtLang}
        videoPreview={videoPreview} setVideoPreview={setVideoPreview} captions={captions}
        uploadedDoc={uploadedDoc} setUploadedDoc={setUploadedDoc}
        ocrLanguage={ocrLanguage} setOcrLanguage={setOcrLanguage}
        isDragging={isDragging} setIsDragging={setIsDragging}
        onDrop={onDrop} onFileChange={onFileChange} fileInputRef={fileInputRef}
        cameraInputRef={cameraInputRef} onCameraCapture={onCameraCapture} extractFromDocument={extractFromDocument}
        selectedModel={selectedModel} setSelectedModel={setSelectedModel}
        showAdvanced={showAdvanced} timeRange={timeRange} setTimeRange={setTimeRange}
        specificInstructions={specificInstructions} setSpecificInstructions={setSpecificInstructions}
        progressLabel={progressLabel} progressPct={progressPct}
        onPaste={onPaste}
      />


      {/* ══ Results section ══ */}
      {(videoPreview || result) && (
        <ExtractionResultsPanel
          videoPreview={videoPreview} docLabel={docLabel} result={result}
          chunksInfo={chunksInfo} enriching={enriching} captions={captions} reset={reset}
          selectedTaskIndices={selectedTaskIndices} setSelectedTaskIndices={setSelectedTaskIndices}
          toggleTaskSelection={toggleTaskSelection}
          saveGrade={saveGrade} setSaveGrade={setSaveGrade}
          saveTopicId={saveTopicId} setSaveTopicId={setSaveTopicId}
          copyAll={copyAll} isCopiedAll={isCopiedAll}
          setShowSaveDialog={setShowSaveDialog} isSaving={isSaving}
          genMaterialType={genMaterialType} setGenMaterialType={setGenMaterialType}
          showGenDropdown={showGenDropdown} setShowGenDropdown={setShowGenDropdown}
          genDropdownRef={genDropdownRef} sendToGenerator={sendToGenerator} sendToKahoot={sendToKahoot}
          printWithSolutions={printWithSolutions} setPrintWithSolutions={setPrintWithSolutions}
          worksheetPrintRef={worksheetPrintRef} handleWorksheetPrint={handleWorksheetPrint}
        />
      )}


      {showSaveDialog && result && (
        <PublishScenarioDialog
          item={{ title: `Екстракција: ${sourceMode === 'document' ? (docLabel ?? 'Документ') : url.slice(0, 60)}` }}
          isPro={!!isPro}
          showTeachingModel={false}
          isLoading={isSaving}
          onPublish={confirmSaveAll}
          onCancel={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
};
