import React, { useState, useRef } from 'react';
import { Sparkles, Loader2, Send, X, ChevronDown, ChevronUp } from 'lucide-react';
import { callGeminiProxy } from '../../services/gemini/core';

interface AssistantMessage {
  role: 'user' | 'assistant';
  text: string;
}

interface Props {
  onApply?: (suggestion: string) => void;
}

const SYSTEM_PROMPT = `Ти си педагошки AI асистент за македонски наставници по математика.
Кога наставникот ти опишува час, ти генерираш структуриран предлог со:
1. Временски распоред (мин по фаза)
2. Диференцирани активности (А=поддршка, Б=стандардно, Ц=надградување)
3. Клучни педагошки прашања за секоја фаза
4. Материјали и ресурси

Одговарај кратко, структурирано, само на македонски. Користи bullet points и временски маркери.`;

export const AILessonAssistant: React.FC<Props> = ({ onApply }) => {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    const userMsg: AssistantMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model' as const,
        parts: [{ text: m.text }],
      }));

      const result = await callGeminiProxy({
        model: 'gemini-2.5-flash',
        systemInstruction: SYSTEM_PROMPT,
        contents: [
          ...history,
          { role: 'user' as const, parts: [{ text }] },
        ],
        generationConfig: { maxOutputTokens: 1200 },
      });
      const aiText = result.text?.trim() || 'Не можев да генерирам предлог. Обиди се пак.';
      setMessages(prev => [...prev, { role: 'assistant', text: aiText }]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: '⚠️ Грешка при генерирање. Провери ја врската и обиди се пак.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-indigo-50/50 transition"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-black text-gray-700 uppercase tracking-wide">AI Lesson Assistant</span>
        </div>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {isOpen && (
        <div className="border-t border-indigo-50">
          {/* Chat history */}
          <div className="max-h-64 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 && (
              <div className="py-4 text-center">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Опиши го часот на природен јазик:<br />
                  <span className="italic text-gray-300">"Питагорова теорема, 8. одд., 45 мин, мешан клас"</span>
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {m.text}
                  {m.role === 'assistant' && onApply && (
                    <button
                      type="button"
                      onClick={() => onApply(m.text)}
                      className="block mt-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 underline"
                    >
                      ↑ Примени во план
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="bg-gray-100 rounded-xl px-3 py-2">
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
              placeholder="Опиши го часот…"
              rows={2}
              className="flex-1 text-xs resize-none border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 text-gray-700"
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || isLoading}
              title="Испрати порака"
              aria-label="Испрати порака до AI асистентот"
              className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 transition flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition flex-shrink-0"
                title="Исчисти конверзација"
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
