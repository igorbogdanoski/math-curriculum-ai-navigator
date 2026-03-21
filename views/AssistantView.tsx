
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { geminiService, isDailyQuotaKnownExhausted } from '../services/geminiService';
import { firestoreService, type CachedMaterial, type ChatSession, type StoredMessage } from '../services/firestoreService';
import { callEmbeddingProxy } from '../services/gemini/core';
import { RateLimitError } from '../services/apiErrors';
import { bm25Score, cosineSimilarity } from '../utils/search';
import type { ChatMessage } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { MathRenderer } from '../components/common/MathRenderer';
import { useNetworkStatus } from '../contexts/NetworkStatusContext';
import { useLastVisited } from '../contexts/LastVisitedContext';
import { BookOpen, Library, X as XIcon, History, Plus, Trash2, Brain } from 'lucide-react';

// Helper: convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};


const typeLabel: Record<string, string> = {
    quiz: 'Квиз', assessment: 'Тест', rubric: 'Рубрика',
    ideas: 'Идеи', analogy: 'Аналогија', outline: 'План',
    thematicplan: 'Тематски план', discussion: 'Дискусија',
    problems: 'Задачи', solver: 'Решенија',
};

interface SourceMaterial {
    id: string;
    title: string;
    type: string;
    score: number;
}

interface EnrichedChatMessage extends ChatMessage {
    sources?: SourceMaterial[];
    isThinking?: boolean;
    thinkingText?: string;
}

const Message: React.FC<{ message: EnrichedChatMessage }> = ({ message }) => {
    const isModel = message.role === 'model';
    const [showThinking, setShowThinking] = useState(false);

    return (
        <div className={`flex items-start gap-3 my-4 ${isModel ? '' : 'flex-row-reverse'}`}>
            <div className={`p-2 rounded-full flex-shrink-0 ${isModel ? 'bg-brand-secondary' : 'bg-gray-300'}`}>
                {isModel ? <ICONS.sparkles className="w-5 h-5 text-white" /> : <div className="w-5 h-5" />}
            </div>
            <div className={`flex flex-col gap-1.5 max-w-lg ${isModel ? 'items-start' : 'items-end'}`}>
                {message.attachmentUrl && (
                    <img src={message.attachmentUrl} alt="Attachment"
                        className="max-h-48 rounded-lg border border-gray-200 shadow-sm object-contain bg-white mb-1" />
                )}
                {/* Thinking toggle */}
                {isModel && message.thinkingText && (
                    <button
                        onClick={() => setShowThinking(v => !v)}
                        className="flex items-center gap-1.5 text-[11px] text-purple-600 hover:text-purple-800 font-semibold px-2 py-0.5 bg-purple-50 border border-purple-200 rounded-full transition-colors"
                    >
                        <Brain className="w-3 h-3" />
                        {showThinking ? 'Скриј размислување' : 'Прикажи размислување'}
                    </button>
                )}
                {isModel && message.thinkingText && showThinking && (
                    <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-700 max-h-48 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed">
                        {message.thinkingText}
                    </div>
                )}
                <div className={`p-3 rounded-lg prose prose-sm ${isModel ? 'bg-blue-100 text-brand-text' : 'bg-gray-200'}`}>
                    <MathRenderer text={message.text} />
                </div>
                {/* Source citations */}
                {isModel && message.sources && message.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-0.5">
                        {message.sources.map(src => (
                            <span key={src.id}
                                className="flex items-center gap-1 text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full"
                                title={`Сличност: ${(src.score * 100).toFixed(0)}%`}
                            >
                                <BookOpen className="w-2.5 h-2.5" />
                                {src.title || typeLabel[src.type] || src.type}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Autosave debounce: 3 seconds after last message
const AUTOSAVE_DELAY_MS = 3000;

export const AssistantView: React.FC = () => {
    const { user, firebaseUser } = useAuth();
    const { isOnline } = useNetworkStatus();
    const { lastVisited } = useLastVisited();

    const [history, setHistory] = useState<EnrichedChatMessage[]>([
        { role: 'model', text: 'Здраво! Јас сум вашиот AI асистент за настава. Можете да ми поставите прашање или да прикачите слика/документ за анализа.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isThrottled, setIsThrottled] = useState(false);

    // File Upload
    const [attachment, setAttachment] = useState<{ file: File; previewUrl: string; base64: string; mimeType: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Thinking tokens mode (Pro/Unlimited only)
    const [thinkingMode, setThinkingMode] = useState(false);

    // Library RAG
    const [libraryMode, setLibraryMode] = useState(false);
    const [libraryMaterials, setLibraryMaterials] = useState<CachedMaterial[]>([]);
    const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);

    // Persistent chat history
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const initializedRef = useRef(false);
    const isMountedRef = useRef(true);
    const embeddingCacheRef = useRef<Map<string, number[]>>(new Map());

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Revoke object URL on unmount
    useEffect(() => {
        return () => {
            if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
        };
    }, [attachment?.previewUrl]);

    // Load chat sessions list
    const loadSessions = useCallback(async () => {
        if (!firebaseUser?.uid) return;
        setIsLoadingSessions(true);
        try {
            const data = await firestoreService.fetchChatSessions(firebaseUser.uid);
            if (isMountedRef.current) setSessions(data);
        } finally {
            if (isMountedRef.current) setIsLoadingSessions(false);
        }
    }, [firebaseUser?.uid]);

    useEffect(() => { loadSessions(); }, [loadSessions]);

    // Autosave: debounced write after every message
    const triggerAutosave = useCallback((msgs: EnrichedChatMessage[]) => {
        if (!firebaseUser?.uid) return;
        if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = setTimeout(async () => {
            // Only save if there are user messages (skip greeting-only state)
            const hasUserMsg = msgs.some(m => m.role === 'user');
            if (!hasUserMsg) return;
            try {
                const storable: StoredMessage[] = msgs.map(m => ({
                    role: m.role,
                    text: m.text,
                    ...(m.attachmentUrl ? { attachmentUrl: m.attachmentUrl } : {}),
                    ...(m.sources ? { sources: m.sources } : {}),
                }));
                if (currentSessionId) {
                    await firestoreService.updateChatSession(currentSessionId, storable);
                } else {
                    const id = await firestoreService.createChatSession(
                        firebaseUser.uid, storable, libraryMode
                    );
                    if (isMountedRef.current) setCurrentSessionId(id);
                }
                // Refresh sidebar session list
                loadSessions();
            } catch (err) {
                console.warn('Autosave failed:', err);
            }
        }, AUTOSAVE_DELAY_MS);
    }, [firebaseUser?.uid, currentSessionId, libraryMode, loadSessions]);

    // Load a previous session
    const loadSession = (session: ChatSession) => {
        setHistory(session.messages as EnrichedChatMessage[]);
        setCurrentSessionId(session.id);
        setLibraryMode(session.libraryMode);
        setShowHistory(false);
    };

    // Start a fresh conversation
    const startNewSession = () => {
        setHistory([{ role: 'model', text: 'Здраво! Нов разговор. Со што можам да ви помогнам?' }]);
        setCurrentSessionId(null);
        setShowHistory(false);
        initializedRef.current = true;
    };

    // Delete a session
    const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await firestoreService.deleteChatSession(id);
        setSessions(prev => prev.filter(s => s.id !== id));
        if (currentSessionId === id) startNewSession();
    };

    // Load library materials
    useEffect(() => {
        if (!libraryMode || !firebaseUser?.uid) return;
        if (libraryMaterials.length > 0) return;
        const load = async () => {
            setIsLoadingLibrary(true);
            try {
                const mats = await firestoreService.fetchLibraryMaterials(firebaseUser.uid);
                const withEmb = mats.filter(m => m.embedding && m.embedding.length > 0);
                if (isMountedRef.current) {
                    setLibraryMaterials(withEmb);
                    setHistory(prev => [...prev, {
                        role: 'model',
                        text: `📚 Библиотечен режим е активиран! Пронајдов **${withEmb.length}** материјали со семантички векторски записи.`
                    }]);
                }
            } finally {
                if (isMountedRef.current) setIsLoadingLibrary(false);
            }
        };
        load();
    }, [libraryMode, firebaseUser?.uid]);

    // Find relevant library materials (RAG)
    const findRelevantMaterials = useCallback(async (
        query: string, topK = 3
    ): Promise<{ sources: SourceMaterial[], ragContext: string }> => {
        if (!libraryMode || libraryMaterials.length === 0) return { sources: [], ragContext: '' };
        try {
            // Use cached embedding if available (avoids redundant API calls for repeated queries)
            let qVec = embeddingCacheRef.current.get(query);
            if (!qVec) {
                qVec = await callEmbeddingProxy(query);
                embeddingCacheRef.current.set(query, qVec);
            }
            const scored = libraryMaterials
                .map(m => {
                    const docText = `${m.title || ''} ${m.conceptId || ''} ${m.topicId || ''} ${typeLabel[m.type] || m.type || ''}`;
                    const cosine = m.embedding ? cosineSimilarity(qVec!, m.embedding) : 0;
                    const bm25 = bm25Score(query, docText);
                    const score = 0.6 * cosine + 0.4 * Math.min(bm25, 1);
                    return { ...m, score };
                })
                .filter(m => m.score > 0.40)
                .sort((a, b) => b.score - a.score)
                .slice(0, topK);
            if (scored.length === 0) return { sources: [], ragContext: '' };
            const sources: SourceMaterial[] = scored.map(m => ({
                id: m.id,
                title: m.title || typeLabel[m.type] || m.type,
                type: m.type,
                score: m.score
            }));
            const ragContext = scored.map(m => {
                const title = m.title || typeLabel[m.type] || m.type;
                const snippet = typeof m.content === 'string'
                    ? m.content.substring(0, 800)
                    : JSON.stringify(m.content).substring(0, 800);
                return `**"${title}" (${typeLabel[m.type] || m.type}${m.gradeLevel > 0 ? ', ' + m.gradeLevel + '. одд.' : ''})**\n${snippet}`;
            }).join('\n\n---\n\n');
            return { sources, ragContext };
        } catch (err) {
            console.warn('RAG embedding failed:', err);
            return { sources: [], ragContext: '' };
        }
    }, [libraryMode, libraryMaterials]);

    // Context awareness
    useEffect(() => {
        if (!initializedRef.current && lastVisited && history.length === 1) {
            initializedRef.current = true;
            const label = lastVisited.type === 'concept' ? 'поимот' : 'подготовката';
            setHistory(prev => {
                const h = [...prev];
                h[0] = { role: 'model', text: `Здраво! Забележав дека работевте на ${label} "**${lastVisited.label}**". Дали ви треба помош?` };
                return h;
            });
        }
    }, [lastVisited]);

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, isLoading]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
                const base64 = await fileToBase64(file);
                setAttachment({ file, previewUrl: URL.createObjectURL(file), base64, mimeType: file.type });
            } catch (err) { console.error('File processing error:', err); }
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveAttachment = () => {
        if (attachment) { URL.revokeObjectURL(attachment.previewUrl); setAttachment(null); }
    };

    const handleSend = async () => {
        if ((!input.trim() && !attachment) || isLoading || !isOnline) return;
        if (isDailyQuotaKnownExhausted()) {
            setHistory(prev => [...prev, { role: 'model', text: 'Дневната AI квота е исцрпена. Обидете се повторно утре.' }]);
            return;
        }
        if (isThrottled) return;

        const textToSend = input.trim() || `[Прикачен фајл: ${attachment!.file.name}]`;
        const newUserMsg: EnrichedChatMessage = {
            role: 'user', text: textToSend, attachmentUrl: attachment?.previewUrl
        };
        const attachPayload = attachment ? { base64: attachment.base64, mimeType: attachment.mimeType } : undefined;

        setHistory(prev => [...prev, newUserMsg]);
        setInput('');
        setAttachment(null);
        setIsLoading(true);
        setIsThrottled(true);
        setTimeout(() => setIsThrottled(false), 2000);

        const placeholderMsg: EnrichedChatMessage = { role: 'model', text: '', isThinking: true };
        setHistory(prev => [...prev, placeholderMsg]);

        const { sources, ragContext } = await findRelevantMaterials(textToSend);

        try {
            const currentHistory = [...history, newUserMsg];

            let fullText = '';
            let thinkingText = '';

            if (thinkingMode) {
                const stream = geminiService.getChatResponseStreamWithThinking(
                    currentHistory, user ?? undefined, attachPayload, ragContext || undefined
                );
                for await (const chunk of stream) {
                    if (!isMountedRef.current) break;
                    if (chunk.kind === 'thinking') {
                        thinkingText += chunk.text;
                        setHistory(prev => {
                            const h = [...prev];
                            const last = h.length - 1;
                            if (last >= 0 && h[last].role === 'model') {
                                h[last] = { ...h[last], thinkingText, isThinking: true };
                            }
                            return h;
                        });
                    } else {
                        fullText += chunk.text;
                        setHistory(prev => {
                            const h = [...prev];
                            const last = h.length - 1;
                            if (last >= 0 && h[last].role === 'model') {
                                h[last] = { ...h[last], text: fullText, thinkingText, isThinking: false };
                            }
                            return h;
                        });
                    }
                }
            } else {
                const stream = geminiService.getChatResponseStream(
                    currentHistory, user ?? undefined, attachPayload, ragContext || undefined
                );
                for await (const chunk of stream) {
                    if (!isMountedRef.current) break;
                    fullText += chunk;
                    setHistory(prev => {
                        const h = [...prev];
                        const last = h.length - 1;
                        if (last >= 0 && h[last].role === 'model') {
                            h[last] = { ...h[last], text: fullText, isThinking: false };
                        }
                        return h;
                    });
                }
            }

            // Attach sources
            if (sources.length > 0) {
                setHistory(prev => {
                    const h = [...prev];
                    const last = h.length - 1;
                    if (last >= 0 && h[last].role === 'model') h[last] = { ...h[last], sources };
                    return h;
                });
            }

            // Trigger autosave
            setHistory(prev => {
                triggerAutosave(prev);
                return prev;
            });

        } catch (error) {
            if (!isMountedRef.current) return;
            const txt = error instanceof RateLimitError
                ? 'Дневната AI квота е исцрпена. Обидете се повторно утре.'
                : 'Се случи грешка при генерирање. Обидете се повторно.';
            setHistory(prev => [...prev.slice(0, -1), { role: 'model', text: txt }]);
        } finally {
            if (isMountedRef.current) setIsLoading(false);
        }
    };

    const handleToggleLibraryMode = () => {
        setLibraryMode(prev => { if (prev) setLibraryMaterials([]); return !prev; });
    };

    return (
        <div className="p-4 md:p-8 h-full flex gap-4 animate-fade-in">

            {/* History Sidebar */}
            {showHistory && (
                <div className="w-64 flex-shrink-0 flex flex-col gap-2">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-gray-700 text-sm">Историја</h3>
                        <button onClick={startNewSession}
                            className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-2 py-1 rounded-lg hover:bg-indigo-700">
                            <Plus className="w-3 h-3" /> Нов
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[70vh]">
                        {isLoadingSessions && <p className="text-xs text-gray-400 text-center py-4">Вчитувам…</p>}
                        {!isLoadingSessions && sessions.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">Нема зачувани разговори.</p>
                        )}
                        {sessions.map(s => (
                            <div key={s.id}
                                onClick={() => loadSession(s)}
                                className={`group flex items-start gap-2 p-2.5 rounded-xl cursor-pointer border transition-all text-xs ${
                                    currentSessionId === s.id
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                                        : 'bg-white border-gray-100 text-gray-700 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold truncate">{s.title}</p>
                                    {s.libraryMode && (
                                        <span className="text-[10px] text-indigo-500 font-bold">📚 Библиотека</span>
                                    )}
                                </div>
                                <button type="button" onClick={e => handleDeleteSession(s.id, e)}
                                    title="Избриши разговор"
                                    aria-label="Избриши разговор"
                                    className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400 hover:text-red-600 transition-opacity">
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main chat area */}
            <div className="flex-1 flex flex-col min-w-0">
                <header className="mb-4 flex justify-between items-center flex-wrap gap-3">
                    <div>
                        <h1 className="text-3xl font-bold text-brand-primary">AI Асистент</h1>
                        <p className="text-sm text-gray-500 mt-1">Вашиот личен помошник за настава.</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {lastVisited && (
                            <div className="hidden md:flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
                                <ICONS.link className="w-3 h-3" />
                                {lastVisited.label}
                            </div>
                        )}
                        {/* History toggle */}
                        <button onClick={() => setShowHistory(v => !v)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                                showHistory ? 'bg-gray-800 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                            }`}>
                            <History className="w-4 h-4" />
                            {sessions.length > 0 && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${showHistory ? 'bg-white text-gray-800' : 'bg-indigo-100 text-indigo-700'}`}>
                                    {sessions.length}
                                </span>
                            )}
                        </button>
                        {/* Thinking mode toggle (Pro/Unlimited) */}
                        {(user?.tier === 'Pro' || user?.tier === 'Unlimited') && (
                            <button type="button" onClick={() => setThinkingMode(v => !v)}
                                title="Прикажи размислување на AI (thinking tokens)"
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${
                                    thinkingMode
                                        ? 'bg-purple-600 text-white border-purple-700 hover:bg-purple-700'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200'
                                }`}>
                                <Brain className="w-4 h-4" />
                                {thinkingMode ? 'Мисли ON' : 'Мисли'}
                            </button>
                        )}
                        {/* Library Mode */}
                        <button onClick={handleToggleLibraryMode} disabled={isLoadingLibrary}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border shadow-sm transition-all ${
                                libraryMode
                                    ? 'bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                            }`}>
                            {isLoadingLibrary
                                ? <ICONS.sparkles className="w-4 h-4 animate-spin" />
                                : <Library className="w-4 h-4" />}
                            {isLoadingLibrary ? 'Вчитувам…' : libraryMode ? 'Библиотека ON' : 'Библиотека'}
                            {libraryMode && !isLoadingLibrary && (
                                <span className="ml-1 bg-white text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                    {libraryMaterials.length}
                                </span>
                            )}
                        </button>
                    </div>
                </header>

                {libraryMode && libraryMaterials.length > 0 && (
                    <div className="mb-3 flex items-center gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2 text-sm text-indigo-800">
                        <BookOpen className="w-4 h-4 flex-shrink-0 text-indigo-500" />
                        <span><strong>NotebookLM режим:</strong> Одговарам врз основа на {libraryMaterials.length} ваши материјали.</span>
                        <button type="button" onClick={handleToggleLibraryMode} title="Исклучи библиотечен режим" className="ml-auto text-indigo-400 hover:text-indigo-700">
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <Card className="flex-1 flex flex-col relative overflow-hidden shadow-lg border-brand-secondary/10">
                    <div className="flex-1 overflow-y-auto p-4 pb-24 scroll-smooth">
                        {history.map((msg, i) => <Message key={`${i}-${msg.role}`} message={msg} />)}
                        {isLoading && history[history.length - 1]?.text === '' && (
                            <div className="flex items-start gap-3 my-4">
                                <div className="p-2 rounded-full bg-brand-secondary">
                                    <ICONS.sparkles className="w-5 h-5 text-white animate-spin" />
                                </div>
                                <div className="p-3 rounded-lg bg-blue-50 text-gray-500 italic text-sm">
                                    {libraryMode ? 'Пребарувам во вашата библиотека…' : 'Генерирам одговор…'}
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </div>

                    <div className="p-4 border-t bg-white absolute bottom-0 left-0 right-0">
                        {attachment && (
                            <div className="flex items-center gap-3 mb-3 p-2 bg-gray-50 border border-gray-200 rounded-lg w-fit">
                                {attachment.mimeType.startsWith('image/') ? (
                                    <img src={attachment.previewUrl} alt="Preview" className="w-10 h-10 object-cover rounded shadow-sm" />
                                ) : (
                                    <div className="w-10 h-10 bg-red-100 text-red-600 rounded flex items-center justify-center font-bold text-xs uppercase">
                                        {attachment.file.name.split('.').pop()}
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <span className="text-xs font-semibold text-gray-700 truncate max-w-[150px]">{attachment.file.name}</span>
                                    <span className="text-[10px] text-gray-500">{(attachment.file.size / 1024).toFixed(1)} KB</span>
                                </div>
                                <button onClick={handleRemoveAttachment} className="p-1 hover:bg-gray-200 rounded-full text-gray-500">
                                    <ICONS.close className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden"
                                aria-label="Прикачи фајл"
                                accept="image/png, image/jpeg, image/webp, application/pdf" />
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                disabled={isLoading || !isOnline}
                                className="p-2 text-gray-500 hover:text-brand-primary hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                                title="Прикачи слика или документ"
                                aria-label="Прикачи слика или документ">
                                <ICONS.paperclip className="w-6 h-6" />
                            </button>
                            <input type="text" value={input}
                                aria-label="Порака до AI асистентот"
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                placeholder={!isOnline ? 'Офлајн режим.' : libraryMode ? 'Прашај нешто за вашите материјали…' : 'Поставете прашање…'}
                                className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-secondary disabled:bg-gray-100 shadow-sm"
                                disabled={isLoading || !isOnline}
                                autoFocus />
                            <button type="button" onClick={handleSend}
                                title="Испрати порака"
                                disabled={isLoading || (!input.trim() && !attachment) || !isOnline}
                                className="bg-brand-primary text-white px-6 py-3 rounded-xl disabled:bg-gray-400 hover:bg-brand-secondary transition-all shadow-md active:scale-95 font-semibold">
                                <ICONS.chatBubble className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
