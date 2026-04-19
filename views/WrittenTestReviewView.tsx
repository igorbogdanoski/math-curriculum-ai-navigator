import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, Camera, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Brain, Sparkles, ChevronDown, ChevronUp, Trash2, Plus, Eye,
  Users, BarChart3, Flame, User, Wand2, Lightbulb,
} from 'lucide-react';
import { geminiService } from '../services/geminiService';
import { persistScanArtifactWithObservability } from '../services/scanArtifactPersistence';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

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
  correctionHint?: string;
  confidence?: number;
}

interface StudentSubmission {
  id: string;
  name: string;
  file: File;
  preview: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  results?: GradeResult[];
}

interface HeatmapEntry {
  questionId: string;
  questionText: string;
  maxPoints: number;
  avgEarned: number;
  successRate: number;  // 0–1
  misconceptions: string[];
}

type Mode = 'single' | 'batch';

const DEFAULT_QUESTIONS: TestQuestion[] = [
  { id: '1', text: '', points: 10, correctAnswer: '' },
  { id: '2', text: '', points: 10, correctAnswer: '' },
  { id: '3', text: '', points: 10, correctAnswer: '' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function heatColor(rate: number): string {
  if (rate >= 0.8) return 'bg-green-500';
  if (rate >= 0.6) return 'bg-lime-400';
  if (rate >= 0.4) return 'bg-amber-400';
  if (rate >= 0.2) return 'bg-orange-500';
  return 'bg-red-500';
}

function mkGrade(pct: number) {
  if (pct >= 90) return { grade: '5', label: 'Одличен', color: 'text-green-600' };
  if (pct >= 75) return { grade: '4', label: 'Многу добар', color: 'text-blue-600' };
  if (pct >= 60) return { grade: '3', label: 'Добар', color: 'text-yellow-600' };
  if (pct >= 50) return { grade: '2', label: 'Доволен', color: 'text-orange-600' };
  return { grade: '1', label: 'Незадоволителен', color: 'text-red-600' };
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export const WrittenTestReviewView: React.FC = () => {
  const { firebaseUser, user } = useAuth();
  const [mode, setMode] = useState<Mode>('single');

  // Shared state
  const [questions, setQuestions] = useState<TestQuestion[]>(DEFAULT_QUESTIONS);
  const [expandedSetup, setExpandedSetup] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Single mode
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [singleResults, setSingleResults] = useState<GradeResult[]>([]);
  const [isGrading, setIsGrading] = useState(false);

  // Batch mode
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [batchProgress, setBatchProgress] = useState(0);
  const [isBatchGrading, setIsBatchGrading] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const singleInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const extractInputRef = useRef<HTMLInputElement>(null);

  // ── Auto-extract state ──
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const persistTestArtifact = useCallback(async (
    mimeType: string,
    results: GradeResult[],
    meta?: { sourceUrl?: string }
  ) => {
    if (!firebaseUser?.uid || results.length === 0) return;

    const totalEarned = results.reduce((sum, r) => sum + r.earnedPoints, 0);
    const totalMax = results.reduce((sum, r) => sum + r.maxPoints, 0);
    const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
    const feedbackText = results
      .map((r, i) => `П${i + 1}: ${r.feedback}`)
      .join('\n');

    const outcome = await persistScanArtifactWithObservability({
      teacherUid: firebaseUser.uid,
      schoolId: user?.schoolId,
      mode: 'test_grading',
      sourceType: 'image',
      sourceUrl: meta?.sourceUrl,
      mimeType,
      extractedText: feedbackText,
      normalizedText: feedbackText.trim(),
      pedagogicalFeedback: results.map((r, i) => ({
        itemRef: r.questionId || `q-${i + 1}`,
        misconceptionType: r.misconception,
        feedback: r.feedback,
      })),
      gradingSummary: {
        earnedPoints: totalEarned,
        maxPoints: totalMax,
        percentage,
      },
      artifactQuality: {
        score: percentage >= 80 ? 0.9 : percentage >= 60 ? 0.78 : percentage >= 40 ? 0.65 : 0.5,
        label: percentage >= 80 ? 'excellent' : percentage >= 60 ? 'good' : percentage >= 40 ? 'fair' : 'poor',
        truncated: false,
      },
    }, {
      flow: 'written_test_review',
      stage: 'vision_grade_submission',
    });

    if (!outcome.ok) {
      throw outcome.error ?? new Error('scan-artifact-persist-failed');
    }
  }, [firebaseUser?.uid, user?.schoolId]);

  // ── Question helpers ──
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
  const validQuestions = questions.filter(q => q.text.trim() && q.correctAnswer.trim());

  // ── Auto-extract questions from test document ──
  const handleExtractQuestions = useCallback(async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { setExtractError('Максимум 10MB.'); return; }
    setIsExtracting(true);
    setExtractError(null);
    try {
      const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
      const isDocx = file.name.endsWith('.docx') ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      let extracted: Array<{ text: string; correctAnswer: string; points: number }>;

      if (isDocx) {
        const mammoth = await import('mammoth');
        const arrayBuffer = await file.arrayBuffer();
        const { value: text } = await mammoth.extractRawText({ arrayBuffer });
        if (!text.trim()) { setExtractError('Документот е празен.'); return; }
        extracted = await geminiService.extractTestQuestions({ kind: 'text', text });
      } else {
        // image or PDF — both via Gemini inline data
        const dataUrl = await readFileAsDataURL(file);
        const base64 = dataUrl.split(',')[1];
        const mimeType = isPdf ? 'application/pdf' : file.type;
        extracted = await geminiService.extractTestQuestions({ kind: isPdf ? 'pdf' : 'image', base64, mimeType });
      }

      if (!extracted.length) { setExtractError('AI не најде прашања во документот. Провери дали документот е тест.'); return; }
      setQuestions(extracted.map((q, i) => ({ id: String(i + 1), ...q })));
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Грешка при извлекување. Обиди се повторно.');
    } finally {
      setIsExtracting(false);
    }
  }, []);

  // ── Single mode ──
  const handleSingleFile = useCallback(async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    if (!file.type.startsWith('image/') && !isPdf) { setError('Поддржани: слики (JPG, PNG, WebP) и PDF.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Максимум 10MB.'); return; }
    setImageFile(file);
    setError(null);
    setSingleResults([]);
    const preview = await readFileAsDataURL(file);
    setImagePreview(preview);
  }, []);

  const handleSingleGrade = async () => {
    if (!imageFile || !imagePreview) return;
    if (validQuestions.length === 0) { setError('Внесете барем едно прашање со точен одговор.'); return; }
    setIsGrading(true);
    setError(null);
    try {
      const base64 = imagePreview.split(',')[1];
      const mimeType = imageFile.type === 'application/pdf' || imageFile.name.endsWith('.pdf')
        ? 'application/pdf'
        : imageFile.type;
      const results = await geminiService.gradeTestWithVision(
        base64, mimeType,
        validQuestions.map(q => ({ id: q.id, text: q.text, points: q.points, correctAnswer: q.correctAnswer }))
      );
      if (!results.length) {
        throw new Error('AI не врати валидни оценки. Обидете се повторно со појасна фотографија.');
      }
      setSingleResults(results);
      setExpandedSetup(false);
      try {
        await persistTestArtifact(imageFile.type, results);
      } catch (persistErr) {
        logger.warn('Failed to persist written-test artifact', persistErr);
        setError('Оценувањето е успешно, но зачувувањето на артефактот не успеа. Обидете се повторно.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Грешка при прегледувањето. Обидете се повторно.';
      setError(message);
    } finally {
      setIsGrading(false);
    }
  };

  // ── Batch mode ──
  const handleBatchFiles = useCallback(async (files: FileList) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 30);
    if (arr.length === 0) { setError('Изберете слики (JPG, PNG, WebP).'); return; }
    setError(null);
    const newSubs: StudentSubmission[] = await Promise.all(
      arr.map(async (file, i) => ({
        id: crypto.randomUUID(),
        name: `Ученик ${i + 1}`,
        file,
        preview: await readFileAsDataURL(file),
        status: 'pending' as const,
      }))
    );
    setSubmissions(prev => [...prev, ...newSubs]);
  }, []);

  const handleBatchGrade = async () => {
    if (submissions.length === 0 || validQuestions.length === 0) {
      setError('Додајте слики и пополнете ги прашањата.');
      return;
    }
    setIsBatchGrading(true);
    setBatchProgress(0);
    setError(null);

    const qList = validQuestions.map(q => ({ id: q.id, text: q.text, points: q.points, correctAnswer: q.correctAnswer }));

    for (let i = 0; i < submissions.length; i++) {
      const sub = submissions[i];
      setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'processing' } : s));
      try {
        const base64 = sub.preview.split(',')[1];
        const results = await geminiService.gradeTestWithVision(base64, sub.file.type, qList);
        if (!results.length) throw new Error('empty-grades');
        setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'done', results } : s));
        try {
          await persistTestArtifact(sub.file.type, results);
        } catch (persistErr) {
          logger.warn('Failed to persist batch written-test artifact', persistErr);
        }
      } catch {
        setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, status: 'error' } : s));
      }
      setBatchProgress(i + 1);
      // Small delay to respect rate limits
      if (i < submissions.length - 1) await new Promise(r => setTimeout(r, 600));
    }
    setIsBatchGrading(false);
    setExpandedSetup(false);
  };

  // ── Computed class stats ──
  const doneSubmissions = submissions.filter(s => s.status === 'done' && s.results);
  const heatmap: HeatmapEntry[] = validQuestions.map(q => {
    const resultsForQ = doneSubmissions
      .map(s => s.results?.find(r => r.questionId === q.id))
      .filter(Boolean) as GradeResult[];
    const avgEarned = resultsForQ.length
      ? resultsForQ.reduce((sum, r) => sum + r.earnedPoints, 0) / resultsForQ.length
      : 0;
    const maxP = resultsForQ[0]?.maxPoints ?? q.points;
    const misconceptions = resultsForQ.map(r => r.misconception).filter(Boolean) as string[];
    return {
      questionId: q.id,
      questionText: q.text,
      maxPoints: maxP,
      avgEarned,
      successRate: maxP > 0 ? avgEarned / maxP : 0,
      misconceptions,
    };
  });

  const classAvg = doneSubmissions.length
    ? Math.round(doneSubmissions.map(s => {
        const total = s.results!.reduce((sum, r) => sum + r.earnedPoints, 0);
        const max = s.results!.reduce((sum, r) => sum + r.maxPoints, 0);
        return max > 0 ? (total / max) * 100 : 0;
      }).reduce((a, b) => a + b, 0) / doneSubmissions.length)
    : 0;

  const allMisconceptions = heatmap.flatMap(h => h.misconceptions);
  const miscCounts: Record<string, number> = {};
  allMisconceptions.forEach(m => { miscCounts[m] = (miscCounts[m] || 0) + 1; });
  const topMisconceptions = Object.entries(miscCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 sm:p-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
          <Eye className="w-7 h-7 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">AI Прегледувач на писмени работи</h1>
          <p className="text-gray-500 mt-1">Gemini 2.5 Pro Vision ги чита рачно напишаните одговори и ги оценува по прашање.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 bg-violet-50 text-violet-700 text-xs font-bold px-3 py-1 rounded-full">
              <Sparkles className="w-3 h-3" /> Gemini 2.5 Pro Vision
            </div>
            <div className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full">
              <Users className="w-3 h-3" /> До 30 ученика одеднаш
            </div>
          </div>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        {(['single', 'batch'] as Mode[]).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
              mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {m === 'single' ? <><User className="w-4 h-4" /> Поединечно</> : <><Users className="w-4 h-4" /> Класа (до 30)</>}
          </button>
        ))}
      </div>

      {/* Setup Panel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setExpandedSetup(s => !s)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-violet-600" />
            <span className="font-bold text-gray-900">Поставки за прегледување</span>
            {(singleResults.length > 0 || doneSubmissions.length > 0) && (
              <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Завршено</span>
            )}
          </div>
          {expandedSetup ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {expandedSetup && (
          <div className="p-5 pt-0 space-y-6 border-t border-gray-50">

            {/* ── SINGLE upload ── */}
            {mode === 'single' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Слика од тестот</label>
                <div
                  onClick={() => singleInputRef.current?.click()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleSingleFile(f); }}
                  onDragOver={e => e.preventDefault()}
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    imagePreview ? 'border-violet-300 bg-violet-50/30' : 'border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50/20'
                  }`}
                >
                  <input ref={singleInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                    aria-label="Прикачи слика или PDF од тест"
                    onChange={e => e.target.files?.[0] && handleSingleFile(e.target.files[0])} />
                  {imagePreview ? (
                    <div className="space-y-3">
                      {imageFile?.type.startsWith('image/') ? (
                        <img src={imagePreview} alt="Тест" className="max-h-48 mx-auto rounded-xl shadow-md object-contain" />
                      ) : (
                        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
                          <FileText className="w-8 h-8 text-red-500" />
                        </div>
                      )}
                      <p className="text-sm text-violet-700 font-medium">{imageFile?.name}</p>
                      <p className="text-xs text-gray-400">Кликни за промена</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto">
                        <Camera className="w-8 h-8 text-violet-500" />
                      </div>
                      <p className="font-bold text-gray-700">Повлечи или кликни за прикачување</p>
                      <p className="text-sm text-gray-400">JPG, PNG, WebP, PDF · Максимум 10MB</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── BATCH upload ── */}
            {mode === 'batch' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-gray-700">Слики од тестовите ({submissions.length}/30)</label>
                  <button
                    type="button"
                    onClick={() => batchInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-sm text-violet-600 font-bold hover:text-violet-700"
                  >
                    <Upload className="w-4 h-4" /> Додај слики
                  </button>
                  <input ref={batchInputRef} type="file" accept="image/*" multiple className="hidden"
                    aria-label="Прикачи слики за одделението"
                    onChange={e => e.target.files && handleBatchFiles(e.target.files)} />
                </div>

                {submissions.length === 0 ? (
                  <div
                    onClick={() => batchInputRef.current?.click()}
                    onDrop={e => { e.preventDefault(); e.dataTransfer.files && handleBatchFiles(e.dataTransfer.files); }}
                    onDragOver={e => e.preventDefault()}
                    className="border-2 border-dashed border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50/20 rounded-2xl p-10 text-center cursor-pointer transition-all"
                  >
                    <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                      <Users className="w-8 h-8 text-violet-500" />
                    </div>
                    <p className="font-bold text-gray-700">Избери до 30 слики одеднаш</p>
                    <p className="text-sm text-gray-400 mt-1">Секоја слика = еден ученик</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto pr-1">
                    {submissions.map((sub, i) => (
                      <div key={sub.id} className="relative group">
                        <img src={sub.preview} alt={sub.name}
                          className={`w-full h-24 object-cover rounded-xl border-2 ${
                            sub.status === 'done' ? 'border-green-400' :
                            sub.status === 'error' ? 'border-red-400' :
                            sub.status === 'processing' ? 'border-violet-400 animate-pulse' :
                            'border-gray-200'
                          }`} />
                        <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                          sub.status === 'done' ? 'bg-green-500 text-white' :
                          sub.status === 'error' ? 'bg-red-500 text-white' :
                          sub.status === 'processing' ? 'bg-violet-500 text-white' :
                          'bg-gray-300 text-gray-600'
                        }`}>
                          {sub.status === 'done' ? '✓' : sub.status === 'error' ? '!' : sub.status === 'processing' ? '…' : i + 1}
                        </div>
                        <input
                          type="text"
                          value={sub.name}
                          onChange={e => setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, name: e.target.value } : s))}
                          className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:border-violet-400"
                          placeholder="Назив"
                        />
                        <button
                          type="button"
                          title="Избриши ученик"
                          onClick={() => setSubmissions(prev => prev.filter(s => s.id !== sub.id))}
                          className="absolute top-1 left-1 w-5 h-5 bg-white/80 rounded-full hidden group-hover:flex items-center justify-center text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Batch progress */}
                {isBatchGrading && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm font-bold text-violet-700 mb-2">
                      <span>Прегледувам {batchProgress}/{submissions.length}...</span>
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-violet-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(batchProgress / submissions.length) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Questions ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-gray-700">Прашања и точни одговори</label>
                <button type="button" onClick={addQuestion}
                  className="flex items-center gap-1.5 text-sm text-violet-600 font-bold hover:text-violet-700">
                  <Plus className="w-4 h-4" /> Додај
                </button>
              </div>

              {/* Auto-extract banner */}
              <div className="mb-3 flex items-center gap-3 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5">
                <Wand2 className="w-4 h-4 text-violet-500 shrink-0" />
                <p className="text-xs text-violet-700 flex-1">
                  <span className="font-bold">Увези автоматски</span> — прикачи слика, PDF или Word од тестот и AI ги пополнува прашањата
                </p>
                <input
                  ref={extractInputRef}
                  type="file"
                  accept="image/*,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  aria-label="Увези прашања од документ"
                  onChange={e => e.target.files?.[0] && handleExtractQuestions(e.target.files[0])}
                />
                <button
                  type="button"
                  onClick={() => extractInputRef.current?.click()}
                  disabled={isExtracting}
                  className="flex items-center gap-1.5 text-xs font-bold bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition disabled:opacity-60 shrink-0"
                >
                  {isExtracting
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Извлекува…</>
                    : <><Wand2 className="w-3 h-3" /> Увези</>}
                </button>
              </div>
              {extractError && (
                <div className="mb-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {extractError}
                </div>
              )}

              <div className="space-y-2">
                {questions.map((q, i) => (
                  <div key={q.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl px-3 py-2">
                    <span className="col-span-1 text-xs font-bold text-gray-400 text-center">{i + 1}.</span>
                    <input type="text" value={q.text} onChange={e => updateQuestion(q.id, 'text', e.target.value)}
                      placeholder="Текст на прашањето"
                      className="col-span-5 px-2 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-300 outline-none" />
                    <input type="text" value={q.correctAnswer} onChange={e => updateQuestion(q.id, 'correctAnswer', e.target.value)}
                      placeholder="Точен одговор"
                      className="col-span-4 px-2 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-300 outline-none" />
                    <input type="number" value={q.points} onChange={e => updateQuestion(q.id, 'points', Number(e.target.value))}
                      min={1} max={100} title="Поени"
                      className="col-span-1 px-1 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-center focus:ring-2 focus:ring-violet-300 outline-none" />
                    <button type="button" title="Избриши прашање" onClick={() => removeQuestion(q.id)} disabled={questions.length <= 1}
                      className="col-span-1 p-1 text-gray-300 hover:text-red-400 disabled:opacity-30 flex justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            {/* Grade button */}
            {mode === 'single' ? (
              <button type="button" onClick={handleSingleGrade} disabled={!imageFile || isGrading}
                className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-200">
                {isGrading ? <><Loader2 className="w-5 h-5 animate-spin" /> AI ги прегледува одговорите...</> : <><Brain className="w-5 h-5" /> Прегледај со AI Vision</>}
              </button>
            ) : (
              <button type="button" onClick={handleBatchGrade} disabled={submissions.length === 0 || isBatchGrading}
                className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-200">
                {isBatchGrading
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Прегледувам {batchProgress}/{submissions.length}...</>
                  : <><Users className="w-5 h-5" /> Прегледај ги сите {submissions.length} ученици</>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════ SINGLE RESULTS ═══════════════ */}
      {mode === 'single' && singleResults.length > 0 && (
        <SingleResults results={singleResults} questions={validQuestions} />
      )}

      {/* ═══════════════ BATCH RESULTS ═══════════════ */}
      {mode === 'batch' && doneSubmissions.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

          {/* Class Summary */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" /> Резиме на класата
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-indigo-50 rounded-xl">
                <p className="text-3xl font-black text-indigo-600">{doneSubmissions.length}</p>
                <p className="text-xs font-bold text-indigo-500 mt-1">Прегледани</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-xl">
                <p className={`text-3xl font-black ${classAvg >= 70 ? 'text-green-600' : classAvg >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{classAvg}%</p>
                <p className="text-xs font-bold text-gray-500 mt-1">Просек на класата</p>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-xl">
                <p className="text-3xl font-black text-green-600">
                  {doneSubmissions.filter(s => {
                    const total = s.results!.reduce((sum, r) => sum + r.earnedPoints, 0);
                    const max = s.results!.reduce((sum, r) => sum + r.maxPoints, 0);
                    return max > 0 && (total / max) >= 0.8;
                  }).length}
                </p>
                <p className="text-xs font-bold text-green-600 mt-1">Над 80%</p>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-xl">
                <p className="text-3xl font-black text-red-600">
                  {doneSubmissions.filter(s => {
                    const total = s.results!.reduce((sum, r) => sum + r.earnedPoints, 0);
                    const max = s.results!.reduce((sum, r) => sum + r.maxPoints, 0);
                    return max > 0 && (total / max) < 0.5;
                  }).length}
                </p>
                <p className="text-xs font-bold text-red-600 mt-1">Под 50%</p>
              </div>
            </div>
          </div>

          {/* Misconception Heatmap */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-lg font-black text-gray-900 mb-2 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" /> Heatmap на успешност по прашање
            </h2>
            <p className="text-xs text-gray-400 mb-4">Процент на точни одговори — темно-зелено = добро, темно-црвено = проблематично</p>
            <div className="space-y-3">
              {heatmap.map((h, i) => (
                <div key={h.questionId} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-gray-400 w-6 flex-shrink-0">П{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-700 truncate mb-1">{h.questionText || `Прашање ${i + 1}`}</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div className={`h-4 rounded-full transition-all duration-700 ${heatColor(h.successRate)}`}
                          style={{ width: `${Math.round(h.successRate * 100)}%` }} />
                      </div>
                      <span className="text-xs font-black text-gray-700 w-10 text-right flex-shrink-0">
                        {Math.round(h.successRate * 100)}%
                      </span>
                    </div>
                    {h.misconceptions.length > 0 && (
                      <p className="text-[10px] text-orange-600 mt-0.5 truncate">
                        ⚠ {h.misconceptions[0]}{h.misconceptions.length > 1 ? ` +${h.misconceptions.length - 1}` : ''}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-[10px] text-gray-400 font-bold">ЛЕГЕНДА:</span>
              {[['bg-green-500', '80–100%'], ['bg-lime-400', '60–80%'], ['bg-amber-400', '40–60%'], ['bg-orange-500', '20–40%'], ['bg-red-500', '0–20%']].map(([cls, lbl]) => (
                <div key={lbl} className="flex items-center gap-1">
                  <div className={`w-3 h-3 rounded-sm ${cls}`} />
                  <span className="text-[10px] text-gray-500">{lbl}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Misconceptions */}
          {topMisconceptions.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
              <h3 className="font-bold text-orange-900 flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5" /> Најчести misconceptions во класата — за следниот час
              </h3>
              <ol className="space-y-2">
                {topMisconceptions.map(([m, count], i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-orange-800">
                    <span className="font-black text-orange-500 flex-shrink-0">{i + 1}.</span>
                    <span className="flex-1">{m}</span>
                    <span className="text-xs bg-orange-200 text-orange-800 font-bold px-2 py-0.5 rounded-full flex-shrink-0">{count}x</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Individual results */}
          <div>
            <h2 className="text-lg font-black text-gray-900 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" /> Резултати по ученик
            </h2>
            <div className="space-y-2">
              {doneSubmissions.map(sub => {
                const total = sub.results!.reduce((sum, r) => sum + r.earnedPoints, 0);
                const max = sub.results!.reduce((sum, r) => sum + r.maxPoints, 0);
                const pct = max > 0 ? Math.round((total / max) * 100) : 0;
                const gi = mkGrade(pct);
                const isExpanded = expandedStudent === sub.id;
                return (
                  <div key={sub.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedStudent(isExpanded ? null : sub.id)}
                      className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                    >
                      <img src={sub.preview} alt={sub.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-bold text-gray-900 truncate">{sub.name}</p>
                        <p className="text-xs text-gray-400">{total}/{max} поени</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xl font-black ${gi.color}`}>{gi.grade}</span>
                        <span className="text-gray-400 text-sm ml-1">{pct}%</span>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    </button>
                    {isExpanded && (
                      <div className="border-t border-gray-50 p-4 space-y-2 bg-gray-50/50">
                        {sub.results!.map((r, ri) => (
                          <div key={r.questionId} className={`p-3 rounded-xl border ${r.earnedPoints === r.maxPoints ? 'border-green-100 bg-green-50/50' : r.earnedPoints === 0 ? 'border-red-100 bg-red-50/50' : 'border-amber-100 bg-amber-50/50'}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-gray-500">П{ri + 1}</span>
                              <div className="flex items-center gap-1.5">
                                {r.confidence !== undefined && (
                                  <span
                                    title={`AI сигурност: ${Math.round(r.confidence * 100)}%`}
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                      r.confidence >= 0.85 ? 'bg-green-100 text-green-700' :
                                      r.confidence >= 0.6  ? 'bg-amber-100 text-amber-700' :
                                      'bg-red-100 text-red-600'
                                    }`}
                                  >
                                    {Math.round(r.confidence * 100)}%
                                  </span>
                                )}
                                <span className="text-sm font-black text-gray-700">{r.earnedPoints}/{r.maxPoints}</span>
                              </div>
                            </div>
                            <p className="text-xs text-gray-600">{r.feedback}</p>
                            {r.misconception && (
                              <p className="text-[10px] text-orange-600 mt-1">⚠ {r.misconception}</p>
                            )}
                            {r.correctionHint && r.earnedPoints < r.maxPoints && (
                              <p className="text-[10px] text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 mt-1">💡 {r.correctionHint}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reset */}
          <button
            type="button"
            onClick={() => { setSubmissions([]); setSingleResults([]); setExpandedSetup(true); setError(null); setBatchProgress(0); }}
            className="w-full py-3 border-2 border-dashed border-gray-200 text-gray-500 font-bold rounded-2xl hover:border-violet-300 hover:text-violet-600 transition-all"
          >
            + Прегледај нов тест
          </button>
        </div>
      )}
    </div>
  );
};

// ── Single Results (extracted for clarity) ────────────────────────────────────

const SingleResults: React.FC<{ results: GradeResult[]; questions: TestQuestion[] }> = ({ results, questions }) => {
  const totalEarned = results.reduce((sum, r) => sum + r.earnedPoints, 0);
  const totalMax = results.reduce((sum, r) => sum + r.maxPoints, 0);
  const percentage = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;

  const getMkGrade = (pct: number) => {
    if (pct >= 90) return { grade: '5', label: 'Одличен', color: 'text-green-600', stroke: '#10b981' };
    if (pct >= 75) return { grade: '4', label: 'Многу добар', color: 'text-blue-600', stroke: '#3b82f6' };
    if (pct >= 60) return { grade: '3', label: 'Добар', color: 'text-yellow-600', stroke: '#eab308' };
    if (pct >= 50) return { grade: '2', label: 'Доволен', color: 'text-orange-600', stroke: '#f97316' };
    return { grade: '1', label: 'Незадоволителен', color: 'text-red-600', stroke: '#ef4444' };
  };
  const gi = getMkGrade(percentage);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-32 h-32 flex-shrink-0">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#f3f4f6" strokeWidth="12" />
              <circle cx="60" cy="60" r="50" fill="none" stroke={gi.stroke} strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - percentage / 100)}`}
                className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-gray-900">{percentage}%</span>
              <span className="text-xs text-gray-400 font-medium">Точност</span>
            </div>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className={`text-5xl font-black mb-1 ${gi.color}`}>{gi.grade}</div>
            <div className="text-xl font-bold text-gray-800">{gi.label}</div>
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

      <div className="space-y-3">
        {results.map((r, i) => {
          const qText = questions.find(q => q.id === r.questionId)?.text || `Прашање ${i + 1}`;
          const isOk = r.earnedPoints === r.maxPoints;
          const isZero = r.earnedPoints === 0;
          return (
            <div key={r.questionId} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${isOk ? 'border-green-200' : isZero ? 'border-red-100' : 'border-amber-100'}`}>
              <div className={`flex items-center gap-4 p-4 ${isOk ? 'bg-green-50/60' : isZero ? 'bg-red-50/60' : 'bg-amber-50/60'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isOk ? 'bg-green-100 text-green-600' : isZero ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-600'}`}>
                  {isOk ? <CheckCircle2 className="w-5 h-5" /> : isZero ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-500 uppercase tracking-wider">Прашање {i + 1}</p>
                  <p className="font-bold text-gray-900 truncate">{qText}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-2xl font-black ${isOk ? 'text-green-600' : isZero ? 'text-red-500' : 'text-amber-600'}`}>{r.earnedPoints}</span>
                  <span className="text-gray-400 font-medium">/{r.maxPoints}</span>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-gray-700 leading-relaxed flex-1">{r.feedback}</p>
                  {r.confidence !== undefined && (
                    <span
                      title={`AI сигурност при читање на рачниот пис: ${Math.round(r.confidence * 100)}%`}
                      className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        r.confidence >= 0.85 ? 'bg-green-100 text-green-700' :
                        r.confidence >= 0.6  ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-600'
                      }`}
                    >
                      {Math.round(r.confidence * 100)}% читливост
                    </span>
                  )}
                </div>
                {r.misconception && (
                  <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                    <Brain className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-orange-700 uppercase tracking-wider block mb-0.5">Misconception</span>
                      <span className="text-sm text-orange-800">{r.misconception}</span>
                    </div>
                  </div>
                )}
                {r.correctionHint && r.earnedPoints < r.maxPoints && (
                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <Lightbulb className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-blue-700 uppercase tracking-wider block mb-0.5">Совет за исправка</span>
                      <span className="text-sm text-blue-800">{r.correctionHint}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {results.some(r => r.misconception) && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5">
          <h3 className="font-bold text-orange-900 flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5" /> Misconceptions — за следниот час
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
    </div>
  );
};
