import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, TrendingUp, GraduationCap } from 'lucide-react';
import { computeMaturaReadiness } from '../../utils/maturaReadiness';
import type { GradeEntry } from '../../types';
import type { QuizResult } from '../../services/firestoreService.types';

interface MaturaReadinessPanelProps {
  entries: GradeEntry[];
  quizResults?: QuizResult[];
  gradeLevel: number;
}

const LEVEL_META = {
  high:   { label: 'Подготвен',     color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-300', icon: CheckCircle2 },
  medium: { label: 'Во напредок',   color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-amber-300', icon: TrendingUp },
  low:    { label: 'Потребна помош', color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-300',   icon: AlertTriangle },
};

export const MaturaReadinessPanel: React.FC<MaturaReadinessPanelProps> = ({
  entries,
  quizResults = [],
  gradeLevel,
}) => {
  const report = useMemo(
    () => computeMaturaReadiness(entries, quizResults),
    [entries, quizResults],
  );

  if (gradeLevel < 8) {
    return (
      <div className="text-xs text-gray-400 italic text-center py-2">
        Matura Readiness е релевантен за 8. и 9. одделение.
      </div>
    );
  }

  if (report.students.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic text-center py-3 flex items-center gap-2 justify-center">
        <GraduationCap className="w-4 h-4" />
        <span>Додај резултати за да видиш Matura Readiness.</span>
      </div>
    );
  }

  const readinessBar =
    report.classAvg >= 75 ? 'bg-green-500' :
    report.classAvg >= 55 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-3">
      {/* Class average */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">Просечна подготвеност за Матура</span>
            <span className="text-sm font-black text-slate-700">{report.classAvg}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${readinessBar} rounded-full transition-all`}
              style={{ width: `${report.classAvg}%` }} />
          </div>
        </div>
      </div>

      {/* Risk summary */}
      <div className="flex gap-2 text-xs flex-wrap">
        <span className="bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">
          ✓ {report.topStudents.length} подготвени
        </span>
        {report.atRiskStudents.length > 0 && (
          <span className="bg-red-100 text-red-700 rounded-full px-2 py-0.5 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {report.atRiskStudents.length} со ризик
          </span>
        )}
      </div>

      {/* Students table */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-0.5">
        {report.students.map(s => {
          const meta = LEVEL_META[s.level];
          const Icon = meta.icon;
          return (
            <div key={s.studentName}
              className={`flex items-center gap-2 p-2 rounded-lg border ${meta.bg} ${meta.border}`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold truncate ${meta.color}`}>{s.studentName}</p>
                {s.weakAreas.length > 0 && (
                  <p className="text-[10px] text-gray-500 truncate">
                    Слабо: {s.weakAreas.slice(0, 2).join(', ')}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-black ${meta.color}`}>{s.readinessPct}%</p>
                <p className="text-[10px] text-gray-400">{meta.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400">
        Формула: 60% Дневник + 40% Dugga/Kahoot · Праг: ≥75% подготвен
      </p>
    </div>
  );
};
