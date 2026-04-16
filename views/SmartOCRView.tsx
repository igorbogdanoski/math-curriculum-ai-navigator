import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ScanLine, Upload, Copy, Save, Check, Loader2, AlertTriangle, BookOpen, Tag, X, ChevronDown, Eye, Code2 } from 'lucide-react';
import { Card } from '../components/common/Card';
import { MathRenderer } from '../components/common/MathRenderer';
import { DokBadge } from '../components/common/DokBadge';
import { smartOCRContract, type SmartOCROutput } from '../services/gemini/visionContracts';
import { saveToLibrary, saveQuestion } from '../services/firestoreService.materials';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

// ─── Symbol Toolbar Data ──────────────────────────────────────────────────────

type SymbolCategory = 'basic' | 'symbols' | 'geometry' | 'calculus';

interface SymbolBtn {
  label: string;
  insert: string;
  title?: string;
}

const SYMBOL_CATEGORIES: Record<SymbolCategory, { label: string; buttons: SymbolBtn[] }> = {
  basic: {
    label: 'Основни',
    buttons: [
      { label: 'Дропка', insert: '\\frac{□}{□}', title: 'Дропка (разломок)' },
      { label: 'Корен', insert: '\\sqrt{□}', title: 'Квадратен корен' },
      { label: 'Степен', insert: '^{□}', title: 'Степен (eksponent)' },
      { label: 'Индекс', insert: '_{□}', title: 'Долен индекс' },
      { label: '±', insert: '\\pm ', title: 'Плус-минус' },
      { label: '≠', insert: '\\neq ', title: 'Не е еднакво' },
      { label: '≤', insert: '\\leq ', title: 'Помало или еднакво' },
      { label: '≥', insert: '\\geq ', title: 'Поголемо или еднакво' },
      { label: '×', insert: '\\times ', title: 'Множење' },
      { label: '÷', insert: '\\div ', title: 'Делење' },
      { label: '∈', insert: '\\in ', title: 'Припаѓа' },
      { label: '∉', insert: '\\notin ', title: 'Не припаѓа' },
      { label: '∅', insert: '\\emptyset ', title: 'Празна множество' },
      { label: '∞', insert: '\\infty ', title: 'Бесконечност' },
      { label: 'π', insert: '\\pi ', title: 'Pi' },
    ],
  },
  symbols: {
    label: 'Симболи',
    buttons: [
      { label: 'α', insert: '\\alpha ', title: 'Alpha' },
      { label: 'β', insert: '\\beta ', title: 'Beta' },
      { label: 'γ', insert: '\\gamma ', title: 'Gamma' },
      { label: 'δ', insert: '\\delta ', title: 'Delta' },
      { label: 'θ', insert: '\\theta ', title: 'Theta' },
      { label: 'λ', insert: '\\lambda ', title: 'Lambda' },
      { label: 'μ', insert: '\\mu ', title: 'Mu' },
      { label: 'σ', insert: '\\sigma ', title: 'Sigma' },
      { label: 'φ', insert: '\\phi ', title: 'Phi' },
      { label: 'ω', insert: '\\omega ', title: 'Omega' },
      { label: '∑', insert: '\\sum_{□}^{□}', title: 'Сума' },
      { label: '∏', insert: '\\prod_{□}^{□}', title: 'Производ' },
      { label: '→', insert: '\\to ', title: 'Стрелка кон' },
      { label: '⟺', insert: '\\Leftrightarrow ', title: 'Еквивалентност' },
      { label: '⟹', insert: '\\Rightarrow ', title: 'Следи' },
    ],
  },
  geometry: {
    label: 'Геометрија',
    buttons: [
      { label: '∠', insert: '\\angle ', title: 'Агол' },
      { label: '△', insert: '\\triangle ', title: 'Триаголник' },
      { label: '⊥', insert: '\\perp ', title: 'Нормала' },
      { label: '∥', insert: '\\parallel ', title: 'Паралелно' },
      { label: '°', insert: '^{\\circ}', title: 'Степени' },
      { label: '≅', insert: '\\cong ', title: 'Конгруентно' },
      { label: '~', insert: '\\sim ', title: 'Слично' },
      { label: 'arc', insert: '\\overset{\\frown}{□}', title: 'Лак' },
      { label: 'vec', insert: '\\vec{□}', title: 'Вектор' },
      { label: 'AB‾', insert: '\\overline{□}', title: 'Отсечка' },
      { label: '|v|', insert: '|\\vec{□}|', title: 'Модул на вектор' },
      { label: '∩', insert: '\\cap ', title: 'Пресек' },
      { label: '∪', insert: '\\cup ', title: 'Унија' },
      { label: '⊂', insert: '\\subset ', title: 'Подмножество' },
      { label: '⊆', insert: '\\subseteq ', title: 'Подмножество или еднакво' },
    ],
  },
  calculus: {
    label: 'Калкулус',
    buttons: [
      { label: '∫', insert: '\\int_{□}^{□}', title: 'Интеграл' },
      { label: '∬', insert: '\\iint ', title: 'Двоен интеграл' },
      { label: 'lim', insert: '\\lim_{□ \\to □}', title: 'Граница' },
      { label: "f'", insert: "f'(□)", title: 'Прв извод' },
      { label: "f''", insert: "f''(□)", title: 'Втор извод' },
      { label: 'd/dx', insert: '\\frac{d}{dx}(□)', title: 'Извод' },
      { label: '∂', insert: '\\partial ', title: 'Парцијален извод' },
      { label: '∇', insert: '\\nabla ', title: 'Набла' },
      { label: 'log', insert: '\\log_{□}(□)', title: 'Логаритам' },
      { label: 'ln', insert: '\\ln(□)', title: 'Природен логаритам' },
      { label: 'sin', insert: '\\sin(□)', title: 'Синус' },
      { label: 'cos', insert: '\\cos(□)', title: 'Косинус' },
      { label: 'tan', insert: '\\tan(□)', title: 'Тангенс' },
      { label: 'asin', insert: '\\arcsin(□)', title: 'Аркусинус' },
      { label: 'e^x', insert: 'e^{□}', title: 'Eksponent' },
    ],
  },
};

// ─── Quality Badge ─────────────────────────────────────────────────────────────

const QualityBadge: React.FC<{ label: SmartOCROutput['quality']['label']; score: number }> = ({ label, score }) => {
  const map = {
    poor: 'bg-red-100 text-red-700 border-red-200',
    fair: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    good: 'bg-blue-100 text-blue-700 border-blue-200',
    excellent: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  const mk = { poor: 'Слабо', fair: 'Добро', good: 'Многу добро', excellent: 'Одлично' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${map[label]}`}>
      {score}% · {mk[label]}
    </span>
  );
};

// ─── Main View ─────────────────────────────────────────────────────────────────

export const SmartOCRView: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { addNotification } = useNotification();

  const [inputTab, setInputTab] = useState<'image' | 'handwriting'>('image');
  const [outputTab, setOutputTab] = useState<'preview' | 'latex'>('latex');
  const [symbolCategory, setSymbolCategory] = useState<SymbolCategory>('basic');

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/png');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<SmartOCROutput | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [latexCode, setLatexCode] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingToBank, setIsSavingToBank] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── File loading ──────────────────────────────────────────────────────────

  const loadFile = useCallback((file: File) => {
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    if (!isImage && !isPdf) {
      setError('Поддржани формати: JPG, PNG, WEBP, GIF, PDF');
      return;
    }
    setError(null);
    setOcrResult(null);
    setLatexCode('');
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const [header, b64] = dataUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] ?? file.type;
      setImageBase64(b64);
      setImageMime(mime);
      setImageName(file.name);
      if (isImage) setPreviewSrc(dataUrl);
      else setPreviewSrc(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  // ── Paste (CTRL+V) ────────────────────────────────────────────────────────

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) loadFile(file);
          break;
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [loadFile]);

  // ── OCR ───────────────────────────────────────────────────────────────────

  const analyze = async () => {
    if (!imageBase64) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const { output, fallback } = await smartOCRContract({
        imageBase64,
        mimeType: imageMime,
        mode: inputTab,
      });
      if (fallback) {
        setError('AI не успеа да ја дигитализира сликата. Обидете се со поквалитетна слика.');
      } else {
        setOcrResult(output);
        setLatexCode(output.latexCode);
        setOutputTab('latex');
      }
    } catch {
      setError('Грешка при поврзување со AI. Проверете ги поставките и обидете се повторно.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Symbol insert ─────────────────────────────────────────────────────────

  const insertSymbol = (snippet: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setLatexCode(prev => prev + snippet);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = latexCode.substring(0, start) + snippet + latexCode.substring(end);
    setLatexCode(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + snippet.length;
      ta.setSelectionRange(cursor, cursor);
    });
  };

  // ── Copy / Save ───────────────────────────────────────────────────────────

  const handleCopy = async () => {
    if (!latexCode) return;
    await navigator.clipboard.writeText(latexCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!latexCode || !firebaseUser) {
      if (!firebaseUser) addNotification('Треба да сте најавени за да зачувате.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const title = imageName
        ? `OCR: ${imageName.replace(/\.[^.]+$/, '')}`
        : `Smart OCR — ${new Date().toLocaleDateString('mk-MK')}`;
      await saveToLibrary(
        { latexCode, normalizedText: ocrResult?.normalizedText ?? '', formulas: ocrResult?.formulas ?? [] },
        {
          title,
          type: 'problems',
          teacherUid: firebaseUser.uid,
          gradeLevel: ocrResult?.curriculumHints?.suggestedGrade ?? 0,
          topicId: ocrResult?.curriculumHints?.suggestedTopicMk,
        },
      );
      addNotification('Зачувано во библиотека! ✓', 'success');
    } catch {
      addNotification('Зачувувањето не успеа. Обидете се повторно.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveToBank = async () => {
    if (!latexCode || !firebaseUser) {
      if (!firebaseUser) addNotification('Треба да сте најавени за да зачувате.', 'warning');
      return;
    }
    setIsSavingToBank(true);
    try {
      await saveQuestion({
        question: latexCode,
        type: 'open',
        answer: '',
        teacherUid: firebaseUser.uid,
        gradeLevel: ocrResult?.curriculumHints?.suggestedGrade,
        topicId: ocrResult?.curriculumHints?.suggestedTopicMk,
        dokLevel: ocrResult?.curriculumHints?.dokLevel,
        isVerified: false,
        isPublic: false,
      });
      addNotification('Зачувано во банка на задачи! ✓', 'success');
    } catch {
      addNotification('Зачувувањето не успеа.', 'error');
    } finally {
      setIsSavingToBank(false);
    }
  };

  // ── Clear ─────────────────────────────────────────────────────────────────

  const reset = () => {
    setImageBase64(null);
    setImageMime('image/png');
    setPreviewSrc(null);
    setImageName('');
    setOcrResult(null);
    setLatexCode('');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const catKeys = Object.keys(SYMBOL_CATEGORIES) as SymbolCategory[];
  const currentButtons = SYMBOL_CATEGORIES[symbolCategory].buttons;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 shadow-md">
            <ScanLine className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Smart OCR 2.0</h1>
            <p className="text-sm text-slate-500">Дигитализација на математика со светска прецизност</p>
          </div>
        </div>

        {/* Input mode tabs */}
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
          {(['image', 'handwriting'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setInputTab(tab)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                inputTab === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'image' ? (
                <><Upload className="h-4 w-4" /> Слика / PDF</>
              ) : (
                <><Code2 className="h-4 w-4" /> Ракопис</>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* ── Left: Image upload ── */}
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">Оригинална Слика</h2>
            {imageBase64 && (
              <button
                type="button"
                onClick={reset}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                title="Избриши"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {!imageBase64 ? (
            <div
              className={`flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-10 transition-colors cursor-pointer min-h-[260px] ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/40'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
                <Upload className="h-8 w-8 text-indigo-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-700">Повлечете слика или залепете (CTRL+V)</p>
                <p className="mt-1 text-sm text-slate-400">Поддржани формати: JPG, PNG, WEBP, PDF</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {previewSrc ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <img src={previewSrc} alt="Прикачена слика" className="max-h-64 w-full object-contain" />
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <BookOpen className="h-8 w-8 text-slate-400" />
                  <div>
                    <p className="font-medium text-slate-700">{imageName}</p>
                    <p className="text-xs text-slate-400">PDF документ</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={analyze}
                disabled={isAnalyzing}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {isAnalyzing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Анализирам...</>
                ) : (
                  <><ScanLine className="h-4 w-4" /> Дигитализирај со AI</>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Curriculum hints */}
          {ocrResult && (ocrResult.curriculumHints.suggestedGrade || ocrResult.curriculumHints.suggestedTopicMk) && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm space-y-1.5">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-800">
                  <Tag className="h-4 w-4" /> Наставна програма
                </div>
                {ocrResult.curriculumHints.dokLevel && (
                  <DokBadge level={ocrResult.curriculumHints.dokLevel} size="compact" />
                )}
              </div>
              {ocrResult.curriculumHints.suggestedGrade && (
                <p className="text-indigo-700">Одделение: <span className="font-semibold">{ocrResult.curriculumHints.suggestedGrade}</span></p>
              )}
              {ocrResult.curriculumHints.suggestedTopicMk && (
                <p className="text-indigo-700">Тема: <span className="font-semibold">{ocrResult.curriculumHints.suggestedTopicMk}</span></p>
              )}
              {ocrResult.curriculumHints.suggestedConceptsMk?.length ? (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {ocrResult.curriculumHints.suggestedConceptsMk.map((c, i) => (
                    <span key={i} className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">{c}</span>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </Card>

        {/* ── Right: LaTeX editor + output ── */}
        <Card className="flex flex-col gap-0 p-0 overflow-hidden">
          {/* Tabs + action buttons */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              {(['preview', 'latex'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setOutputTab(tab)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-all ${
                    outputTab === tab
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab === 'preview' ? (
                    <><Eye className="h-3.5 w-3.5" /> Преглед</>
                  ) : (
                    <><Code2 className="h-3.5 w-3.5" /> LaTeX Код</>
                  )}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!latexCode}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
              >
                {isCopied ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Копирано</> : <><Copy className="h-3.5 w-3.5" /> Копирај</>}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!latexCode || isSaving}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-40"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Библиотека
              </button>
              <button
                type="button"
                onClick={handleSaveToBank}
                disabled={!latexCode || isSavingToBank}
                title="Зачувај во банка на задачи (saved_questions)"
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:opacity-40"
              >
                {isSavingToBank ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookOpen className="h-3.5 w-3.5" />}
                Банка
              </button>
            </div>
          </div>

          {/* Symbol toolbar */}
          <div className="border-b border-slate-100 px-4 py-2 space-y-2">
            {/* Category tabs */}
            <div className="flex gap-1">
              {catKeys.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSymbolCategory(cat)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    symbolCategory === cat
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {SYMBOL_CATEGORIES[cat].label}
                </button>
              ))}
            </div>
            {/* Symbol buttons */}
            <div className="flex flex-wrap gap-1.5">
              {currentButtons.map((btn, i) => (
                <button
                  key={i}
                  type="button"
                  title={btn.title}
                  onClick={() => insertSymbol(btn.insert)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-800"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Output area */}
          <div className="flex-1 p-4 min-h-[300px]">
            {outputTab === 'latex' ? (
              <textarea
                ref={textareaRef}
                value={latexCode}
                onChange={(e) => setLatexCode(e.target.value)}
                placeholder="Дигитализираниот текст ќе се појави овде"
                className="h-full min-h-[280px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                spellCheck={false}
              />
            ) : (
              <div className="min-h-[280px] rounded-xl border border-slate-200 bg-slate-50 p-4 overflow-auto">
                {latexCode ? (
                  <MathRenderer text={latexCode} />
                ) : (
                  <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-slate-400">
                    <Eye className="h-10 w-10 opacity-30" />
                    <p className="text-sm">Рендерираниот LaTeX ќе се појави овде</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quality badge */}
          {ocrResult && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
              <span className="text-xs text-slate-400">Квалитет на дигитализација</span>
              <QualityBadge label={ocrResult.quality.label} score={ocrResult.quality.score} />
            </div>
          )}
        </Card>
      </div>

      {/* ── Extracted Formulas ── */}
      {ocrResult && ocrResult.formulas.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 font-semibold text-slate-700">Извлечени формули ({ocrResult.formulas.length})</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ocrResult.formulas.map((formula, i) => (
              <div
                key={i}
                className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <div className="flex-1 min-w-0 overflow-hidden">
                  <MathRenderer text={formula} />
                </div>
                <button
                  type="button"
                  onClick={() => insertSymbol(formula + ' ')}
                  className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
                  title="Вметни во уредникот"
                >
                  <ChevronDown className="h-3.5 w-3.5 rotate-[-90deg]" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
