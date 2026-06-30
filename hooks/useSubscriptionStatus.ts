import { useAuth } from '../contexts/AuthContext';
import type { TeachingProfile } from '../types';

export type SubscriptionTier = 'Free' | 'Pro' | 'School' | 'Unlimited';

/** Amber "low credits" UI trigger — consistent across Sidebar, UpgradeNudge, and generator guard. */
export const LOW_CREDITS_THRESHOLD = 5;
/** Early warning threshold — emit analytics event when approaching this level. */
export const CREDITS_WARN_EARLY = 10;

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  creditsBalance: number;
  isLowCredits: boolean;
  isUnlimited: boolean;
  isPro: boolean;
}

/** Derive tier from profile fields — tier field takes precedence. */
export function deriveTier(profile: TeachingProfile | null): SubscriptionTier {
  if (!profile) return 'Free';
  if (profile.tier) return profile.tier;
  if (profile.hasUnlimitedCredits) return 'Unlimited';
  if (profile.isPremium) return 'Pro';
  return 'Free';
}

/** True if the user profile has unlimited AI generation (no credit deduction needed). */
export function isUnlimitedProfile(profile: TeachingProfile | null | undefined): boolean {
  if (!profile) return false;
  const tier = deriveTier(profile);
  return tier === 'Unlimited' || tier === 'School' || !!profile.hasUnlimitedCredits || !!profile.isPremium;
}

export function useSubscriptionStatus(): SubscriptionStatus {
  const { user } = useAuth();
  const tier = deriveTier(user);
  const creditsBalance = user?.aiCreditsBalance ?? 0;
  const isUnlimited = tier === 'Unlimited' || tier === 'School' || (user?.hasUnlimitedCredits ?? false);
  const isPro = tier === 'Pro' || isUnlimited;
  const isLowCredits = !isUnlimited && creditsBalance <= LOW_CREDITS_THRESHOLD;

  return { tier, creditsBalance, isLowCredits, isUnlimited, isPro };
}
