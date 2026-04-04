import React, { useState, useRef, useEffect } from 'react';
import { ICONS } from '../../constants';
import { geminiService } from '../../services/geminiService';
import { sanitizePromptInput } from '../../services/gemini/core';
import { useAuth } from '../../contexts/AuthContext';

interface RefineGenerationChatProps {
    material: any;
    onUpdateMaterial: (newMaterial: any) => void;
    materialType: string;
}

export function RefineGenerationChat({ material, onUpdateMaterial, materialType }: RefineGenerationChatProps) {
    const { user } = useAuth();
    const [prompt, setPrompt] = useState('');
    const [isRefining, setIsRefining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleRefine = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isRefining) return;

        setIsRefining(true);
        setError(null);
        
        try {
            const safePrompt = sanitizePromptInput(prompt, 600);
            // Note: We're adding a generic refineMaterialJSON method to realGeminiService!
            // It will take the existing JSON and the user's prompt to update it.
            const newMaterial = await geminiService.refineMaterialJSON(material, safePrompt, materialType);
            if (newMaterial) {
                onUpdateMaterial(newMaterial);
                setPrompt('');
            } else {
                setError('Неуспешно фино подесување. Обидете се повторно.');
            }
        } catch (err: any) {
            console.error("Error refining material:", err);
            setError(err.message || 'Настана грешка при комуникацијата со AI.');
        } finally {
            setIsRefining(false);
        }
    };

    return (
        <div className="mt-8 bg-blue-50/50 rounded-2xl border border-blue-100 p-5 animate-fade-in shadow-inner">
            <div className="flex items-center gap-2 mb-4">
                <ICONS.sparkles className="w-5 h-5 text-brand-primary" />
                <h3 className="text-lg font-bold text-gray-800">Чекор 4: Фино подесување со AI (Refinement)</h3>
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
                Дали сакате да промените нешто? На пример: <span className="italic">„Направи ги прашањата малку потешки“</span>, <span className="italic">„Смени го прашање бр.2 да биде за пица наместо јаболка“</span> или <span className="italic">„Додади уште една активност за вовед“</span>.
            </p>

            <form onSubmit={handleRefine} className="flex gap-3">
                <div className="relative flex-1">
                    <input
                        ref={inputRef}
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Како сакате да го подобриме материјалот?"
                        disabled={isRefining}
                        className="w-full pl-4 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-shadow disabled:bg-gray-100 disabled:text-gray-500"
                    />
                </div>
                <button
                    type="submit"
                    disabled={!prompt.trim() || isRefining}
                    className="px-6 py-3 bg-brand-primary text-white rounded-xl hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all font-bold flex items-center gap-2"
                >
                    {isRefining ? (
                        <><ICONS.spinner className="w-5 h-5 animate-spin" /> Се обидувам...</>
                    ) : (
                        <><ICONS.send className="w-5 h-5" /> Испрати</>
                    )}
                </button>
            </form>
            
            {error && (
                <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2">
                    <ICONS.alertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}
        </div>
    );
}
