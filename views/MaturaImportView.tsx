/**
 * MaturaImportView — B2.3
 * PDF matura import pipeline for teachers/admins.
 *
 * Flow:
 *   1. Upload PDF
 *   2. Enter optional metadata hints (year, session, language, track)
 *   3. Gemini OCR extracts questions → structured draft
 *   4. Review table — edit individual fields inline
 *   5. Confirm → save to Firestore via importMaturaFromDraft()
 */

import React, { useState, useRef } from 'react';
import {
  Upload, FileText, Loader2, AlertTriangle, CheckCircle,
  Sparkles, Edit2, Trash2, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { Card } from '../components/common/Card';
import { geminiService, isDailyQuotaKnownExhausted } from '../services/geminiService';
import { importMaturaFromDraft } from '../services/firestoreService.matura';
import type { MaturaImportDraft, MaturaImportQuestion } from '../services/firestoreService.matura';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

type Step = 'upload' | 'review' | 'done';

const SESSIONS = ['june', 'august', 'demo', 'ucilisna'] as const;
const LANGUAGES = ['mk', 'al', 'tr'] as const;
const TRACKS = ['gymnasium', 'vocational4', 'vocational3', 'vocational2', 'gymnasium_elective'] as const;
const TOPIC_AREAS = ['algebra', 'analiza', 'geometrija', 'statistika', 'kombinatorika', 'trigonometrija', 'matrici-vektori', 'broevi', 'logika'] as const;

function generateExamId(draft: Omit<MaturaImportDraft, 'examId' | 'questions'>): string {
  const track = draft.track === 'gymnasium' ? 'gymnasium' : draft.track;
  return `dim-${track}-${draft.year}-${draft.session}-${draft.language}-pdf`;
}

export function MaturaImportView() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('upload');
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Metadata hints (user-entered before extraction)
  const [hintYear, setHintYear] = useState(new Date().getFullYear());
  const [hintSession, setHintSession] = useState<string>('june');
  const [hintLanguage, setHintLanguage] = useState<string>('mk');
  const [hintTrack, setHintTrack] = useState<string>('gymnasium');

  // Extracted draft (editable)
  const [draft, setDraft] = useState<MaturaImportDraft | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Guard: admin/teacher only
  if (!user || (user.role !== 'admin' && user.role !== 'school_admin' && user.role !== 'teacher')) {
    return (
      <div className="p-8 text-center text-gray-500">
        <AlertTriangle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p>Само наставници и администратори можат да увезуваат матурски испити.</p>
      </div>
    );
  }

  // ── Step 1: File selection ────────────────────────────────────────────────────

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setError('Само PDF датотеки се поддржани.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPdfBase64(dataUrl.split(',')[1]);
      setPdfName(file.name);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  // ── Step 2: Extract via Gemini ────────────────────────────────────────────────

  const handleExtract = async () => {
    if (!pdfBase64) return;
    if (isDailyQuotaKnownExhausted()) {
      setError('Дневната AI квота е исцрпена. Обидете се повторно утре.');
      return;
    }
    setIsExtracting(true);
    setError(null);
    try {
      const rawJson = await geminiService.extractMaturaFromPdf(pdfBase64, {
        year: hintYear,
        session: hintSession,
        language: hintLanguage,
        track: hintTrack,
      });

      // Strip markdown fences if present
      const cleaned = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned) as {
        examMeta: Record<string, unknown>;
        questions: MaturaImportQuestion[];
      };

      const meta = parsed.examMeta ?? {};
      const examDraft: MaturaImportDraft = {
        examId: generateExamId({
          year: (meta.year as number) ?? hintYear,
          session: (meta.session as string) ?? hintSession,
          language: (meta.language as string) ?? hintLanguage,
          track: (meta.track as string) ?? hintTrack,
          gradeLevel: (meta.gradeLevel as number) ?? 13,
          durationMinutes: (meta.durationMinutes as number) ?? 120,
          title: (meta.title as string) ?? '',
        }),
        title: (meta.title as string) ?? `ДИМ матура ${hintYear} ${hintSession} (${hintLanguage.toUpperCase()})`,
        year: (meta.year as number) ?? hintYear,
        session: (meta.session as string) ?? hintSession,
        language: (meta.language as string) ?? hintLanguage,
        track: (meta.track as string) ?? hintTrack,
        gradeLevel: (meta.gradeLevel as number) ?? 13,
        durationMinutes: (meta.durationMinutes as number) ?? 120,
        questions: parsed.questions ?? [],
      };

      setDraft(examDraft);
      setStep('review');
    } catch (err: any) {
      setError(`AI не можеше да ги извлече прашањата: ${err.message ?? 'Непозната грешка'}. Обидете се повторно или проверете го PDF-от.`);
    } finally {
      setIsExtracting(false);
    }
  };

  // ── Step 3: Inline editing ────────────────────────────────────────────────────

  const updateDraftField = <K extends keyof MaturaImportDraft>(key: K, value: MaturaImportDraft[K]) => {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
  };

  const updateQuestion = (idx: number, updates: Partial<MaturaImportQuestion>) => {
    if (!draft) return;
    const qs = [...draft.questions];
    qs[idx] = { ...qs[idx], ...updates };
    setDraft({ ...draft, questions: qs });
  };

  const removeQuestion = (idx: number) => {
    if (!draft) return;
    const qs = draft.questions.filter((_, i) => i !== idx);
    setDraft({ ...draft, questions: qs });
  };

  // ── Step 4: Save ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!draft) return;
    setIsSaving(true);
    setError(null);
    try {
      await importMaturaFromDraft(draft);
      setStep('done');
    } catch (err: any) {
      setError(`Зачувувањето не успеа: ${err.message ?? 'Непозната грешка'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-7 h-7 text-violet-600" />
          Увоз на матурски испит (PDF)
        </h1>
        <p className="text-gray-500 mt-1">Прикачи официјален PDF — AI ги извлекува прашањата и ги зачувува во библиотеката.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['upload', 'review', 'done'] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            <span className={`px-3 py-1 rounded-full font-medium ${step === s ? 'bg-violet-600 text-white' : 'bg-slate-100 text-gray-500'}`}>
              {i + 1}. {s === 'upload' ? 'Прикачи PDF' : s === 'review' ? 'Прегледај' : 'Завршено'}
            </span>
            {i < 2 && <span className="text-gray-300">→</span>}
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── STEP: upload ── */}
      {step === 'upload' && (
        <div className="space-y-4">
          <Card className="p-6 bg-slate-50 border-dashed border-2 border-slate-300">
            {!pdfBase64 ? (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-violet-100 rounded-full flex items-center justify-center mx-auto text-violet-600">
                  <Upload className="w-10 h-10" />
                </div>
                <div>
                  <p className="font-semibold text-gray-700">Прикачи PDF матурски испит</p>
                  <p className="text-sm text-gray-500 mt-1">Само PDF, до 10 MB</p>
                </div>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  aria-label="Прикачи PDF"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelected}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-2 bg-violet-600 text-white rounded-lg shadow hover:bg-violet-700 transition"
                >
                  Избери PDF
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800 break-all">{pdfName}</p>
                  <p className="text-xs text-emerald-600">PDF вчитан ✓</p>
                </div>
                <button
                  type="button"
                  aria-label="Отстрани PDF"
                  onClick={() => { setPdfBase64(null); setPdfName(''); }}
                  className="text-gray-400 hover:text-red-500 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </Card>

          {/* Metadata hints */}
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-gray-700 text-sm">Метаподатоци (опционално)</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Година</label>
                <input
                  type="number"
                  aria-label="Година на испит"
                  value={hintYear}
                  onChange={e => setHintYear(Number(e.target.value))}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Сесија</label>
                <select
                  aria-label="Сесија"
                  value={hintSession}
                  onChange={e => setHintSession(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  {SESSIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Јазик</label>
                <select
                  aria-label="Јазик на испит"
                  value={hintLanguage}
                  onChange={e => setHintLanguage(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  {LANGUAGES.map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Трак</label>
                <select
                  aria-label="Образовен трак"
                  value={hintTrack}
                  onChange={e => setHintTrack(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </Card>

          <button
            disabled={!pdfBase64 || isExtracting}
            onClick={handleExtract}
            className="w-full py-4 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl font-bold transition shadow flex items-center justify-center gap-2"
          >
            {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {isExtracting ? 'AI извлекува прашања...' : 'Извлечи прашања'}
          </button>
        </div>
      )}

      {/* ── STEP: review ── */}
      {step === 'review' && draft && (
        <div className="space-y-4">
          {/* Exam header editable */}
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-violet-500" />
              Метаподатоци на испитот
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Наслов</label>
                <input
                  type="text"
                  aria-label="Наслов на испит"
                  value={draft.title}
                  onChange={e => updateDraftField('title', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">ID</label>
                <input
                  type="text"
                  aria-label="Exam ID"
                  value={draft.examId}
                  onChange={e => updateDraftField('examId', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Година</label>
                  <input
                    type="number"
                    aria-label="Година"
                    value={draft.year}
                    onChange={e => updateDraftField('year', Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Траење (мин)</label>
                  <input
                    type="number"
                    aria-label="Траење во минути"
                    value={draft.durationMinutes}
                    onChange={e => updateDraftField('durationMinutes', Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Одделение</label>
                  <input
                    type="number"
                    aria-label="Одделение"
                    value={draft.gradeLevel}
                    onChange={e => updateDraftField('gradeLevel', Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {draft.questions.length} прашања · {draft.questions.reduce((s, q) => s + q.points, 0)} поени
            </p>
          </Card>

          {/* Questions table */}
          <Card className="p-5 space-y-3">
            <h3 className="font-semibold text-gray-700">
              Прашања ({draft.questions.length})
            </h3>
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {draft.questions.map((q, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-violet-600">Q{q.questionNumber} · Дел {q.part} · {q.points}п</span>
                    <button
                      type="button"
                      aria-label={`Отстрани прашање ${q.questionNumber}`}
                      onClick={() => removeQuestion(idx)}
                      className="text-gray-300 hover:text-red-500 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea
                    aria-label={`Текст на прашање ${q.questionNumber}`}
                    value={q.questionText}
                    rows={2}
                    onChange={e => updateQuestion(idx, { questionText: e.target.value })}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400 resize-none"
                  />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Тип</label>
                      <select
                        aria-label={`Тип на прашање ${q.questionNumber}`}
                        value={q.questionType}
                        onChange={e => updateQuestion(idx, { questionType: e.target.value as 'mc' | 'open' })}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                      >
                        <option value="mc">mc</option>
                        <option value="open">open</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Точен одговор</label>
                      <input
                        type="text"
                        aria-label={`Точен одговор за прашање ${q.questionNumber}`}
                        value={q.correctAnswer ?? ''}
                        onChange={e => updateQuestion(idx, { correctAnswer: e.target.value || undefined })}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Тема</label>
                      <select
                        aria-label={`Тема за прашање ${q.questionNumber}`}
                        value={q.topicArea ?? ''}
                        onChange={e => updateQuestion(idx, { topicArea: e.target.value || undefined })}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                      >
                        <option value="">—</option>
                        {TOPIC_AREAS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">DoK</label>
                      <select
                        aria-label={`DoK ниво за прашање ${q.questionNumber}`}
                        value={q.dokLevel ?? ''}
                        onChange={e => updateQuestion(idx, { dokLevel: e.target.value ? Number(e.target.value) : undefined })}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white"
                      >
                        <option value="">—</option>
                        {[1, 2, 3, 4].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Raw JSON toggle */}
          <button
            type="button"
            onClick={() => setShowRawJson(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-violet-600 transition"
          >
            {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showRawJson ? 'Сокриј JSON' : 'Прикажи суров JSON'}
          </button>
          {showRawJson && (
            <pre className="text-xs bg-slate-900 text-green-300 p-4 rounded-lg overflow-x-auto max-h-64">
              {JSON.stringify(draft, null, 2)}
            </pre>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep('upload'); setDraft(null); }}
              className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-slate-50 transition text-sm"
            >
              ← Назад
            </button>
            <button
              type="button"
              disabled={isSaving || draft.questions.length === 0}
              onClick={handleSave}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl font-bold transition shadow flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              {isSaving ? 'Зачувување...' : `Зачувај ${draft.questions.length} прашања во Firestore`}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: done ── */}
      {step === 'done' && draft && (
        <Card className="p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Испитот е успешно увезен!</h2>
          <p className="text-gray-500 text-sm">
            <strong>{draft.title}</strong><br />
            {draft.questions.length} прашања · {draft.questions.reduce((s, q) => s + q.points, 0)} поени
          </p>
          <p className="text-xs text-gray-400 font-mono">{draft.examId}</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => navigate('/matura-library')}
              className="px-5 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition text-sm font-semibold"
            >
              Оди во библиотека →
            </button>
            <button
              type="button"
              onClick={() => { setStep('upload'); setDraft(null); setPdfBase64(null); setPdfName(''); }}
              className="px-5 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-slate-50 transition text-sm"
            >
              Увези нов PDF
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}

export default MaturaImportView;
