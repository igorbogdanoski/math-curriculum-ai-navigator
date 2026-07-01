import React, { useState } from 'react';
import { getAuth } from 'firebase/auth';
import { app } from '../../../firebaseConfig';
import type { MaterialOptionsProps } from './materialOptionsProps';

interface WebExtractResult {
    available: boolean;
    text?: string;
    title?: string;
    charCount?: number;
    truncated?: boolean;
    sourceUrl?: string;
    sourceType?: string;
    extractionMode?: string;
    reason?: string;
}

export const WebExtractorOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => {
    const [isLoading,   setIsLoading]   = useState(false);
    const [result,      setResult]      = useState<WebExtractResult | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    const hasText = !!(state.webpageText);

    const parseBatchUrls = (raw: string): string[] =>
        Array.from(new Set(raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean))).slice(0, 8);

    const buildAuthHeaders = async (): Promise<HeadersInit> => {
        const currentUser = getAuth(app).currentUser;
        if (!currentUser) return {};
        const token = await currentUser.getIdToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const handleFetch = async () => {
        const url = state.webpageUrl.trim();
        if (!url) return;
        setIsLoading(true);
        setResult(null);
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageText', value: null } });
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageExtractMeta', value: null } });
        try {
            const params = new URLSearchParams({ url });
            const headers = await buildAuthHeaders();
            const res = await fetch(`/api/webpage-extract?${params.toString()}`, { headers });
            const data: WebExtractResult = await res.json();
            setResult(data);
            if (data.available && data.text) {
                dispatch({ type: 'SET_FIELD', payload: { field: 'webpageText', value: data.text } });
                dispatch({ type: 'SET_FIELD', payload: { field: 'webpageExtractMeta', value: {
                    sourceUrls: [url],
                    sourceTypes: [data.sourceType ?? 'webpage'],
                    extractionModes: [data.extractionMode ?? 'html-static'],
                    charCount: data.charCount ?? data.text.length,
                    truncated: !!data.truncated,
                }}});
            }
        } catch {
            setResult({ available: false, reason: 'Не може да се поврзе со серверот' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleBatchFetch = async () => {
        const urls = parseBatchUrls(state.webpageBatchUrls);
        if (urls.length === 0) return;
        setIsLoading(true);
        setResult(null);
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageText', value: null } });
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageExtractMeta', value: null } });
        try {
            const headers = await buildAuthHeaders();
            const batchResults = await Promise.all(urls.map(async (url) => {
                try {
                    const params = new URLSearchParams({ url });
                    const res = await fetch(`/api/webpage-extract?${params.toString()}`, { headers });
                    const data: WebExtractResult = await res.json();
                    return { url, data };
                } catch {
                    return { url, data: { available: false, reason: 'Network error' } as WebExtractResult };
                }
            }));
            const successful = batchResults.filter(r => r.data.available && r.data.text);
            const failedUrls = batchResults.filter(r => !r.data.available).map(r => r.url);
            if (successful.length === 0) {
                setResult({ available: false, reason: 'Ниту еден URL не беше успешно извлечен.' });
                return;
            }
            const combinedText = successful.map(({ url, data }) => `=== SOURCE: ${url} ===\n${data.text ?? ''}`).join('\n\n').slice(0, 18000);
            const first = successful[0].data;
            setResult({ available: true, text: combinedText, title: `Batch extract (${successful.length}/${urls.length})`, charCount: combinedText.length, truncated: combinedText.length >= 18000, sourceType: first.sourceType, extractionMode: first.extractionMode, sourceUrl: successful[0].url });
            dispatch({ type: 'SET_FIELD', payload: { field: 'webpageText', value: combinedText } });
            dispatch({ type: 'SET_FIELD', payload: { field: 'webpageUrl', value: successful[0].url } });
            dispatch({ type: 'SET_FIELD', payload: { field: 'webpageExtractMeta', value: { sourceUrls: successful.map(r => r.url), sourceTypes: successful.map(r => r.data.sourceType ?? 'webpage'), extractionModes: successful.map(r => r.data.extractionMode ?? 'html-static'), charCount: combinedText.length, truncated: combinedText.length >= 18000, failedUrls }}});
        } finally {
            setIsLoading(false);
        }
    };

    const handleClear = () => {
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageUrl', value: '' } });
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageBatchUrls', value: '' } });
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageText', value: null } });
        dispatch({ type: 'SET_FIELD', payload: { field: 'webpageExtractMeta', value: null } });
        setResult(null);
        setShowPreview(false);
        inputRef.current?.focus();
    };

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">URL на веб страна</label>
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="url"
                        value={state.webpageUrl}
                        onChange={(e) => {
                            dispatch({ type: 'SET_FIELD', payload: { field: 'webpageUrl', value: e.target.value } });
                            if (result) { setResult(null); dispatch({ type: 'SET_FIELD', payload: { field: 'webpageText', value: null } }); }
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleFetch(); }}
                        placeholder="https://math.com/lesson/fractii"
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                    />
                    <button type="button" onClick={handleFetch} disabled={!state.webpageUrl.trim() || isLoading}
                        className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-bold text-white transition active:scale-95">
                        {isLoading ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg> : '🌐'}
                        {isLoading ? 'Преземам…' : 'Извлечи'}
                    </button>
                    {(state.webpageUrl || result) && (
                        <button type="button" onClick={handleClear} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-500 hover:bg-slate-100 transition">✕</button>
                    )}
                </div>
            </div>

            <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Batch извори (по еден URL во нов ред)</label>
                <textarea value={state.webpageBatchUrls} onChange={(e) => dispatch({ type: 'SET_FIELD', payload: { field: 'webpageBatchUrls', value: e.target.value } })} rows={3} placeholder={'https://example.com/lesson-1\nhttps://example.com/lesson-2.pdf'} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent" />
                <div className="mt-2 flex items-center justify-between">
                    <p className="text-[11px] text-slate-500">Макс 8 URL извори по batch.</p>
                    <button type="button" onClick={handleBatchFetch} disabled={isLoading || parseBatchUrls(state.webpageBatchUrls).length === 0} className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 px-3 py-1.5 text-xs font-bold text-white">Batch Extract</button>
                </div>
            </div>

            {result && !isLoading && (
                <>
                    {result.available ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-800 truncate">✅ {result.title || 'Страна извлечена'}</p>
                                    <p className="text-xs text-emerald-700 mt-0.5">{result.charCount?.toLocaleString()} знаци{result.truncated && ' (скратено)'}{' · '}<span className="font-medium">Текстот е подготвен за AI</span></p>
                                    <p className="text-[11px] text-emerald-700/90 mt-1">Извор: {result.sourceType === 'pdf' ? 'PDF документ' : 'Веб страна'}{result.extractionMode === 'html-reader-fallback' && ' · Reader fallback'}{result.extractionMode === 'pdf-native' && ' · PDF text extraction'}{result.extractionMode === 'pdf-ocr-fallback' && ' · PDF OCR fallback'}</p>
                                </div>
                                <button type="button" onClick={() => setShowPreview(v => !v)} className="shrink-0 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 underline">{showPreview ? 'Скриј' : 'Прегледај'}</button>
                            </div>
                            {showPreview && (
                                <div className="rounded-lg bg-white border border-emerald-100 p-2.5 max-h-40 overflow-y-auto">
                                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">{result.text!.slice(0, 1200)}{result.text!.length > 1200 ? '…' : ''}</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                            <p className="text-xs font-bold text-rose-800">⚠ Не може да се извлече содржина</p>
                            <p className="text-xs text-rose-700 mt-0.5">{result.reason ?? 'Непозната грешка'}</p>
                            <p className="text-xs text-rose-600 mt-1.5">Совет: ако страницата е динамичка, системот автоматски пробува reader fallback. За учебници, внеси директен PDF линк.</p>
                        </div>
                    )}
                </>
            )}

            <div className={`rounded-xl p-3 border text-xs font-semibold flex items-center gap-2 ${hasText ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-violet-50 border-violet-200 text-violet-800'}`}>
                <span className="text-base">{hasText ? '🎯' : '💡'}</span>
                {hasText ? 'Содржината е извлечена — AI ќе генерира материјал базиран на вистинскиот текст од страната.' : 'Внеси URL на математичка страна (учебник, статија, задачи) и кликни Извлечи.'}
            </div>
        </div>
    );
};
