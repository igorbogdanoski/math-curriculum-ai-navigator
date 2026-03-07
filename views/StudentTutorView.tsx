import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import { firestoreService } from '../services/firestoreService';
import { MathRenderer } from '../components/common/MathRenderer';

/** Parse hash query params, e.g. #/tutor?student=Марко&concept=fractions&title=Дропки */
const getHashParams = (): URLSearchParams => {
  const search = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(search);
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const StudentTutorView: React.FC = () => {
  const { t } = useLanguage();

  // Curriculum context from URL params
  const params = getHashParams();
  const studentParam = params.get('student') ?? '';
  const conceptIdParam = params.get('concept') ?? '';
  const conceptTitleParam = params.get('title') ?? conceptIdParam;

  const [contextBanner, setContextBanner] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: t('tutor.greeting')
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Inject curriculum context when student + concept params are present
  useEffect(() => {
    if (!studentParam || !conceptIdParam) return;
    let cancelled = false;

    const inject = async () => {
      try {
        // Fetch last 5 results for this student, filter by concept
        const allResults = await firestoreService.fetchQuizResultsByStudentName(studentParam);
        const conceptResults = allResults
          .filter(r => r.conceptId === conceptIdParam)
          .slice(0, 5);

        const avgPct = conceptResults.length > 0
          ? Math.round(conceptResults.reduce((s, r) => s + r.percentage, 0) / conceptResults.length)
          : null;

        const contextMsg = avgPct !== null
          ? `Здраво ${studentParam}! Гледам дека го учиш концептот „${conceptTitleParam}". Имаш ${conceptResults.length} обид${conceptResults.length === 1 ? '' : 'и'} со просечен резултат ${avgPct}%. Ајде заедно да го подобриме твоето разбирање! Со што сакаш да почнеме — имаш ли конкретно прашање или задача?`
          : `Здраво${studentParam ? ` ${studentParam}` : ''}! Денес ќе работиме на „${conceptTitleParam}". Имаш ли конкретно прашање или сакаш да ти го објаснам концептот од почеток?`;

        if (!cancelled) {
          setContextBanner(`Тема: ${conceptTitleParam}${studentParam ? ` · Ученик: ${studentParam}` : ''}${avgPct !== null ? ` · Просек: ${avgPct}%` : ''}`);
          setMessages([{ id: 'context-welcome', role: 'assistant', content: contextMsg }]);
        }
      } catch {
        // Non-fatal — just show generic greeting
      }
    };

    inject();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    const newMessages: Message[] = [...messages, { id: Date.now().toString(), role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await geminiService.askTutor(userMessage, newMessages);
      setMessages([...newMessages, { id: Date.now().toString(), role: 'assistant', content: response }]);
    } catch (error) {
      console.error('Failed to get tutor response:', error);
      setMessages([...newMessages, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: 'Извини, се појави проблем при поврзувањето. Те молам обиди се повторно.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-4xl mx-auto p-4 md:p-6">
      <Card className="flex flex-col flex-1 bg-white shadow-xl overflow-hidden rounded-2xl border-2 border-brand-100">
        <div className="bg-brand-50 p-4 border-b border-brand-100 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <ICONS.messages className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-800 text-lg">AI Тутор по Математика</h2>
              {contextBanner ? (
                <p className="text-xs font-semibold text-indigo-600 truncate">{contextBanner}</p>
              ) : (
                <p className="text-sm text-gray-500">Безбедно учење. Објаснува, не решава.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-gray-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-brand-500 text-white rounded-tr-sm' 
                    : 'bg-white border text-gray-800 rounded-tl-sm'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm md:prose-base max-w-none">
                    <MathRenderer text={msg.content} />
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white border-t border-brand-100">
          <div className="relative flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Прашај нешто... (на пр. Како се собираат дропки со различен именител?)"
              className="w-full resize-none border-2 border-brand-100 rounded-xl px-4 py-3 pb-3 min-h-[56px] max-h-32 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all pr-12 text-gray-700 bg-gray-50/50"
              rows={1}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 bottom-2 rounded-lg p-2 h-10 w-10 flex items-center justify-center bg-brand-500 hover:bg-brand-600 disabled:opacity-50 disabled:bg-gray-300"
            >
              <ICONS.add className="w-5 h-5 text-white" />
            </button>
          </div>
          <p className="text-xs text-center text-gray-400 mt-2">{t('tutor.disclaimer')}</p>
        </div>
      </Card>
    </div>
  );
};
