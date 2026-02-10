import React from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';

interface GradePercentage {
    grade: number;
    percentage: number;
}

interface StandardsCoverageCardProps {
    data: GradePercentage[];
}

export const StandardsCoverageCard: React.FC<StandardsCoverageCardProps> = ({ data }) => {
    return (
        <Card className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                <h2 className="text-lg font-bold text-brand-primary flex items-center gap-2">
                    <ICONS.check className="w-5 h-5 text-green-500" />
                    Национални Стандарди
                </h2>
                <span className="text-xs text-gray-400 font-medium">ПО ОДДЕЛЕНИЕ</span>
            </div>

            <div className="flex-1 space-y-4 py-2">
                {data.map((item: GradePercentage) => (
                    <div key={item.grade} className="space-y-1.5">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-semibold text-gray-700">{item.grade}-то одделение</span>
                            <span className="text-xs font-bold text-brand-primary">{item.percentage}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                            <div 
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                    item.percentage > 70 ? 'bg-green-500' : 
                                    item.percentage > 30 ? 'bg-brand-primary' : 
                                    'bg-brand-accent'
                                }`}
                                style={{ width: `${item.percentage}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between">
                <p className="text-[10px] text-gray-400 leading-tight">
                    Процентот се пресметува врз основа на мапирани концепти во вашите подготовки.
                </p>
                <button className="text-brand-primary hover:text-brand-dark transition-colors">
                    <ICONS.arrowRight className="w-4 h-4" />
                </button>
            </div>
        </Card>
    );
};
