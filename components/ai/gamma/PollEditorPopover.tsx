import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface PollEditorPopoverProps {
  pollDraft: string[];
  setPollDraft: React.Dispatch<React.SetStateAction<string[]>>;
  pollCorrectDraft: number | null;
  setPollCorrectDraft: React.Dispatch<React.SetStateAction<number | null>>;
  isGeneratingPoll: boolean;
  onGenerateAiOptions: () => void;
  onStartPoll: () => void;
}

export function PollEditorPopover({
  pollDraft, setPollDraft, pollCorrectDraft, setPollCorrectDraft,
  isGeneratingPoll, onGenerateAiOptions, onStartPoll,
}: PollEditorPopoverProps) {
  return (
    <div className="absolute top-14 right-4 z-50 w-72 bg-slate-900 border border-violet-500/30 rounded-2xl p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-black text-violet-300 uppercase tracking-widest">Направи анкета</p>
        <button
          type="button"
          onClick={onGenerateAiOptions}
          disabled={isGeneratingPoll}
          title="AI предложи опции врз основа на овој слајд"
          className="flex items-center gap-1 text-[11px] font-bold text-violet-300 hover:text-violet-200 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {isGeneratingPoll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          AI предложи
        </button>
      </div>
      <div className="space-y-2">
        {pollDraft.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPollCorrectDraft(c => c === i ? null : i)}
              title={pollCorrectDraft === i ? 'Ова е точниот одговор' : 'Означи како точен одговор'}
              className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center text-xs font-black transition ${
                pollCorrectDraft === i
                  ? 'bg-emerald-500 border-emerald-400 text-white'
                  : 'border-white/20 text-slate-500 hover:border-emerald-400 hover:text-emerald-400'
              }`}
            >
              ✓
            </button>
            <input
              type="text"
              value={opt}
              onChange={e => setPollDraft(d => d.map((v, j) => j === i ? e.target.value : v))}
              placeholder={`Опција ${String.fromCharCode(65 + i)}`}
              maxLength={80}
              className="flex-1 min-w-0 bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-slate-500 mt-1.5">Означи ✓ ако анкетата има точен одговор (по избор — остави празно за мислење/гласање).</p>
      <div className="flex items-center justify-between mt-3">
        {pollDraft.length < 4 ? (
          <button type="button" onClick={() => setPollDraft(d => [...d, ''])}
            className="text-[11px] font-bold text-slate-400 hover:text-white transition">
            + Опција
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={onStartPoll}
          disabled={pollDraft.map(o => o.trim()).filter(Boolean).length < 2}
          className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition"
        >
          Стартувај
        </button>
      </div>
    </div>
  );
}
