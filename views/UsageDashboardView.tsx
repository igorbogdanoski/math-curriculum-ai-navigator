import React, { useEffect, useState } from 'react';
import {
  Zap, Crown, TrendingUp, AlertTriangle, CheckCircle2,
  Sparkles, BarChart3, BookOpen, Presentation, FileText,
  Brain, Target, Layers, ExternalLink,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AI_COSTS } from '../services/gemini/core';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { CACHE_COLLECTION } from '../services/gemini/core';

// ── Types ────────────────────────────────────────────────────────────────────

interface CacheEntry {
  type: string;
  createdAt: { toDate?: () => Date } | null;
}

// ── Feature cost breakdown ────────────────────────────────────────────────────

const FEATURE_COSTS = [
  { label: 'Квиз / Тест генерација',         cost: AI_COSTS.TEXT_BASIC,    icon: FileText,      color: 'text-blue-600',   bg: 'bg-blue-50' },
  { label: 'Масовна генерација',             cost: AI_COSTS.BULK,          icon: Layers,        color: 'text-violet-600', bg: 'bg-violet-50' },
  { label: 'Варијанти на прашања',           cost: AI_COSTS.VARIANTS,      icon: Target,        color: 'text-emerald-600',bg: 'bg-emerald-50' },
  { label: 'Патека на учење',               cost: AI_COSTS.LEARNING_PATH, icon: TrendingUp,    color: 'text-orange-600', bg: 'bg-orange-50' },
  { label: 'Презентација (Math Gamma)',      cost: AI_COSTS.PRESENTATION,  icon: Presentation,  color: 'text-pink-600',   bg: 'bg-pink-50' },
  { label: 'AI илустрација',                cost: AI_COSTS.ILLUSTRATION,  icon: Sparkles,      color: 'text-amber-600',  bg: 'bg-amber-50' },
  { label: 'Годишен план',                  cost: AI_COSTS.ANNUAL_PLAN,   icon: BookOpen,      color: 'text-teal-600',   bg: 'bg-teal-50' },
];

// ── Tier config ───────────────────────────────────────────────────────────────

function getTierInfo(user: { tier?: string; isPremium?: boolean; hasUnlimitedCredits?: boolean } | null) {
  if (!user) return { label: 'Бесплатно', color: 'text-slate-600', bg: 'bg-slate-100', isUnlimited: false };
  if (user.hasUnlimitedCredits || user.tier === 'Unlimited') return { label: 'Unlimited', color: 'text-emerald-700', bg: 'bg-emerald-100', isUnlimited: true };
  if (user.isPremium || user.tier === 'Pro') return { label: 'Pro', color: 'text-indigo-700', bg: 'bg-indigo-100', isUnlimited: true };
  if (user.tier === 'School') return { label: 'School', color: 'text-indigo-700', bg: 'bg-indigo-100', isUnlimited: true };
  return { label: 'Бесплатно', color: 'text-slate-600', bg: 'bg-slate-100', isUnlimited: false };
}

// ── Balance gauge ─────────────────────────────────────────────────────────────

const BalanceGauge: React.FC<{ balance: number; maxDisplay?: number }> = ({ balance, maxDisplay = 200 }) => {
  const pct = Math.min(100, (balance / maxDisplay) * 100);
  const color = balance > 50 ? 'bg-emerald-500' : balance > 10 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={balance}
        aria-valuemin={0}
        aria-valuemax={maxDisplay}
      />
    </div>
  );
};

// ── Main view ─────────────────────────────────────────────────────────────────

export function UsageDashboardView() {
  const { user, firebaseUser } = useAuth();
  const tier = getTierInfo(user);
  const balance = user?.aiCreditsBalance ?? 0;
  const isLowBalance = !tier.isUnlimited && balance <= 10;

  const [recentCount, setRecentCount] = useState<number | null>(null);
  const [typeBreakdown, setTypeBreakdown] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!firebaseUser?.uid) return;
    const uid = firebaseUser.uid;
    getDocs(
      query(
        collection(db, CACHE_COLLECTION),
        where('teacherUid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(50),
      ),
    ).then(snap => {
      setRecentCount(snap.size);
      const breakdown: Record<string, number> = {};
      snap.docs.forEach(d => {
        const data = d.data() as CacheEntry;
        const t = data.type ?? 'other';
        breakdown[t] = (breakdown[t] ?? 0) + 1;
      });
      setTypeBreakdown(breakdown);
    }).catch(() => {
      setRecentCount(0);
    });
  }, [firebaseUser?.uid]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
          <BarChart3 className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">AI Употреба и Кредити</h1>
          <p className="text-sm text-gray-500 mt-0.5">Преглед на тековната состојба на вашиот AI буџет</p>
        </div>
      </div>

      {/* Low balance warning */}
      {isLowBalance && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">Кредитите се при крај!</p>
            <p className="text-xs text-amber-700 mt-0.5">Останале само <strong>{balance}</strong> кредити. Надградете на Pro за неограничено генерирање.</p>
          </div>
          <a
            href="#/pricing"
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <Crown className="w-3.5 h-3.5" /> Надгради
          </a>
        </div>
      )}

      {/* Balance card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">Тековен баланс</p>
            <div className="flex items-end gap-2 mt-1">
              {tier.isUnlimited ? (
                <span className="text-4xl font-black text-emerald-600">∞</span>
              ) : (
                <span className="text-4xl font-black text-gray-900">{balance}</span>
              )}
              {!tier.isUnlimited && <span className="text-gray-400 text-sm mb-1">кредити</span>}
            </div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm ${tier.bg} ${tier.color}`}>
            <Crown className="w-4 h-4" />
            {tier.label}
          </div>
        </div>

        {!tier.isUnlimited && (
          <div className="space-y-2">
            <BalanceGauge balance={balance} />
            <div className="flex justify-between text-xs text-gray-400">
              <span>0</span>
              <span>Стартни 50 кредити</span>
            </div>
          </div>
        )}

        {tier.isUnlimited && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-4 py-2.5">
            <CheckCircle2 className="w-4 h-4" />
            Pro план активен — неограничени AI генерации
          </div>
        )}
      </div>

      {/* Recent activity */}
      {recentCount !== null && recentCount > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-500" />
            Кеширани AI материјали
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl font-black text-indigo-600">{recentCount}</div>
            <div className="text-sm text-gray-500">генерирани и кешира<br />ни материјали</div>
          </div>
          {Object.keys(typeBreakdown).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(typeBreakdown)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([type, count]) => (
                  <div key={type} className="bg-gray-50 rounded-xl px-3 py-2 text-center">
                    <div className="text-lg font-bold text-gray-800">{count}</div>
                    <div className="text-[10px] text-gray-500 capitalize">{type.replace(/_/g, ' ')}</div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Feature costs */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          Цена по операција
        </h2>
        <div className="space-y-2">
          {FEATURE_COSTS.map(({ label, cost, icon: Icon, color, bg }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${bg}`}>
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <span className="text-sm text-gray-700">{label}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-gray-800">{cost}</span>
                <span className="text-xs text-gray-400">кред.</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          * Туторингот, hint-овите и основните прашања не трошат кредити.
          Кредитите се одбиваат само за сложени AI генерации.
        </p>
      </div>

      {/* Upgrade CTA for free users */}
      {!tier.isUnlimited && (
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white">
          <div className="flex items-start gap-4">
            <Crown className="w-8 h-8 text-yellow-300 shrink-0" />
            <div className="flex-1">
              <h2 className="font-black text-lg mb-1">Надгради на Pro — 1200 МКД/год.</h2>
              <p className="text-indigo-100 text-sm mb-4">
                Неограничени AI генерации, Gamma презентации, диференцирани материјали 3×,
                годишен план, IEP поддршка и приоритетна поддршка.
              </p>
              <a
                href="#/pricing"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-white text-indigo-700 font-black rounded-xl hover:bg-indigo-50 transition-colors text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                Погледни ги плановите
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
