import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { geminiService } from '../../services/geminiService';
import { isDailyQuotaKnownExhausted } from '../../services/geminiService';
import { useAuth } from '../../contexts/AuthContext';
import { MathRenderer } from './MathRenderer';
import { GeoAvatarFace, type GeoAvatarState } from './GeoAvatarFace';
import type { ChatMessage } from '../../types';

const TEACHER_GREETING = 'Здраво! Јас сум вашиот педагошки AI асистент. Можам да одговорам на прашања за наставата по математика, да предложам активности или да помогнам со планирање на час. Со што можам да помогнам?';
const STUDENT_GREETING = 'Здраво! Јас сум Гео, твојот AI тутор по математика. Прашај ме нешто и ќе ти помогнам чекор по чекор — без да ти го дадам решението веднаш!';
const MAX_HISTORY = 20;
const QUOTA_EXHAUSTED_MSG = '⛔ AI квотата е исцрпена за денес. Обидете се повторно после 09:00 МК утре.';

/**
 * "Geo" — the persistent, role-aware Math Tutor avatar. Evolved from the former
 * teacher-only AIChatPanel: same floating slot, same open/close mechanics, now
 * branches by role (teacher keeps the pedagogical-assistant chat unchanged;
 * students get Geo backed by the curriculum-aware askTutor()).
 */
export const TutorAvatarWidget: React.FC = () => {
    const { user, firebaseUser, isLoading: authLoading } = useAuth();
    const isTeacher = !!firebaseUser;

    const [isOpen, setIsOpen] = useState(false);
    const [tutorState, setTutorState] = useState<GeoAvatarState>('idle');
    const [history, setHistory] = useState<ChatMessage[]>([
        { role: 'model', text: isTeacher ? TEACHER_GREETING : STUDENT_GREETING },
    ]);
    const [input, setInput] = useState('');
    const [isBusy, setIsBusy] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const abortRef = useRef(false);
    const attemptCountRef = useRef(0);
    const idleTimeoutRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (isOpen) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
            inputRef.current?.focus();
        }
    }, [isOpen, history]);

    useEffect(() => () => window.clearTimeout(idleTimeoutRef.current), []);

    // The greeting is picked from `isTeacher` at mount time, but Firebase auth resolves
    // asynchronously — a teacher whose session is still loading would otherwise see the
    // student greeting frozen in place. Re-sync once auth settles, but only while the
    // conversation is still untouched (never overwrite an in-progress chat).
    useEffect(() => {
        if (authLoading) return;
        const expected = isTeacher ? TEACHER_GREETING : STUDENT_GREETING;
        setHistory(h => (h.length === 1 && h[0].text !== expected ? [{ role: 'model', text: expected }] : h));
    }, [authLoading, isTeacher]);

    const settleToIdle = useCallback(() => {
        window.clearTimeout(idleTimeoutRef.current);
        idleTimeoutRef.current = window.setTimeout(() => setTutorState('idle'), 1200);
    }, []);

    const sendMessage = useCallback(async () => {
        const text = input.trim();
        if (!text || isBusy) return;

        if (isDailyQuotaKnownExhausted()) {
            setHistory(h => [...h, { role: 'model', text: QUOTA_EXHAUSTED_MSG }]);
            setInput('');
            return;
        }

        const userMsg: ChatMessage = { role: 'user', text };
        const newHistory = [...history, userMsg].slice(-MAX_HISTORY);
        setHistory(newHistory);
        setInput('');
        setIsBusy(true);
        setTutorState('thinking');
        abortRef.current = false;

        setHistory(h => [...h, { role: 'model', text: '' }]);

        try {
            if (isTeacher) {
                let accumulated = '';
                for await (const chunk of geminiService.getChatResponseStream(newHistory, user ?? undefined)) {
                    if (abortRef.current) break;
                    if (accumulated === '') setTutorState('explaining');
                    accumulated += chunk;
                    setHistory(h => {
                        const updated = [...h];
                        updated[updated.length - 1] = { role: 'model', text: accumulated };
                        return updated;
                    });
                }
            } else {
                attemptCountRef.current += 1;
                // `history` here is the state *before* this turn's user message was appended —
                // askTutor() re-appends `text` itself, so passing `newHistory` would duplicate it.
                const tutorHistory = history.map(m => ({
                    role: m.role === 'model' ? 'assistant' : 'user',
                    content: m.text,
                }));
                const response = await geminiService.askTutor(text, tutorHistory, undefined, attemptCountRef.current);
                setTutorState('explaining');
                setHistory(h => {
                    const updated = [...h];
                    updated[updated.length - 1] = { role: 'model', text: response };
                    return updated;
                });
            }
        } catch (err: any) {
            const errMsg = err?.message?.includes('квота') || err?.message?.includes('quota')
                ? QUOTA_EXHAUSTED_MSG
                : '⚠️ Грешка при поврзување со AI. Обидете се повторно.';
            setHistory(h => {
                const updated = [...h];
                updated[updated.length - 1] = { role: 'model', text: errMsg };
                return updated;
            });
        } finally {
            setIsBusy(false);
            settleToIdle();
        }
    }, [input, isBusy, history, user, isTeacher, settleToIdle]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const toggleOpen = () => {
        setIsOpen(o => {
            const next = !o;
            if (!next) {
                attemptCountRef.current = 0;
                // Stop an in-flight teacher-path stream from continuing to consume/update
                // history in the background after the panel is closed.
                abortRef.current = true;
            }
            return next;
        });
    };

    const title = isTeacher ? 'AI Педагошки Асистент' : 'Гео — AI Тутор';
    const subtitle = isTeacher ? 'Gemini · математика · Македонија' : 'Објаснува, не решава';

    return (
        <>
            {/* Floating avatar button */}
            <button
                type="button"
                onClick={toggleOpen}
                aria-label={isTeacher ? 'AI чет асистент' : 'AI тутор Гео'}
                className={`fixed bottom-20 right-24 md:bottom-8 z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 no-print ${
                    isOpen ? 'bg-gray-700 hover:bg-gray-800' : 'bg-white hover:bg-gray-50 border border-gray-200'
                }`}
            >
                {isOpen ? <X className="w-6 h-6 text-white" /> : <GeoAvatarFace state={tutorState} size="fab" />}
            </button>

            {/* Chat panel */}
            {isOpen && (
                <div className="fixed bottom-40 right-24 md:bottom-28 z-30 w-80 sm:w-96 flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden no-print"
                    style={{ maxHeight: 'calc(100vh - 10rem)' }}
                >
                    {/* Header */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-brand-primary text-white flex-shrink-0">
                        <GeoAvatarFace state={tutorState} size="fab" className="w-8 h-8" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold leading-tight">{title}</p>
                            <p className="text-xs opacity-75 leading-tight">{subtitle}</p>
                        </div>
                        {isBusy && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />}
                    </div>

                    {/* Message history */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
                        {history.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                                    msg.role === 'user'
                                        ? 'bg-brand-primary text-white rounded-br-sm whitespace-pre-wrap'
                                        : 'bg-gray-100 text-slate-800 rounded-bl-sm'
                                }`}>
                                    {msg.role === 'user' ? (
                                        msg.text
                                    ) : msg.text === '' && isBusy && i === history.length - 1 ? (
                                        <span className="inline-flex gap-1 py-1">
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </span>
                                    ) : (
                                        <MathRenderer text={msg.text} />
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
                            disabled={isBusy}
                            className="flex-1 resize-none text-sm px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-50 leading-snug"
                            style={{ maxHeight: '80px', overflowY: 'auto' }}
                        />
                        <button
                            type="button"
                            onClick={sendMessage}
                            disabled={!input.trim() || isBusy}
                            aria-label="Испрати порака"
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
