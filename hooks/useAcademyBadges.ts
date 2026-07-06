import { useQuery } from '@tanstack/react-query';
import { academyBadgesService } from '../services/firestoreService.academyBadges';
import { SPECIALIZATIONS, type Specialization } from '../data/academy/specializations';

/**
 * Looks up which Academy specializations a given uid has completed, for
 * display next to their name elsewhere in the app (Scenario Bank, Forum).
 * react-query dedupes reads across every card/row rendering the same uid on
 * one page — same pattern as hooks/useClassInsights.ts.
 */
export function useAcademyBadges(uid: string | undefined): { badges: Specialization[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['academy-badges', uid],
    queryFn: () => academyBadgesService.getBadges(uid as string),
    enabled: !!uid,
    staleTime: 30 * 60 * 1000,
  });

  const ids = data ?? [];
  const badges = SPECIALIZATIONS.filter(spec => ids.includes(spec.id));

  return { badges, isLoading: !!uid && isLoading };
}
