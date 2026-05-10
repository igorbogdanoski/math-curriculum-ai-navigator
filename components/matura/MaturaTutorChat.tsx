import React, { useState, useRef, useCallback } from 'react';
import { Sparkles, Loader2, Send, X, ChevronDown, ChevronUp, Bot, LineChart, Dices, Triangle, Scale, Lightbulb } from 'lucide-react';
import { callGeminiProxy, DEFAULT_MODEL } from '../../services/gemini/core';
import { FunctionTransformer } from '../math/FunctionTransformer';
import { ProbabilitySimulator } from '../math/ProbabilitySimulator';
import { ConicSectionExplorer } from '../math/ConicSectionExplorer';
import { InequalitySolver } from '../math/InequalitySolver';
import type { BaseFunctionKey } from '../math/functionTransformerHelpers';
import type { StudentMaturaProfile } from '../../types';

const FN_PRESETS: { key: BaseFunctionKey; label: string }[] = [
  { key: 'sin',     label: 'sin' },
  { key: 'cos',     label: 'cos' },
  { key: 'logBase', label: 'log_b' },
  { key: 'expBase', label: 'b^x' },
  { key: 'sq',      label: 'x²' },
  { key: 'polyN',   label: 'x^n' },
  { key: 'recip',   label: '1/x' },
];

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface Props {
  profile: StudentMaturaProfile | null;
  weakTopics?: string[];
}

const TRACK_LABEL: Record<string, string> = {
  gymnasium: 'Гимназиски',
  vocational4: 'Стручен 4-год.',
  vocational3: 'Стручен 3-год.',
  vocational2: 'Стручен 2-год.',
};

const QUICK_CHIPS = [
  'Објасни ми дефинитен интеграл со пример',
  'Покажи ми решение на квадратна равенка',
  'Кои теореми треба да ги знам за геометрија?',
  'Помогни ми со тригонометриски идентитети',
  'Дај ми задача за вежбање по матура',
];

function buildSystemPrompt(profile: StudentMaturaProfile | null, weakTopics: string[]): string {
  const trackLine = profile?.track
    ? `Ученикот е на ${TRACK_LABEL[profile.track] ?? profile.track} програма.`
    : '';
  const weakLine = weakTopics.length > 0
    ? `Слаби теми: ${weakTopics.join(', ')}.`
    : '';
  return `Ти си AI матурски тутор по математика за македонски средношколци.
${trackLine} ${weakLine}

Твојата задача:
- Одговарај само на македонски, кратко и прецизно
- Секогаш покажувај чекори кога решаваш задачи
- Означи формули со $ ... $ (LaTeX) кога е можно
- Кога ученикот не разбира — поедностави со аналогија или контра-пример
- Предлагај follow-up прашање на крај на секој одговор
- Не давај само одговор — едуцирај го процесот

Ако прашањето е надвор од математика — насочи го кон матурска подготовка.`;
}

function buildFeynmanPrompt(topic: string): string {
  return `Ти играш улога на збунет ученик на 14 години кој ги учи: "${topic}".

Правила:
- Одговарај САМО на македонски
- Постави искрени прашања кои вистински збунет ученик би ги поставил — "Не разбирам зошто...", "Дали тоа значи дека...", "Може ли со пример..."
- Никогаш не давај одговори — само прашај
- Биди конкретен (не генерален) — прашувај за конкретни чекори или поими
- По 4 размени (кога ученикот напишал доволно), ЗАПРИ со прашување и дај Феинман фидбек:
  напиши "🎯 ФЕИНМАН ОЦЕНКА:" па оцени го нивното објаснување по: точност, едноставност, комплетност (1-10 секое)
  и дај конкретен совет за подобрување.`;
}

export const MaturaTutorChat: React.FC<Props> = ({ profile, weakTopics = [] }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showTransformer, setShowTransformer] = useState(false);
  const [fnPreset, setFnPreset] = useState<BaseFunctionKey>('sin');
  const [showProbSim, setShowProbSim] = useState(false);
  const [showConic, setShowConic] = useState(false);
  const [showIneq, setShowIneq] = useState(false);
  const [feynmanTopic, setFeynmanTopic] = useState('');
  const [feynmanMode, setFeynmanMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activateFeynman = (topic: string) => {
    setFeynmanTopic(topic);
    setFeynmanMode(true);
    setMessages([]);
    setIsOpen(true);
  };

  const exitFeynman = () => {
    setFeynmanMode(false);
    setFeynmanTopic('');
    setMessages([]);
  };

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    setIsOpen(true);
    setMessages(prev => [...prev, { role: 'user', text: trimmed }]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model' as const,
        parts: [{ text: m.text }],
      }));
      const sysPrompt = feynmanMode
        ? buildFeynmanPrompt(feynmanTopic)
        : buildSystemPrompt(profile, weakTopics);
      const result = await callGeminiProxy({
        model: DEFAULT_MODEL,
        systemInstruction: sysPrompt,
        contents: [
          ...history,
          { role: 'user' as const, parts: [{ text: trimmed }] },
        ],
        generationConfig: { maxOutputTokens: 1500 },
      });
      const aiText = result.text?.trim() || 'Не можев да одговорам. Обиди се пак.';
      setMessages(prev => [...prev, { role: 'assistant', text: aiText }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: '⚠️ Грешка. Провери ја врската и обиди се пак.' }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, profile, weakTopics, feynmanMode, feynmanTopic]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  const [feynmanInput, setFeynmanInput] = useState('');

  return (
    <div className={`rounded-2xl border shadow-sm overflow-hidden ${feynmanMode ? 'border-yellow-300 bg-yellow-50' : 'border-indigo-200 bg-white'}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 transition text-left ${feynmanMode ? 'hover:bg-yellow-100/60' : 'hover:bg-indigo-50/60'}`}
      >
        <div className="flex items-center gap-2">
          {feynmanMode
            ? <Lightbulb className="w-4 h-4 text-yellow-600" />
            : <Bot className="w-4 h-4 text-indigo-500" />
          }
          <span className={`text-xs font-black uppercase tracking-wide ${feynmanMode ? 'text-yellow-800' : 'text-gray-700'}`}>
            {feynmanMode ? `Феинман режим — "${feynmanTopic}"` : 'AI Матурски Тутор'}
          </span>
          {messages.length > 0 && (
            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${feynmanMode ? 'bg-yellow-200 text-yellow-800' : 'bg-indigo-100 text-indigo-600'}`}>
              {messages.filter(m => m.role === 'assistant').length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {feynmanMode && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); exitFeynman(); }}
              className="text-[10px] text-yellow-700 hover:text-yellow-900 font-semibold px-2 py-0.5 rounded border border-yellow-300 bg-yellow-100"
            >
              Излези
            </button>
          )}
          {!feynmanMode && <span className="text-[10px] text-indigo-400 font-semibold hidden sm:inline">Прашај нешто…</span>}
          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-indigo-100">
          {/* Quick chips — shown when no messages */}
          {messages.length === 0 && !feynmanMode && (
            <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5">
              {/* Feynman mode launcher */}
              <div className="w-full flex gap-1.5 mb-1">
                <input
                  value={feynmanInput}
                  onChange={e => setFeynmanInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && feynmanInput.trim()) activateFeynman(feynmanInput.trim()); }}
                  placeholder="Тема за Феинман (пр. дефинитен интеграл)…"
                  className="flex-1 text-[10px] border border-yellow-300 bg-yellow-50 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-yellow-400 text-gray-700 placeholder:text-gray-400"
                />
                <button
                  type="button"
                  onClick={() => feynmanInput.trim() && activateFeynman(feynmanInput.trim())}
                  className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-yellow-300 bg-yellow-100 text-yellow-800 hover:bg-yellow-200 transition inline-flex items-center gap-1"
                >
                  <Lightbulb className="w-3 h-3" /> Поучи ме
                </button>
              </div>
              {QUICK_CHIPS.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => send(chip)}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                >
                  {chip}
                </button>
              ))}
              {FN_PRESETS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => { setFnPreset(key); setShowTransformer(true); }}
                  className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition inline-flex items-center gap-1"
                  data-testid={`matura-tutor-fn-${key}`}
                >
                  <LineChart className="w-3 h-3" />
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowProbSim((v) => !v)}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition inline-flex items-center gap-1"
                data-testid="matura-tutor-probsim-toggle"
              >
                <Dices className="w-3 h-3" />
                {showProbSim ? 'Скриј експеримент' : 'Експеримент со веројатност'}
              </button>
              <button
                type="button"
                onClick={() => setShowConic((v) => !v)}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition inline-flex items-center gap-1"
                data-testid="matura-tutor-conic-toggle"
              >
                <Triangle className="w-3 h-3" />
                {showConic ? 'Скриј пресеци' : 'Конусни пресеци'}
              </button>
              <button
                type="button"
                onClick={() => setShowIneq((v) => !v)}
                className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition inline-flex items-center gap-1"
                data-testid="matura-tutor-ineq-toggle"
              >
                <Scale className="w-3 h-3" />
                {showIneq ? 'Скриј неравенки' : 'Неравенки'}
              </button>
            </div>
          )}

          {/* Function transformer (S62-E1) — per-function preset */}
          {showTransformer && (
            <div className="px-3 pt-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-600">Слајдер за функција</span>
                <button
                  type="button"
                  onClick={() => setShowTransformer(false)}
                  className="text-[10px] text-gray-400 hover:text-gray-600"
                  aria-label="Скриј"
                >
                  ✕
                </button>
              </div>
              <FunctionTransformer key={fnPreset} initialFunction={fnPreset} />
            </div>
          )}

          {/* Probability simulator (T4.2) */}
          {showProbSim && (
            <div className="px-3 pt-3">
              <ProbabilitySimulator />
            </div>
          )}

          {/* Conic section explorer (T4.3) */}
          {showConic && (
            <div className="px-3 pt-3">
              <ConicSectionExplorer />
            </div>
          )}

          {/* Inequality solver (T4.4) */}
          {showIneq && (
            <div className="px-3 pt-3">
              <InequalitySolver />
            </div>
          )}

          {/* Feynman mode banner */}
          {feynmanMode && messages.length === 0 && (
            <div className="px-3 pt-3 pb-1">
              <div className="bg-yellow-100 border border-yellow-300 rounded-xl px-3 py-2 text-xs text-yellow-800">
                <strong>Феинман режим активен!</strong> Објасни ми „{feynmanTopic}" со свои зборови — јас играм улога на збунет ученик и ќе ти поставувам прашања. После 3-4 размени ќе добиеш оценка.
              </div>
            </div>
          )}

          {/* Chat history */}
          <div className="max-h-72 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 && !feynmanMode && (
              <p className="text-[11px] text-gray-400 text-center py-3 italic">
                Постави прашање или избери тема погоре
              </p>
            )}
            {messages.length === 0 && feynmanMode && (
              <p className="text-[11px] text-yellow-600 text-center py-3 italic">
                Почни со своето објаснување…
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 mt-1 shrink-0" />
                )}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-50 border border-gray-100 text-gray-800'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400 mt-1 shrink-0" />
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 px-3 py-2 flex gap-2 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Прашај го туторот…"
              rows={2}
              className="flex-1 text-xs resize-none border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700 placeholder:text-gray-400"
            />
            <button
              type="button"
              onClick={() => send(input)}
              disabled={!input.trim() || isLoading}
              title="Испрати до AI тутор"
              aria-label="Испрати прашање до AI матурски тутор"
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                title="Исчисти конверзација"
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
