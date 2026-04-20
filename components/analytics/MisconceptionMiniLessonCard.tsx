/**
 * S37-C3 — Misconception Mini-Lesson Card
 *
 * Appears in ConceptDetailView (teacher/school_admin role) and shows the
 * most common student mistakes on this concept, aggregated from quiz_results.
 * A "Генерирај мини-лекција" button asks Gemini to produce a targeted
 * corrective explanation for each misconception pattern.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { firestoreService } from '../../services/firestoreService';
import { callGeminiProxy } from '../../services/gemini/core.proxy';
import { DEFAULT_MODEL } from '../../services/gemini/core.constants';
import { AlertTriangle, Lightbulb, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import type { QuizResult } from '../../services/firestoreService.types';

interface MisconceptionEntry {
  text: string;
  count: number;
  miniLesson?: string;
}

interface Props {
  conceptId: string;
  conceptTitle: string;
  teacherUid: string;
}

function aggregateMisconceptions(results: QuizResult[]): MisconceptionEntry[] {
  const counts: Record<string, number> = {};
  for (const r of results) {
    for (const m of r.misconceptions ?? []) {
      if (!m.misconception || m.misconception.includes('Непозната') || m.misconception.includes('Пресметков')) continue;
      counts[m.misconception] = (counts[m.misconception] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([text, count]) => ({ text, count }));
}

export const MisconceptionMiniLessonCard: React.FC<Props> = ({ conceptId, conceptTitle, teacherUid }) => {
  const [misconceptions, setMisconceptions] = useState<MisconceptionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    firestoreService.fetchQuizResultsByConcept(conceptId, teacherUid, 100)
      .then(results => {
        if (!mounted) return;
        setMisconceptions(aggregateMisconceptions(results));
        setLoading(false);
      })
      .catch(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [conceptId, teacherUid]);

  const generateMiniLesson = useCallback(async (idx: number) => {
    const m = misconceptions[idx];
    if (!m || m.miniLesson) { setExpandedIdx(idx); return; }
    setGenerating(true);
    try {
      const prompt = `Ти си педагог по математика. Ученик направил следна грешка при учење на "${conceptTitle}": "${m.text}". Напиши кратка мини-лекција (3-4 реченици) на македонски јазик која: 1) ја признава грешката, 2) објаснува зошто е погрешна, 3) дава точниот начин на размислување. Биди конкретен, јасен и охрабрувачки.`;
      const resp = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.7 },
      });
      const result = resp.text?.trim() ?? '';
      setMisconceptions(prev => prev.map((entry, i) =>
        i === idx ? { ...entry, miniLesson: result } : entry
      ));
      setExpandedIdx(idx);
    } catch {
      // non-fatal
    } finally {
      setGenerating(false);
    }
  }, [misconceptions, conceptTitle]);

  if (loading) return null;
  if (misconceptions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50/60 to-orange-50/40 p-4">
      <button
        type="button"
        className="w-full flex items-center gap-2 text-left"
        onClick={() => setExpanded(p => !p)}
        aria-expanded={expanded ? 'true' : 'false'}
      >
        <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
        <span className="font-black text-rose-700 text-sm flex-1">
          Типични грешки ({misconceptions.length})
        </span>
        <span className="text-xs text-rose-400 font-medium">{misconceptions[0].count}+ ученици</span>
        {expanded ? <ChevronUp className="w-4 h-4 text-rose-400" /> : <ChevronDown className="w-4 h-4 text-rose-400" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {misconceptions.map((m, idx) => (
            <div key={idx} className="rounded-xl bg-white/70 border border-rose-100 p-3">
              <div className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-black flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 leading-snug">{m.text}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{m.count} {m.count === 1 ? 'ученик' : 'ученици'}</p>

                  {m.miniLesson && expandedIdx === idx && (
                    <div className="mt-2 flex gap-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-700 leading-relaxed">{m.miniLesson}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => generateMiniLesson(idx)}
                    disabled={generating}
                    className="mt-2 flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 disabled:opacity-50 transition-colors"
                  >
                    {generating && expandedIdx === idx
                      ? <><RefreshCw className="w-3 h-3 animate-spin" /> Генерирам…</>
                      : m.miniLesson && expandedIdx === idx
                        ? '✓ Мини-лекција прикажана'
                        : <><Lightbulb className="w-3 h-3" /> Генерирај мини-лекција</>
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
