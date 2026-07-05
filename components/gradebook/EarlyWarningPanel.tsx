import React, { useRef, useEffect, useState } from 'react';
import {
  Zap, AlertTriangle, MessageCircle, Smartphone, Share2, Copy, Brain,
  Loader2, ChevronDown, ChevronUp, X, Sparkles,
} from 'lucide-react';
import type { GradeEntry } from '../../types';
import type { ParentSharing } from '../../hooks/useParentSharing';

interface EarlyWarningPanelProps {
  entries: GradeEntry[];
  gradeLevel: number;
  className: string;
  sharing: ParentSharing;
}

/** Flags students with ≥3 results below 50% and offers an AI-generated intervention plan. */
export const EarlyWarningPanel: React.FC<EarlyWarningPanelProps> = ({ entries, gradeLevel, className, sharing }) => {
  const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([]);
  const [warningIntervention, setWarningIntervention] = useState<Record<string, string>>({});
  const [loadingIntervention, setLoadingIntervention] = useState<string | null>(null);
  const [expandedWarning, setExpandedWarning] = useState<string | null>(null);

  const isMounted = useRef(true);
  useEffect(() => { return () => { isMounted.current = false; }; }, []);

  const studentGroups = entries.reduce<Record<string, GradeEntry[]>>((acc, e) => {
    if (!acc[e.studentName]) acc[e.studentName] = [];
    acc[e.studentName].push(e);
    return acc;
  }, {});

  const earlyWarningStudents = Object.entries(studentGroups)
    .filter(([, se]) => se.filter(e => e.percentage < 50).length >= 3)
    .map(([name, se]) => ({
      name,
      lowCount: se.filter(e => e.percentage < 50).length,
      avgPct: Math.round(se.reduce((sum, e) => sum + e.percentage, 0) / se.length),
      tests: se.map(e => `${e.testTitle}: ${e.percentage}%`),
    }))
    .filter(s => !dismissedWarnings.includes(s.name));

  const handleIntervention = async (studentName: string, tests: string[]) => {
    setLoadingIntervention(studentName);
    setExpandedWarning(studentName);
    try {
      const { geminiService } = await import('../../services/geminiService');
      const prompt = `Наставник по математика, одделение ${gradeLevel} (${className || 'класа'}), пријавува ученик "${studentName}" со следниве резултати: ${tests.join(', ')}.

Ученикот има ≥3 резултати под 50%. Генерирај конкретен план за интервенција (4-5 точки) на македонски јазик. Вклучи:
1. Можни причини за слабиот успех
2. Диференцирани стратегии за поддршка
3. Препорака за родителска средба
4. Конкретна активност за следниот час

Биди практичен и охрабрувачки.`;

      let text = '';
      for await (const chunk of geminiService.getChatResponseStream([{ role: 'user', text: prompt }])) {
        text += chunk;
        if (isMounted.current) setWarningIntervention(prev => ({ ...prev, [studentName]: text }));
      }
    } catch {
      if (isMounted.current) setWarningIntervention(prev => ({ ...prev, [studentName]: 'Грешка при генерирање на планот.' }));
    } finally {
      if (isMounted.current) setLoadingIntervention(null);
    }
  };

  if (earlyWarningStudents.length === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-red-200 bg-red-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-red-100 bg-red-100/50">
        <div className="w-9 h-9 bg-red-500 text-white rounded-xl flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-red-900 flex items-center gap-2">
            Рано предупредување — {earlyWarningStudents.length} {earlyWarningStudents.length === 1 ? 'ученик' : 'ученици'} во ризик
          </h3>
          <p className="text-xs text-red-700 mt-0.5">≥3 резултати под 50% · препорачана педагошка интервенција</p>
        </div>
        <span className="text-[10px] bg-red-200 text-red-800 font-bold px-2 py-1 rounded-full uppercase tracking-wider flex-shrink-0">
          AI Early Warning
        </span>
      </div>

      <div className="p-4 space-y-3">
        {earlyWarningStudents.map(student => {
          const isExpanded = expandedWarning === student.name;
          const intervention = warningIntervention[student.name];
          const loading = loadingIntervention === student.name;
          return (
            <div key={student.name} className="bg-white rounded-xl border border-red-100 overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{student.name}</p>
                  <p className="text-xs text-gray-500">
                    {student.lowCount} резултати под 50% · Просек: <span className="font-bold text-red-600">{student.avgPct}%</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => sharing.handleShareWhatsApp(student.name, student.avgPct, student.tests)}
                    title="Сподели на WhatsApp"
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-lg hover:bg-green-100 transition-all"
                  >
                    <MessageCircle className="w-3 h-3" />
                    WA
                  </button>
                  <button
                    type="button"
                    onClick={() => sharing.handleShareViber(student.name, student.avgPct, student.tests)}
                    title="Сподели на Viber"
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-50 border border-violet-200 text-violet-700 text-xs font-bold rounded-lg hover:bg-violet-100 transition-all"
                  >
                    <Smartphone className="w-3 h-3" />
                    Viber
                  </button>
                  <button
                    type="button"
                    onClick={() => sharing.handleCopyParentLink(student.name)}
                    title="Копирај линк"
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-all"
                  >
                    {sharing.copiedParent === student.name ? <Copy className="w-3 h-3 text-green-600" /> : <Share2 className="w-3 h-3" />}
                    {sharing.copiedParent === student.name ? '✓' : 'Линк'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleIntervention(student.name, student.tests)}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 transition-all"
                  >
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
                    Интервенција
                  </button>
                  {intervention && (
                    <button
                      type="button"
                      title={isExpanded ? 'Сокриј' : 'Прикажи'}
                      aria-label={isExpanded ? 'Сокриј план за интервенција' : 'Прикажи план за интервенција'}
                      onClick={() => setExpandedWarning(isExpanded ? null : student.name)}
                      className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                  <button
                    type="button"
                    title="Отфрли предупредување"
                    aria-label="Отфрли предупредување за ученик"
                    onClick={() => setDismissedWarnings(prev => [...prev, student.name])}
                    className="p-1.5 text-gray-300 hover:text-gray-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Intervention plan */}
              {(loading || intervention) && isExpanded && (
                <div className="px-4 pb-4">
                  <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                    {loading && !intervention ? (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        AI подготвува план за интервенција…
                      </div>
                    ) : (
                      <>
                        <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-500" /> AI План за педагошка интервенција
                        </p>
                        <p className="text-sm text-red-900 leading-relaxed whitespace-pre-wrap">{intervention}</p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Test breakdown */}
              <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                {student.tests.map((t) => (
                  <span key={t} className="text-[10px] bg-red-50 text-red-700 border border-red-100 px-2 py-0.5 rounded-full font-medium">{t}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
