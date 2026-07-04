import React from 'react';
import {
  Sparkles, Globe, ChevronDown, ChevronUp, Loader2, AlertTriangle,
  Play, FileText, Upload, Link, Camera, X,
} from 'lucide-react';
import { ExtractionProgress } from './ExtractionTaskCard';
import {
  OCR_SUPPORTED_LANGUAGES,
  type OcrLanguage,
} from '../../services/gemini/visionContracts';
import type { VideoPreviewData, VideoCaptionsResult } from '../../utils/videoPreview';
import { isVimeoUrl, isOcrLanguage } from '../../views/extractionHubHelpers';

export type SourceMode = 'url' | 'youtube' | 'document' | 'camera';

export interface UploadedDoc {
  name: string;
  size: number;
  kind: 'docx' | 'pdf' | 'txt' | 'image';
  text?: string;
  base64?: string;
  mimeType?: string;
  images?: Array<{ mimeType: string; data: string }>;
}

type ModelOption = { id: string; label: string };

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (World-Class)' },
];

const OCR_LANG_MK: Record<OcrLanguage, string> = {
  auto: 'Автоматски (препорачано)',
  mk:   'Македонски (Кирилица)',
  sr:   'Српски (Кирилица / Латиница)',
  hr:   'Хрватски (Латиница, čćžšđ)',
  ru:   'Руски (Кирилица)',
  tr:   'Турски (Латиница, ğşıçöü)',
  en:   'Англиски (Латиница)',
};

interface ExtractionSourceHeroProps {
  sourceMode: SourceMode;
  setSourceMode: (m: SourceMode) => void;
  isLoading: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  setResult: (r: null) => void;
  canExtract: boolean;
  extract: () => void;
  navigate: (path: string) => void;

  // URL mode
  url: string;
  setUrl: (v: string) => void;
  urlInputRef: React.RefObject<HTMLInputElement | null>;
  noTranscriptDetected: boolean;
  setNoTranscriptDetected: (v: boolean) => void;
  manualTranscript: string;
  setManualTranscript: (v: string) => void;
  setShowAdvanced: (v: boolean) => void;

  // YouTube mode
  ytUrl: string;
  setYtUrl: (v: string) => void;
  ytTimeStart: string;
  setYtTimeStart: (v: string) => void;
  ytTimeEnd: string;
  setYtTimeEnd: (v: string) => void;
  ytLang: OcrLanguage;
  setYtLang: (v: OcrLanguage) => void;
  videoPreview: VideoPreviewData | null;
  setVideoPreview: (v: VideoPreviewData | null) => void;
  captions: VideoCaptionsResult | null;

  // Document mode
  uploadedDoc: UploadedDoc | null;
  setUploadedDoc: (v: UploadedDoc | null) => void;
  ocrLanguage: OcrLanguage;
  setOcrLanguage: (v: OcrLanguage) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  // Camera mode
  cameraInputRef: React.RefObject<HTMLInputElement | null>;
  onCameraCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
  extractFromDocument: () => void;

  // Shared model/advanced
  selectedModel: string;
  setSelectedModel: (v: string) => void;
  showAdvanced: boolean;
  timeRange: string;
  setTimeRange: (v: string) => void;
  specificInstructions: string;
  setSpecificInstructions: (v: string) => void;

  progressLabel: string;
  progressPct: number;

  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
}

export const ExtractionSourceHero: React.FC<ExtractionSourceHeroProps> = ({
  sourceMode, setSourceMode, isLoading, error, setError, setResult, canExtract, extract, navigate,
  url, setUrl, urlInputRef, noTranscriptDetected, setNoTranscriptDetected, manualTranscript, setManualTranscript, setShowAdvanced,
  ytUrl, setYtUrl, ytTimeStart, setYtTimeStart, ytTimeEnd, setYtTimeEnd, ytLang, setYtLang,
  videoPreview, setVideoPreview, captions,
  uploadedDoc, setUploadedDoc, ocrLanguage, setOcrLanguage, isDragging, setIsDragging, onDrop, onFileChange, fileInputRef,
  cameraInputRef, onCameraCapture, extractFromDocument,
  selectedModel, setSelectedModel, showAdvanced, timeRange, setTimeRange, specificInstructions, setSpecificInstructions,
  progressLabel, progressPct,
  onPaste,
}) => {
  return (
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
        <div className="flex justify-center gap-2 flex-wrap">
          {[
            { mode: 'youtube' as SourceMode, icon: Play, label: 'YouTube', iconClass: 'fill-red-400 text-red-400' },
            { mode: 'url' as SourceMode, icon: Link, label: 'Веб URL', iconClass: '' },
            { mode: 'document' as SourceMode, icon: FileText, label: 'Документ', iconClass: '' },
            { mode: 'camera' as SourceMode, icon: Camera, label: 'Камера', iconClass: 'text-emerald-500' },
          ].map(({ mode, icon: Icon, label, iconClass }) => (
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
              <Icon className={`h-4 w-4 ${iconClass}`} />
              {label}
            </button>
          ))}
        </div>

        {/* Input card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm" onPaste={onPaste}>

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

          {/* ── YouTube mode (S48) ── */}
          {sourceMode === 'youtube' && (
            <div className="space-y-3">
              {/* URL input */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-red-400">▶</span>
                  <input
                    type="url"
                    value={ytUrl}
                    onChange={e => { setYtUrl(e.target.value); setError(null); setResult(null); setVideoPreview(null); }}
                    onKeyDown={e => { if (e.key === 'Enter' && canExtract) extract(); }}
                    placeholder="https://youtube.com/watch?v=..."
                    disabled={isLoading}
                    className="w-full rounded-xl border border-white/10 bg-white/10 py-3.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-red-400/60 focus:outline-none focus:ring-2 focus:ring-red-400/20 disabled:opacity-60"
                  />
                </div>
                <button
                  type="button"
                  onClick={extract}
                  disabled={!canExtract}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-5 py-3.5 font-bold text-white transition hover:from-red-600 hover:to-orange-600 disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  Екстрахирај
                </button>
              </div>

              {/* Time range (upfront — most important YT control) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1">Почеток (пр. 3:00)</label>
                  <input
                    type="text"
                    value={ytTimeStart}
                    onChange={e => setYtTimeStart(e.target.value)}
                    placeholder="0:00"
                    disabled={isLoading}
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 mb-1">Крај (пр. 18:30)</label>
                  <input
                    type="text"
                    value={ytTimeEnd}
                    onChange={e => setYtTimeEnd(e.target.value)}
                    placeholder="до крај"
                    disabled={isLoading}
                    className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Language selector */}
              <div className="flex items-center gap-3">
                <label className="text-xs text-white/50 shrink-0">Јазик на транскрипт:</label>
                <select
                  value={ytLang}
                  onChange={e => { if (isOcrLanguage(e.target.value)) setYtLang(e.target.value as OcrLanguage); }}
                  disabled={isLoading}
                  aria-label="Јазик на транскрипт"
                  title="Јазик на транскрипт"
                  className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
                >
                  {(['mk', 'sq', 'tr', 'en', 'sr'] as OcrLanguage[]).map(l => (
                    <option key={l} value={l} className="bg-slate-900 text-white">{OCR_LANG_MK[l]}</option>
                  ))}
                </select>
              </div>

              {/* Video preview card */}
              {videoPreview && (
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                  {videoPreview.thumbnailUrl && (
                    <img src={videoPreview.thumbnailUrl} alt="" className="w-24 h-14 object-cover rounded-lg shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{videoPreview.title}</p>
                    {videoPreview.authorName && <p className="text-xs text-white/50 mt-0.5">{videoPreview.authorName}</p>}
                    {captions && (
                      <p className={`text-xs mt-1 ${captions.available ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {captions.available ? `✓ Транскрипт достапен` : '⚠ Транскриптот не е достапен'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Manual transcript — always visible so users can paste before extraction */}
              <div>
                <label className={`mb-1 block text-xs font-semibold ${noTranscriptDetected ? 'text-amber-300' : 'text-white/50'}`}>
                  Рачен транскрипт
                  <span className="ml-1 font-normal">
                    {noTranscriptDetected ? '(видеото нема субтитли — задолжително)' : '(опционално — залепи ако видеото нема субтитли)'}
                  </span>
                </label>
                <textarea
                  value={manualTranscript}
                  onChange={e => setManualTranscript(e.target.value)}
                  placeholder="Заалепете го транскриптот тука..."
                  rows={noTranscriptDetected ? 5 : 3}
                  className={`w-full resize-y rounded-xl border px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-1 ${
                    noTranscriptDetected
                      ? 'border-amber-400/40 bg-amber-500/10 focus:ring-amber-400/50'
                      : 'border-white/10 bg-white/5 focus:ring-white/20'
                  }`}
                />
                {manualTranscript.trim() && (
                  <p className="mt-1 text-xs text-emerald-400/80">
                    ✓ {manualTranscript.trim().length.toLocaleString()} знаци — ќе се користи наместо автоматски транскрипт
                  </p>
                )}
              </div>
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
                  accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.txt,text/plain,image/png,image/jpeg,image/webp,image/heic,image/heif,image/gif,.png,.jpg,.jpeg,.webp,.heic,.heif,.gif"
                  className="sr-only"
                  aria-label="Изберете документ (PDF, DOCX, TXT, PNG, JPG, WEBP, HEIC)"
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

          {/* ── Camera mode ── */}
          {sourceMode === 'camera' && (
            <div className="space-y-3">
              <p className="text-xs text-white/60">Сними или прикачи фотографија на страница со задачи (тетратка, табла, учебник).</p>
              <div
                className="relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-emerald-400/40 bg-emerald-500/5 px-6 py-8 text-center cursor-pointer hover:border-emerald-400/70 transition"
                onClick={() => !isLoading && cameraInputRef.current?.click()}
              >
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  aria-label="Сними слика со камера"
                  title="Сними слика со камера"
                  onChange={onCameraCapture}
                  disabled={isLoading}
                />
                {uploadedDoc?.base64 ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-lg overflow-hidden max-h-40">
                      <img src={`data:${uploadedDoc.mimeType ?? 'image/jpeg'};base64,${uploadedDoc.base64}`} alt="Снимена слика" className="max-h-40 object-contain" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-300">{uploadedDoc.name}</span>
                  </div>
                ) : (
                  <>
                    <Camera className="h-8 w-8 text-emerald-400" />
                    <p className="text-sm font-semibold text-white/70">Допри за да сниме или избери слика</p>
                    <p className="text-xs text-white/40">PNG · JPG · HEIC · WEBP</p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={extractFromDocument}
                disabled={isLoading || !uploadedDoc}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 font-bold text-white transition hover:from-emerald-600 hover:to-teal-600 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Екстрахирај од слика
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
  );
};
