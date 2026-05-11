import React from 'react';
import { Crown, Lock, Sparkles } from 'lucide-react';
import { useNavigation } from '../../contexts/NavigationContext';

export type UpgradeTier = 'Pro' | 'School';

interface UpgradePromptProps {
  feature: string;
  description?: string;
  requiredTier?: UpgradeTier;
  /** Compact inline variant (no card border, smaller) */
  compact?: boolean;
  className?: string;
}

const TIER_META: Record<UpgradeTier, { label: string; color: string; bg: string; border: string; icon: typeof Crown }> = {
  Pro:    { label: 'Pro',    color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200', icon: Crown },
  School: { label: 'School', color: 'text-indigo-700', bg: 'bg-indigo-50',  border: 'border-indigo-200', icon: Sparkles },
};

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  feature,
  description,
  requiredTier = 'Pro',
  compact = false,
  className = '',
}) => {
  const { navigate } = useNavigation();
  const meta = TIER_META[requiredTier];
  const Icon = meta.icon;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${meta.bg} ${meta.color} ${meta.border} border ${className}`}
      >
        <Lock className="w-3 h-3" />
        {feature} — {meta.label}
      </span>
    );
  }

  return (
    <div className={`rounded-2xl border ${meta.border} ${meta.bg} p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 ${className}`}>
      <div className={`flex-shrink-0 w-10 h-10 rounded-xl ${meta.bg} ${meta.border} border flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${meta.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className={`font-bold text-sm ${meta.color}`}>
          {feature} е достапна само за {meta.label} корисници
        </p>
        {description && (
          <p className="text-xs text-gray-600 mt-0.5 leading-snug">{description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => navigate('/pricing')}
        className={`flex-shrink-0 px-4 py-2 rounded-lg text-xs font-black transition-colors ${meta.color} ${meta.bg} ${meta.border} border hover:opacity-80`}
      >
        Надгради на {meta.label} →
      </button>
    </div>
  );
};
