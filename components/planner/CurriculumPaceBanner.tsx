import React, { useState, useMemo } from 'react';
import { BookOpen, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { getSchoolWeekNumber, GRADE8_WEEK_MILESTONES } from '../../data/official/grade8Official';
import { GRADE6_WEEK_MILESTONES } from '../../data/official/grade6Official';
import { GRADE7_WEEK_MILESTONES } from '../../data/official/grade7Official';
import type { WeekMilestone } from '../../data/official/grade8Official';

interface Props {
  currentDate: Date;
  grade?: number;
}

const GRADE_OPTIONS = [
  { value: 6, label: 'VI одделение', hours: '180ч · 5ч/нед' },
  { value: 7, label: 'VII одделение', hours: '144ч · 4ч/нед' },
  { value: 8, label: 'VIII одделение', hours: '144ч · 4ч/нед' },
];

const ALL_MILESTONES: Record<number, Record<number, WeekMilestone>> = {
  6: GRADE6_WEEK_MILESTONES,
  7: GRADE7_WEEK_MILESTONES,
  8: GRADE8_WEEK_MILESTONES,
};

function getMilestone(grade: number, weekNum: number): WeekMilestone | null {
  return ALL_MILESTONES[grade]?.[weekNum] ?? null;
}

const PREF_KEY = 'curriculum_pace_grade';

export const CurriculumPaceBanner: React.FC<Props> = ({ currentDate, grade: gradeProp }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<number>(() => {
    if (gradeProp) return gradeProp;
    const saved = localStorage.getItem(PREF_KEY);
    return saved ? parseInt(saved, 10) : 8;
  });

  const weekNum = useMemo(() => getSchoolWeekNumber(currentDate), [currentDate]);
  const milestone = useMemo(() => weekNum ? getMilestone(selectedGrade, weekNum) : null, [weekNum, selectedGrade]);

  // Progress: weeks done out of 36
  const progressPct = weekNum ? Math.min(100, Math.round((weekNum / 36) * 100)) : 0;

  const isExamWeek = milestone?.isWrittenExam ?? false;

  const handleGradeChange = (g: number) => {
    setSelectedGrade(g);
    localStorage.setItem(PREF_KEY, String(g));
  };

  if (!weekNum) {
    // Summer break — don't show
    return null;
  }

  return (
    <div className={`rounded-xl border transition-all ${
      isExamWeek
        ? 'border-amber-200 bg-amber-50'
        : 'border-emerald-200 bg-emerald-50'
    }`}>
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setIsExpanded(p => !p)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left"
      >
        <BookOpen className={`w-4 h-4 flex-shrink-0 ${isExamWeek ? 'text-amber-600' : 'text-emerald-600'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${isExamWeek ? 'text-amber-700' : 'text-emerald-700'}`}>
              МОН Програма · Недела {weekNum}/36
            </span>
            {isExamWeek && (
              <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">
                ✍️ Писмена работа
              </span>
            )}
          </div>
          {milestone && (
            <p className="text-[11px] text-gray-600 truncate">
              <span className="font-semibold text-gray-700">{milestone.theme}:</span> {milestone.subtopic}
            </p>
          )}
        </div>

        {/* Progress bar */}
        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
          <div className="w-20 h-1.5 bg-white rounded-full overflow-hidden border border-gray-200">
            <div
              className={`h-full rounded-full transition-all ${isExamWeek ? 'bg-amber-400' : 'bg-emerald-400'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-500">{progressPct}%</span>
        </div>

        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
        )}
      </button>

      {/* Expanded panel */}
      {isExpanded && (
        <div className="px-3 pb-3 border-t border-white/60 pt-2 space-y-3">
          {/* Grade selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-gray-600">Одделение:</span>
            {GRADE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleGradeChange(opt.value)}
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border transition ${
                  selectedGrade === opt.value
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Surrounding weeks context */}
          <div className="space-y-1">
            {[-1, 0, 1].map(offset => {
              const wk = weekNum + offset;
              if (wk < 1 || wk > 36) return null;
              const ms = getMilestone(selectedGrade, wk);
              if (!ms) return null;
              const isCurrent = offset === 0;
              return (
                <div
                  key={wk}
                  className={`flex items-start gap-2 text-[11px] rounded-lg px-2 py-1 ${
                    isCurrent ? 'bg-white/80 shadow-sm font-semibold' : 'text-gray-500'
                  }`}
                >
                  {isCurrent ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  ) : offset < 0 ? (
                    <AlertCircle className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-gray-300 mt-0.5 flex-shrink-0" />
                  )}
                  <span>
                    <span className={`${isCurrent ? 'text-gray-800' : 'text-gray-400'} mr-1`}>
                      Нед. {wk}
                      {offset < 0 ? ' (минатата)' : offset > 0 ? ' (следната)' : ' (оваа)'}:
                    </span>
                    <span className={isCurrent ? 'text-emerald-700' : ''}>
                      {ms.theme} — {ms.subtopic}
                    </span>
                    {ms.isWrittenExam && (
                      <span className="ml-1 text-[10px] font-bold text-amber-600">✍️</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-gray-400">
            Извор: Наставна програма МОН 2025 · важечка од учебна 2026/2027
            {' · '}{GRADE_OPTIONS.find(o => o.value === selectedGrade)?.hours ?? ''}
          </p>
        </div>
      )}
    </div>
  );
};
