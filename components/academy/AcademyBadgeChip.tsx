import React from 'react';
import { useAcademyBadges } from '../../hooks/useAcademyBadges';
import type { Specialization } from '../../data/academy/specializations';

/**
 * A single earned-specialization pill, styled after the existing "AI" reply
 * badge in components/forum/ForumInternals.tsx — same size/shape, colored
 * per specialization via its own `color` (bg+text) and `borderColor` fields.
 */
export const AcademyBadgeChip: React.FC<{ specialization: Specialization }> = ({ specialization }) => (
  <span
    title={specialization.title}
    className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${specialization.color} ${specialization.borderColor}`}
  >
    <span aria-hidden="true">{specialization.emoji}</span>
  </span>
);

/**
 * Renders up to `max` earned-specialization badges for a given teacher uid,
 * with a "+N" overflow chip beyond that. Safe to mount for any uid, including
 * ones with no academy_badges doc (e.g. 'ai-expert') — resolves to nothing.
 */
export const AcademyBadgeRow: React.FC<{ uid: string | undefined; max?: number }> = ({ uid, max = 2 }) => {
  const { badges } = useAcademyBadges(uid);
  if (badges.length === 0) return null;

  const shown = badges.slice(0, max);
  const overflow = badges.length - shown.length;

  return (
    <span className="inline-flex items-center gap-1">
      {shown.map(spec => <AcademyBadgeChip key={spec.id} specialization={spec} />)}
      {overflow > 0 && (
        <span
          title={badges.slice(max).map(s => s.title).join(', ')}
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-gray-100 text-gray-500 border-gray-200"
        >
          +{overflow}
        </span>
      )}
    </span>
  );
};
