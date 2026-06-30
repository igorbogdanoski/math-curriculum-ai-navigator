/**
 * CulturalResponsivenessPanel — C1 (S108A)
 * CRT audit panel for lesson plans (Hammond 2015, Gay 2010).
 * Shows score, strengths, gaps, and actionable suggestions.
 */
import React, { useState, useCallback } from 'react';
import { Globe, Loader2, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import type { LessonPlan } from '../../types';
import { geminiService } from '../../services/geminiService';

interface CRTResult {
  crtScore: number;
  strengths: string[];
  gaps: string[];
  suggestions: Array<{ area: string; action: string; example: string }>;
  summary: string;
}

interface Props {
  plan: Partial<LessonPlan>;
}

function scoreColor(score: number): string {
  if (score >= 8) return 'text-emerald-600';
  if (score >= 5) return 'text-amber-600';
  return 'text-red-600';
}

export const CulturalResponsivenessPanel: React.FC<Props> = ({ plan }) => {
  const [result, setResult] = useState<CRTResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await geminiService.auditCulturalResponsiveness(plan);
      setResult(data);
      setExpanded(true);
    } catch {
      setError('Грешка при CRT анализа. Пробај повторно.');
    } finally {
      setLoading(false);
    }
  }, [plan]);

  return (
    <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Globe className="w-4 h-4 text-teal-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-teal-800">Culturally Responsive Teaching (CRT)</p>
          <p className="text-[10px] text-teal-600">Hammond 2015 · Gay 2010 — Еднаквост, јазик, заедница</p>
        </div>
      </div>

      {/* Trigger */}
      {!result && (
        <button
          type="button"
          onClick={runAudit}
          disabled={loading}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Анализира CRT...' : 'CRT Ревизија'}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div className="space-y-3">
          {/* Score + Summary */}
          <div className="flex items-center gap-3">
            <p className={`text-3xl font-black ${scoreColor(result.crtScore)}`}>{result.crtScore}/10</p>
            <p className="text-xs text-gray-600 flex-1">{result.summary}</p>
          </div>

          <button type="button" onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1 text-xs text-teal-600 font-semibold hover:underline">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Склопи детали' : 'Прикажи детали'}
          </button>

          {expanded && (
            <div className="space-y-3 border-t border-teal-100 pt-3">
              {/* Strengths */}
              {result.strengths.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">💪 CRT Силни страни</p>
                  <ul className="space-y-0.5">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-emerald-700">
                        <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Gaps */}
              {result.gaps.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">⚠️ Пропусти</p>
                  <ul className="space-y-0.5">
                    {result.gaps.map((g, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-700">
                        <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Suggestions */}
              {result.suggestions.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">🌍 Конкретни препораки</p>
                  <div className="space-y-2">
                    {result.suggestions.slice(0, 3).map((s, i) => (
                      <div key={i} className="bg-white border border-teal-200 rounded-xl p-3 space-y-1">
                        <p className="text-[10px] font-bold text-teal-700 uppercase">{s.area}</p>
                        <p className="text-[11px] text-gray-800 font-medium">{s.action}</p>
                        <p className="text-[10px] text-gray-500 italic">{s.example}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button type="button" onClick={() => { setResult(null); runAudit(); }}
                className="text-xs text-teal-600 hover:underline font-semibold">
                Анализирај повторно
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
