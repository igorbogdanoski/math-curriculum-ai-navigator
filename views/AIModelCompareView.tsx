import React, { useState, useCallback } from 'react';
import { Sparkles, Send, ThumbsUp, Loader2, RotateCcw, Lightbulb } from 'lucide-react';
import { callGeminiProxy, DEFAULT_MODEL, PRO_MODEL } from '../services/gemini/core';
import { MathRenderer } from '../components/common/MathRenderer';

const PRESETS = [
  { label: 'Докажи дека √2 е ирационален', prompt: 'Докажи дека √2 е ирационален број. Објасни го доказот чекор по чекор на начин разбирлив за гимназиски ученик.' },
  { label: 'Квадратна формула', prompt: 'Изведи ја квадратната формула за решавање на равенката ax² + bx + c = 0 и објасни кога дискриминантата е важна.' },
  { label: 'Интеграција по делови', prompt: 'Кога ја користиме интеграцијата по делови? Дај еден пример и реши го детално.' },
  { label: 'Геометриска серија', prompt: 'Изведи ја формулата за сумата на бесконечна геометриска серија. Кога конвергира?' },
];

interface ModelResult {
  text: string;
  durationMs: number;
}

export function AIModelCompareView() {
  const [prompt, setPrompt]         = useState('');
  const [flashResult, setFlashResult] = useState<ModelResult | null>(null);
  const [proResult, setProResult]     = useState<ModelResult | null>(null);
  const [flashLoading, setFlashLoading] = useState(false);
  const [proLoading, setProLoading]     = useState(false);
  const [vote, setVote] = useState<'flash' | 'pro' | 'tie' | null>(null);
  const [totalVotes, setTotalVotes] = useState<{ flash: number; pro: number; tie: number }>({ flash: 0, pro: 0, tie: 0 });

  const handleCompare = useCallback(async () => {
    if (!prompt.trim()) return;
    setFlashResult(null);
    setProResult(null);
    setVote(null);
    setFlashLoading(true);
    setProLoading(true);

    const contents = [{ role: 'user' as const, parts: [{ text: prompt }] }];

    const runModel = async (
      model: string,
      setLoading: (v: boolean) => void,
      setResult: (r: ModelResult) => void,
    ) => {
      const t0 = Date.now();
      try {
        const r = await callGeminiProxy({ model, contents });
        setResult({ text: r.text ?? '', durationMs: Date.now() - t0 });
      } catch {
        setResult({ text: '⚠️ Грешка при генерирање.', durationMs: Date.now() - t0 });
      } finally {
        setLoading(false);
      }
    };

    await Promise.allSettled([
      runModel(DEFAULT_MODEL, setFlashLoading, setFlashResult),
      runModel(PRO_MODEL, setProLoading, setProResult),
    ]);
  }, [prompt]);

  const handleVote = (choice: 'flash' | 'pro' | 'tie') => {
    if (vote !== null) return;
    setVote(choice);
    setTotalVotes(prev => ({ ...prev, [choice]: prev[choice] + 1 }));
  };

  const hasResults = flashResult || proResult;
  const bothDone   = flashResult && proResult;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Споредба на AI модели</h1>
          <p className="text-sm text-gray-500 mt-0.5">Испрати го истото прашање до Flash и Pro моделот — забележи ги разликите во стил, детал и брзина.</p>
        </div>
      </div>

      {/* Educational callout */}
      <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 flex gap-3">
        <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 space-y-1">
          <p className="font-semibold">Зошто ова е корисно за учење?</p>
          <p>Различни AI модели го обработуваат истото прашање на различен начин. Споредувањето ти помага да развиеш критичко мислење: кој одговор е попрецизен? Кој е поедноставен? Дали двата даваат исти резултати?</p>
        </div>
      </div>

      {/* Prompt input */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
        <div>
          <label className="text-sm font-semibold text-gray-700 mb-2 block">Твое прашање или математички проблем</label>
          <textarea
            rows={3}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="пр. Докажи дека √2 е ирационален број..."
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPrompt(p.prompt)}
              className="text-xs px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCompare}
            disabled={!prompt.trim() || flashLoading || proLoading}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {flashLoading || proLoading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Генерирање...</>
              : <><Send className="w-4 h-4" /> Испрати на двата</>
            }
          </button>
          {hasResults && (
            <button
              type="button"
              disabled={flashLoading || proLoading}
              onClick={() => { setFlashResult(null); setProResult(null); setVote(null); setPrompt(''); }}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 hover:bg-gray-50 disabled:opacity-40 text-gray-600 rounded-xl text-sm transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Ресетирај
            </button>
          )}
        </div>
      </div>

      {/* Side-by-side results */}
      {hasResults && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Flash */}
          <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-blue-50 border-b border-blue-200">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <span className="font-bold text-blue-800 text-sm">Flash</span>
                <span className="text-[10px] text-blue-400 bg-blue-100 rounded-full px-2 py-0.5">брзо</span>
              </div>
              {flashResult && (
                <span className="text-[10px] text-blue-400">{(flashResult.durationMs / 1000).toFixed(1)}с</span>
              )}
            </div>
            <div className="p-5 min-h-[180px]">
              {flashLoading
                ? <div className="flex items-center gap-2 text-blue-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Генерирање...</div>
                : flashResult
                ? <div className="text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none"><MathRenderer text={flashResult.text} /></div>
                : null
              }
            </div>
          </div>

          {/* Pro */}
          <div className="bg-white rounded-2xl border-2 border-purple-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-purple-50 border-b border-purple-200">
              <div className="flex items-center gap-2">
                <span className="text-lg">🧠</span>
                <span className="font-bold text-purple-800 text-sm">Pro</span>
                <span className="text-[10px] text-purple-400 bg-purple-100 rounded-full px-2 py-0.5">детално</span>
              </div>
              {proResult && (
                <span className="text-[10px] text-purple-400">{(proResult.durationMs / 1000).toFixed(1)}с</span>
              )}
            </div>
            <div className="p-5 min-h-[180px]">
              {proLoading
                ? <div className="flex items-center gap-2 text-purple-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Генерирање...</div>
                : proResult
                ? <div className="text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none"><MathRenderer text={proResult.text} /></div>
                : null
              }
            </div>
          </div>
        </div>
      )}

      {/* Voting */}
      {bothDone && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700 text-center">
            {vote ? '✅ Благодариме за твојот избор!' : 'Кој одговор ти помага повеќе?'}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              disabled={vote !== null}
              onClick={() => handleVote('flash')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                vote === 'flash'
                  ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-300'
                  : vote !== null
                  ? 'border-gray-100 text-gray-400 bg-gray-50'
                  : 'border-blue-200 hover:border-blue-400 text-blue-700 hover:bg-blue-50'
              }`}
            >
              <ThumbsUp className="w-4 h-4" /> ⚡ Flash е подобро
            </button>
            <button
              type="button"
              disabled={vote !== null}
              onClick={() => handleVote('tie')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                vote === 'tie'
                  ? 'border-gray-500 bg-gray-50 text-gray-800 ring-2 ring-gray-300'
                  : vote !== null
                  ? 'border-gray-100 text-gray-400 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-400 text-gray-600 hover:bg-gray-50'
              }`}
            >
              🤝 Подеднакво
            </button>
            <button
              type="button"
              disabled={vote !== null}
              onClick={() => handleVote('pro')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                vote === 'pro'
                  ? 'border-purple-500 bg-purple-50 text-purple-800 ring-2 ring-purple-300'
                  : vote !== null
                  ? 'border-gray-100 text-gray-400 bg-gray-50'
                  : 'border-purple-200 hover:border-purple-400 text-purple-700 hover:bg-purple-50'
              }`}
            >
              <ThumbsUp className="w-4 h-4" /> 🧠 Pro е подобро
            </button>
          </div>
          {vote && (
            <div className="text-center space-y-1 pt-1">
              <p className="text-xs text-gray-500">Резултати на оваа сесија:</p>
              <div className="flex justify-center gap-4 text-xs font-semibold">
                <span className="text-blue-600">⚡ Flash: {totalVotes.flash}</span>
                <span className="text-gray-500">🤝 Исто: {totalVotes.tie}</span>
                <span className="text-purple-600">🧠 Pro: {totalVotes.pro}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4">
          <p className="font-bold text-blue-800 text-sm mb-1">⚡ Flash — Gemini Flash</p>
          <p className="text-xs text-blue-700">Брз, ефикасен модел. Одличен за повечето задачи — одговора за секунди. Добар избор за секојдневна употреба.</p>
        </div>
        <div className="rounded-2xl bg-purple-50 border border-purple-200 p-4">
          <p className="font-bold text-purple-800 text-sm mb-1">🧠 Pro — Gemini Pro</p>
          <p className="text-xs text-purple-700">Посложен модел, генерира подетални и попрецизни одговори. Побавен и поскап — се користи кога Flash не е доволен.</p>
        </div>
      </div>
    </div>
  );
}
