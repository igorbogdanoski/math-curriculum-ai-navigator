import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { detectCurriculumGaps } from '../../utils/curriculumGapDetector';

interface CurriculumGapPanelProps {
  planTopics: string[];
  gradeNum: number;
  /** Called when teacher clicks "Add topic" for a gap */
  onSuggestTopic?: (standardCode: string, description: string) => void;
}

export const CurriculumGapPanel: React.FC<CurriculumGapPanelProps> = ({
  planTopics,
  gradeNum,
  onSuggestTopic,
}) => {
  const [showUncovered, setShowUncovered] = useState(false);

  const { covered, uncovered, coveragePct } = useMemo(
    () => detectCurriculumGaps(planTopics, gradeNum),
    [planTopics, gradeNum],
  );

  if (gradeNum > 9) {
    return (
      <div className="text-xs text-gray-400 italic text-center py-2">
        БРО Gap Detector е активен само за основно образование (одд. 1–9).
      </div>
    );
  }

  const gapColor =
    coveragePct >= 80 ? 'text-green-600' :
    coveragePct >= 50 ? 'text-amber-600' : 'text-red-600';

  const barColor =
    coveragePct >= 80 ? 'bg-green-500' :
    coveragePct >= 50 ? 'bg-amber-500' : 'bg-red-500';

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
          <p className="text-lg font-black text-slate-700">{covered.length}<span className="text-xs text-gray-400">/{covered.length + uncovered.length}</span></p>
          <p className="text-[10px] text-gray-400">покриени</p>
        </div>
      </div>

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
        <div>
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
            <ul className="mt-2 space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {uncovered.map(std => (
                <li
                  key={std.code}
                  className="flex items-start gap-2 p-2 bg-red-50 border border-red-100 rounded-lg"
                >
                  <span className="font-mono text-[10px] font-bold text-red-600 shrink-0 mt-0.5">
                    {std.code}
                  </span>
                  <span className="text-[11px] text-red-800 flex-1 leading-relaxed line-clamp-2">
                    {std.description}
                  </span>
                  {onSuggestTopic && (
                    <button
                      type="button"
                      onClick={() => onSuggestTopic(std.code, std.description)}
                      title="Предложи нова тема за овој стандард"
                      className="shrink-0 text-red-500 hover:text-red-700 transition-colors"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
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
