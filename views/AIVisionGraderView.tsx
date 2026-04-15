import React, { useState, useRef } from 'react';
import { Camera, Upload, X, CheckCircle, Loader2, RefreshCw, Sparkles, Printer, AlertTriangle, FileText } from 'lucide-react';
import { Card } from '../components/common/Card';
import { MathRenderer } from '../components/common/MathRenderer';
import { geminiService, isDailyQuotaKnownExhausted } from '../services/geminiService';
import { persistScanArtifactWithObservability } from '../services/scanArtifactPersistence';
import { useAuth } from '../contexts/AuthContext';
import { AppError, ErrorCode } from '../utils/errors';

type FileKind = 'image' | 'pdf' | 'docx';

interface LoadedFile {
    kind: FileKind;
    /** base64 data (no data-URL prefix) — for image/pdf */
    base64?: string;
    mimeType?: string;
    /** extracted plain text — for docx */
    text?: string;
    /** display name */
    name: string;
    /** data-URL for image preview */
    previewSrc?: string;
}

export const AIVisionGraderView: React.FC = () => {
    const { firebaseUser, user } = useAuth();
    const [loadedFile, setLoadedFile] = useState<LoadedFile | null>(null);
    const [conceptContext, setConceptContext] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [analysisDepth, setAnalysisDepth] = useState<'standard' | 'detailed'>('standard');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const downloadFile = (filename: string, content: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const handleExportMarkdown = () => {
        if (!result) return;
        const md = [
            '# AI Проверка на Домашна',
            '',
            `- Датум: ${new Date().toLocaleString('mk-MK')}`,
            `- Контекст: ${conceptContext || 'Не е внесен'}`,
            `- Режим: ${analysisDepth === 'detailed' ? 'Детална анализа' : 'Стандардна анализа'}`,
            '',
            '## Резултат',
            '',
            result,
        ].join('\n');
        downloadFile('ai-analiza-domashna.md', md, 'text/markdown;charset=utf-8');
    };

    const handleExportJson = () => {
        if (!result) return;
        const payload = {
            generatedAt: new Date().toISOString(),
            context: conceptContext || null,
            analysisDepth,
            result,
        };
        downloadFile('ai-analiza-domashna.json', JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
    };

    const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setResult(null);
        setError(null);

        const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
        const isDocx = file.name.endsWith('.docx') ||
            file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        if (isPdf) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target?.result as string;
                const base64 = dataUrl.split(',')[1];
                setLoadedFile({ kind: 'pdf', base64, mimeType: 'application/pdf', name: file.name });
            };
            reader.readAsDataURL(file);
            return;
        }

        if (isDocx) {
            try {
                const mammoth = await import('mammoth');
                const arrayBuffer = await file.arrayBuffer();
                const { value: text } = await mammoth.extractRawText({ arrayBuffer });
                if (!text.trim()) {
                    setError('Документот е празен или не содржи текст кој може да се извлече.');
                    return;
                }
                setLoadedFile({ kind: 'docx', text, name: file.name });
            } catch {
                setError('Не може да се отвори .docx датотеката. Проверете дали е валидна.');
            }
            return;
        }

        // Image (default)
        const reader = new FileReader();
        reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (!match) {
                setError('Неподдржан формат на слика.');
                return;
            }
            setLoadedFile({ kind: 'image', base64: match[2], mimeType: match[1], name: file.name, previewSrc: dataUrl });
        };
        reader.readAsDataURL(file);
    };

    const analyzeFile = async () => {
        if (!loadedFile) return;
        if (isDailyQuotaKnownExhausted()) {
            setError('Дневната AI квота е исцрпена. Обидете се повторно утре.');
            return;
        }

        setIsAnalyzing(true);
        setError(null);

        try {
            let text: string;
            const sourceType: 'image' | 'pdf' | 'web' | 'video' =
                loadedFile.kind === 'docx' ? 'web' : loadedFile.kind;

            if (loadedFile.kind === 'docx') {
                if (!loadedFile.text) throw new AppError('No text', ErrorCode.VALIDATION_FAILED, 'Нема извлечен текст.', false);
                text = await geminiService.analyzeDocumentText(
                    loadedFile.text,
                    conceptContext.trim() || undefined,
                    { detailMode: analysisDepth },
                );
            } else {
                // image or pdf — both handled as inlineData by Gemini
                if (!loadedFile.base64 || !loadedFile.mimeType) {
                    throw new AppError('No data', ErrorCode.VALIDATION_FAILED, 'Датотеката не е вчитана правилно.', false);
                }
                text = await geminiService.analyzeHandwriting(
                    loadedFile.base64,
                    loadedFile.mimeType,
                    conceptContext.trim() || undefined,
                    { detailMode: analysisDepth },
                );
            }

            setResult(text);

            if (firebaseUser?.uid) {
                const outcome = await persistScanArtifactWithObservability({
                    teacherUid: firebaseUser.uid,
                    schoolId: user?.schoolId,
                    mode: 'homework_feedback',
                    sourceType,
                    mimeType: loadedFile.mimeType ?? 'text/plain',
                    extractedText: text,
                    normalizedText: text.trim(),
                    artifactQuality: {
                        score: text.length > 250 ? 0.9 : 0.75,
                        label: text.length > 250 ? 'good' : 'fair',
                        truncated: false,
                    },
                }, {
                    flow: 'vision_homework',
                    stage: 'single_scan_analysis',
                });

                if (!outcome.ok) {
                    setError('Анализата е успешна, но зачувувањето на скенираниот артефакт не успеа. Обидете се повторно.');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Се појави грешка при анализата.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const reset = () => {
        setLoadedFile(null);
        setResult(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    const handlePrint = () => window.print();

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Camera className="w-7 h-7 text-indigo-600" />
                    AI Проверка на Домашни (OCR)
                </h1>
                <p className="text-gray-500 mt-1">Прикачи слика, PDF или Word документ — AI ги детектира грешките и дава корекции.</p>
            </div>

            {/* Concept context input */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Концепт (опционално)</label>
                <input
                    type="text"
                    value={conceptContext}
                    onChange={(e) => setConceptContext(e.target.value)}
                    placeholder="пр. Собирање дропки со различен именител"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                    type="button"
                    onClick={() => setShowAdvanced(v => !v)}
                    className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
                >
                    {showAdvanced ? '▾ Сокриј напредни опции' : '▸ Напредни опции'}
                </button>
                {showAdvanced && (
                    <div className="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Режим на анализа</label>
                        <select
                            aria-label="Режим на анализа"
                            value={analysisDepth}
                            onChange={(e) => setAnalysisDepth(e.target.value as 'standard' | 'detailed')}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                            <option value="standard">Стандардна (побрза)</option>
                            <option value="detailed">Детална (подлабока)</option>
                        </select>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* File upload panel */}
                <Card className="p-6 flex flex-col items-center justify-center min-h-[400px] bg-slate-50 border-dashed border-2 border-slate-300">
                    {!loadedFile ? (
                        <div className="text-center space-y-4 w-full">
                            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                                <Upload className="w-10 h-10" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-700">Прикачи или сликај домашна работа</p>
                                <p className="text-sm text-gray-500 mt-1">Поддржани: JPG, PNG, PDF, DOCX</p>
                            </div>

                            <input
                                type="file"
                                accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                aria-label="Прикачи датотека"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileSelected}
                            />
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                aria-label="Фотографирај со камера"
                                className="hidden"
                                ref={cameraInputRef}
                                onChange={handleFileSelected}
                            />

                            <div className="flex gap-3 justify-center mt-4 flex-wrap">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition flex items-center gap-2"
                                >
                                    <Upload className="w-4 h-4" />
                                    Прикачи датотека
                                </button>
                                <button
                                    onClick={() => cameraInputRef.current?.click()}
                                    className="px-4 py-2 bg-white text-indigo-600 hover:bg-slate-50 rounded-lg shadow border border-slate-200 transition flex items-center gap-2"
                                >
                                    <Camera className="w-4 h-4" />
                                    Камера
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full space-y-3">
                            {/* Image preview */}
                            {loadedFile.kind === 'image' && loadedFile.previewSrc && (
                                <div className="relative rounded-lg overflow-hidden group">
                                    <img src={loadedFile.previewSrc} alt="Преглед" className="w-full h-auto object-contain rounded-lg max-h-[320px]" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <button type="button" aria-label="Отстрани" onClick={reset} className="bg-white/20 hover:bg-white/40 p-3 rounded-full backdrop-blur transition">
                                            <X className="w-8 h-8 text-white" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* PDF / docx badge */}
                            {(loadedFile.kind === 'pdf' || loadedFile.kind === 'docx') && (
                                <div className="flex flex-col items-center gap-3 py-8">
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-inner ${loadedFile.kind === 'pdf' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                        <FileText className="w-8 h-8" />
                                    </div>
                                    <p className="font-medium text-gray-700 text-sm text-center break-all px-2">{loadedFile.name}</p>
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${loadedFile.kind === 'pdf' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {loadedFile.kind}
                                    </span>
                                    {loadedFile.kind === 'docx' && loadedFile.text && (
                                        <p className="text-xs text-gray-400 text-center">{loadedFile.text.length.toLocaleString()} знаци извлечени</p>
                                    )}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={reset}
                                className="w-full py-1.5 text-xs text-gray-500 hover:text-red-600 flex items-center justify-center gap-1 transition"
                            >
                                <X className="w-3.5 h-3.5" />
                                Отстрани датотека
                            </button>
                        </div>
                    )}
                </Card>

                {/* Analysis result panel */}
                <div className="flex flex-col space-y-4">
                    <Card className="p-6 flex-1 flex flex-col relative overflow-hidden bg-white shadow-sm border border-slate-100 printable-area">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-emerald-600" />
                                <h3 className="font-semibold text-gray-800">Резултат од Анализата</h3>
                            </div>
                            {result && (
                                <div className="flex items-center gap-2 no-print">
                                    <button
                                        type="button"
                                        onClick={handleExportMarkdown}
                                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        MD
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleExportJson}
                                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition"
                                    >
                                        <Upload className="w-4 h-4" />
                                        JSON
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handlePrint}
                                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition"
                                    >
                                        <Printer className="w-4 h-4" />
                                        Печати
                                    </button>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 text-sm flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {!result && !isAnalyzing && !error && (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-3">
                                <RefreshCw className="w-12 h-12 opacity-20" />
                                <p className="text-center text-sm px-4">AI ги детектира грешките, го пофалува точниот дел и сугерира точни насоки за ученикот.</p>
                            </div>
                        )}

                        {isAnalyzing && (
                            <div className="flex-1 flex flex-col items-center justify-center text-indigo-600 space-y-3">
                                <Loader2 className="w-10 h-10 animate-spin" />
                                <p className="animate-pulse text-sm font-medium">AI анализира документ...</p>
                            </div>
                        )}

                        {result && (
                            <div className="prose prose-sm md:prose-base prose-indigo overflow-y-auto max-h-[400px]">
                                <MathRenderer text={result} />
                            </div>
                        )}
                    </Card>

                    <button
                        disabled={!loadedFile || isAnalyzing}
                        onClick={analyzeFile}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl font-bold transition-all shadow hover:shadow-md flex items-center justify-center gap-2"
                    >
                        {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        {isAnalyzing ? 'Анализа во тек...' : 'Анализирај Решение'}
                    </button>
                </div>
            </div>
        </div>
    );
};
