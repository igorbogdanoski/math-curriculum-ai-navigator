import React, { useMemo } from 'react';
import { Card } from '../common/Card';
import { Brain, Lightbulb, Target, ArrowRight } from 'lucide-react';
import type { PlannerItem, LessonPlan, BloomsLevel } from '../../types';
import { PlannerItemType } from '../../types';

interface Props {
  items: PlannerItem[];
  lessonPlans: LessonPlan[];
}

const BLOOM_COLORS: Record<string, string> = {
  'Remembering': 'bg-slate-300',
  'Understanding': 'bg-blue-300',
  'Applying': 'bg-indigo-400',
  'Analyzing': 'bg-violet-400',
  'Evaluating': 'bg-fuchsia-500',
  'Creating': 'bg-purple-600',
};

const BLOOM_LABELS: Record<string, string> = {
  'Remembering': 'Запомнување',
  'Understanding': 'Разбирање',
  'Applying': 'Применување',
  'Analyzing': 'Анализирање',
  'Evaluating': 'Евалуирање',
  'Creating': 'Креирање',
};

const BLOOM_ORDER = ['Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating'];

export const PlannerMetaAnalysis: React.FC<Props> = ({ items, lessonPlans }) => {
  const analysis = useMemo(() => {
    let totalObjectives = 0;
    const counts: Record<string, number> = {
      'Remembering': 0, 'Understanding': 0, 'Applying': 0,
      'Analyzing': 0, 'Evaluating': 0, 'Creating': 0
    };

    const periodPlans = items
      .filter(item => item.type === PlannerItemType.LESSON && item.lessonPlanId)
      .map(item => lessonPlans.find(p => p.id === item.lessonPlanId))
      .filter((p): p is LessonPlan => !!p);

    periodPlans.forEach(plan => {
      plan.objectives?.forEach(obj => {
        if (obj.bloomsLevel) {
          counts[obj.bloomsLevel] = (counts[obj.bloomsLevel] || 0) + 1;
          totalObjectives++;
        }
      });
    });

    const highOrder = counts['Analyzing'] + counts['Evaluating'] + counts['Creating'];
    const midOrder = counts['Applying'];
    const lowOrder = counts['Remembering'] + counts['Understanding'];

    let tips: string[] = [];
    if (totalObjectives > 0) {
      const highPerc = (highOrder / totalObjectives) * 100;
      const lowPerc = (lowOrder / totalObjectives) * 100;

      if (lowPerc > 70) {
        tips.push("Часовите се претежно фокусирани на основно помнење и разбирање. Обидете се да додадете сценарија од реалниот живот (Применување) за учениците кои побрзо совладуваат.");
      } else if (highPerc > 50 && lowPerc < 20) {
        tips.push("Високо ниво на когнитивно оптоварување (Анализа/Креирање). За учениците со тешкотии, подгответе дополнителни 'чекор-по-чекор' насоки или решени примери за совладување на основите прво.");
      } else {
        tips.push("Одлично избалансирана когнитивна крива на часовите! Користете флексибилни групи за меѓусебна поддршка на учениците врз база на нивната брзина на примена (Applying).");
      }
    } else {
      tips.push("Додадете лекции со дефинирани цели за да ја видите анализата на Блумовата таксономија овде.");
    }

    return { counts, totalObjectives, tips };
  }, [items, lessonPlans]);

  return (
    <Card className="p-4 bg-white/50 border-indigo-100 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-gray-800">Педагошка Мета-анализа</h3>
      </div>

      {analysis.totalObjectives > 0 ? (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-2">
              Блумова Таксономија
            </p>
            <div className="flex h-12 w-full rounded-lg overflow-hidden border border-gray-200 shadow-inner">
              {BLOOM_ORDER.map(level => {
                const count = analysis.counts[level] || 0;
                const perc = (count / analysis.totalObjectives) * 100;
                if (count === 0) return null;
                return (
                  <div 
                    key={level} 
                    className={`${BLOOM_COLORS[level]} h-full transition-all group relative cursor-help flex items-center justify-center`}
                    style={{ width: `${perc}%` }}
                  >
                    {perc > 10 && <span className="text-[10px] font-bold text-white/90 drop-shadow-md">{count}</span>}
                    <div className="absolute opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-xs p-1.5 rounded -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 pointer-events-none transition-opacity">
                      {BLOOM_LABELS[level]}: {count} цели ({perc.toFixed(0)}%)
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
              {BLOOM_ORDER.map(level => (
                <div key={level} className="flex items-center gap-1">
                  <div className={`w-2.5 h-2.5 rounded-sm ${BLOOM_COLORS[level]}`} />
                  <span className="text-[10px] text-gray-600">{BLOOM_LABELS[level]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-1">Совети за Диференцијација</p>
                <ul className="text-xs text-amber-700 space-y-1.5">
                  {analysis.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <ArrowRight className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-50" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">{analysis.tips[0]}</p>
        </div>
      )}
    </Card>
  );
};
