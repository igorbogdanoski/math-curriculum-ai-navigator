/**
 * KahootMakerView — S51 upgrade
 * Three creation paths: Extraction Hub tasks / document upload / free-text prompt
 * AI generates proper MC questions; teacher can edit every question before launch.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2, Gamepad2, Timer, Check, ChevronRight, AlertCircle, Zap,
  ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2, Upload, Lightbulb,
  FileText, Brain, ArrowUp, ArrowDown, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import { firestoreService } from '../services/firestoreService';
import { geminiService } from '../services/geminiService';
import type { KahootQuestion } from '../services/geminiService';
import type { EnrichedWebTask } from '../services/gemini/visionContracts';

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_KEY = 'kahoot_tasks';
const AUTO_LAUNCH_KEY = 'kahoot_auto_launch';

const TIMER_OPTIONS: { label: string; value: number | undefined }[] = [
  { label: 'Без тајмер', value: undefined },
  { label: '10 сек', value: 10 },
  { label: '20 сек', value: 20 },
  { label: '30 сек', value: 30 },
  { label: '45 сек', value: 45 },
  { label: '60 сек', value: 60 },
];

const DIFF_COLORS: Record<string, string> = {
  basic: 'bg-green-100 text-green-700 border-green-200',
  intermediate: 'bg-amber-100 text-amber-700 border-amber-200',
  advanced: 'bg-red-100 text-red-700 border-red-200',
};

type Step = 'source' | 'generating' | 'editing';
type Source = 'tasks' | 'document' | 'prompt';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readFileAsBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve({ base64, mimeType: file.type || 'application/pdf' });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makeBlankQuestion(): KahootQuestion {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    difficulty: 'intermediate',
  };
}

// ─── QuestionCard ─────────────────────────────────────────────────────────────

interface QuestionCardProps {
  q: KahootQuestion;
  idx: number;
  total: number;
  onChange: (q: KahootQuestion) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = [
  'border-red-300 bg-red-50 focus:border-red-500',
  'border-blue-300 bg-blue-50 focus:border-blue-500',
  'border-yellow-300 bg-yellow-50 focus:border-yellow-500',
  'border-green-300 bg-green-50 focus:border-green-500',
];

function QuestionCard({ q, idx, total, onChange, onDelete, onMoveUp, onMoveDown }: QuestionCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isComplete = q.question.trim().length > 0 && q.options.every((o: string) => o.trim().length > 0);

  return (
    <div className={`rounded-2xl border-2 transition-all ${isComplete ? 'border-indigo-200 bg-white' : 'border-amber-200 bg-amber-50/30'}`}>
      {/* Card header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-black flex items-center justify-center flex-shrink-0">
          {idx + 1}
        </span>
        <p className={`flex-1 text-sm font-semibold min-w-0 truncate ${q.question.trim() ? 'text-gray-800' : 'text-gray-400 italic'}`}>
          {q.question.trim() || 'Внеси прашање...'}
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          {isComplete && <Check className="w-3.5 h-3.5 text-emerald-500" />}
          <button type="button" onClick={onMoveUp} disabled={idx === 0} aria-label="Помести нагоре"
            className="p-1 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-colors">
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={onMoveDown} disabled={idx === total - 1} aria-label="Помести надолу"
            className="p-1 rounded text-gray-400 hover:text-indigo-600 disabled:opacity-20 transition-colors">
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? 'Прошири' : 'Собери'}
            className="p-1 rounded text-gray-400 hover:text-indigo-600 transition-colors">
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onDelete} aria-label="Избриши прашање"
            className="p-1 rounded text-gray-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Editable body */}
      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {/* Question text */}
          <textarea
            value={q.question}
            onChange={e => onChange({ ...q, question: e.target.value })}
            placeholder="Текст на прашањето (може да содржи LaTeX: $x^2 + 2x + 1$)"
            rows={2}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:border-indigo-400 transition"
          />

          {/* Answer options */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Одговори — означи го точниот со ○
            </p>
            {q.options.map((opt: string, i: number) => (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChange({ ...q, correctIndex: i as 0 | 1 | 2 | 3 })}
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all text-xs font-black ${
                    q.correctIndex === i
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-gray-300 text-gray-400 hover:border-emerald-300'
                  }`}
                  title={`Означи "${OPTION_LABELS[i]}" како точен одговор`}
                >
                  {OPTION_LABELS[i]}
                </button>
                <input
                  type="text"
                  value={opt}
                  onChange={e => {
                    const next: [string, string, string, string] = [...q.options] as [string, string, string, string];
                    next[i] = e.target.value;
                    onChange({ ...q, options: next });
                  }}
                  placeholder={`Одговор ${OPTION_LABELS[i]}${i === q.correctIndex ? ' (точен)' : ''}`}
                  className={`flex-1 rounded-xl border-2 px-3 py-1.5 text-sm focus:outline-none transition ${
                    q.correctIndex === i
                      ? 'border-emerald-300 bg-emerald-50 focus:border-emerald-500'
                      : OPTION_COLORS[i]
                  }`}
                />
              </div>
            ))}
          </div>

          {/* Difficulty */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Тежина:</span>
            {(['basic', 'intermediate', 'advanced'] as const).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => onChange({ ...q, difficulty: d })}
                className={`text-[10px] px-2 py-0.5 rounded-full border font-bold transition-all ${
                  q.difficulty === d ? DIFF_COLORS[d] : 'border-gray-200 text-gray-400 hover:border-gray-300'
                }`}
              >
                {d === 'basic' ? 'Лесно' : d === 'intermediate' ? 'Средно' : 'Тешко'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export const KahootMakerView: React.FC = () => {
  const { firebaseUser } = useAuth();
  const { navigate } = useNavigation();

  // Workflow state
  const [step, setStep] = useState<Step>('source');
  const [activeSource, setActiveSource] = useState<Source | null>(null);

  // Source data
  const [sessionTasks, setSessionTasks] = useState<EnrichedWebTask[]>([]);
  const [selectedTaskIndices, setSelectedTaskIndices] = useState<Set<number>>(new Set());
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docCount, setDocCount] = useState(8);
  const [promptText, setPromptText] = useState('');
  const [promptCount, setPromptCount] = useState(6);

  // Editor state
  const [questions, setQuestions] = useState<KahootQuestion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Config state
  const [timerSeconds, setTimerSeconds] = useState<number | undefined>(20);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load session tasks on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed: EnrichedWebTask[] = JSON.parse(raw);
        setSessionTasks(parsed);
        setSelectedTaskIndices(new Set(parsed.map((_, i) => i)));
      }
    } catch { /* corrupted — ignore */ }
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const updateQuestion = (idx: number, q: KahootQuestion) =>
    setQuestions(prev => prev.map((old, i) => i === idx ? q : old));

  const deleteQuestion = (idx: number) =>
    setQuestions(prev => prev.filter((_, i) => i !== idx));

  const moveQuestion = (idx: number, dir: -1 | 1) => {
    setQuestions(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const addBlankQuestion = () =>
    setQuestions(prev => [...prev, makeBlankQuestion()]);

  const toggleTaskIndex = (i: number) =>
    setSelectedTaskIndices(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });

  // ── Generation ────────────────────────────────────────────────────────────

  const generate = async () => {
    setGenError(null);
    setGenerating(true);
    setStep('generating');
    try {
      let qs: KahootQuestion[] = [];
      if (activeSource === 'tasks') {
        const chosen = sessionTasks.filter((_, i) => selectedTaskIndices.has(i));
        qs = await geminiService.generateKahootFromTasks(chosen);
        if (!title) setTitle(`Kahoot — ${new Date().toLocaleDateString('mk-MK')}`);
      } else if (activeSource === 'document' && docFile) {
        const { base64, mimeType } = await readFileAsBase64(docFile);
        qs = await geminiService.generateKahootFromDocument(base64, mimeType, docCount);
        if (!title) setTitle(`Kahoot — ${docFile.name.replace(/\.[^.]+$/, '')}`);
      } else if (activeSource === 'prompt' && promptText.trim()) {
        qs = await geminiService.generateKahootFromPrompt(promptText.trim(), promptCount);
        if (!title) setTitle(`Kahoot — ${promptText.trim().slice(0, 40)}`);
      }
      if (qs.length === 0) throw new Error('AI не врати ниту едно прашање. Обиди се со поинаков опис.');
      setQuestions(qs);
      setStep('editing');
    } catch (err: unknown) {
      setGenError(err instanceof Error ? err.message : 'Грешка при генерирање.');
      setStep('source');
    } finally {
      setGenerating(false);
    }
  };

  // ── Save & launch ─────────────────────────────────────────────────────────

  const handleLaunch = async () => {
    if (!firebaseUser || questions.length === 0) return;
    const valid = questions.filter(q => q.question.trim() && q.options.every((o: string) => o.trim()));
    if (valid.length === 0) {
      setSaveError('Нема комплетирани прашања. Пополни ги полиња за прашање и сите 4 одговори.');
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const quizContent = {
        title: title.trim() || 'Kahoot квиз',
        questions: valid.map(q => ({
          question: q.question.trim(),
          type: 'multiple_choice',
          options: q.options,
          answer: q.options[q.correctIndex],
          difficulty_level: q.difficulty,
        })),
      };
      const quizId = await firestoreService.saveToLibrary(quizContent, {
        title: quizContent.title,
        type: 'quiz',
        teacherUid: firebaseUser.uid,
      });
      const autoLaunch = { quizId, quizTitle: quizContent.title, timerPerQuestion: timerSeconds };
      try { sessionStorage.setItem(AUTO_LAUNCH_KEY, JSON.stringify(autoLaunch)); } catch { /* quota */ }
      navigate('/live/host');
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Грешка при зачувување.');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Generating spinner
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'generating') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 p-8">
        <div className="relative">
          <div className="w-20 h-20 rounded-full border-4 border-indigo-100" />
          <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
          <Gamepad2 className="absolute inset-0 m-auto w-8 h-8 text-indigo-600" />
        </div>
        <div className="text-center">
          <p className="text-lg font-black text-gray-800">AI генерира прашања...</p>
          <p className="text-sm text-gray-500 mt-1">Создава дистрактори, ги проверува одговорите</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Editor (questions + config)
  // ─────────────────────────────────────────────────────────────────────────

  if (step === 'editing') {
    const validCount = questions.filter(q => q.question.trim() && q.options.every((o: string) => o.trim())).length;
    return (
      <div className="p-4 md:p-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button type="button" onClick={() => setStep('source')} aria-label="Назад кон извор"
            className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="p-2.5 bg-indigo-100 rounded-2xl">
            <Gamepad2 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Уреди прашања</h1>
            <p className="text-sm text-gray-500">{questions.length} прашање{questions.length !== 1 ? 'а' : ''} — кликни за да уредиш</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Question list */}
          <div className="lg:col-span-2 space-y-3">
            {questions.map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                idx={i}
                total={questions.length}
                onChange={updated => updateQuestion(i, updated)}
                onDelete={() => deleteQuestion(i)}
                onMoveUp={() => moveQuestion(i, -1)}
                onMoveDown={() => moveQuestion(i, 1)}
              />
            ))}
            <button
              type="button"
              onClick={addBlankQuestion}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2 text-sm font-semibold"
            >
              <Plus className="w-4 h-4" /> Додади прашање
            </button>
          </div>

          {/* Config panel */}
          <div className="space-y-4">
            {/* Regenerate */}
            <button
              type="button"
              onClick={() => setStep('source')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-600 text-sm font-semibold hover:bg-indigo-100 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Генерирај повторно
            </button>

            {/* Quiz title */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                Наслов на квизот
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={80}
                placeholder="Kahoot квиз..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 focus:outline-none focus:border-indigo-400 transition"
              />
            </div>

            {/* Timer */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="w-4 h-4 text-indigo-500" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Тајмер по прашање</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {TIMER_OPTIONS.map(opt => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => setTimerSeconds(opt.value)}
                    className={`py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                      timerSeconds === opt.value
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-gray-100 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-4 text-white">
              <p className="text-xs font-bold text-indigo-200 uppercase tracking-widest mb-3">Резиме</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-indigo-200">Вкупно прашања</span>
                  <span className="font-bold">{questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-200">Комплетирани</span>
                  <span className={`font-bold ${validCount < questions.length ? 'text-yellow-300' : 'text-emerald-300'}`}>
                    {validCount}/{questions.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-indigo-200">Тајмер</span>
                  <span className="font-bold">{timerSeconds != null ? `${timerSeconds}с/пр.` : 'Без'}</span>
                </div>
                {timerSeconds != null && validCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-indigo-200">Вкупно ~</span>
                    <span className="font-bold">{Math.ceil(validCount * timerSeconds / 60)} мин</span>
                  </div>
                )}
              </div>
            </div>

            {saveError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 font-semibold">{saveError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={handleLaunch}
              disabled={saving || validCount === 0 || !firebaseUser}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition disabled:opacity-40 text-sm shadow-lg"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Зачувување...</>
                : <><Zap className="w-4 h-4" /> Зачувај и стартувај LIVE <ChevronRight className="w-4 h-4" /></>
              }
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Source selector
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button type="button" onClick={() => navigate('/live/host')} aria-label="Назад"
          className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="p-3 bg-indigo-100 rounded-2xl">
          <Gamepad2 className="w-7 h-7 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Kahoot Maker</h1>
          <p className="text-sm text-gray-500">Избери извор → AI генерира → ти го уредиш → стартувај</p>
        </div>
      </div>

      {genError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-semibold">{genError}</p>
        </div>
      )}

      {/* Source cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Card 1: Extraction Hub tasks */}
        <button
          type="button"
          onClick={() => setActiveSource(activeSource === 'tasks' ? null : 'tasks')}
          disabled={sessionTasks.length === 0}
          className={`rounded-2xl border-2 p-5 text-left transition-all ${
            activeSource === 'tasks'
              ? 'border-indigo-500 bg-indigo-50'
              : sessionTasks.length > 0
                ? 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-indigo-100 rounded-xl">
              <Brain className="w-5 h-5 text-indigo-600" />
            </div>
            {activeSource === 'tasks' && <Check className="w-4 h-4 text-indigo-600 ml-auto" />}
          </div>
          <h3 className="font-black text-gray-800 text-sm mb-1">Extraction Hub</h3>
          <p className="text-xs text-gray-500">
            {sessionTasks.length > 0
              ? `${sessionTasks.length} извлечени задачи — готови за конверзија`
              : 'Нема задачи — прво ги извлечи преку Extraction Hub'}
          </p>
        </button>

        {/* Card 2: Document / PDF upload */}
        <button
          type="button"
          onClick={() => setActiveSource(activeSource === 'document' ? null : 'document')}
          className={`rounded-2xl border-2 p-5 text-left transition-all ${
            activeSource === 'document'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            {activeSource === 'document' && <Check className="w-4 h-4 text-blue-600 ml-auto" />}
          </div>
          <h3 className="font-black text-gray-800 text-sm mb-1">Документ / PDF</h3>
          <p className="text-xs text-gray-500">Прикачи работен лист, тест или PDF — AI ги чита задачите</p>
        </button>

        {/* Card 3: Prompt */}
        <button
          type="button"
          onClick={() => setActiveSource(activeSource === 'prompt' ? null : 'prompt')}
          className={`rounded-2xl border-2 p-5 text-left transition-all ${
            activeSource === 'prompt'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-xl">
              <Lightbulb className="w-5 h-5 text-purple-600" />
            </div>
            {activeSource === 'prompt' && <Check className="w-4 h-4 text-purple-600 ml-auto" />}
          </div>
          <h3 className="font-black text-gray-800 text-sm mb-1">Опиши тема</h3>
          <p className="text-xs text-gray-500">Напиши идеја или тема — AI генерира комплетен квиз</p>
        </button>
      </div>

      {/* Source-specific inputs */}

      {/* Extraction Hub: task selection */}
      {activeSource === 'tasks' && sessionTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-gray-800 text-sm">
              Задачи ({selectedTaskIndices.size}/{sessionTasks.length} избрани)
            </h2>
            <button
              type="button"
              onClick={() => {
                if (selectedTaskIndices.size === sessionTasks.length)
                  setSelectedTaskIndices(new Set());
                else
                  setSelectedTaskIndices(new Set(sessionTasks.map((_, i) => i)));
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline"
            >
              {selectedTaskIndices.size === sessionTasks.length ? 'Одбери ги сите' : 'Избери ги сите'}
            </button>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {sessionTasks.map((task, i) => {
              const isSelected = selectedTaskIndices.has(i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleTaskIndex(i)}
                  className={`w-full text-left rounded-xl border-2 px-3 py-2 transition-all ${
                    isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'border-indigo-500 bg-indigo-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-xs text-gray-400 font-bold">#{i + 1}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${DIFF_COLORS[task.difficulty] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {task.difficulty}
                    </span>
                    <p className="text-xs font-semibold text-gray-700 truncate flex-1">
                      {task.latexStatement || task.statement || task.title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Document upload */}
      {activeSource === 'document' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            className="hidden"
            onChange={e => setDocFile(e.target.files?.[0] ?? null)}
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
              docFile ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
            }`}
          >
            {docFile ? (
              <>
                <FileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-blue-700">{docFile.name}</p>
                <p className="text-xs text-blue-500 mt-0.5">{(docFile.size / 1024).toFixed(0)} KB — кликни за промена</p>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-500">Кликни за да прикачиш документ</p>
                <p className="text-xs text-gray-400 mt-0.5">PDF, PNG, JPG, WEBP — до 10 MB</p>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="doc-count" className="text-sm font-semibold text-gray-600 whitespace-nowrap">Број на прашања:</label>
            <input
              id="doc-count"
              type="number"
              min={2}
              max={20}
              value={docCount}
              onChange={e => setDocCount(Math.min(20, Math.max(2, Number(e.target.value))))}
              className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      )}

      {/* Prompt input */}
      {activeSource === 'prompt' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Опиши ја темата или идејата
            </label>
            <textarea
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              placeholder="Пример: 5 прашања за множење дроби за 6-то одделение, среден степен на тежина"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:border-purple-400 transition"
            />
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="prompt-count" className="text-sm font-semibold text-gray-600 whitespace-nowrap">Број на прашања:</label>
            <input
              id="prompt-count"
              type="number"
              min={2}
              max={20}
              value={promptCount}
              onChange={e => setPromptCount(Math.min(20, Math.max(2, Number(e.target.value))))}
              className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:border-purple-400"
            />
          </div>
        </div>
      )}

      {/* Generate button */}
      {activeSource && (
        <button
          type="button"
          onClick={generate}
          disabled={
            generating ||
            (activeSource === 'tasks' && selectedTaskIndices.size === 0) ||
            (activeSource === 'document' && !docFile) ||
            (activeSource === 'prompt' && !promptText.trim())
          }
          className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition disabled:opacity-40 text-base shadow-lg"
        >
          {generating
            ? <><Loader2 className="w-5 h-5 animate-spin" /> Генерирање...</>
            : <><Brain className="w-5 h-5" /> Генерирај прашања со AI <ChevronRight className="w-5 h-5" /></>
          }
        </button>
      )}
    </div>
  );
};
