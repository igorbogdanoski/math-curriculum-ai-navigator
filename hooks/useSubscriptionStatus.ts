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

/** True if a Pro subscription has expired (proExpiresAt is in the past). */
export function isProExpired(profile: TeachingProfile | null | undefined): boolean {
  if (!profile?.proExpiresAt) return false;
  return new Date(profile.proExpiresAt) < new Date();
}

/** Derive effective tier — respects proExpiresAt expiry for Pro tier. */
export function deriveTier(profile: TeachingProfile | null): SubscriptionTier {
  if (!profile) return 'Free';
  const raw = profile.tier ?? (profile.hasUnlimitedCredits ? 'Unlimited' : profile.isPremium ? 'Pro' : 'Free');
  // Unlimited and School never expire via proExpiresAt
  if (raw === 'Pro' && isProExpired(profile)) return 'Free';
  return raw;
}

/** True if the user profile has unlimited AI generation (no credit deduction needed). */
export function isUnlimitedProfile(profile: TeachingProfile | null | undefined): boolean {
  if (!profile) return false;
  const tier = deriveTier(profile);
  // Pro, Unlimited, and School all get unlimited generation
  return tier === 'Pro' || tier === 'Unlimited' || tier === 'School';
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
