import React, { useMemo } from 'react';
import { Card } from '../common/Card';
import { analyzeLessonBalance, LessonActivityLike } from '../../services/pedagogicalAnalysis';
import { ICONS } from '../../constants';

interface PedagogicalDashboardProps {
  activities: LessonActivityLike[];
}

export const PedagogicalDashboard: React.FC<PedagogicalDashboardProps> = ({ activities }) => {
  const analysis = useMemo(() => analyzeLessonBalance(activities), [activities]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <Card className="sticky top-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <ICONS.sparkles className="w-5 h-5 text-brand-primary" />
          Педагошка анализа
        </h3>
        <div className={`text-2xl font-black ${getScoreColor(analysis.score)}`}>
          {analysis.score}<span className="text-sm font-normal text-gray-400">/100</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Distribution Chart */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Дистрибуција на нивоа</p>
          <div className="space-y-1.5">
            {Object.entries(analysis.distribution).map(([level, minutes]) => (
              <div key={level} className="flex items-center text-xs">
                <span className="w-20 text-gray-600 truncate">{level}</span>
                <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden mx-2">
                  <div 
                    className="bg-brand-primary h-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, (minutes / 45) * 100)}%` }}
                  ></div>
                </div>
                <span className="w-8 text-right text-gray-400 font-mono">{minutes}m</span>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback Messages */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Препораки</p>
          <div className="space-y-2">
            {analysis.feedback.map((msg, i) => {
              const isPositive = msg.includes('✅') || msg.includes('🌟') || msg.includes('🔍') || msg.includes('Браво');
              const isWarning = msg.includes('⚠️') || msg.includes('⚡');
              
              return (
                <div 
                  key={i} 
                  className={`p-2.5 rounded-lg text-xs leading-relaxed border ${
                    isPositive ? 'bg-green-50 text-green-800 border-green-100' : 
                    isWarning ? 'bg-amber-50 text-amber-800 border-amber-100' : 
                    'bg-blue-50 text-blue-800 border-blue-100'
                  }`}
                >
                  {msg}
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-400 italic">
          * Анализата е базирана на Блумовата таксономија и времетраењето на активностите.
        </div>
      </div>
    </Card>
  );
};
