import React, { useMemo, useState } from 'react';
import { useCurriculum } from '../hooks/useCurriculum';
import { ConceptMastery } from '../services/firestoreService';
import { Trophy, Star, Lock, BookOpen, Target, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LogicMapProps {
  masteryRecords: ConceptMastery[];
}

export const LogicMap: React.FC<LogicMapProps> = ({ masteryRecords }) => {
  const { curriculum, isLoading } = useCurriculum();
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);

  // Derive initial grade from mastery or default
  const activeGrade = useMemo(() => {
    if (selectedGrade !== null) return selectedGrade;
    if (!masteryRecords.length) return 6; // default
    // find grade with most activity
    const gradeCounts = masteryRecords.reduce((acc, m) => {
      acc[m.gradeLevel] = (acc[m.gradeLevel] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    let max = 6;
    let maxCount = 0;
    Object.entries(gradeCounts).forEach(([k, v]) => {
      if (v > maxCount) {
        maxCount = v;
        max = Number(k);
      }
    });
    return max;
  }, [masteryRecords, selectedGrade]);

  const masteryMap = useMemo(() => {
    const map: Record<string, ConceptMastery> = {};
    masteryRecords.forEach(m => { map[m.conceptId] = m; });
    return map;
  }, [masteryRecords]);

  if (isLoading || !curriculum) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Вчитување мапа...</div>;
  }

  const grades = curriculum.grades.sort((a, b) => a.level - b.level);
  const currentGradeData = grades.find(g => g.level === activeGrade);

  // Helper to snake the concepts
  const getIndentClass = (idx: number) => {
    const pattern = ["ml-0", "ml-12", "ml-24", "ml-12", "ml-0", "-ml-12", "-ml-24", "-ml-12"];
    return pattern[idx % pattern.length];
  };

  return (
    <div className="bg-slate-50 p-4 md:p-8 rounded-3xl border border-slate-200">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <Target className="w-8 h-8 text-indigo-500" />
            Мапа на Знаење
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Следи го твојот напредок низ концепти! Отклучи ги сите полиња.
          </p>
        </div>

        <select 
          value={activeGrade} 
          onChange={(e) => setSelectedGrade(Number(e.target.value))}
          className="bg-white border-2 border-indigo-100 rounded-xl px-4 py-2 font-bold text-indigo-700 outline-none focus:border-indigo-300"
        >
          {grades.map(g => (
            <option key={g.id} value={g.level}>{g.level} Одделение</option>
          ))}
        </select>
      </div>

      <div className="max-w-xl mx-auto flex flex-col items-center relative">
        {currentGradeData?.topics.map((topic, tIdx) => (
          <div key={topic.id} className="w-full mb-16 relative">
            {/* Topic Header */}
            <div className="bg-indigo-600 text-white rounded-2xl p-4 shadow-lg mb-8 relative z-10 text-center">
              <h3 className="font-bold text-lg">{topic.title}</h3>
              <p className="text-indigo-200 text-xs mt-1">{topic.concepts.length} Концепти</p>
            </div>

            {/* Concepts winding path */}
            <div className="flex flex-col items-center gap-6 relative">
              {topic.concepts.map((concept, cIdx) => {
                const mastery = masteryMap[concept.id];
                const isMastered = mastery?.mastered;
                const inProgress = mastery && !isMastered && mastery.attempts > 0;
                
                // Color variants
                const bgColors = isMastered 
                  ? "bg-amber-400 border-amber-500 text-white shadow-amber-300/50" 
                  : inProgress 
                    ? "bg-blue-500 border-blue-600 text-white shadow-blue-300/50"
                    : "bg-slate-200 border-slate-300 text-slate-400";
                
                const icon = isMastered 
                  ? <Trophy className="w-8 h-8 fill-current" /> 
                  : inProgress 
                    ? <Star className="w-8 h-8 fill-current" /> 
                    : <Lock className="w-8 h-8" />;

                return (
                  <div key={concept.id} className={`relative ${getIndentClass(cIdx)}`}>
                    {/* Path line to next (except very last of entire tree) */}
                    {(cIdx < topic.concepts.length - 1 || tIdx < currentGradeData.topics.length - 1) && (
                      <div className="absolute top-full left-1/2 -mt-2 w-3 h-10 bg-indigo-100 -translate-x-1/2 -z-10 rounded-full" />
                    )}
                    
                    <Link to={`/play/${concept.id}`} title={concept.title} className="block group">
                      <div className={`w-24 h-24 rounded-full border-b-8 flex items-center justify-center transition-transform group-hover:scale-105 shadow-xl ${bgColors}`}>
                        {icon}
                      </div>
                      
                      {/* Tooltip on hover/always show small label */}
                      <div className="absolute top-1/2 left-full ml-4 -translate-y-1/2 bg-white px-3 py-2 border border-slate-200 shadow-lg rounded-xl w-48 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
                        <p className="text-xs font-bold text-slate-800 line-clamp-3">{concept.title}</p>
                        {isMastered ? (
                          <span className="text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-1">
                            <CheckCircle2 className="w-3 h-3" /> Совладано
                          </span>
                        ) : inProgress ? (
                          <span className="text-[10px] text-blue-600 font-bold mt-1 block">
                            Последнo ниво: {mastery?.highestScore || 0}%
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 mt-1 block">Не е започнато</span>
                        )}
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
