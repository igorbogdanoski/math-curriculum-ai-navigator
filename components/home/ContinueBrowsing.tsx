import React from 'react';
import { Card } from '../common/Card';
import { ICONS } from '../../constants';
import { useNavigation } from '../../contexts/NavigationContext';

interface LastVisitedItem {
  path: string;
  label: string;
  type: 'concept' | 'lesson';
}
interface ContinueBrowsingProps {
  lastVisited: LastVisitedItem | null;
}

export const ContinueBrowsing: React.FC<ContinueBrowsingProps> = ({ lastVisited }) => {
    const { navigate } = useNavigation();
    
    const Icon = lastVisited?.type === 'concept' ? ICONS.bookOpen : ICONS.myLessons;

    return (
        <Card onClick={lastVisited ? () => navigate(lastVisited.path) : () => navigate('/explore')}>
             <h2 className="text-2xl font-semibold text-brand-primary mb-4">Продолжи каде што застана</h2>
             {lastVisited ? (
                <div className="flex items-center gap-3">
                    <Icon className="w-6 h-6 text-brand-secondary flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-gray-800 truncate" title={lastVisited.label}>{lastVisited.label}</p>
                        <p className="text-sm text-brand-secondary hover:underline">Продолжи со работа &rarr;</p>
                    </div>
                </div>
             ) : (
                <div className="flex items-center gap-3">
                    <ICONS.explore className="w-6 h-6 text-brand-secondary flex-shrink-0" />
                     <div>
                        <p className="font-semibold text-gray-800">Истражи ја програмата</p>
                        <p className="text-sm text-gray-500">Започнете со пребарување на теми и поими.</p>
                    </div>
                </div>
             )}
        </Card>
    );
};