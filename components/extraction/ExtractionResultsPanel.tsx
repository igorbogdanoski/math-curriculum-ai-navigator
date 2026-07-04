import React from 'react';
import {
  Loader2, Check, Copy, Save, Wand2, X,
  Tag, ExternalLink, FileText, Gamepad2, ChevronDown,
  FileDown, CheckSquare, Printer,
} from 'lucide-react';
import { PrintShell } from '../common/PrintShell';
import { Card } from '../common/Card';
import type { WebTaskExtractionOutput } from '../../services/gemini/visionContracts';
import { TaskCard } from './ExtractionTaskCard';
import type { VideoPreviewData, VideoCaptionsResult } from '../../utils/videoPreview';

type QuickGenType = 'SCENARIO' | 'QUIZ' | 'FLASHCARDS' | 'ASSESSMENT';

const GEN_OPTIONS: Array<{ type: QuickGenType; label: string; title: string }> = [
  { type: 'SCENARIO',   label: 'Работен лист', title: 'Генерирај работен лист од извлечените задачи' },
  { type: 'QUIZ',       label: 'Квиз',         title: 'Генерирај квиз со прашања' },
  { type: 'FLASHCARDS', label: 'Флешкарти',    title: 'Генерирај флешкарти за учење' },
  { type: 'ASSESSMENT', label: 'Тест',          title: 'Генерирај формален тест' },
];

const qualityMk: Record<string, string> = {
  poor: 'Слабо', fair: 'Добро', good: 'Многу добро', excellent: 'Одлично',
};

interface ExtractionResultsPanelProps {
  videoPreview: VideoPreviewData | null;
  docLabel: string | null;
  result: WebTaskExtractionOutput | null;
  chunksInfo: { processed: number; total: number; beforeDedup: number } | null;
  enriching: boolean;
  captions: VideoCaptionsResult | null;
  reset: () => void;

  selectedTaskIndices: Set<number>;
  setSelectedTaskIndices: React.Dispatch<React.SetStateAction<Set<number>>>;
  toggleTaskSelection: (idx: number) => void;

  saveGrade: number | '';
  setSaveGrade: (v: number | '') => void;
  saveTopicId: string;
  setSaveTopicId: (v: string) => void;

  copyAll: () => void;
  isCopiedAll: boolean;

  setShowSaveDialog: (v: boolean) => void;
  isSaving: boolean;

  genMaterialType: QuickGenType;
  setGenMaterialType: (t: QuickGenType) => void;
  showGenDropdown: boolean;
  setShowGenDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  genDropdownRef: React.RefObject<HTMLDivElement | null>;
  sendToGenerator: (t?: QuickGenType) => void;
  sendToKahoot: () => void;

  printWithSolutions: boolean;
  setPrintWithSolutions: (v: boolean) => void;
  worksheetPrintRef: React.RefObject<HTMLDivElement | null>;
  handleWorksheetPrint: () => void;
}

export const ExtractionResultsPanel: React.FC<ExtractionResultsPanelProps> = ({
  videoPreview, docLabel, result, chunksInfo, enriching, captions, reset,
  selectedTaskIndices, setSelectedTaskIndices, toggleTaskSelection,
  saveGrade, setSaveGrade, saveTopicId, setSaveTopicId,
  copyAll, isCopiedAll,
  setShowSaveDialog, isSaving,
  genMaterialType, setGenMaterialType, showGenDropdown, setShowGenDropdown, genDropdownRef, sendToGenerator, sendToKahoot,
  printWithSolutions, setPrintWithSolutions, worksheetPrintRef, handleWorksheetPrint,
}) => {
  return (
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
              {enriching && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-indigo-500">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  AI додава педагошки метаподатоци (Bloom, DOK, предуслови)...
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                result.quality.label === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
                result.quality.label === 'good' ? 'bg-blue-100 text-blue-700' :
                result.quality.label === 'fair' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {result.quality.score}% · {qualityMk[result.quality.label] ?? result.quality.label}
              </span>
              {/* DoK distribution mini-bar */}
              {result.tasks.some(t => t.dokLevel) && (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-slate-500 font-bold">DoK:</span>
                  {([1, 2, 3, 4] as const).map(lvl => {
                    const cnt = result.tasks.filter(t => t.dokLevel === lvl).length;
                    if (!cnt) return null;
                    const cls = lvl === 1 ? 'bg-green-100 text-green-700' : lvl === 2 ? 'bg-blue-100 text-blue-700' : lvl === 3 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
                    return (
                      <span key={lvl} className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${cls}`}>
                        {lvl}·{cnt}
                      </span>
                    );
                  })}
                </div>
              )}
              {/* S96.3 — curriculum tagging */}
              <select
                value={saveGrade}
                onChange={e => setSaveGrade(e.target.value === '' ? '' : Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                title="Одделение за каталогизација"
              >
                <option value="">Одд.</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
              <input
                type="text"
                value={saveTopicId}
                onChange={e => setSaveTopicId(e.target.value)}
                placeholder="Тема (за пребарување)"
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-600 w-36 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                title="Тема/топик за каталогизација во библиотека"
              />
              <button
                type="button"
                onClick={copyAll}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                {isCopiedAll ? <><Check className="h-3.5 w-3.5 text-emerald-600" /> Копирано</> : <><Copy className="h-3.5 w-3.5" /> Копирај сè</>}
              </button>
              <button
                type="button"
                onClick={() => setShowSaveDialog(true)}
                disabled={isSaving}
                title={selectedTaskIndices.size > 0 ? `Зачувај ${selectedTaskIndices.size} избрани задачи` : 'Зачувај сите задачи во Националната Банка'}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {(isSaving) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Зачувај{selectedTaskIndices.size > 0 ? ` (${selectedTaskIndices.size})` : ''}
              </button>
              {/* Quick-generate split button */}
              <div ref={genDropdownRef} className="relative">
                <div className="flex overflow-hidden rounded-xl">
                  <button
                    type="button"
                    onClick={() => sendToGenerator(genMaterialType)}
                    title={GEN_OPTIONS.find(o => o.type === genMaterialType)?.title}
                    className="flex items-center gap-1.5 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition"
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    {GEN_OPTIONS.find(o => o.type === genMaterialType)?.label ?? 'Генератор'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGenDropdown(v => !v)}
                    title="Избери тип на материјал"
                    aria-label="Избери тип на материјал"
                    className="border-l border-indigo-500 bg-indigo-600 px-1.5 py-2 text-white hover:bg-indigo-700 transition"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                {showGenDropdown && (
                  <div className="absolute right-0 top-full z-20 mt-1 min-w-[160px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                    {GEN_OPTIONS.map(opt => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => { setGenMaterialType(opt.type); setShowGenDropdown(false); }}
                        className={`flex w-full items-center px-4 py-2.5 text-sm font-medium transition ${
                          genMaterialType === opt.type
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={sendToKahoot}
                title="Направи Kahoot live квиз од извлечените задачи"
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-xl transition"
              >
                <Gamepad2 className="h-3.5 w-3.5" />
                Kahoot
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

          {/* Worksheet Builder action bar */}
          {selectedTaskIndices.size > 0 && (
            <div className="sticky top-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 shadow-sm">
              <span className="text-sm font-bold text-indigo-700">
                <CheckSquare className="inline h-4 w-4 mr-1.5" />
                {selectedTaskIndices.size} избрани задачи
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedTaskIndices(new Set(result.tasks.map((_, i) => i)))}
                  className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition"
                >
                  Сите
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTaskIndices(new Set())}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition"
                >
                  Откажи
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tasks = result.tasks.filter((_, i) => selectedTaskIndices.has(i));
                    const lines: string[] = ['# Работен лист\n'];
                    tasks.forEach((t, n) => {
                      lines.push(`**Задача ${n + 1}: ${t.title}**`);
                      lines.push(t.latexStatement || t.statement);
                      lines.push('');
                    });
                    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'raboten-list.md';
                    a.click();
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  .md
                </button>
                <label className="flex items-center gap-1 text-xs text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={printWithSolutions}
                    onChange={e => setPrintWithSolutions(e.target.checked)}
                    className="rounded accent-indigo-600"
                  />
                  со решенија
                </label>
                <button
                  type="button"
                  onClick={() => handleWorksheetPrint()}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Испечати работен лист
                </button>
              </div>
            </div>
          )}

          {/* Hidden PrintShell for worksheet print */}
          <div className="absolute -left-[9999px] top-0">
            <PrintShell
              ref={worksheetPrintRef}
              title="Работен лист — Математика"
              subtitle={result.tasks.find(t => t.topicMk)?.topicMk ?? ''}
            >
              {result.tasks
                .filter((_, i) => selectedTaskIndices.size === 0 || selectedTaskIndices.has(i))
                .map((task, n) => (
                  <div key={n} className="worksheet-task mb-6">
                    <div className="flex items-start gap-2">
                      <span className="font-black text-sm shrink-0 mt-0.5">{n + 1}.</span>
                      <div className="flex-1">
                        <p className="font-semibold text-sm mb-1">{task.title}</p>
                        <p className="text-sm whitespace-pre-line">{task.latexStatement || task.statement}</p>
                        {/* Answer box */}
                        <div className="worksheet-answer-box mt-3 rounded border border-gray-400 min-h-[80px] p-2">
                          {printWithSolutions && task.solution ? (
                            <>
                              <p className="text-[9pt] font-bold text-gray-600 mb-1">Решение:</p>
                              {task.solution.steps.map((step, si) => (
                                <p key={si} className="text-[9pt] text-gray-700 mb-0.5">{si + 1}. {step}</p>
                              ))}
                              <p className="text-[9pt] font-bold mt-1">✓ {task.solution.finalAnswer}</p>
                            </>
                          ) : (
                            <p className="text-[8pt] text-gray-300 italic">Простор за одговор</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </PrintShell>
          </div>

          {/* Task cards grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {result.tasks.map((task, i) => (
              <TaskCard key={i} task={task} index={i} selected={selectedTaskIndices.has(i)} onSelect={toggleTaskSelection} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
