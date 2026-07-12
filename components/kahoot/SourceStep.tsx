import React, { type RefObject } from 'react';
import {
  ArrowLeft, Gamepad2, AlertCircle, Check, Brain, FileText, Lightbulb,
  Upload, BookOpen, ChevronRight, Loader2,
} from 'lucide-react';
import type { EnrichedWebTask } from '../../services/gemini/visionContracts';
import type { Curriculum, Grade, Topic } from '../../types';
import { DIFF_COLORS, type Source } from './kahootConstants';

interface SourceStepProps {
  onBack: () => void;
  genError: string | null;
  activeSource: Source | null;
  onSetActiveSource: (s: Source | null) => void;

  sessionTasks: EnrichedWebTask[];
  selectedTaskIndices: Set<number>;
  onToggleTaskIndex: (i: number) => void;
  onSelectAllTasks: (allSelected: boolean, total: number) => void;

  docFile: File | null;
  onDocFileChange: (f: File | null) => void;
  docCount: number;
  onDocCountChange: (n: number) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;

  promptText: string;
  onPromptTextChange: (v: string) => void;
  promptCount: number;
  onPromptCountChange: (n: number) => void;
  curriculum: Curriculum | null | undefined;
  promptGradeId: string;
  onPromptGradeIdChange: (id: string) => void;
  promptTopicId: string;
  onPromptTopicIdChange: (id: string) => void;
  promptGrade: Grade | undefined;
  promptTopics: Topic[];
  promptTopicObj: Topic | undefined;

  generating: boolean;
  onGenerate: () => void;
}

export function SourceStep({
  onBack, genError, activeSource, onSetActiveSource,
  sessionTasks, selectedTaskIndices, onToggleTaskIndex, onSelectAllTasks,
  docFile, onDocFileChange, docCount, onDocCountChange, fileInputRef,
  promptText, onPromptTextChange, promptCount, onPromptCountChange,
  curriculum, promptGradeId, onPromptGradeIdChange, promptTopicId, onPromptTopicIdChange,
  promptGrade, promptTopics, promptTopicObj,
  generating, onGenerate,
}: SourceStepProps) {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button type="button" onClick={onBack} aria-label="Назад"
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
          onClick={() => onSetActiveSource(activeSource === 'tasks' ? null : 'tasks')}
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
          onClick={() => onSetActiveSource(activeSource === 'document' ? null : 'document')}
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
          onClick={() => onSetActiveSource(activeSource === 'prompt' ? null : 'prompt')}
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
              onClick={() => onSelectAllTasks(selectedTaskIndices.size === sessionTasks.length, sessionTasks.length)}
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
                  onClick={() => onToggleTaskIndex(i)}
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
            aria-label="Прикачи документ (PDF, PNG, JPG, WEBP)"
            onChange={e => onDocFileChange(e.target.files?.[0] ?? null)}
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
              onChange={e => onDocCountChange(Math.min(20, Math.max(2, Number(e.target.value))))}
              className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
      )}

      {/* Prompt input */}
      {activeSource === 'prompt' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-5 space-y-4">
          <div>
            <label htmlFor="kahoot-prompt-text" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
              Опиши ја темата или идејата
            </label>
            <textarea
              id="kahoot-prompt-text"
              value={promptText}
              onChange={e => onPromptTextChange(e.target.value)}
              placeholder="Пример: 5 прашања за множење дроби за 6-то одделение, среден степен на тежина"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:border-purple-400 transition"
            />
          </div>

          {/* Curriculum context picker */}
          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 mb-1">
              <BookOpen className="w-3.5 h-3.5" />
              Поврзи со наставна програма
              <span className="font-normal text-purple-500">(опционално — го прецизира AI-от)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="kahoot-prompt-grade" className="block text-[10px] font-semibold text-gray-500 mb-1">Одделение</label>
                <select
                  id="kahoot-prompt-grade"
                  value={promptGradeId}
                  onChange={e => { onPromptGradeIdChange(e.target.value); onPromptTopicIdChange(''); }}
                  title="Одделение за curriculum контекст"
                  className="w-full text-xs border border-purple-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-purple-400"
                >
                  <option value="">— Сите —</option>
                  {curriculum?.grades.map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="kahoot-prompt-topic" className="block text-[10px] font-semibold text-gray-500 mb-1">Тема</label>
                <select
                  id="kahoot-prompt-topic"
                  value={promptTopicId}
                  onChange={e => onPromptTopicIdChange(e.target.value)}
                  disabled={!promptGradeId}
                  title="Тема за curriculum контекст"
                  className="w-full text-xs border border-purple-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-purple-400 disabled:opacity-50"
                >
                  <option value="">— Сите теми —</option>
                  {promptTopics.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            </div>
            {promptGrade && (
              <p className="text-[10px] text-purple-600">
                ✓ AI ќе ги применува стандардите на <strong>{promptGrade.title}{promptTopicObj ? ` — ${promptTopicObj.title}` : ''}</strong>
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="prompt-count" className="text-sm font-semibold text-gray-600 whitespace-nowrap">Број на прашања:</label>
            <input
              id="prompt-count"
              type="number"
              min={2}
              max={20}
              value={promptCount}
              onChange={e => onPromptCountChange(Math.min(20, Math.max(2, Number(e.target.value))))}
              title="Број на прашања"
              className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:border-purple-400"
            />
          </div>
        </div>
      )}

      {/* Generate button */}
      {activeSource && (
        <button
          type="button"
          onClick={onGenerate}
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
}
