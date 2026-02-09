import React from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import type { PlannerItem, LessonPlan } from '../../types';
import { useNavigation } from '../../contexts/NavigationContext';

interface QuickAIStartProps {
  todaysLesson?: PlannerItem;
  tomorrowsLesson?: PlannerItem;
  getLessonPlan: (id: string) => LessonPlan | undefined;
}

const ActionButton: React.FC<{ 
    icon: React.ComponentType<{className?: string}>, 
    title: string, 
    subtitle?: string,
    onClick: () => void,
    colorClass: string,
    iconColorClass: string
}> = ({ icon: Icon, title, subtitle, onClick, colorClass, iconColorClass }) => (
    <button 
        onClick={onClick} 
        className={`flex flex-col justify-between p-4 rounded-2xl border transition-all duration-200 hover:shadow-lg hover:-translate-y-1 ${colorClass} h-32 w-full text-left group relative overflow-hidden`}
    >
        <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none`}>
            <Icon className="w-24 h-24" />
        </div>
        
        <div className={`p-2.5 rounded-xl w-fit ${iconColorClass} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="w-6 h-6 text-white" />
        </div>
        
        <div>
            <span className="block font-bold text-md leading-tight mb-0.5">{title}</span>
            {subtitle && <span className="text-xs opacity-80 font-medium leading-tight">{subtitle}</span>}
        </div>
    </button>
);

export const QuickAIStart: React.FC<QuickAIStartProps> = ({ todaysLesson, tomorrowsLesson, getLessonPlan }) => {
    const { navigate } = useNavigation();

    const getContextForGenerator = (lessonItem: PlannerItem) => {
        const plan = lessonItem.lessonPlanId ? getLessonPlan(lessonItem.lessonPlanId) : null;
        if (!plan) return '';
        const params = new URLSearchParams({
            grade: String(plan.grade),
            topicId: plan.topicId,
            ...(plan.conceptIds && plan.conceptIds.length > 0 && { conceptId: plan.conceptIds[0] }),
        });
        return params.toString();
    }

    return (
        <Card className="h-full flex flex-col bg-white/50 backdrop-blur-sm border-white/60">
            <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-brand-primary flex items-center gap-2">
                    <ICONS.sparkles className="w-5 h-5 text-brand-accent" />
                    Брз AI Старт
                </h2>
            </div>
            
            <div className="grid grid-cols-2 gap-3 flex-1">
                {todaysLesson ? (
                    <ActionButton
                        icon={ICONS.quiz}
                        title="Квиз за денес"
                        subtitle={todaysLesson.title}
                        onClick={() => navigate(`/generator?materialType=QUIZ&${getContextForGenerator(todaysLesson)}`)}
                        colorClass="bg-blue-50 border-blue-100 text-blue-900 hover:bg-blue-100 hover:border-blue-300"
                        iconColorClass="bg-blue-500"
                    />
                ) : (
                     <ActionButton
                        icon={ICONS.generator}
                        title="Нов Тест"
                        subtitle="Генерирај проверка"
                        onClick={() => navigate('/generator?materialType=ASSESSMENT')}
                        colorClass="bg-blue-50 border-blue-100 text-blue-900 hover:bg-blue-100 hover:border-blue-300"
                        iconColorClass="bg-blue-500"
                    />
                )}

                {tomorrowsLesson ? (
                    <ActionButton
                        icon={ICONS.lightbulb}
                        title="Идеја за утре"
                        subtitle="Воведна активност"
                        onClick={() => navigate(`/generator?materialType=SCENARIO&${getContextForGenerator(tomorrowsLesson)}`)}
                        colorClass="bg-amber-50 border-amber-100 text-amber-900 hover:bg-amber-100 hover:border-amber-300"
                        iconColorClass="bg-amber-500"
                    />
                ) : (
                    <ActionButton
                        icon={ICONS.myLessons}
                        title="Нов План"
                        subtitle="Креирај подготовка"
                        onClick={() => navigate('/planner/lesson/new')}
                        colorClass="bg-amber-50 border-amber-100 text-amber-900 hover:bg-amber-100 hover:border-amber-300"
                        iconColorClass="bg-amber-500"
                    />
                )}

                <ActionButton
                    icon={ICONS.assistant}
                    title="AI Асистент"
                    subtitle="Разговарај"
                    onClick={() => navigate('/assistant')}
                    colorClass="bg-purple-50 border-purple-100 text-purple-900 hover:bg-purple-100 hover:border-purple-300"
                    iconColorClass="bg-purple-500"
                />

                <ActionButton
                    icon={ICONS.gallery}
                    title="Илустрација"
                    subtitle="Креирај визуел"
                    onClick={() => navigate('/generator?materialType=ILLUSTRATION')}
                    colorClass="bg-teal-50 border-teal-100 text-teal-900 hover:bg-teal-100 hover:border-teal-300"
                    iconColorClass="bg-teal-500"
                />
            </div>
        </Card>
    );
};