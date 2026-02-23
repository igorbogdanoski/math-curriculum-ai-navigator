import React from 'react';
import { Card } from '../common/Card';
import { ProgressRing } from '../home/ProgressRing';
import { ICONS } from '../../constants';
import { useNavigation } from '../../contexts/NavigationContext';

interface OverallProgressProps {
    stats: {
        totalPlans: number;
        reflectionRate: number;
        standardsCoverage: number;
    };
}

const StatCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ComponentType<{className?: string}>;
    progress?: number;
    emptyHint?: string;
    onClick?: () => void;
}> = ({ title, value, icon: Icon, progress, emptyHint, onClick }) => {
    const isEmpty = progress !== undefined ? progress === 0 : value === 0;
    return (
        <div
            onClick={onClick}
            className={`bg-gray-50 p-4 rounded-lg flex items-center gap-4 border border-gray-100 ${onClick ? 'cursor-pointer hover:bg-white hover:shadow-sm transition-all' : ''}`}
        >
            {progress !== undefined ? (
                <ProgressRing progress={progress} size={48} strokeWidth={5} />
            ) : (
                <div className="p-3 bg-brand-primary/10 rounded-full">
                    <Icon className="w-6 h-6 text-brand-primary" />
                </div>
            )}
            <div className="min-w-0">
                <p className="text-sm text-gray-500">{title}</p>
                <p className="text-2xl font-bold text-brand-primary">{progress !== undefined ? `${value}%` : value}</p>
                {isEmpty && emptyHint && (
                    <p className="text-xs text-gray-400 mt-0.5 leading-tight">{emptyHint}</p>
                )}
            </div>
        </div>
    );
};


export const OverallProgress: React.FC<OverallProgressProps> = ({ stats }) => {
    const { navigate } = useNavigation();
    return (
        <Card>
            <h2 className="text-xl font-semibold text-brand-primary mb-4">Вкупен Напредок</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    title="Вкупно подготовки"
                    value={stats.totalPlans}
                    icon={ICONS.myLessons}
                    emptyHint="Создај прва подготовка"
                    onClick={() => navigate('/planner/lesson/new')}
                />
                <StatCard
                    title="Пополнети рефлексии"
                    value={stats.reflectionRate}
                    icon={ICONS.chatBubble}
                    progress={stats.reflectionRate}
                    emptyHint="Додај рефлексија по час"
                    onClick={() => navigate('/my-lessons')}
                />
                <StatCard
                    title="Покриеност на стандарди"
                    value={stats.standardsCoverage}
                    icon={ICONS.chart}
                    progress={stats.standardsCoverage}
                    emptyHint="Додај концепти во планерот"
                    onClick={() => navigate('/reports/coverage')}
                />
            </div>
        </Card>
    );
};
