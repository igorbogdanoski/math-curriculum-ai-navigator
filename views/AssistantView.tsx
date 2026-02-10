
import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import type { ChatMessage } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { MathRenderer } from '../components/common/MathRenderer';
import { useNetworkStatus } from '../contexts/NetworkStatusContext';
import { useLastVisited } from '../contexts/LastVisitedContext';

// Helper to convert File to Base64
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // Remove the Data URL prefix (e.g., "data:image/png;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
};

const Message: React.FC<{ message: ChatMessage }> = ({ message }) => {
    const isModel = message.role === 'model';
    return (
        <div className={`flex items-start gap-3 my-4 ${isModel ? '' : 'flex-row-reverse'}`}>
            <div className={`p-2 rounded-full flex-shrink-0 ${isModel ? 'bg-brand-secondary' : 'bg-gray-300'}`}>
                {isModel ? <ICONS.sparkles className="w-5 h-5 text-white"/> : <div className="w-5 h-5"></div> }
            </div>
            <div className={`flex flex-col gap-2 max-w-lg ${isModel ? 'items-start' : 'items-end'}`}>
                {message.attachmentUrl && (
                    <div className="mb-1">
                        <img 
                            src={message.attachmentUrl} 
                            alt="Attachment" 
                            className="max-h-48 rounded-lg border border-gray-200 shadow-sm object-contain bg-white" 
                        />
                    </div>
                )}
                <div className={`p-3 rounded-lg prose prose-sm ${isModel ? 'bg-blue-100 text-brand-text' : 'bg-gray-200'}`}>
                    <MathRenderer text={message.text} />
                </div>
            </div>
        </div>
    );
}

export const AssistantView: React.FC = () => {
    const { user } = useAuth();
    const { isOnline } = useNetworkStatus();
    const { lastVisited } = useLastVisited();
    
    const [history, setHistory] = useState<ChatMessage[]>([
        { role: 'model', text: 'Здраво! Јас сум вашиот AI асистент за настава. Можете да ми поставите прашање или да прикачите слика/документ за анализа.' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // File Upload State
    const [attachment, setAttachment] = useState<{ file: File; previewUrl: string; base64: string; mimeType: string } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const initializedRef = useRef(false);

    // Context Awareness Logic (Phase 1)
    useEffect(() => {
        if (!initializedRef.current && lastVisited && history.length === 1) {
            initializedRef.current = true;
            
            const contextTypeLabel = lastVisited.type === 'concept' ? 'поимот' : 'подготовката';
            const suggestedPrompt = `Забележав дека работевте на ${contextTypeLabel} "**${lastVisited.label}**". Дали ви треба помош или идеи поврзани со тоа?`;
            
            setHistory((prev: ChatMessage[]) => {
                // Update the greeting to be contextual
                const newHistory = [...prev];
                newHistory[0] = { 
                    role: 'model', 
                    text: `Здраво! ${suggestedPrompt}` 
                };
                return newHistory;
            });
        }
    }, [lastVisited]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, isLoading]);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const base64 = await fileToBase64(file);
                setAttachment({
                    file,
                    previewUrl: URL.createObjectURL(file),
                    base64,
                    mimeType: file.type
                });
            } catch (err) {
                console.error("File processing error:", err);
            }
        }
        // Reset input value so the same file can be selected again if needed
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleRemoveAttachment = () => {
        if (attachment) {
            URL.revokeObjectURL(attachment.previewUrl);
            setAttachment(null);
        }
    };

    const handleSend = async () => {
        if ((!input.trim() && !attachment) || isLoading || !isOnline) return;
        
        const textToSend = input.trim() || (attachment ? `[Прикачен фајл: ${attachment.file.name}]` : '');
        
        // Create user message object, including the attachment URL for display in history
        const newUserMessage: ChatMessage = { 
            role: 'user', 
            text: textToSend,
            attachmentUrl: attachment?.previewUrl 
        };
        
        // Prepare attachment payload for the API
        const attachmentPayload = attachment ? { base64: attachment.base64, mimeType: attachment.mimeType } : undefined;

        setHistory((prev: ChatMessage[]) => [...prev, newUserMessage]);
        setInput('');
        
        // Clear attachment state but do NOT revoke URL yet as it's used in the history display
        setAttachment(null); 
        
        setIsLoading(true);

        const placeholderMessage: ChatMessage = { role: 'model', text: '' };
        setHistory((prev: ChatMessage[]) => [...prev, placeholderMessage]);

        try {
            // Pass the visual history plus the user profile AND the attachment
            const stream = geminiService.getChatResponseStream(
                [...history, newUserMessage], 
                user ?? undefined,
                attachmentPayload
            );
            
            for await (const chunk of stream) {
                setHistory((prev: ChatMessage[]) => {
                    const newHistory = [...prev];
                    const lastMessageIndex = newHistory.length - 1;
            
                    if (lastMessageIndex >= 0 && newHistory[lastMessageIndex].role === 'model') {
                        newHistory[lastMessageIndex] = {
                            ...newHistory[lastMessageIndex],
                            text: newHistory[lastMessageIndex].text + chunk
                        };
                    }
                    return newHistory;
                });
            }
        } catch (error) {
            const errorMessage: ChatMessage = { role: 'model', text: (error as Error).message };
            setHistory((prev: ChatMessage[]) => [...prev.slice(0, -1), errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-8 h-full flex flex-col animate-fade-in">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-brand-primary">AI Асистент</h1>
                    <p className="text-lg text-gray-600 mt-2">Вашиот личен помошник за настава.</p>
                </div>
                {lastVisited && (
                    <div className="hidden md:flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100 animate-fade-in">
                        <ICONS.link className="w-3 h-3" />
                        Активен контекст: {lastVisited.label}
                    </div>
                )}
            </header>

            <Card className="flex-1 flex flex-col relative overflow-hidden shadow-lg border-brand-secondary/10">
                <div className="flex-1 overflow-y-auto p-4 pb-20 scroll-smooth">
                    {history.map((msg: ChatMessage, i: number) => <Message key={i} message={msg} />)}
                    {isLoading && history[history.length-1].text === '' && (
                        <div className="flex items-start gap-3 my-4">
                             <div className="p-2 rounded-full bg-brand-secondary">
                                <ICONS.sparkles className="w-5 h-5 text-white animate-spin"/>
                            </div>
                            <div className="p-3 rounded-lg bg-blue-50 text-gray-500 italic text-sm">
                                Генерирам одговор...
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
                
                {/* Input Area Container */}
                <div className="p-4 border-t bg-white absolute bottom-0 left-0 right-0">
                    
                    {/* Attachment Preview (Before Sending) */}
                    {attachment && (
                        <div className="flex items-center gap-3 mb-3 p-2 bg-gray-50 border border-gray-200 rounded-lg w-fit animate-fade-in-up">
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
                            <button onClick={handleRemoveAttachment} className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                                <ICONS.close className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-4">
                        {/* Hidden File Input */}
                        <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileSelect} 
                            className="hidden" 
                            accept="image/png, image/jpeg, image/webp, application/pdf"
                        />
                        
                        {/* Attachment Button */}
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading || !isOnline}
                            className="p-2 text-gray-500 hover:text-brand-primary hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                            title="Прикачи слика или документ"
                        >
                            <ICONS.paperclip className="w-6 h-6" />
                        </button>

                        <input
                            type="text"
                            value={input}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
                            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && handleSend()}
                            placeholder={isOnline ? "Поставете прашање или прикачете материјал..." : "Офлајн режим. Четувањето е оневозможено."}
                            className="flex-1 p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-secondary focus:border-brand-secondary disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm"
                            disabled={isLoading || !isOnline}
                            autoFocus
                        />
                        <button 
                            onClick={handleSend}
                            disabled={isLoading || (!input.trim() && !attachment) || !isOnline}
                            className="bg-brand-primary text-white px-6 py-3 rounded-xl disabled:bg-gray-400 hover:bg-brand-secondary transition-all shadow-md active:scale-95 font-semibold"
                        >
                            <ICONS.chatBubble className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
};
