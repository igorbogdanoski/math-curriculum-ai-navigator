import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';

import { geminiService } from '../services/geminiService';
import { MathRenderer } from '../components/common/MathRenderer';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const StudentTutorView: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Здраво! Јас сум твојот AI тутор по математика. Тука сум да ти помогнам да ги разбереш лекциите, но нема да ти ги решам задачите наместо тебе. Што учиме денес?'
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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center text-white shadow-sm">
              <ICONS.messages className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-lg">AI Тутор по Математика</h2>
              <p className="text-sm text-gray-500">Безбедно учење. Објаснува, не решава.</p>
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
                    <MathRenderer content={msg.content} />
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
          <p className="text-xs text-center text-gray-400 mt-2">
            AI туторот може да греши. Секогаш проверувај ги информациите.
          </p>
        </div>
      </Card>
    </div>
  );
};
