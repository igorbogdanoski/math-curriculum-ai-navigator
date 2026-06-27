/**
 * PedagogicalEnrichPanel — S89
 *
 * AI-powered pedagogical enrichment for any planning level.
 * Drop this into AnnualPlanGeneratorView, AIThematicPlanGeneratorModal,
 * WeeklyPlanView, or LessonPlanEditorView.
 *
 * Analyzes the plan against 10 world pedagogical frameworks and returns:
 *   • Overall quality score (1-10)
 *   • 3 quick-win actions
 *   • Framework-by-framework status indicators
 *   • Prioritized improvement suggestions with examples
 */

import React, { useState, useCallback } from 'react';
import {
  Sparkles, ChevronDown, ChevronUp, Loader2,
  CheckCircle2, AlertCircle, Info, Zap, Target, BookOpen,
} from 'lucide-react';
import { geminiService } from '../../services/geminiService';
import { useAuth } from '../../contexts/AuthContext';

type PlanType = 'annual' | 'thematic' | 'weekly' | 'lesson';

export interface PedagogicalEnrichPlanSummary {
  grade: string;
  title?: string;
  objectives?: string[];
  topics?: string[];
  activities?: string[];
  weeks?: number;
}

interface EnrichResult {
  overallScore: number;
  strengths: string[];
  quickWins: string[];
  suggestions: Array<{
    framework: string;
    emoji: string;
    priority: 'high' | 'medium' | 'low';
    suggestion: string;
    rationale: string;
    example: string;
  }>;
  frameworkStatus: Array<{
    framework: string;
    emoji: string;
    status: 'strong' | 'adequate' | 'needs_attention';
    label: string;
    insight: string;
  }>;
}

interface Props {
  planType: PlanType;
  planSummary: PedagogicalEnrichPlanSummary;
  /** Optional: collapse button label override */
  label?: string;
}

const SCORE_WIDTH: Record<number, string> = {
  1: 'w-[10%]', 2: 'w-[20%]', 3: 'w-[30%]', 4: 'w-[40%]', 5: 'w-[50%]',
  6: 'w-[60%]', 7: 'w-[70%]', 8: 'w-[80%]', 9: 'w-[90%]', 10: 'w-full',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  strong:           { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
  adequate:         { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-400'    },
  needs_attention:  { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400'   },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  high:   { bg: 'bg-red-50',    text: 'text-red-800',   badge: 'bg-red-100 text-red-700'     },
  medium: { bg: 'bg-amber-50',  text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
  low:    { bg: 'bg-gray-50',   text: 'text-gray-800',  badge: 'bg-gray-100 text-gray-600'   },
};

const PLAN_TYPE_LABELS: Record<PlanType, string> = {
  annual:   'Годишна програма',
  thematic: 'Тематски план',
  weekly:   'Неделен план',
  lesson:   'Сценарио на час',
};

export const PedagogicalEnrichPanel: React.FC<Props> = ({ planType, planSummary, label }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EnrichResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSuggestion, setExpandedSuggestion] = useState<number | null>(null);

  const handleEnrich = useCallback(async () => {
    setIsOpen(true);
    if (result) return; // already loaded
    setIsLoading(true);
    setError(null);
    try {
      const data = await geminiService.enrichPlanPedagogically(
        planType,
        planSummary,
        user ?? undefined,
      );
      setResult(data);
    } catch (err) {
      setError((err as Error).message || 'AI грешка при збогатување');
    } finally {
      setIsLoading(false);
    }
  }, [planType, planSummary, result, user]);

  const scoreColor =
    !result ? '' :
    result.overallScore >= 8 ? 'text-emerald-600' :
    result.overallScore >= 6 ? 'text-blue-600' :
    result.overallScore >= 4 ? 'text-amber-600' :
    'text-red-600';

  const scoreBg =
    !result ? '' :
    result.overallScore >= 8 ? 'from-emerald-50 to-teal-50 border-emerald-200' :
    result.overallScore >= 6 ? 'from-blue-50 to-indigo-50 border-blue-200' :
    result.overallScore >= 4 ? 'from-amber-50 to-yellow-50 border-amber-200' :
    'from-red-50 to-orange-50 border-red-200';

  return (
    <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 overflow-hidden">
      {/* Header / trigger */}
      <button
        type="button"
        onClick={handleEnrich}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-purple-100/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-purple-900 text-sm">
              {label ?? 'AI Педагошко збогатување'}
            </p>
            <p className="text-xs text-purple-600">
              {PLAN_TYPE_LABELS[planType]} · Bloom, UbD, 5E, ZPD, PBL и уште 5 рамки
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <span className={`text-sm font-bold ${scoreColor}`}>
              {result.overallScore}/10
            </span>
          )}
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          ) : isOpen ? (
            <ChevronUp className="w-4 h-4 text-purple-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-purple-500" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div className="border-t border-purple-200 px-4 pb-4 space-y-4 pt-3">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-purple-700 py-4 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
              AI анализира педагошки рамки…
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {result && (
            <>
              {/* Overall score */}
              <div className={`rounded-xl border bg-gradient-to-br ${scoreBg} p-3 flex items-center gap-3`}>
                <div className={`text-3xl font-black ${scoreColor} leading-none`}>
                  {result.overallScore}
                  <span className="text-base font-semibold text-gray-400">/10</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="w-full bg-white/60 rounded-full h-2 mt-1">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        result.overallScore >= 8 ? 'bg-emerald-500' :
                        result.overallScore >= 6 ? 'bg-blue-500' :
                        result.overallScore >= 4 ? 'bg-amber-500' : 'bg-red-500'
                      } ${SCORE_WIDTH[result.overallScore] ?? 'w-[50%]'}`}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Педагошки квалитет на планот</p>
                </div>
              </div>

              {/* Framework status chips */}
              {result.frameworkStatus.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Статус по рамки</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.frameworkStatus.map(f => {
                      const c = STATUS_COLORS[f.status] ?? STATUS_COLORS.adequate;
                      return (
                        <div
                          key={f.framework}
                          title={f.insight}
                          className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium ${c.bg} ${c.text} ${c.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                          {f.emoji} {f.framework}
                          <span className="opacity-70">· {f.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Strengths */}
              {result.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Силни страни
                  </p>
                  <ul className="space-y-1">
                    {result.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-emerald-800 flex items-start gap-1.5">
                        <span className="text-emerald-400 mt-0.5 flex-shrink-0">✓</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quick wins */}
              {result.quickWins.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> Веднаш применливо (Quick Wins)
                  </p>
                  <ol className="space-y-1">
                    {result.quickWins.map((w, i) => (
                      <li key={i} className="text-sm text-amber-900 flex items-start gap-2">
                        <span className="font-bold text-amber-600 flex-shrink-0 w-4 text-center">{i + 1}.</span>
                        {w}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Suggestions */}
              {result.suggestions.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-purple-500" /> Педагошки препораки
                  </p>
                  <div className="space-y-2">
                    {result.suggestions.map((s, i) => {
                      const pc = PRIORITY_COLORS[s.priority] ?? PRIORITY_COLORS.medium;
                      const isExpanded = expandedSuggestion === i;
                      return (
                        <div key={i} className={`rounded-xl border ${pc.bg} overflow-hidden`}>
                          <button
                            type="button"
                            onClick={() => setExpandedSuggestion(isExpanded ? null : i)}
                            className="w-full flex items-start gap-2 p-3 text-left"
                          >
                            <span className="text-base flex-shrink-0 mt-0.5">{s.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${pc.badge}`}>
                                  {s.priority === 'high' ? 'Висок' : s.priority === 'medium' ? 'Среден' : 'Низок'}
                                </span>
                                <span className="text-xs font-semibold text-gray-500">{s.framework}</span>
                              </div>
                              <p className={`text-sm font-medium mt-0.5 ${pc.text}`}>{s.suggestion}</p>
                            </div>
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                              : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
                            }
                          </button>
                          {isExpanded && (
                            <div className="px-3 pb-3 space-y-2 border-t border-white/50 pt-2">
                              <div className="flex items-start gap-1.5">
                                <Info className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-gray-600 italic">{s.rationale}</p>
                              </div>
                              <div className="flex items-start gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-indigo-800 bg-white/60 rounded-lg px-2 py-1">{s.example}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Re-analyze button */}
              <button
                type="button"
                onClick={() => { setResult(null); handleEnrich(); }}
                className="w-full text-xs text-purple-600 hover:text-purple-800 font-semibold py-1 hover:underline"
              >
                Анализирај повторно
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
