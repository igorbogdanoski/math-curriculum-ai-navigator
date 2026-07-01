import React, { useState } from 'react';
import { fetchVideoPreview, fetchYouTubeCaptions, type VideoCaptionsResult } from '../../../utils/videoPreview';
import type { MaterialOptionsProps } from './materialOptionsProps';

export const VideoExtractorOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => {
    const [isLoadingPreview,  setIsLoadingPreview]  = useState(false);
    const [previewError,      setPreviewError]      = useState<string | null>(null);
    const [captionsResult,    setCaptionsResult]    = useState<VideoCaptionsResult | null>(null);
    const [isLoadingCaptions, setIsLoadingCaptions] = useState(false);
    const [showTranscript,    setShowTranscript]    = useState(false);

    const handlePreview = async () => {
        if (!state.videoUrl.trim() || isLoadingPreview) return;
        setIsLoadingPreview(true);
        setPreviewError(null);
        setCaptionsResult(null);
        try {
            const preview = await fetchVideoPreview(state.videoUrl);
            dispatch({ type: 'SET_FIELD', payload: { field: 'videoPreview', value: preview } });
            dispatch({ type: 'SET_FIELD', payload: { field: 'videoUrl', value: preview.normalizedUrl } });
            if (preview.provider === 'youtube' && preview.videoId) {
                setIsLoadingCaptions(true);
                const caps = await fetchYouTubeCaptions(preview.videoId, 'mk');
                setCaptionsResult(caps);
                setIsLoadingCaptions(false);
                dispatch({ type: 'SET_FIELD', payload: { field: 'videoTranscript', value: caps.available ? caps.transcript ?? null : null } });
                dispatch({ type: 'SET_FIELD', payload: { field: 'videoTranscriptSegments', value: caps.available ? (caps.segments ?? []) : [] } });
            }
        } catch (error) {
            dispatch({ type: 'SET_FIELD', payload: { field: 'videoPreview', value: null } });
            setPreviewError(error instanceof Error ? error.message : 'Грешка при preview вчитување.');
        } finally {
            setIsLoadingPreview(false);
            setIsLoadingCaptions(false);
        }
    };

    const hasTranscript = captionsResult?.available && captionsResult.transcript;

    return (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-5 mb-6 space-y-4">
            {/* Step 1: URL */}
            <div>
                <label htmlFor="videoUrl" className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <span className="bg-brand-primary/10 text-brand-primary w-6 h-6 rounded-full flex items-center justify-center text-xs font-black">1</span>
                    Видео URL
                </label>
                <div className="flex gap-2">
                    <input
                        id="videoUrl"
                        type="url"
                        value={state.videoUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            dispatch({ type: 'SET_FIELD', payload: { field: 'videoUrl', value: e.target.value } });
                            setCaptionsResult(null);
                        }}
                        className="block w-full p-3 border-2 border-gray-200 rounded-xl bg-white focus:ring-0 focus:border-brand-primary outline-none transition-all shadow-sm font-medium text-gray-800"
                        placeholder="https://www.youtube.com/watch?v=..."
                    />
                    <button
                        type="button"
                        onClick={handlePreview}
                        disabled={!state.videoUrl.trim() || isLoadingPreview || isLoadingCaptions}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 whitespace-nowrap"
                    >
                        {isLoadingPreview ? 'Вчитувам…' : 'Анализирај'}
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-1.5">Поддржани: YouTube (со автоматски субтитли) и Vimeo.</p>
                {previewError && <p className="text-xs text-red-600 mt-2">{previewError}</p>}
            </div>

            {/* Preview card */}
            {state.videoPreview && (
                <div className="rounded-xl border border-indigo-100 bg-white p-3 flex gap-3 items-start">
                    {state.videoPreview.thumbnailUrl ? (
                        <img src={state.videoPreview.thumbnailUrl} alt={state.videoPreview.title}
                            className="w-28 h-20 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
                    ) : (
                        <div className="w-28 h-20 rounded-lg border border-gray-200 bg-gray-100 flex-shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-800 truncate">{state.videoPreview.title}</p>
                        {state.videoPreview.authorName && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{state.videoPreview.authorName}</p>
                        )}
                        <div className="mt-2">
                            {isLoadingCaptions && (
                                <p className="text-[11px] text-indigo-600 font-semibold animate-pulse">⏳ Извлекувам субтитли…</p>
                            )}
                            {!isLoadingCaptions && hasTranscript && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                        ✓ Транскрипт извлечен — {captionsResult!.charCount?.toLocaleString()} знаци
                                        {captionsResult!.source === 'auto' ? ' · авто' : ' · рачно'}
                                        {captionsResult!.truncated ? ' · скратен' : ''}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowTranscript(p => !p)}
                                        className="text-[11px] text-indigo-600 underline"
                                    >
                                        {showTranscript ? 'Скриј' : 'Прикажи'}
                                    </button>
                                </div>
                            )}
                            {!isLoadingCaptions && captionsResult && !captionsResult.available && (
                                <div>
                                    <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 inline-block">
                                        ⚠ Нема субтитли — AI ќе работи само со наслов
                                    </p>
                                    {captionsResult.reason && (
                                        <p className="text-[10px] text-gray-400 mt-0.5">{captionsResult.reason}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Transcript preview */}
            {showTranscript && hasTranscript && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 max-h-40 overflow-y-auto">
                    <p className="text-xs text-slate-500 font-semibold mb-1">Транскрипт (прв дел):</p>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-mono">
                        {captionsResult!.transcript!.slice(0, 800)}
                        {captionsResult!.transcript!.length > 800 ? '…' : ''}
                    </p>
                </div>
            )}

            {/* Quality indicator */}
            {state.videoPreview && !isLoadingCaptions && (
                <div className={`rounded-xl p-3 border text-xs font-semibold flex items-center gap-2 ${
                    hasTranscript
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}>
                    <span className="text-base">{hasTranscript ? '🎯' : '💡'}</span>
                    {hasTranscript
                        ? 'Целосен транскрипт е достапен — AI ќе генерира прецизно наставно сценарио базирано на вистинската содржина.'
                        : 'Нема транскрипт — AI ќе генерира сценарио базирано на наслов и тема. Резултатот е помалку специфичен.'
                    }
                </div>
            )}
        </div>
    );
};
