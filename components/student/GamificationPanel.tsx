import React from 'react';
import { ACHIEVEMENTS } from '../../services/firestoreService';
import type { StudentGamification } from '../../services/firestoreService';
import { calcFibonacciLevel, getAvatar } from '../../utils/gamification';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  gamification: StudentGamification;
  classRank: { rank: number; total: number } | null;
}

export const GamificationPanel: React.FC<Props> = ({ gamification, classRank }) => {
  const { t } = useLanguage();
  const lvlInfo = calcFibonacciLevel(gamification.totalXP);
  const avatar = getAvatar(lvlInfo.level);

  return (
    <div className="w-full max-w-2xl mb-4">
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex flex-col md:flex-row gap-4 mb-3">
          {/* Level Frame */}
          <div className="flex-1 bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl p-3 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
              <svg width="100" height="100" viewBox="0 0 100 100">
                <path fill="currentColor" d="M50 0 C77.6 0 100 22.4 100 50 C100 77.6 77.6 100 50 100 C22.4 100 0 77.6 0 50 C0 22.4 22.4 0 50 0 Z" />
              </svg>
            </div>
            <div className="flex justify-between items-end mb-2 relative z-10">
              <div>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">{t('progress.learningLevel')}</p>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-2xl shadow-md shadow-indigo-200 select-none">
                    {avatar.emoji}
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-sm leading-tight">
                      {avatar.title} <span className="text-indigo-500 font-bold">{t('progress.level')} {lvlInfo.level}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {gamification.totalXP} XP · {t('progress.untilNextLevel')}: +{lvlInfo.nextLevelXp - lvlInfo.currentXp} XP
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* XP Progress Bar */}
            <div className="w-full bg-indigo-100 rounded-full h-2.5 mt-1 overflow-hidden relative z-10">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-1000 ease-out relative"
                style={{ width: `${lvlInfo.progress}%` }}
              >
                <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-r from-transparent to-white/30 truncate" />
              </div>
            </div>
            {classRank && (
              <div className="mt-2 flex items-center gap-1.5 relative z-10">
                <span className="text-xs font-bold text-indigo-600">🏆 #{classRank.rank}</span>
                <span className="text-[10px] text-indigo-400">
                  {t('progress.ofInClass').replace('{total}', classRank.total.toString())}
                </span>
              </div>
            )}
          </div>

          {/* Streak + Total Quizzes */}
          <div className="flex flex-1 gap-2">
            <div className="flex-1 bg-orange-50 border border-orange-100 rounded-xl p-3 flex flex-col justify-center">
              <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-1">
                {t('progress.streakCurrent').toUpperCase()}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-2xl drop-shadow-sm">{t('progress.streakFire')}</span>
                <div>
                  <p className="font-black text-slate-800 text-sm leading-tight">
                    {gamification.currentStreak} {gamification.currentStreak === 1 ? t('progress.streakDay') : t('progress.streakDays')}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">{t('progress.streakCurrent')}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-3 flex flex-col justify-center">
              <p className="text-[10px] font-bold text-green-500 uppercase tracking-wider mb-1">
                {t('progress.longestStreak').toUpperCase()}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-2xl drop-shadow-sm">{t('progress.streakMedal')}</span>
                <div>
                  <p className="font-black text-slate-800 text-sm leading-tight">{gamification.totalQuizzes}</p>
                  <p className="text-[10px] text-slate-500 font-medium whitespace-nowrap">{t('progress.totalQuizCount')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Achievements */}
        {gamification.achievements.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
              {t('progress.achievements').toUpperCase()}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {gamification.achievements.map(id => {
                const a = ACHIEVEMENTS[id];
                return a ? (
                  <span
                    key={id}
                    title={a.label}
                    className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full"
                  >
                    {a.icon} {a.label}
                  </span>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
