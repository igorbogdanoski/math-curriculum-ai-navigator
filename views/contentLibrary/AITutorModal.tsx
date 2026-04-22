import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, X, Send } from 'lucide-react';
import type { CachedMaterial } from '../../services/firestoreService';
import { callGeminiProxy, DEFAULT_MODEL, SAFETY_SETTINGS } from '../../services/gemini/core';
import { logger } from '../../utils/logger';

interface TutorMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

export const AITutorModal: React.FC<{
  material: CachedMaterial;
  onClose: () => void;
}> = ({ material, onClose }) => {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: TutorMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const contentStr = typeof material.content === 'string'
        ? material.content
        : JSON.stringify(material.content, null, 2);

      const materialContext = `
Material Title: ${material.title || 'Untitled'}
Material Type: ${material.type}
Grade Level: ${material.gradeLevel}
Topic: ${material.topicId || 'N/A'}
Content: ${contentStr.substring(0, 2000)}${contentStr.length > 2000 ? '...' : ''}`;

      const systemPrompt = `You are an expert pedagogical AI tutor assisting a teacher. You have access to the following material:

${materialContext}

Your role is to:
1. Answer questions about the material's content and context
2. Suggest pedagogical approaches for teaching this material
3. Provide assessment strategies and rubric ideas
4. Offer alternative explanations or examples
5. Help with pacing and learning objectives

Keep responses concise (2-3 sentences max), practical, and focused on teacher needs.`;

      const proxyResponse = await callGeminiProxy({
        model: DEFAULT_MODEL,
        systemInstruction: systemPrompt,
        contents: [
          ...messages.map(m => ({
            role: (m.role === 'user' ? 'user' : 'model') as 'user' | 'model',
            parts: [{ text: m.content }],
          })),
          { role: 'user' as const, parts: [{ text: userMessage.content }] },
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
        safetySettings: SAFETY_SETTINGS,
      });

      const assistantMessage = proxyResponse.text ||
        'Sorry, I could not generate a response. Please try again.';

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantMessage,
        timestamp: Date.now(),
      }]);
    } catch (error) {
      logger.error('Error calling Gemini API:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Грешка при поврзување со AI. Обидете се повторно.',
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center overflow-y-auto p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-gray-800">Ask AI Tutor</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Material: {material.title || 'Untitled'}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition" title="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-10">
              <Sparkles className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-gray-500 font-medium">No questions yet</p>
              <p className="text-sm text-gray-400 mt-1">Ask about material content, teaching strategies, or assessment ideas</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-xl ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 border border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl rounded-bl-none">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t bg-gray-50 px-4 py-3 flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !loading && sendMessage()}
            placeholder="Ask about this material..."
            disabled={loading}
            className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            title="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
