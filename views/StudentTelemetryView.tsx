import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigation } from '../contexts/NavigationContext';
import {
  fetchTeacherTelemetry, aggregateByStep, aggregateByConcept,
} from '../services/firestoreService.telemetry';
import type { StepTelemetryRecord, StepAggregate } from '../services/firestoreService.telemetry';
import { useCurriculum } from '../hooks/useCurriculum';
import { Loader2, Brain, Clock, AlertCircle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function heatColor(rate: number): string {
  // successRate 0→red, 100→green
  if (rate >= 80) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (rate >= 60) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (rate >= 40) return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

// ─── StepHeatmap ──────────────────────────────────────────────────────────────

function StepHeatmap({ agg, problemText }: { agg: StepAggregate[]; problemText: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 italic truncate">{problemText}</p>
      <div className="flex flex-wrap gap-2">
        {agg.map(s => (
          <div
            key={s.stepIndex}
            className={`flex flex-col items-center px-3 py-2 rounded-xl border text-xs font-semibold min-w-[72px] ${heatColor(s.successRate)}`}
            title={`Чекор ${s.stepIndex + 1}: ${s.sampleCount} ученика`}
          >
            <span className="text-lg font-bold">Ч{s.stepIndex + 1}</span>
            <span>{s.successRate}% ✓</span>
            <span className="opacity-70">{fmtMs(s.avgTimeMs)}</span>
            <span className="opacity-70">{s.avgHints} hints</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ConceptCard ──────────────────────────────────────────────────────────────

interface ConceptCardProps {
  conceptId: string;
  problemText: string;
  avgHints: number;
  avgTime: number;
  hardestStepIndex: number;
  records: StepTelemetryRecord[];
}

function ConceptCard({ conceptId, problemText, avgHints, avgTime, hardestStepIndex, records }: ConceptCardProps) {
  const [open, setOpen] = useState(false);
  const { getConceptDetails } = useCurriculum();
  const { navigate } = useNavigation();
  const { concept, grade } = getConceptDetails(conceptId);
  const agg = aggregateByStep(records);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">
              {concept?.title ?? conceptId}
            </span>
            {grade && (
              <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">
                {grade.level}. одд.
              </span>
            )}
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
              {records.length} записи
            </span>
          </div>
          <div className="flex gap-4 mt-1 text-xs text-gray-500">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmtMs(avgTime)} просечно</span>
            <span className="flex items-center gap-1"><Brain className="w-3 h-3" /> {avgHints} hints/чекор</span>
            <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Нај-тежок: Чекор {hardestStepIndex + 1}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); navigate(`/concept/${conceptId}`); }}
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Концептот
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {open && agg.length > 0 && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">Хитмап по чекори</p>
          <StepHeatmap agg={agg} problemText={problemText} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase">
                <tr>
                  <th className="px-3 py-1.5 text-left">Чекор</th>
                  <th className="px-3 py-1.5 text-right">Примероци</th>
                  <th className="px-3 py-1.5 text-right">Вкупно обиди</th>
                  <th className="px-3 py-1.5 text-right">Просечно време</th>
                  <th className="px-3 py-1.5 text-right">Просечни hints</th>
                  <th className="px-3 py-1.5 text-right">Успех %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {agg.map(s => (
                  <tr key={s.stepIndex} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-semibold">Чекор {s.stepIndex + 1}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{s.sampleCount}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{s.totalAttempts}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{fmtMs(s.avgTimeMs)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{s.avgHints}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${s.successRate >= 70 ? 'text-emerald-600' : s.successRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {s.successRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export const StudentTelemetryView: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [records, setRecords] = useState<StepTelemetryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'hints' | 'time' | 'records'>('hints');

  useEffect(() => {
    if (!firebaseUser?.uid) { setLoading(false); return; }
    let alive = true;
    fetchTeacherTelemetry(firebaseUser.uid)
      .then(r => { if (alive) { setRecords(r); setLoading(false); } })
      .catch(() => { if (alive) { setFetchError('Грешка при вчитување на телеметриски податоци.'); setLoading(false); } });
    return () => { alive = false; };
  }, [firebaseUser?.uid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-red-500">
        <AlertCircle className="w-10 h-10 opacity-60" />
        <p className="font-semibold">{fetchError}</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-gray-400">
        <Brain className="w-12 h-12 opacity-30" />
        <p className="text-lg font-semibold">Сè уште нема телеметриски податоци</p>
        <p className="text-sm text-center max-w-sm">
          Кога учениците ги решаваат задачите чекор-по-чекор во Solver-от, нивните податоци ќе се прикажат тука.
        </p>
      </div>
    );
  }

  const byConcept = aggregateByConcept(records);
  const recordsByConcept = new Map<string, StepTelemetryRecord[]>();
  for (const r of records) {
    const arr = recordsByConcept.get(r.conceptId) ?? [];
    arr.push(r);
    recordsByConcept.set(r.conceptId, arr);
  }

  const sorted = [...byConcept].sort((a, b) => {
    if (sortBy === 'hints') return b.avgHints - a.avgHints;
    if (sortBy === 'time') return b.avgTime - a.avgTime;
    return (recordsByConcept.get(b.conceptId)?.length ?? 0) - (recordsByConcept.get(a.conceptId)?.length ?? 0);
  });

  const totalStudents = new Set(records.map(r => r.studentId)).size;
  const avgHintsOverall = (records.reduce((s, r) => s + r.hintsUsed, 0) / records.length).toFixed(1);
  const avgTimeOverall = fmtMs(Math.round(records.reduce((s, r) => s + r.timeSpentMs, 0) / records.length));

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-500" />
            Когнитивна телеметрија
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Анализа на тешкотиите по чекори — базирана на реални сесии на учениците
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Ученика', value: totalStudents, icon: TrendingUp, color: 'text-indigo-600 bg-indigo-50' },
            { label: 'Просечни hints', value: avgHintsOverall, icon: Brain, color: 'text-amber-600 bg-amber-50' },
            { label: 'Просечно/чекор', value: avgTimeOverall, icon: Clock, color: 'text-blue-600 bg-blue-50' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-2xl p-4 text-center border border-white`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Sort controls */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-gray-500 self-center">Сортирај по:</span>
          {(['hints', 'time', 'records'] as const).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setSortBy(k)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${sortBy === k ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}
            >
              {k === 'hints' ? 'Hints' : k === 'time' ? 'Пообемно' : 'Записи'}
            </button>
          ))}
        </div>

        {/* Concept cards */}
        <div className="space-y-3">
          {sorted.map(c => (
            <ConceptCard
              key={c.conceptId}
              conceptId={c.conceptId}
              problemText={c.problemText}
              avgHints={c.avgHints}
              avgTime={c.avgTime}
              hardestStepIndex={c.hardestStepIndex}
              records={recordsByConcept.get(c.conceptId) ?? []}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
