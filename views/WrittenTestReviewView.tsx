import React, { useRef } from 'react';
import {
  Upload, Camera, FileText, Loader2, AlertTriangle,
  Brain, Sparkles, ChevronDown, ChevronUp, Trash2, Plus, Eye,
  Users, User, Wand2, RotateCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CloudImportMenu } from '../components/common/CloudImportMenu';
import { useTestGrading } from '../hooks/useTestGrading';
import { SingleResults } from '../components/writtentest/SingleResults';
import { BatchResultsPanel } from '../components/writtentest/BatchResultsPanel';
import type { Mode, GradeResult, StudentSubmission } from '../components/writtentest/testGradingTypes';

// ── Component ─────────────────────────────────────────────────────────────────

export const WrittenTestReviewView: React.FC = () => {
  const { firebaseUser, user } = useAuth();
  const g = useTestGrading({ firebaseUid: firebaseUser?.uid, schoolId: user?.schoolId });

  const singleInputRef = useRef<HTMLInputElement>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);
  const extractInputRef = useRef<HTMLInputElement>(null);

  // ── Computed class stats ──
  const doneSubmissions = g.submissions.filter(
    (s): s is StudentSubmission & { results: NonNullable<StudentSubmission['results']> } => s.status === 'done' && !!s.results
  );
  const heatmap = g.validQuestions.map(q => {
    const resultsForQ = doneSubmissions
      .map(s => s.results.find(r => r.questionId === q.id))
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
        const total = s.results.reduce((sum, r) => sum + r.earnedPoints, 0);
        const max = s.results.reduce((sum, r) => sum + r.maxPoints, 0);
        return max > 0 ? (total / max) * 100 : 0;
      }).reduce((a, b) => a + b, 0) / doneSubmissions.length)
    : 0;

  const allMisconceptions = heatmap.flatMap(h => h.misconceptions);
  const miscCounts: Record<string, number> = {};
  allMisconceptions.forEach(m => { miscCounts[m] = (miscCounts[m] || 0) + 1; });
  const topMisconceptions = Object.entries(miscCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5) as [string, number][];

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
            onClick={() => { g.setMode(m); g.setError(null); }}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-sm transition-all ${
              g.mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
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
          onClick={() => g.setExpandedSetup(s => !s)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-violet-600" />
            <span className="font-bold text-gray-900">Поставки за прегледување</span>
            {(g.singleResults.length > 0 || doneSubmissions.length > 0) && (
              <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">Завршено</span>
            )}
          </div>
          {g.expandedSetup ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
        </button>

        {g.expandedSetup && (
          <div className="p-5 pt-0 space-y-6 border-t border-gray-50">

            {/* ── SINGLE upload ── */}
            {g.mode === 'single' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">Слика од тестот</label>
                <div
                  onClick={() => singleInputRef.current?.click()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) g.handleSingleFile(f); }}
                  onDragOver={e => e.preventDefault()}
                  className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    g.imagePreview ? 'border-violet-300 bg-violet-50/30' : 'border-gray-200 bg-gray-50 hover:border-violet-300 hover:bg-violet-50/20'
                  }`}
                >
                  <input ref={singleInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                    aria-label="Прикачи слика или PDF од тест"
                    onChange={e => e.target.files?.[0] && g.handleSingleFile(e.target.files[0])} />
                  {g.imagePreview ? (
                    <div className="space-y-3">
                      {g.imageFile?.type.startsWith('image/') ? (
                        <img src={g.imagePreview} alt="Тест" className="max-h-48 mx-auto rounded-xl shadow-md object-contain" />
                      ) : (
                        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto">
                          <FileText className="w-8 h-8 text-red-500" />
                        </div>
                      )}
                      <p className="text-sm text-violet-700 font-medium">{g.imageFile?.name}</p>
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
                <div className="flex justify-center mt-3">
                  <CloudImportMenu variant="light" onFileSelected={g.handleSingleFile} onError={g.setError} />
                </div>
              </div>
            )}

            {/* ── BATCH upload ── */}
            {g.mode === 'batch' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-bold text-gray-700">Слики од тестовите ({g.submissions.length}/30)</label>
                  <button
                    type="button"
                    onClick={() => batchInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-sm text-violet-600 font-bold hover:text-violet-700"
                  >
                    <Upload className="w-4 h-4" /> Додај слики
                  </button>
                  <input ref={batchInputRef} type="file" accept="image/*" multiple className="hidden"
                    aria-label="Прикачи слики за одделението"
                    onChange={e => e.target.files && g.handleBatchFiles(e.target.files)} />
                </div>

                {g.submissions.length === 0 ? (
                  <div
                    onClick={() => batchInputRef.current?.click()}
                    onDrop={e => { e.preventDefault(); e.dataTransfer.files && g.handleBatchFiles(e.dataTransfer.files); }}
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
                    {g.submissions.map((sub, i) => (
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
                          onChange={e => g.setSubmissions(prev => prev.map(s => s.id === sub.id ? { ...s, name: e.target.value } : s))}
                          className="mt-1 w-full text-xs border border-gray-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:border-violet-400"
                          placeholder="Назив"
                        />
                        <button
                          type="button"
                          title="Избриши ученик"
                          onClick={() => g.setSubmissions(prev => prev.filter(s => s.id !== sub.id))}
                          className="absolute top-1 left-1 w-5 h-5 bg-white/80 rounded-full hidden group-hover:flex items-center justify-center text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        {sub.status === 'error' && (
                          <button
                            type="button"
                            title="Обиди се повторно"
                            onClick={() => g.handleRetryOne(sub.id)}
                            disabled={g.isBatchGrading}
                            className="absolute bottom-1 right-1 flex items-center gap-1 px-1.5 py-0.5 bg-red-600 text-white rounded-full text-[10px] font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
                          >
                            <RotateCw className="w-2.5 h-2.5" /> Повтори
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Batch progress */}
                {g.isBatchGrading && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm font-bold text-violet-700 mb-2">
                      <span>Прегледувам {g.batchProgress}/{g.submissions.length}...</span>
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-violet-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${(g.batchProgress / g.submissions.length) * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Questions ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-gray-700">Прашања и точни одговори</label>
                <button type="button" onClick={g.addQuestion}
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
                  onChange={e => e.target.files?.[0] && g.handleExtractQuestions(e.target.files[0])}
                />
                <button
                  type="button"
                  onClick={() => extractInputRef.current?.click()}
                  disabled={g.isExtracting}
                  className="flex items-center gap-1.5 text-xs font-bold bg-violet-600 text-white px-3 py-1.5 rounded-lg hover:bg-violet-700 transition disabled:opacity-60 shrink-0"
                >
                  {g.isExtracting
                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Извлекува…</>
                    : <><Wand2 className="w-3 h-3" /> Увези</>}
                </button>
              </div>
              {g.extractError && (
                <div className="mb-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {g.extractError}
                </div>
              )}

              <div className="space-y-2">
                {g.questions.map((q, i) => (
                  <div key={q.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl px-3 py-2">
                    <span className="col-span-1 text-xs font-bold text-gray-400 text-center">{i + 1}.</span>
                    <input type="text" value={q.text} onChange={e => g.updateQuestion(q.id, 'text', e.target.value)}
                      placeholder="Текст на прашањето"
                      className="col-span-5 px-2 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-300 outline-none" />
                    <input type="text" value={q.correctAnswer} onChange={e => g.updateQuestion(q.id, 'correctAnswer', e.target.value)}
                      placeholder="Точен одговор"
                      className="col-span-4 px-2 py-1.5 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-violet-300 outline-none" />
                    <input type="number" value={q.points} onChange={e => g.updateQuestion(q.id, 'points', Number(e.target.value))}
                      min={1} max={100} title="Поени"
                      className="col-span-1 px-1 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-center focus:ring-2 focus:ring-violet-300 outline-none" />
                    <button type="button" title="Избриши прашање" onClick={() => g.removeQuestion(q.id)} disabled={g.questions.length <= 1}
                      className="col-span-1 p-1 text-gray-300 hover:text-red-400 disabled:opacity-30 flex justify-center">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {g.error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {g.error}
              </div>
            )}

            {/* Grade button */}
            {g.mode === 'single' ? (
              <button type="button" onClick={g.handleSingleGrade} disabled={!g.imageFile || g.isGrading}
                className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-200">
                {g.isGrading ? <><Loader2 className="w-5 h-5 animate-spin" /> AI ги прегледува одговорите...</> : <><Brain className="w-5 h-5" /> Прегледај со AI Vision</>}
              </button>
            ) : (
              <button type="button" onClick={g.handleBatchGrade} disabled={g.submissions.length === 0 || g.isBatchGrading}
                className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold hover:from-violet-700 hover:to-purple-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-violet-200">
                {g.isBatchGrading
                  ? <><Loader2 className="w-5 h-5 animate-spin" /> Прегледувам {g.batchProgress}/{g.submissions.length}...</>
                  : <><Users className="w-5 h-5" /> Прегледај ги сите {g.submissions.length} ученици</>}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════ SINGLE RESULTS ═══════════════ */}
      {g.mode === 'single' && g.singleResults.length > 0 && (
        <SingleResults results={g.singleResults} questions={g.validQuestions} />
      )}

      {/* ═══════════════ BATCH RESULTS ═══════════════ */}
      {g.mode === 'batch' && doneSubmissions.length > 0 && (
        <BatchResultsPanel
          doneSubmissions={doneSubmissions}
          heatmap={heatmap}
          classAvg={classAvg}
          topMisconceptions={topMisconceptions}
          onReset={g.resetAll}
        />
      )}
    </div>
  );
};
