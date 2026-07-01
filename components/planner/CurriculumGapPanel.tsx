import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Zap, Loader2 } from 'lucide-react';
import { detectCurriculumGaps } from '../../utils/curriculumGapDetector';
import { callGeminiProxy, sanitizePromptInput, DEFAULT_MODEL } from '../../services/gemini/core';

interface CurriculumGapPanelProps {
  planTopics: string[];
  gradeNum: number;
  onSuggestTopic?: (standardCode: string, description: string) => void;
}

export const CurriculumGapPanel: React.FC<CurriculumGapPanelProps> = ({
  planTopics,
  gradeNum,
  onSuggestTopic,
}) => {
  const [showUncovered, setShowUncovered] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  const { covered, uncovered, coveragePct } = useMemo(
    () => detectCurriculumGaps(planTopics, gradeNum),
    [planTopics, gradeNum],
  );

  if (gradeNum > 9) {
    return (
      <div className="text-xs text-gray-400 italic text-center py-2">
        БРО Gap Detector е активен само за основно образование (одд. 1–9).
        <br />
        <span className="text-[10px]">БРО стандардите претставуваат компетенции кои учениците треба да ги поседуваат по завршување на 9. одделение.</span>
      </div>
    );
  }

  const gapColor =
    coveragePct >= 80 ? 'text-green-600' :
    coveragePct >= 50 ? 'text-amber-600' : 'text-red-600';

  const barColor =
    coveragePct >= 80 ? 'bg-green-500' :
    coveragePct >= 50 ? 'bg-amber-500' : 'bg-red-500';

  const handleAISuggestions = async () => {
    if (uncovered.length === 0) return;
    setIsGenerating(true);
    setAiSuggestions(null);
    setAiError('');
    try {
      const stdList = uncovered
        .slice(0, 10)
        .map(s => `• ${s.code}: ${s.description}`)
        .join('\n');
      const safeList = sanitizePromptInput(stdList, 1200);
      const safeGrade = sanitizePromptInput(String(gradeNum), 10);
      const safeTopics = sanitizePromptInput(planTopics.slice(0, 8).join(', '), 400);

      const prompt = `Ти си педагошки советник за математика за ${safeGrade}. одделение (основно образование, МОН — Македонија).

Тековните теми во годишниот план се: ${safeTopics}.

Следниве БРО стандарди (III-А) се непокриени во планот:
${safeList}

ВАЖНО: БРО стандардите се компетенции кои учениците треба да ги поседуваат по завршување на основното образование (9. одд.) и се развиваат постепено низ сите 9 години. За ${safeGrade}. одделение, треба да се работи на нивна подготовка/темелење.

За секој непокриен стандард предложи:
1. Конкретна тема или наставна единица (2-3 збора наслов)
2. Кратка активност за оваа возраст (1 реченица)
3. Во кој месец/период би се вклопила (Септември–Јуни)

Одговори на македонски, структурирано, кратко — 3-4 реченици по стандард.`;

      const resp = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      if (resp?.text) setAiSuggestions(resp.text.trim());
      else setAiError('Нема одговор од AI.');
    } catch {
      setAiError('Грешка при генерирање предлози. Обиди се повторно.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Coverage meter */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Покриеност на БРО стандарди (III-А)</span>
            <span className={`text-sm font-black ${gapColor}`}>{coveragePct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full transition-all`}
              style={{ width: `${coveragePct}%` }}
            />
          </div>
        </div>
        <div className="text-center shrink-0">
          <p className="text-lg font-black text-slate-700">
            {covered.length}
            <span className="text-xs text-gray-400">/{covered.length + uncovered.length}</span>
          </p>
          <p className="text-[10px] text-gray-400">покриени</p>
        </div>
      </div>

      {/* Scope note */}
      <p className="text-[10px] text-gray-400 italic leading-relaxed">
        БРО стандардите (III-А.1–27) претставуваат компетенции кои ученикот треба да ги поседува по завршување на <strong>9. одделение</strong> — развиваат се постепено низ сите 9 години на основното образование преку наставните програми.
      </p>

      {/* Summary badges */}
      <div className="flex gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
          <CheckCircle2 className="w-3 h-3" /> {covered.length} покриени
        </span>
        {uncovered.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
            <AlertTriangle className="w-3 h-3" /> {uncovered.length} непокриени
          </span>
        )}
      </div>

      {/* Uncovered standards — collapsible */}
      {uncovered.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowUncovered(s => !s)}
            className="w-full flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Непокриени стандарди
            </span>
            {showUncovered ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showUncovered && (
            <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {uncovered.map(std => (
                <li
                  key={std.code}
                  className="flex items-start gap-2 p-2 bg-red-50 border border-red-100 rounded-lg"
                >
                  <span className="font-mono text-[10px] font-bold text-red-600 shrink-0 mt-0.5">
                    {std.code}
                  </span>
                  <span className="text-[11px] text-red-800 flex-1 leading-relaxed">
                    {std.description}
                  </span>
                  {onSuggestTopic && (
                    <button
                      type="button"
                      onClick={() => onSuggestTopic(std.code, std.description)}
                      title="Предложи нова тема за овој стандард"
                      className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* AI suggestions button */}
          <button
            type="button"
            onClick={handleAISuggestions}
            disabled={isGenerating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
          >
            {isGenerating
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI генерира предлози за покривање...</>
              : <><Zap className="w-3.5 h-3.5" /> AI: Предлози за покривање на непокриените стандарди</>}
          </button>

          {aiError && (
            <p className="text-[10px] text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">{aiError}</p>
          )}

          {aiSuggestions && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-1">
              <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide mb-2">
                AI Предлози за покривање на непокриените БРО стандарди
              </p>
              <div className="text-[11px] text-indigo-900 leading-relaxed whitespace-pre-wrap">
                {aiSuggestions}
              </div>
            </div>
          )}
        </div>
      )}

      {uncovered.length === 0 && (
        <div className="flex items-center gap-2 text-green-700 text-xs font-medium bg-green-50 rounded-lg p-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Сите 27 математички БРО стандарди се покриени во планот!
        </div>
      )}
    </div>
  );
};
