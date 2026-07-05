import React, { useState } from 'react';
import type { MaterialOptionsProps } from './materialOptionsProps';
import { parseUploadedFile } from '../../../services/documentParser';

interface FileResult {
    name: string;
    ok: boolean;
    charCount?: number;
    reason?: string;
}

const isSupportedDoc = (file: File): boolean => {
    const name = file.name.toLowerCase();
    return (
        file.type === 'application/pdf' || name.endsWith('.pdf') ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx') ||
        file.type === 'text/plain' || name.endsWith('.txt')
    );
};

/**
 * Extracts math tasks from uploaded PDF/DOCX/TXT documents — supports multiple files at once.
 * Reuses `services/documentParser.ts` (already used by ExtractionHubView) for the actual PDF
 * OCR / DOCX parsing, and writes into the same `webpageText`/`webpageExtractMeta` state fields
 * as WebExtractorOptions so the downstream generation step needs no separate wiring.
 */
export const DocumentExtractorOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<FileResult[] | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const hasText = !!state.webpageText;

    const handleFiles = async (files: FileList | File[]) => {
        const list = Array.from(files).slice(0, 8);
        if (list.length === 0) return;
        setIsLoading(true);
        setResults(null);
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageText', value: null } });
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageExtractMeta', value: null } });
        try {
            const parsed = await Promise.all(list.map(async (file): Promise<{ file: File; result: FileResult; text?: string }> => {
                if (!isSupportedDoc(file)) {
                    return { file, result: { name: file.name, ok: false, reason: 'Неподдржан формат' } };
                }
                try {
                    const doc = await parseUploadedFile(file);
                    return { file, result: { name: file.name, ok: true, charCount: doc.charCount }, text: doc.text };
                } catch (err) {
                    return { file, result: { name: file.name, ok: false, reason: (err as Error).message } };
                }
            }));
            setResults(parsed.map(p => p.result));
            const successful = parsed.filter(p => p.result.ok && p.text);
            if (successful.length === 0) return;
            const combinedText = successful
                .map(p => `=== SOURCE: ${p.file.name} ===\n${p.text ?? ''}`)
                .join('\n\n')
                .slice(0, 18000);
            dispatch({ type: 'SET_FIELD', payload: { field: 'webpageText', value: combinedText } });
            dispatch({ type: 'SET_FIELD', payload: { field: 'webpageExtractMeta', value: {
                sourceUrls: successful.map(p => p.file.name),
                sourceTypes: successful.map(() => 'pdf' as const),
                extractionModes: successful.map(() => 'pdf-native' as const),
                charCount: combinedText.length,
                truncated: combinedText.length >= 18000,
                failedUrls: parsed.filter(p => !p.result.ok).map(p => p.file.name),
            } } });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    };

    const handleClear = () => {
        setResults(null);
        setShowPreview(false);
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageText', value: null } });
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageExtractMeta', value: null } });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">PDF / DOCX / TXT документи</label>
                <div
                    className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-colors cursor-pointer ${
                        dragOver ? 'border-sky-400 bg-sky-50' : 'border-slate-300 bg-slate-50 hover:border-sky-300 hover:bg-sky-50/40'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <span className="text-4xl">📄</span>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-slate-700">Прикачи до 8 документи или повлечи овде</p>
                        <p className="text-xs text-slate-400 mt-0.5">PDF, DOCX, TXT — до 20 MB по документ, повеќестрани се поддржани</p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        multiple
                        className="hidden"
                        onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); }}
                    />
                </div>
            </div>

            {isLoading && (
                <div className="flex items-center gap-2 text-sm text-sky-700 font-semibold">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                    Извлекувам содржина...
                </div>
            )}

            {results && !isLoading && (
                <div className="space-y-2">
                    {results.map((r, i) => (
                        <div key={i} className={`rounded-xl border p-2.5 flex items-center gap-2 text-xs ${r.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
                            <span>{r.ok ? '✅' : '⚠'}</span>
                            <span className="font-semibold truncate flex-1">{r.name}</span>
                            <span>{r.ok ? `${r.charCount?.toLocaleString()} знаци` : r.reason}</span>
                        </div>
                    ))}
                    {hasText && (
                        <div className="flex items-center justify-between">
                            <button type="button" onClick={() => setShowPreview(v => !v)} className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 underline">{showPreview ? 'Скриј преглед' : 'Прегледај текст'}</button>
                            <button type="button" onClick={handleClear} className="text-[11px] text-slate-500 hover:text-slate-700 underline">Исчисти</button>
                        </div>
                    )}
                    {showPreview && hasText && (
                        <div className="rounded-lg bg-white border border-slate-200 p-2.5 max-h-40 overflow-y-auto">
                            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">{state.webpageText!.slice(0, 1200)}{state.webpageText!.length > 1200 ? '…' : ''}</p>
                        </div>
                    )}
                </div>
            )}

            <div className={`rounded-xl p-3 border text-xs font-semibold flex items-center gap-2 ${hasText ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-sky-50 border-sky-200 text-sky-800'}`}>
                <span className="text-base">{hasText ? '🎯' : '💡'}</span>
                {hasText ? 'Содржината е извлечена — AI ќе генерира материјал базиран на вистинскиот текст од документите.' : 'Прикачи еден или повеќе документи и AI ќе ги извлече задачите од сите нив.'}
            </div>
        </div>
    );
};
