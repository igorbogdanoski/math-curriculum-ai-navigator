import React, { useState, useRef } from 'react';
import { Camera, Upload, X, CheckCircle, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Card } from '../components/common/Card';
import { useLanguage } from '../i18n/LanguageContext';
import { MathRenderer } from '../components/common/MathRenderer';

export const AIVisionGraderView: React.FC = () => {
    const { t } = useLanguage();
    const [imageStr, setImageStr] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            setImageStr(event.target?.result as string);
            setResult(null);
            setError(null);
        };
        reader.readAsDataURL(file);
    };

    const analyzeImage = async () => {
        if (!imageStr) return;
        
        setIsAnalyzing(true);
        setError(null);
        
        try {
            // Extract base64 and mime type
            const match = imageStr.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (!match) throw new Error("Invalid image format");
            
            const mimeType = match[1];
            const base64Data = match[2];

            const response = await fetch('/api/gemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('user_token') || ''}`
                },
                body: JSON.stringify({
                    model: 'gemini-1.5-flash',
                    contents: [
                        {
                            role: 'user',
                            parts: [
                                { text: 'You are an expert math teacher. Please analyze the student\'s handwritten math homework in this image. Identify any mistakes, praise correct logic, provide step-by-step corrections, and give an overall brief encouraging feedback. Reply in Macedonian.' },
                                { inlineData: { mimeType, data: base64Data } }
                            ]
                        }
                    ]
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to analyze image');
            }

            const data = await response.json();
            setResult(data.text);
        } catch (err: any) {
            setError(err.message || 'An error occurred during analysis');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const reset = () => {
        setImageStr(null);
        setResult(null);
        setError(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Camera className="w-7 h-7 text-indigo-600" />
                    AI Vision - Проверка на Домашни
                </h1>
                <p className="text-gray-500 mt-1">Обезбедете слика од ученичко решение за автоматска валидација и повратни информации.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 flex flex-col items-center justify-center min-h-[400px] bg-slate-50 border-dashed border-2 border-slate-300">
                    {!imageStr ? (
                        <div className="text-center space-y-4">
                            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                                <Upload className="w-10 h-10" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-700">Прикачи или сликај домашна работа</p>
                                <p className="text-sm text-gray-500 mt-1">Поддржани формати: JPG, PNG</p>
                            </div>
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleFileSelected}
                            />
                            <div className="flex gap-3 justify-center mt-4">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition"
                                >
                                    Прикачи Датотека
                                </button>
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="px-4 py-2 bg-white text-indigo-600 hover:bg-slate-50 rounded-lg shadow border border-slate-200 transition flex items-center gap-2"
                                >
                                    <Camera className="w-4 h-4" />
                                    Камера
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full relative rounded-lg overflow-hidden group">
                           <img src={imageStr} alt="Homework preview" className="w-full h-auto object-contain rounded-lg max-h-[500px]" />
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <button onClick={reset} className="bg-white/20 hover:bg-white/40 p-3 rounded-full backdrop-blur transition">
                                   <X className="w-8 h-8 text-white" />
                               </button>
                           </div>
                        </div>
                    )}
                </Card>

                <div className="flex flex-col space-y-4">
                    <Card className="p-6 flex-1 flex flex-col relative overflow-hidden bg-white shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                            <h3 className="font-semibold text-gray-800">Резултат од Анализата</h3>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 text-sm">
                                {error}
                            </div>
                        )}

                        {!result && !isAnalyzing && !error && (
                           <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-3">
                               <RefreshCw className="w-12 h-12 opacity-20" />
                               <p className="text-center text-sm px-4">Автоматската анализа ги детектира грешките, го пофалува точниот дел и сугерира точни насоки за ученикот.</p>
                           </div>
                        )}

                        {isAnalyzing && (
                            <div className="flex-1 flex flex-col items-center justify-center text-indigo-600 space-y-3">
                                <Loader2 className="w-10 h-10 animate-spin" />
                                <p className="animate-pulse text-sm font-medium">Вештачката Интелигенција анализира...</p>
                            </div>
                        )}

                        {result && (
                            <div className="prose prose-sm md:prose-base prose-indigo overflow-y-auto max-h-[400px]">
                                <MathRenderer text={result} />
                            </div>
                        )}

                    </Card>

                   <button
                       disabled={!imageStr || isAnalyzing}
                       onClick={analyzeImage}
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
