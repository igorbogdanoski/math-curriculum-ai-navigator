import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, Loader2, Sparkles } from 'lucide-react';
import { AcademyLesson } from '../../data/academy/content';
import { callGeminiProxy } from '../../services/gemini/core';
import { useAcademyProgress } from '../../contexts/AcademyProgressContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AcademyMentor: React.FC<{ lesson: AcademyLesson }> = ({ lesson }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Здраво! Јас сум твојот AI ментор за оваа лекција. Имате ли прашање за "${lesson.title}" или како да го примените ова во вашиот час по математика?`
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addXp } = useAcademyProgress() as any; // Temporary cast until we update context

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const systemPrompt = `Ти си AI Ментор во "Едукативниот Центар" на апликацијата Math Navigator. 
Твоја задача е да му помогнеш на наставникот по математика подлабоко да ја разбере тековната лекција: "${lesson.title}".

Клучни информации за лекцијата:
Теорија: ${lesson.theory.join(' ')}
Когнитивна придобивка: ${lesson.cognitiveBenefit}
Пример: ${lesson.mathExample}

Твојот стил треба да биде охрабрувачки, професионален и практичен. Давај конкретни идеи како овој модел/тон може да се искористи за конкретни математички теми. Ако наставникот те праша нешто надвор од контекстот на лекцијата, нежно врати го на темата.

Одговарај на македонски јазик. Биди концизен но информативен.`;

      const contents = messages.concat({ role: 'user', content: userMessage }).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const response = await callGeminiProxy({
        model: 'gemini-1.5-flash',
        contents,
        systemInstruction: systemPrompt
      });

      if (response && response.text) {
        setMessages(prev => [...prev, { role: 'assistant', content: response.text }]);
        // Grant XP for first interaction if we have the method
        if (addXp && messages.length === 1) {
            addXp(10, 'Интеракција со AI Ментор');
        }
      }
    } catch (error) {
      console.error('Mentor Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Извинете, настана грешка. Ве молам обидете се повторно.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-brand-primary text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-40 group"
          title="Прашај го менторот"
        >
          <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full animate-bounce">
            AI Ментор
          </div>
          <Bot className="w-8 h-8" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] h-[500px] max-h-[calc(100vh-6rem)] bg-white rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden border border-gray-100 animate-in slide-in-from-bottom-10">
          {/* Header */}
          <div className="bg-brand-primary p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold">AI Ментор</h4>
                <div className="flex items-center gap-1.5 text-xs text-brand-primary-light/80">
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Активен за: {lesson.title}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-brand-primary text-white rounded-tr-none shadow-sm' 
                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-100 shadow-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2 text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Менторот пишува...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Прашај нешто..."
                className="w-full pl-4 pr-12 py-3 bg-gray-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-brand-primary transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-brand-primary disabled:text-gray-300 hover:bg-brand-primary/5 rounded-xl transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Подобрено со вештачка интелигенција
            </div>
          </div>
        </div>
      )}
    </>
  );
};
