import React from 'react';
import { Card } from '../common/Card';
import { ProgressRing } from '../home/ProgressRing';
import { ICONS } from '../../constants';

interface OverallProgressProps {
    stats: {
        totalPlans: number;
        reflectionRate: number;
        standardsCoverage: number;
    };
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ComponentType<{className?: string}>; progress?: number; }> = ({ title, value, icon: Icon, progress }) => (
    <div className="bg-gray-50 p-4 rounded-lg flex items-center gap-4 border border-gray-100">
        {progress !== undefined ? (
            <ProgressRing progress={progress} size={48} strokeWidth={5} />
        ) : (
            <div className="p-3 bg-brand-primary/10 rounded-full">
                <Icon className="w-6 h-6 text-brand-primary" />
            </div>
        )}
        <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-brand-primary">{progress !== undefined ? `${value}%` : value}</p>
        </div>
    </div>
);


export const OverallProgress: React.FC<OverallProgressProps> = ({ stats }) => {
    return (
        <Card>
            <h2 className="text-xl font-semibold text-brand-primary mb-4">Вкупен Напредок</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard title="Вкупно подготовки" value={stats.totalPlans} icon={ICONS.myLessons} />
                <StatCard title="Пополнети рефлексии" value={stats.reflectionRate} icon={ICONS.chatBubble} progress={stats.reflectionRate} />
                <StatCard title="Покриеност на стандарди" value={stats.standardsCoverage} icon={ICONS.chart} progress={stats.standardsCoverage} />
            </div>
        </Card>
    );
};
