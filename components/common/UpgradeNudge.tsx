import React from 'react';
import { Zap, AlertTriangle } from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';
import { useSubscriptionStatus } from '../../hooks/useSubscriptionStatus';

interface UpgradeNudgeProps {
  /** Override the auto-detected status (for Storybook / tests). */
  forceShow?: 'low_credits' | 'free_tier';
  className?: string;
}

export const UpgradeNudge: React.FC<UpgradeNudgeProps> = ({ forceShow, className = '' }) => {
  const { navigate } = useNavigation();
  const { isLowCredits, creditsBalance, tier } = useSubscriptionStatus();

  const showLowCredits = forceShow === 'low_credits' || isLowCredits;
  const showFreeTier   = forceShow === 'free_tier'   || (!showLowCredits && tier === 'Free');

  if (!showLowCredits && !showFreeTier) return null;

  if (showLowCredits) {
    return (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm ${className}`}
        role="alert"
      >
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">
          {creditsBalance <= 0
            ? 'AI кредитите се исцрпени.'
            : `Само ${creditsBalance} AI кредити преостануваат.`}
        </span>
        <button
          onClick={() => navigate('/pricing')}
          className="font-bold underline underline-offset-2 whitespace-nowrap"
        >
          Надгради →
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm ${className}`}
    >
      <Zap className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">Пробај Pro — неограничени AI генерации.</span>
      <button
        onClick={() => navigate('/pricing')}
        className="font-bold underline underline-offset-2 whitespace-nowrap"
      >
        Дознај повеќе →
      </button>
    </div>
  );
};
