import React, { useState, useRef, useCallback } from 'react';
import { Sparkles, Loader2, Send, X, ChevronDown, ChevronUp, Bot } from 'lucide-react';
import { callGeminiProxy } from '../../services/gemini/core';
import type { StudentMaturaProfile } from '../../types';

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

export const MaturaTutorChat: React.FC<Props> = ({ profile, weakTopics = [] }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      const result = await callGeminiProxy({
        model: 'gemini-2.5-flash',
        systemInstruction: buildSystemPrompt(profile, weakTopics),
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
  }, [isLoading, messages, profile, weakTopics]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50/60 transition text-left"
      >
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-black text-gray-700 uppercase tracking-wide">AI Матурски Тутор</span>
          {messages.length > 0 && (
            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-600 text-[10px] font-bold rounded-full">
              {messages.filter(m => m.role === 'assistant').length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-indigo-400 font-semibold hidden sm:inline">Прашај нешто…</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-indigo-100">
          {/* Quick chips — shown when no messages */}
          {messages.length === 0 && (
            <div className="px-3 pt-3 pb-1 flex flex-wrap gap-1.5">
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
            </div>
          )}

          {/* Chat history */}
          <div className="max-h-72 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 && (
              <p className="text-[11px] text-gray-400 text-center py-3 italic">
                Постави прашање или избери тема погоре
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
