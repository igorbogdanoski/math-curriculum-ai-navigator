import React, { useCallback, useState } from 'react';
import { Sparkles, CheckCircle2, AlertCircle, XCircle, ChevronDown, ChevronUp, Loader2, X } from 'lucide-react';
import type { LessonPlan } from '../../types';
import { geminiService } from '../../services/geminiService';
import { MATH_STANDARDS } from '../../data/allNationalStandardsComplete';

interface BloomHit { level: number; label: string; evidence: string }
interface AuditResult {
  completenessScore: number;
  phases: { intro: boolean; main: boolean; concluding: boolean };
  implicitBloom: BloomHit[];
  suggestedEnrichments: string[];
  strengths: string[];
}

interface Props {
  plan: Partial<LessonPlan>;
  onDismiss: () => void;
}

const BLOOM_COLORS: Record<number, string> = {
  1: 'bg-sky-50 text-sky-700 border-sky-200',
  2: 'bg-purple-50 text-purple-700 border-purple-200',
  3: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  4: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  5: 'bg-amber-50 text-amber-700 border-amber-200',
  6: 'bg-red-50 text-red-700 border-red-200',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 55) return 'text-amber-600';
  return 'text-red-600';
}

function detectImplicitBRO(plan: Partial<LessonPlan>): string[] {
  if (!plan.grade || plan.grade > 9) return [];
  const texts = [
    plan.title, plan.theme,
    ...(plan.objectives?.map(o => o.text) ?? []),
    plan.scenario?.introductory?.text,
    ...(plan.scenario?.main?.map(m => m.text) ?? []),
    plan.scenario?.concluding?.text,
  ].filter(Boolean).join(' ').toLowerCase();

  return MATH_STANDARDS.filter(std => {
    const kws = std.description.toLowerCase().split(/[\s,.:;()/]+/).filter(w => w.length >= 4);
    const hits = kws.filter(w => texts.includes(w));
    return hits.length >= 2;
  }).slice(0, 5).map(s => s.code);
}

export const UploadedScenarioBanner: React.FC<Props> = ({ plan, onDismiss }) => {
  const [audit, setAudit] = useState<AuditResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [confirmedBRO, setConfirmedBRO] = useState<Set<string>>(new Set());
  const [broSuggestions] = useState(() => detectImplicitBRO(plan));

  const runAudit = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await geminiService.auditUploadedScenario(plan);
      setAudit(result);
      setExpanded(true);
    } catch {
      setError('Грешка при анализа. Пробајте повторно.');
    } finally {
      setIsRunning(false);
    }
  }, [plan]);

  const toggleBRO = (code: string) => {
    setConfirmedBRO(prev => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  return (
    <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-indigo-600 font-black text-sm flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            Прикачено сопствено сценарио
          </span>
          <span className="text-[10px] text-indigo-500 font-medium">— Уреди ги полињата, потоа збогати со AI</span>
        </div>
        <button type="button" onClick={onDismiss} className="p-1 hover:bg-indigo-100 rounded-lg" aria-label="Затвори банер">
          <X className="w-4 h-4 text-indigo-400" />
        </button>
      </div>

      {/* Audit trigger */}
      {!audit && (
        <button
          type="button"
          onClick={runAudit}
          disabled={isRunning}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
        >
          {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isRunning ? 'Педагошка верификација...' : 'Верификувај педагошки (AI)'}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Audit result */}
      {audit && (
        <div className="space-y-3">
          {/* Score row */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-center">
              <p className={`text-3xl font-black ${scoreColor(audit.completenessScore)}`}>
                {audit.completenessScore}%
              </p>
              <p className="text-[10px] text-gray-500">Комплетност</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'intro',      label: 'Воведна' },
                { key: 'main',       label: 'Главна' },
                { key: 'concluding', label: 'Завршна' },
              ].map(({ key, label }) => {
                const ok = audit.phases[key as keyof typeof audit.phases];
                const Icon = ok ? CheckCircle2 : XCircle;
                return (
                  <span key={key} className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border ${ok ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    <Icon className="w-3 h-3" /> {label}
                  </span>
                );
              })}
            </div>
          </div>

          <button type="button" onClick={() => setExpanded(v => !v)} className="flex items-center gap-1 text-xs text-indigo-600 font-semibold hover:underline">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Склопи детали' : 'Прикажи детали'}
          </button>

          {expanded && (
            <div className="space-y-3 border-t border-indigo-100 pt-3">
              {/* Implicit Bloom */}
              {audit.implicitBloom.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">🎯 Имплицитни Bloom нивоа (веќе присутни)</p>
                  <div className="space-y-1">
                    {audit.implicitBloom.map((b, i) => (
                      <div key={i} className={`flex items-start gap-2 text-[11px] px-2.5 py-1.5 rounded-lg border ${BLOOM_COLORS[b.level] ?? 'bg-gray-50 text-gray-700 border-gray-200'}`}>
                        <span className="font-bold shrink-0">B{b.level} {b.label}</span>
                        <span className="text-gray-600 italic">„{b.evidence}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BRO auto-suggestions */}
              {broSuggestions.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">📋 Детектирани БРО Стандарди — потврди ги</p>
                  <div className="flex flex-wrap gap-1.5">
                    {broSuggestions.map(code => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleBRO(code)}
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border transition-colors ${confirmedBRO.has(code) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'}`}
                      >
                        {confirmedBRO.has(code) ? '✓ ' : ''}{code}
                      </button>
                    ))}
                  </div>
                  {confirmedBRO.size > 0 && (
                    <p className="text-[10px] text-indigo-600 mt-1">💡 Потврдените стандарди додај ги рачно во полето „БРО Стандарди" подолу.</p>
                  )}
                </div>
              )}

              {/* Strengths */}
              {audit.strengths.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">💪 Педагошки силни страни</p>
                  <ul className="space-y-0.5">
                    {audit.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-emerald-700">
                        <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Enrichments */}
              {audit.suggestedEnrichments.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">🔧 Минимални додатоци за МОН-усогласеност</p>
                  <ul className="space-y-1">
                    {audit.suggestedEnrichments.slice(0, 2).map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0 text-amber-600" /> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
