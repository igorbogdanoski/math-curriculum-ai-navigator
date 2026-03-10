import React, { useEffect, useState } from 'react';
import { Trophy, Loader2 } from 'lucide-react';
import { firestoreService, type StudentGamification } from '../../services/firestoreService';
import { calcFibonacciLevel, getAvatar } from '../../utils/gamification';
import { useLanguage } from '../../i18n/LanguageContext';

interface Props {
  teacherUid: string;
}

type LeagueTier = 'bronze' | 'silver' | 'gold';

const LEAGUE_TIERS: Record<LeagueTier, { label: string; minLevel: number; color: string; bg: string; border: string }> = {
  bronze: { label: '🥉 Бронзена лига', minLevel: 1, color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200' },
  silver: { label: '🥈 Сребрена лига', minLevel: 3, color: 'text-slate-600', bg: 'bg-slate-50',  border: 'border-slate-200' },
  gold:   { label: '🥇 Златна лига',   minLevel: 6, color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-300' },
};

function getTier(level: number): LeagueTier {
  if (level >= 6) return 'gold';
  if (level >= 3) return 'silver';
  return 'bronze';
}

interface LeaderRow {
  gamification: StudentGamification;
  level: number;
  avatar: { emoji: string; title: string };
  tier: LeagueTier;
}

export const LeagueTab: React.FC<Props> = ({ teacherUid }) => {
  const [rows, setRows] = useState<LeaderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  useEffect(() => {
    if (!teacherUid) return;
    setLoading(true);
    firestoreService.fetchClassLeaderboard(teacherUid)
      .then(data => {
        const enriched: LeaderRow[] = data.map(g => {
          const lvl = calcFibonacciLevel(g.totalXP).level;
          return { gamification: g, level: lvl, avatar: getAvatar(lvl), tier: getTier(lvl) };
        });
        setRows(enriched);
      })
      .finally(() => setLoading(false));
  }, [teacherUid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> {t('analytics.league.loading')}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Trophy className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-semibold">Нема податоци за лига.</p>
        <p className="text-sm mt-1">Учениците треба да завршат квизови за да се pojvat тука.</p>
      </div>
    );
  }

  // Top 3 podium
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  // Group rest by tier
  const tierOrder: LeagueTier[] = ['gold', 'silver', 'bronze'];

  return (
    <div className="space-y-6">
      {/* Podium */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-6">
        <h3 className="text-sm font-bold text-indigo-500 uppercase tracking-widest mb-4 text-center">Топ 3 на одделението</h3>
        <div className="flex items-end justify-center gap-4">
          {/* 2nd place */}
          {top3[1] && (
            <div className="flex flex-col items-center">
              <span className="text-3xl mb-1">{top3[1].avatar.emoji}</span>
              <p className="text-xs font-bold text-slate-700 max-w-[80px] truncate text-center">{top3[1].gamification.studentName}</p>
              <p className="text-[10px] text-slate-500">{top3[1].gamification.totalXP} XP</p>
              <div className="w-16 h-10 bg-slate-300 rounded-t-lg flex items-center justify-center mt-1">
                <span className="font-black text-slate-600">2</span>
              </div>
            </div>
          )}
          {/* 1st place */}
          {top3[0] && (
            <div className="flex flex-col items-center">
              <span className="text-4xl mb-1">{top3[0].avatar.emoji}</span>
              <span className="text-lg">👑</span>
              <p className="text-xs font-black text-slate-800 max-w-[90px] truncate text-center">{top3[0].gamification.studentName}</p>
              <p className="text-[10px] text-slate-500">{top3[0].gamification.totalXP} XP</p>
              <div className="w-20 h-14 bg-yellow-400 rounded-t-lg flex items-center justify-center mt-1">
                <span className="font-black text-yellow-900 text-lg">1</span>
              </div>
            </div>
          )}
          {/* 3rd place */}
          {top3[2] && (
            <div className="flex flex-col items-center">
              <span className="text-3xl mb-1">{top3[2].avatar.emoji}</span>
              <p className="text-xs font-bold text-slate-700 max-w-[80px] truncate text-center">{top3[2].gamification.studentName}</p>
              <p className="text-[10px] text-slate-500">{top3[2].gamification.totalXP} XP</p>
              <div className="w-16 h-8 bg-amber-600 rounded-t-lg flex items-center justify-center mt-1">
                <span className="font-black text-amber-100">3</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Full ranked list grouped by tier */}
      {tierOrder.map(tier => {
        const tierRows = rows.filter(r => r.tier === tier);
        if (tierRows.length === 0) return null;
        const meta = LEAGUE_TIERS[tier];
        return (
          <div key={tier} className={`border ${meta.border} rounded-2xl overflow-hidden`}>
            <div className={`${meta.bg} px-4 py-2.5 border-b ${meta.border}`}>
              <span className={`text-sm font-black ${meta.color}`}>{meta.label}</span>
              <span className="text-xs text-gray-400 ml-2">Лв. {meta.minLevel}{tier === 'gold' ? '+' : `–${tier === 'silver' ? 5 : 2}`}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {tierRows.map((row, i) => {
                const rank = rows.indexOf(row) + 1;
                const lvlInfo = calcFibonacciLevel(row.gamification.totalXP);
                return (
                  <div key={row.gamification.studentName} className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition">
                    <span className="w-6 text-center text-xs font-black text-gray-400">{rank}</span>
                    <span className="text-xl">{row.avatar.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800 truncate">{row.gamification.studentName}</p>
                      <p className="text-[10px] text-gray-400">{row.avatar.title} · Лв.{row.level} · 🔥 {row.gamification.currentStreak} · 📝 {row.gamification.totalQuizzes} квизови</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-indigo-600">{row.gamification.totalXP} XP</p>
                      {/* Mini progress bar */}
                      <div className="w-20 bg-gray-100 rounded-full h-1.5 mt-1">
                        <div
                          className="bg-indigo-400 h-1.5 rounded-full"
                          style={{ width: `${lvlInfo.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
