import React from 'react';
import { MessageSquare, TrendingUp, Users } from 'lucide-react';
import type { ForumStats } from '../../services/firestoreService.forum';

export const StatsBanner: React.FC<{ stats: ForumStats }> = ({ stats }) => (
  <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl">
    <div className="flex items-center gap-2 text-sm">
      <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
        <MessageSquare className="w-4 h-4 text-indigo-600" />
      </div>
      <div>
        <div className="font-black text-indigo-700 text-base leading-none">{stats.totalThreads}</div>
        <div className="text-[10px] text-gray-500 font-medium">вкупно нишки</div>
      </div>
    </div>
    <div className="flex items-center gap-2 text-sm">
      <div className="w-8 h-8 bg-emerald-100 rounded-xl flex items-center justify-center">
        <TrendingUp className="w-4 h-4 text-emerald-600" />
      </div>
      <div>
        <div className="font-black text-emerald-700 text-base leading-none">{stats.activeThisWeek}</div>
        <div className="text-[10px] text-gray-500 font-medium">нови оваа недела</div>
      </div>
    </div>
    <div className="flex items-center gap-2 text-sm">
      <div className="w-8 h-8 bg-violet-100 rounded-xl flex items-center justify-center">
        <Users className="w-4 h-4 text-violet-600" />
      </div>
      <div>
        <div className="font-black text-violet-700 text-base leading-none">CoP</div>
        <div className="text-[10px] text-gray-500 font-medium">Community of Practice</div>
      </div>
    </div>
  </div>
);
