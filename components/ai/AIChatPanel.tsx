import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2 } from 'lucide-react';
import { geminiService } from '../../services/geminiService';
import { isDailyQuotaKnownExhausted } from '../../services/geminiService';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatMessage } from '../../types';

const SYSTEM_GREETING = 'Здраво! Јас сум вашиот педагошки AI асистент. Можам да одговорам на прашања за наставата по математика, да предложам активности или да помогнам со планирање на час. Со што можам да помогнам?';
const MAX_HISTORY = 20;

export const AIChatPanel: React.FC = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<ChatMessage[]>([
        { role: 'model', text: SYSTEM_GREETING },
    ]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef(false);

    useEffect(() => {
        if (isOpen) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            inputRef.current?.focus();
        }
    }, [isOpen, history]);

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if (!text || isStreaming) return;

        if (isDailyQuotaKnownExhausted()) {
            setHistory(h => [...h, {
                role: 'model',
                text: '⛔ AI квотата е исцрпена за денес. Обидете се повторно после 09:00 МК утре.',
            }]);
            setInput('');
            return;
        }

        const userMsg: ChatMessage = { role: 'user', text };
        const newHistory = [...history, userMsg].slice(-MAX_HISTORY);
        setHistory(newHistory);
        setInput('');
        setIsStreaming(true);
        abortRef.current = false;

        // Placeholder for streaming response
        setHistory(h => [...h, { role: 'model', text: '' }]);

        try {
            let accumulated = '';
            for await (const chunk of geminiService.getChatResponseStream(newHistory, user ?? undefined)) {
                if (abortRef.current) break;
                accumulated += chunk;
                setHistory(h => {
                    const updated = [...h];
                    updated[updated.length - 1] = { role: 'model', text: accumulated };
                    return updated;
                });
            }
        } catch (err: any) {
            const errMsg = err?.message?.includes('квота') || err?.message?.includes('quota')
                ? '⛔ AI квотата е исцрпена за денес. Обидете се повторно после 09:00 МК утре.'
                : '⚠️ Грешка при поврзување со AI. Обидете се повторно.';
            setHistory(h => {
                const updated = [...h];
                updated[updated.length - 1] = { role: 'model', text: errMsg };
                return updated;
            });
        } finally {
            setIsStreaming(false);
        }
    }, [input, isStreaming, history, user]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <>
            {/* Floating chat button */}
            <button
                type="button"
                onClick={() => setIsOpen(o => !o)}
                aria-label="AI чет асистент"
                className={`fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 no-print ${
                    isOpen
                        ? 'bg-gray-700 hover:bg-gray-800 text-white'
                        : 'bg-brand-primary hover:bg-brand-primary/90 text-white'
                }`}
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
            </button>

            {/* Chat panel */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 z-30 w-80 sm:w-96 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden no-print"
                    style={{ maxHeight: 'calc(100vh - 7rem)' }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-brand-primary text-white flex-shrink-0">
                        <MessageCircle className="w-4 h-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold leading-tight">AI Педагошки Асистент</p>
                            <p className="text-xs opacity-75 leading-tight">Gemini · математика · Македонија</p>
                        </div>
                        {isStreaming && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                    </div>

                    {/* Message history */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                        {history.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                                    msg.role === 'user'
                                        ? 'bg-brand-primary text-white rounded-br-sm'
                                        : 'bg-gray-100 text-slate-800 rounded-bl-sm'
                                }`}>
                                    {msg.text}
                                    {msg.role === 'model' && i === history.length - 1 && isStreaming && (
                                        <span className="inline-block w-1.5 h-4 bg-gray-500 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                                    )}
                                </div>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className="flex gap-2 p-3 border-t border-gray-100 flex-shrink-0">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Напишете прашање... (Enter за испрати)"
                            rows={1}
                            disabled={isStreaming}
                            className="flex-1 resize-none text-sm px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-50 leading-snug"
                            style={{ maxHeight: '80px', overflowY: 'auto' }}
                        />
                        <button
                            type="button"
                            onClick={sendMessage}
                            disabled={!input.trim() || isStreaming}
                            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-brand-primary text-white hover:bg-brand-primary/90 transition disabled:opacity-40"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
