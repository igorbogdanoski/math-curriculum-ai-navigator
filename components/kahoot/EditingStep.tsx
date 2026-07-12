import React from 'react';
import { ArrowLeft, Gamepad2, RefreshCw, Timer, AlertCircle, Loader2, Zap, ChevronRight, FileSpreadsheet, Plus } from 'lucide-react';
import type { KahootQuestion } from '../../services/geminiService';
import { DokDistributionBar } from '../common/DokBadge';
import { QuestionCard } from './QuestionCard';
import { TIMER_OPTIONS } from './kahootConstants';

interface EditingStepProps {
  questions: KahootQuestion[];
  title: string;
  onTitleChange: (v: string) => void;
  timerSeconds: number | undefined;
  onTimerChange: (v: number | undefined) => void;
  saveError: string | null;
  saving: boolean;
  canLaunch: boolean;
  onBackToSource: () => void;
  onLaunch: () => void;
  onExportXlsx: () => void;
  onUpdateQuestion: (idx: number, q: KahootQuestion) => void;
  onDeleteQuestion: (idx: number) => void;
  onMoveQuestion: (idx: number, dir: -1 | 1) => void;
  onAddBlankQuestion: () => void;
}

export function EditingStep({
  questions, title, onTitleChange, timerSeconds, onTimerChange, saveError, saving, canLaunch,
  onBackToSource, onLaunch, onExportXlsx, onUpdateQuestion, onDeleteQuestion, onMoveQuestion, onAddBlankQuestion,
}: EditingStepProps) {
  const validCount = questions.filter(q => q.question.trim() && q.options.every((o: string) => o.trim())).length;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button type="button" onClick={onBackToSource} aria-label="Назад кон извор"
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
              onChange={updated => onUpdateQuestion(i, updated)}
              onDelete={() => onDeleteQuestion(i)}
              onMoveUp={() => onMoveQuestion(i, -1)}
              onMoveDown={() => onMoveQuestion(i, 1)}
            />
          ))}
          <button
            type="button"
            onClick={onAddBlankQuestion}
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
            onClick={onBackToSource}
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
              onChange={e => onTitleChange(e.target.value)}
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
                  onClick={() => onTimerChange(opt.value)}
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

          {/* DoK distribution */}
          {questions.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <DokDistributionBar questions={questions} />
            </div>
          )}

          {saveError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-semibold">{saveError}</p>
            </div>
          )}

          <button
            type="button"
            onClick={onLaunch}
            disabled={saving || validCount === 0 || !canLaunch}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition disabled:opacity-40 text-sm shadow-lg"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Зачувување...</>
              : <><Zap className="w-4 h-4" /> Зачувај и стартувај LIVE <ChevronRight className="w-4 h-4" /></>
            }
          </button>
          <button
            type="button"
            onClick={onExportXlsx}
            disabled={validCount === 0}
            title="Извези .xlsx во форматот што kahoot.com прифаќа за 'Import from spreadsheet'"
            className="w-full flex items-center justify-center gap-2 py-2.5 border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-600 hover:text-indigo-700 font-bold rounded-2xl transition disabled:opacity-40 text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Извези .xlsx за увоз во kahoot.com
          </button>
        </div>
      </div>
    </div>
  );
}
