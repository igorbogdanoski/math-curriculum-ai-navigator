/**
 * S100.1 — Lesson Study Hub
 *
 * Japanese Lesson Study (研究授業 Kenkyuu Jugyou) digital protocol.
 * Teachers document, share, and AI-analyse observations from delivered lessons.
 *
 * Route: /lesson-study
 */

import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Card } from '../components/common/Card';
import {
  fetchObservationsByTeacher,
  submitObservation,
  type ScenarioObservation,
} from '../services/firestoreService.scenarioObservations';
import {
  BookOpen, Plus, Brain, Loader2, Star, TrendingUp, CheckCircle2,
  ChevronDown, ChevronUp, FileText,
} from 'lucide-react';

// ── AI report generation ──────────────────────────────────────────────────────

async function* generateLessonStudyReport(
  observations: ScenarioObservation[],
): AsyncGenerator<string> {
  const { geminiService } = await import('../services/geminiService');
  const summary = observations.map(o =>
    `Сценарио: ${o.scenarioId} | Улога: ${o.role === 'delivered' ? 'реализирал' : 'набљудувал'} | ` +
    `Ниво на ангажираност: ${o.engagementLevel}/5 | ` +
    `Добро: ${o.whatWorked} | Подобрување: ${o.whatToImprove}`,
  ).join('\n');

  const prompt = `Анализирај ги следниве набљудувања од Lesson Study сесии на македонски наставник:\n\n${summary}\n\nГенерирај МОН-компатибилен Lesson Study извештај (до 300 збора, на македонски) со следните делови:\n1. Преглед на реализацијата\n2. Клучни наоди (позитивни и области за подобрување)\n3. Препораки за следен час (Research Lesson)\n4. Кратки заклучоци`;

  yield* geminiService.getChatResponseStream([{ role: 'user', text: prompt }]);
}

// ── New observation form ──────────────────────────────────────────────────────

interface FormState {
  scenarioId: string;
  role: 'delivered' | 'observed';
  whatWorked: string;
  whatToImprove: string;
  engagementLevel: 1 | 2 | 3 | 4 | 5;
  observedGrade: number;
}

const INITIAL_FORM: FormState = {
  scenarioId: '',
  role: 'delivered',
  whatWorked: '',
  whatToImprove: '',
  engagementLevel: 3,
  observedGrade: 8,
};

// ── Main view ─────────────────────────────────────────────────────────────────

export const LessonStudyView: React.FC = () => {
  const { firebaseUser, user } = useAuth();
  const { addNotification } = useNotification();

  const [observations, setObservations] = useState<ScenarioObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);
  const [expandedObs, setExpandedObs] = useState<string | null>(null);
  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    setLoading(true);
    fetchObservationsByTeacher(firebaseUser.uid)
      .then(obs => { if (isMounted.current) { setObservations(obs); setLoading(false); } })
      .catch(() => { if (isMounted.current) setLoading(false); });
  }, [firebaseUser?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !form.scenarioId.trim() || !form.whatWorked.trim()) return;
    setSubmitting(true);
    try {
      await submitObservation({
        ...form,
        authorUid: firebaseUser.uid,
        authorName: user?.name ?? 'Наставник',
        schoolName: user?.schoolName ?? '',
      });
      addNotification('Набљудувањето е зачувано! ✅', 'success');
      setForm(INITIAL_FORM);
      setShowForm(false);
      // Refresh
      const updated = await fetchObservationsByTeacher(firebaseUser.uid);
      if (isMounted.current) setObservations(updated);
    } catch {
      addNotification('Грешка при зачувување.', 'error');
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  const handleGenerateReport = async () => {
    if (observations.length === 0) return;
    setLoadingReport(true);
    setAiReport('');
    try {
      for await (const chunk of generateLessonStudyReport(observations)) {
        if (isMounted.current) setAiReport(prev => prev + chunk);
      }
    } catch {
      if (isMounted.current) setAiReport('Грешка при генерирање на извештај.');
    } finally {
      if (isMounted.current) setLoadingReport(false);
    }
  };

  const engagementLabel = (n: 1 | 2 | 3 | 4 | 5) => ['', 'Пасивни', 'Слаба', 'Средна', 'Добра', 'Одлична'][n];
  const engagementColor = (n: 1 | 2 | 3 | 4 | 5) => n >= 4 ? 'text-green-600' : n === 3 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <Helmet>
        <title>Lesson Study Hub — MisMath AI</title>
        <meta name="description" content="Japanese Lesson Study protocol — набљудувај, анализирај и подобрувај наставата." />
      </Helmet>

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
              🎌 Lesson Study Hub
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Japanese Kenkyuu Jugyou — набљудувај часови, документирај наоди, подобрувај ја наставата.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(s => !s)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl font-semibold text-sm hover:bg-brand-secondary transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Ново набљудување
          </button>
        </div>

        {/* New observation form */}
        {showForm && (
          <Card className="p-5">
            <h2 className="font-black text-slate-700 mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-primary" /> Внеси набљудување
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">ID на сценарио / наслов на час</label>
                  <input
                    type="text"
                    required
                    value={form.scenarioId}
                    onChange={e => setForm(f => ({ ...f, scenarioId: e.target.value }))}
                    placeholder="пр. Линеарни равенки"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Одделение</label>
                  <select
                    value={form.observedGrade}
                    onChange={e => setForm(f => ({ ...f, observedGrade: Number(e.target.value) }))}
                    aria-label="Одделение"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-primary"
                  >
                    {Array.from({ length: 9 }, (_, i) => i + 1).map(g => (
                      <option key={g} value={g}>{g}. одд.</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Улога</label>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as 'delivered' | 'observed' }))}
                    aria-label="Улога на набљудувачот"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-primary"
                  >
                    <option value="delivered">Реализирал</option>
                    <option value="observed">Набљудувал</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-600">Ангажираност на учениците (1–5)</label>
                  <div className="flex gap-1">
                    {([1, 2, 3, 4, 5] as const).map(n => (
                      <button key={n} type="button"
                        onClick={() => setForm(f => ({ ...f, engagementLevel: n }))}
                        className={`flex-1 h-9 rounded-lg text-sm font-bold border transition-colors ${form.engagementLevel === n ? 'bg-brand-primary text-white border-brand-primary' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                      >
                        <Star className={`w-3.5 h-3.5 mx-auto ${n <= form.engagementLevel ? 'text-amber-400 fill-current' : 'text-gray-300'}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-green-700">✓ Што функционираше добро?</label>
                <textarea
                  required
                  value={form.whatWorked}
                  onChange={e => setForm(f => ({ ...f, whatWorked: e.target.value }))}
                  rows={3}
                  placeholder="Учениците беа ангажирани при..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-primary resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-amber-700">⚡ Што би подобриле?</label>
                <textarea
                  value={form.whatToImprove}
                  onChange={e => setForm(f => ({ ...f, whatToImprove: e.target.value }))}
                  rows={2}
                  placeholder="Следниот пат би сменил..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-primary resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 bg-brand-primary text-white rounded-lg font-semibold text-sm hover:bg-brand-secondary transition-colors disabled:bg-gray-400"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin inline" /> : 'Зачувај'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-5 py-2 bg-gray-100 text-gray-600 rounded-lg font-semibold text-sm hover:bg-gray-200 transition-colors"
                >
                  Откажи
                </button>
              </div>
            </form>
          </Card>
        )}

        {/* Observations list */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-slate-700 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Набљудувања ({observations.length})
            </h2>
            {observations.length >= 2 && (
              <button type="button" onClick={handleGenerateReport}
                disabled={loadingReport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400"
              >
                {loadingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                AI Извештај
              </button>
            )}
          </div>

          {loading && (
            <div className="space-y-2 animate-pulse">
              {[1, 2].map(i => <div key={i} className="h-16 bg-slate-100 rounded-xl" />)}
            </div>
          )}

          {!loading && observations.length === 0 && (
            <div className="text-center py-10 text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-500">Нема набљудувања</p>
              <p className="text-sm">Кликни „Ново набљудување" за да почнеш.</p>
            </div>
          )}

          <div className="space-y-2">
            {observations.map(obs => {
              const isOpen = expandedObs === obs.id;
              return (
                <div key={obs.id} className="border border-slate-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedObs(isOpen ? null : obs.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${obs.role === 'delivered' ? 'bg-blue-100' : 'bg-violet-100'}`}>
                      {obs.role === 'delivered' ? '🎓' : '👁'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{obs.scenarioId}</p>
                      <p className="text-xs text-gray-400">{obs.observedGrade}. одд. · {obs.role === 'delivered' ? 'Реализирал' : 'Набљудувал'}</p>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${engagementColor(obs.engagementLevel)}`}>
                      {'★'.repeat(obs.engagementLevel)}{'☆'.repeat(5 - obs.engagementLevel)} {engagementLabel(obs.engagementLevel)}
                    </span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-2 bg-slate-50">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-[11px] font-bold text-green-700 mb-1 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Добро функционираше
                        </p>
                        <p className="text-xs text-green-800 whitespace-pre-wrap">{obs.whatWorked}</p>
                      </div>
                      {obs.whatToImprove && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                          <p className="text-[11px] font-bold text-amber-700 mb-1">⚡ За подобрување</p>
                          <p className="text-xs text-amber-800 whitespace-pre-wrap">{obs.whatToImprove}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* AI Report */}
        {(aiReport || loadingReport) && (
          <Card className="p-5 bg-indigo-50 border-indigo-200">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h2 className="font-black text-indigo-800">МОН Lesson Study Извештај</h2>
            </div>
            {loadingReport && !aiReport && (
              <div className="flex items-center gap-2 text-indigo-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Генерирам извештај…</span>
              </div>
            )}
            {aiReport && (
              <div className="text-sm text-indigo-900 leading-relaxed whitespace-pre-wrap">{aiReport}</div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};
