import React, { useState } from 'react';
import { Brain, AlertTriangle, TrendingUp, CheckCircle2, Loader2, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useStudentCognitiveProfile } from '../../hooks/useStudentCognitiveProfile';

interface StudentCognitiveProfilePanelProps {
  grade: number;
  teacherUid: string;
  studentNames?: string[];
}

const DOK_LABELS: Record<1 | 2 | 3 | 4, { label: string; color: string }> = {
  1: { label: 'Присетување', color: 'bg-slate-400' },
  2: { label: 'Концепти',    color: 'bg-blue-400' },
  3: { label: 'Стратегии',   color: 'bg-violet-500' },
  4: { label: 'Проширено',   color: 'bg-rose-500' },
};

export const StudentCognitiveProfilePanel: React.FC<StudentCognitiveProfilePanelProps> = ({
  grade,
  teacherUid,
  studentNames = [],
}) => {
  const [selectedStudent, setSelectedStudent] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const { profile, isLoading, error } = useStudentCognitiveProfile({
    studentName: selectedStudent,
    teacherUid,
    grade,
  });

  const dokTotal = profile ? Object.values(profile.dokDistribution).reduce((s, n) => s + n, 0) : 0;

  return (
    <div className="border border-indigo-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-black text-indigo-700 uppercase tracking-widest">
            Когнитивен Профил
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-4 h-4 text-indigo-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-indigo-400" />
        )}
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 bg-white">
          {/* Student selector */}
          <div className="space-y-1">
            {studentNames.length > 0 ? (
              <div className="flex gap-2 items-center">
                <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <select
                  value={selectedStudent}
                  onChange={e => setSelectedStudent(e.target.value)}
                  aria-label="Избери ученик за когнитивен профил"
                  className="flex-1 border border-indigo-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400"
                >
                  <option value="">— Избери ученик —</option>
                  {studentNames.map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex gap-2 items-center">
                <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <input
                  type="text"
                  value={selectedStudent}
                  onChange={e => setSelectedStudent(e.target.value)}
                  placeholder="Внеси ime на ученик"
                  className="flex-1 border border-indigo-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400"
                />
              </div>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center gap-2 text-indigo-600 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Вчитувам профил…</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          {/* Empty — no student selected */}
          {!selectedStudent && !isLoading && (
            <p className="text-xs text-gray-400 italic text-center py-2">
              Избери ученик за да видиш когнитивен профил базиран на Kahoot/Dugga резултати.
            </p>
          )}

          {/* Profile data */}
          {profile && !isLoading && (
            <div className="space-y-3">
              {/* Overall mastery */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Просечна совладаност</p>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        profile.overallMasteryPct >= 80 ? 'bg-green-500' :
                        profile.overallMasteryPct >= 60 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${profile.overallMasteryPct}%` }}
                    />
                  </div>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">{profile.overallMasteryPct}%</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-indigo-700">{profile.masteredConcepts}</p>
                  <p className="text-[10px] text-gray-400">/{profile.totalConcepts} концепти</p>
                </div>
              </div>

              {/* DoK distribution */}
              {dokTotal > 0 && (
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">DoK дистрибуција</p>
                  <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
                    {([1, 2, 3, 4] as const).map(lvl => {
                      const pct = dokTotal > 0 ? Math.round((profile.dokDistribution[lvl] / dokTotal) * 100) : 0;
                      return pct > 0 ? (
                        <div
                          key={lvl}
                          title={`DoK ${lvl}: ${DOK_LABELS[lvl].label} (${pct}%)`}
                          className={`${DOK_LABELS[lvl].color} transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      ) : null;
                    })}
                  </div>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {([1, 2, 3, 4] as const).map(lvl => profile.dokDistribution[lvl] > 0 && (
                      <span key={lvl} className="text-[10px] text-gray-500 flex items-center gap-0.5">
                        <span className={`w-2 h-2 rounded-full inline-block ${DOK_LABELS[lvl].color}`} />
                        DoK{lvl}·{profile.dokDistribution[lvl]}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Weak topics */}
              {profile.weakTopics.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                    <span className="text-[11px] font-bold text-red-700">Слаби теми (&lt;60%)</span>
                  </div>
                  <ul className="space-y-0.5">
                    {profile.weakTopics.slice(0, 4).map((t, i) => (
                      <li key={i} className="text-xs text-red-700 line-clamp-1">• {t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Strong topics */}
              {profile.strongTopics.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-[11px] font-bold text-green-700">Силни теми (≥80%)</span>
                  </div>
                  <ul className="space-y-0.5">
                    {profile.strongTopics.slice(0, 3).map((t, i) => (
                      <li key={i} className="text-xs text-green-700 line-clamp-1">• {t}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* No data state */}
              {profile.overallMasteryPct === 0 && profile.masteredConcepts === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 italic">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Нема резултати за {profile.studentName} во {grade}. одд. Ученикот треба прво да изработи Kahoot или Dugga тест.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
