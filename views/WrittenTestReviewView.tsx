import React, { useState, useRef, useCallback } from 'react';
import { Upload, Camera, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle, Brain, Sparkles, ChevronDown, ChevronUp, Trash2, Plus, Eye } from 'lucide-react';
import { geminiService } from '../services/geminiService';

interface TestQuestion {
  id: string;
  text: string;
  points: number;
  correctAnswer: string;
}

interface GradeResult {
  questionId: string;
  earnedPoints: number;
  maxPoints: number;
  feedback: string;
  misconception?: string;
}

const DEFAULT_QUESTIONS: TestQuestion[] = [
  { id: '1', text: '', points: 10, correctAnswer: '' },
  { id: '2', text: '', points: 10, correctAnswer: '' },
  { id: '3', text: '', points: 10, correctAnswer: '' },
];

export const WrittenTestReviewView: React.FC = () => {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>(DEFAULT_QUESTIONS);
  const [results, setResults] = useState<GradeResult[]>([]);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSetup, setExpandedSetup] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Ве молиме прикачете слика (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Сликата е преголема (максимум 10MB).');
      return;
    }
    setImageFile(file);
    setError(null);
    setResults([]);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleGrade = async () => {
    if (!imageFile || !imagePreview) return;
    const validQuestions = questions.filter(q => q.text.trim() && q.correctAnswer.trim());
    if (validQuestions.length === 0) {
      setError('Внесете барем едно прашање со точен одговор.');
      return;
    }

    setIsGrading(true);
    setError(null);

    try {
      // Extract base64 from data URL
      const base64 = imagePreview.split(',')[1];
      const mimeType = imageFile.type;

      const gradeResults = await geminiService.gradeTestWithVision(
        base64,
        mimeType,
        validQuestions.map(q => ({
          id: q.id,
          text: q.text,
          points: q.points,
          correctAnswer: q.correctAnswer
        }))
      );

      setResults(gradeResults);
      setExpandedSetup(false);
    } catch (err) {
      console.error('Vision grading error:', err);
      setError('Настана грешка при прегледувањето. Обидете се повторно.');
    } finally {
      setIsGrading(false);
    }
  };

  const addQuestion = () => {
    const newId = String(questions.length + 1);
    setQuestions(prev => [...prev, { id: newId, text: '', points: 10, correctAnswer: '' }]);
  };

  const removeQuestion = (id: string) => {
    if (questions.length <= 1) return;
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, field: keyof TestQuestion, value: string | number) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const totalEarned = results.reduce((sum, r) => sum + r.earnedPoints, 0);
  const totalMax = results.reduce((sum, r) => sum + r.maxPoints, 0);
  const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

  const getMkGrade = (pct: number) => {
    if (pct >= 90) return { grade: '5', label: 'Одличен', color: 'text-green-600' };
    if (pct >= 75) return { grade: '4', label: 'Многу добар', color: 'text-blue-600' };
    if (pct >= 60) return { grade: '3', label: 'Добар', color: 'text-yellow-600' };
    if (pct >= 50) return { grade: '2', label: 'Доволен', color: 'text-orange-600' };
    return { grade: '1', label: 'Незадоволителен', color: 'text-red-600' };
  };

  const gradeInfo = getMkGrade(percentage);

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
          <Eye className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">AI Прегледувач на писмени работи</h1>
          <p className="text-gray-500 mt-1">
            Прикачи слика од рачно напишан тест — Gemini 2.5 Pro Vision ги чита одговорите, ги оценува и ги идентификува типичните грешки.
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 text-xs font-bold px-3 py-1 rounded-full">
            <Sparkles className="w-3 h-3" />
            Gemini 2.5 Pro Vision
          </div>
        </div>
      </div>

      {/* Setup Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setExpandedSetup(s => !s)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-violet-600" />
            <span className="font-bold text-gray-900">Поставки за прегледување</span>
            {results.length > 0 && (
              <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Завршено</span>
            )}
          </div>
          {expandedSetup ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {expandedSetup && (
          <div className="p-5 pt-0 space-y-6 border-t border-gray-50">
            {/* Upload Zone */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Слика од тестот</label>
              <div
                ref={dragRef}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  imagePreview
                    ? 'border-violet-300 bg-violet-50/30'
                    : 'border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {imagePreview ? (
                  <div className="space-y-3">
                    <img
                      src={imagePreview}
                      alt="Тест"
                      className="max-h-48 mx-auto rounded-xl shadow-md object-contain"
                    />
                    <p className="text-sm text-violet-700 font-medium">{imageFile?.name}</p>
                    <p className="text-xs text-gray-400">Кликни за промена</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto">
                      <Camera className="w-8 h-8 text-violet-500" />
                    </div>
                    <div>
                      <p className="font-bold text-gray-700">Повлечи или кликни за прикачување</p>
                      <p className="text-sm text-gray-400 mt-1">JPG, PNG, WebP · Максимум 10MB</p>
                    </div>
                    <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Upload className="w-3 h-3" /> Скениран тест</span>
                      <span className="flex items-center gap-1"><Camera className="w-3 h-3" /> Фотографиран тест</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Questions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-bold text-gray-700">Прашања и точни одговори</label>
                <button
                  onClick={addQuestion}
                  className="flex items-center gap-1.5 text-sm text-violet-600 font-bold hover:text-violet-700"
                >
                  <Plus className="w-4 h-4" />
                  Додај прашање
                </button>
              </div>
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="grid grid-cols-12 gap-3 items-start bg-gray-50 rounded-xl p-3">
                    <div className="col-span-1 flex items-center justify-center h-10">
                      <span className="text-sm font-bold text-gray-400">{i + 1}.</span>
                    </div>
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={q.text}
                        onChange={(e) => updateQuestion(q.id, 'text', e.target.value)}
                        placeholder="Текст на прашањето"
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none"
                      />
                    </div>
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={q.correctAnswer}
                        onChange={(e) => updateQuestion(q.id, 'correctAnswer', e.target.value)}
                        placeholder="Точен одговор"
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none"
                      />
                    </div>
                    <div className="col-span-1">
                      <input
                        type="number"
                        value={q.points}
                        onChange={(e) => updateQuestion(q.id, 'points', Number(e.target.value))}
                        min={1}
                        max={100}
                        title="Поени"
                        className="w-full px-2 py-2 text-sm bg-white border border-gray-200 rounded-lg text-center focus:ring-2 focus:ring-violet-300 outline-none"
                      />
                    </div>
                    <div className="col-span-1 flex items-center justify-center h-10">
                      <button
                        onClick={() => removeQuestion(q.id)}
                        disabled={questions.length <= 1}
                        className="p-1.5 text-gray-300 hover:text-red-400 disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Прашања без текст или точен одговор ќе бидат прескокнати.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleGrade}
              disabled={!imageFile || isGrading}
              className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-200"
            >
              {isGrading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  AI ги прегледува одговорите...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  Прегледај со AI Vision
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Summary Card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-32 h-32 flex-shrink-0">
                <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#f3f4f6" strokeWidth="12" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke={percentage >= 60 ? '#8b5cf6' : '#f59e0b'}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 50}`}
                    strokeDashoffset={`${2 * Math.PI * 50 * (1 - percentage / 100)}`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black text-gray-900">{percentage}%</span>
                  <span className="text-xs text-gray-400 font-medium">Точност</span>
                </div>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className={`text-5xl font-black mb-1 ${gradeInfo.color}`}>{gradeInfo.grade}</div>
                <div className="text-xl font-bold text-gray-800">{gradeInfo.label}</div>
                <div className="text-gray-500 mt-1">{totalEarned} / {totalMax} поени</div>
                <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                  <span className="text-xs bg-green-50 text-green-700 font-bold px-3 py-1 rounded-full">
                    {results.filter(r => r.earnedPoints === r.maxPoints).length} целосни
                  </span>
                  <span className="text-xs bg-amber-50 text-amber-700 font-bold px-3 py-1 rounded-full">
                    {results.filter(r => r.earnedPoints > 0 && r.earnedPoints < r.maxPoints).length} делумни
                  </span>
                  <span className="text-xs bg-red-50 text-red-700 font-bold px-3 py-1 rounded-full">
                    {results.filter(r => r.earnedPoints === 0).length} без поени
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Per-Question Results */}
          <div className="space-y-3">
            <h2 className="text-lg font-black text-gray-900 px-1">Резултати по прашање</h2>
            {results.map((r, i) => {
              const qText = questions.find(q => q.id === r.questionId)?.text || `Прашање ${i + 1}`;
              const isFullCredit = r.earnedPoints === r.maxPoints;
              const isZero = r.earnedPoints === 0;
              return (
                <div
                  key={r.questionId}
                  className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                    isFullCredit ? 'border-green-200' : isZero ? 'border-red-100' : 'border-amber-100'
                  }`}
                >
                  <div className={`flex items-center gap-4 p-4 ${
                    isFullCredit ? 'bg-green-50/60' : isZero ? 'bg-red-50/60' : 'bg-amber-50/60'
                  }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isFullCredit ? 'bg-green-100 text-green-600' : isZero ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-600'
                    }`}>
                      {isFullCredit ? <CheckCircle2 className="w-5 h-5" /> : isZero ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Прашање {i + 1}</p>
                      <p className="font-bold text-gray-900 truncate">{qText}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-2xl font-black ${isFullCredit ? 'text-green-600' : isZero ? 'text-red-500' : 'text-amber-600'}`}>
                        {r.earnedPoints}
                      </span>
                      <span className="text-gray-400 font-medium">/{r.maxPoints}</span>
                      <p className="text-xs text-gray-400">поени</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <p className="text-sm text-gray-700 leading-relaxed">{r.feedback}</p>
                    {r.misconception && (
                      <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                        <Brain className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-orange-700 uppercase tracking-wider block mb-0.5">Типична грешка (Misconception)</span>
                          <span className="text-sm text-orange-800">{r.misconception}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Misconception Summary */}
          {results.some(r => r.misconception) && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
              <h3 className="font-bold text-orange-900 flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5" />
                Резиме на типични грешки — за следниот час
              </h3>
              <ul className="space-y-2">
                {results.filter(r => r.misconception).map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-orange-800">
                    <span className="font-bold flex-shrink-0">П{results.indexOf(r) + 1}:</span>
                    {r.misconception}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* New review button */}
          <button
            onClick={() => {
              setImageFile(null);
              setImagePreview(null);
              setResults([]);
              setExpandedSetup(true);
              setError(null);
            }}
            className="w-full py-3 border-2 border-dashed border-gray-200 text-gray-500 font-bold rounded-2xl hover:border-violet-300 hover:text-violet-600 transition-all"
          >
            + Прегледај нов тест
          </button>
        </div>
      )}
    </div>
  );
};
