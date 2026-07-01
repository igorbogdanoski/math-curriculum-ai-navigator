import React, { useState } from 'react';
import type { MaterialOptionsProps } from './materialOptionsProps';

const IMAGE_MODES = [
    { id: 'textbook',    label: 'Учебник / работен лист', icon: '📖', hint: 'Страница од учебник, принтана задача или работен лист' },
    { id: 'handwriting', label: 'Рачен запис / табла',    icon: '✏️', hint: 'Рачно напишани задачи, белешки или фотографија од табла' },
    { id: 'exam',        label: 'Испитен лист / тест',    icon: '📝', hint: 'Матура, контролна работа или испит — извлечи ги задачите' },
] as const;

type ImageMode = typeof IMAGE_MODES[number]['id'];

export const ImageExtractorOptions: React.FC<Pick<MaterialOptionsProps, 'state' | 'dispatch'>> = ({ state, dispatch }) => {
    const imageMode: ImageMode = (state.imageMode as ImageMode) ?? 'textbook';
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const base64 = dataUrl.split(',')[1];
            dispatch({ type: 'SET_FIELD', payload: { field: 'imageFile', value: { file, base64, previewUrl: dataUrl } } });
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const clearImage = () => {
        dispatch({ type: 'SET_FIELD', payload: { field: 'imageFile', value: null } });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const img = state.imageFile;

    return (
        <div className="space-y-4">
            {/* Mode selector */}
            <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Тип на слика</label>
                <div className="grid grid-cols-3 gap-2">
                    {IMAGE_MODES.map(m => (
                        <button
                            key={m.id}
                            type="button"
                            onClick={() => dispatch({ type: 'SET_FIELD', payload: { field: 'imageMode', value: m.id } })}
                            title={m.hint}
                            className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-xs font-semibold transition-all ${
                                imageMode === m.id
                                    ? 'border-violet-500 bg-violet-50 text-violet-800'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
                            }`}
                        >
                            <span className="text-xl">{m.icon}</span>
                            <span className="text-center leading-tight">{m.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Upload zone */}
            {!img ? (
                <div
                    className={`relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-colors cursor-pointer ${
                        dragOver ? 'border-violet-400 bg-violet-50' : 'border-slate-300 bg-slate-50 hover:border-violet-300 hover:bg-violet-50/40'
                    }`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <span className="text-4xl">🖼️</span>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-slate-700">Прикачи слика или повлечи овде</p>
                        <p className="text-xs text-slate-400 mt-0.5">JPG, PNG, WEBP — до 10 MB</p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                </div>
            ) : (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={img.previewUrl} alt="Прикачена слика" className="w-full max-h-64 object-contain" />
                    <button
                        type="button"
                        onClick={clearImage}
                        className="absolute top-2 right-2 rounded-full bg-slate-800/70 p-1.5 text-white hover:bg-red-600 transition-colors"
                        title="Отстрани слика"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="px-3 py-2 flex items-center gap-2">
                        <span className="text-sm">✅</span>
                        <p className="text-xs text-slate-600 font-medium truncate">{img.file.name}</p>
                        <span className="ml-auto text-xs text-slate-400">{(img.file.size / 1024).toFixed(0)} KB</span>
                    </div>
                </div>
            )}

            {/* Info banner */}
            <div className={`rounded-xl p-3 border text-xs font-semibold flex items-center gap-2 ${
                img
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-violet-50 border-violet-200 text-violet-800'
            }`}>
                <span className="text-base">{img ? '🔍' : '💡'}</span>
                {img
                    ? 'AI ќе ги извлече задачите, теоријата и концептите од сликата и ќе генерира наставен материјал.'
                    : 'Прикачи слика — AI (Gemini Vision) ќе ги препознае математичките задачи и ќе создаде материјал.'
                }
            </div>
        </div>
    );
};
