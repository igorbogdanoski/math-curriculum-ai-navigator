// ─── Domain type re-exports ───────────────────────────────────────────────────
// Types are defined in types/* domain files; re-exported here for backward
// compatibility — all existing imports from 'types' continue to work unchanged.
import type {
  NationalStandard, Concept, Topic, Grade, Curriculum,
  SecondaryTrack, SecondaryCurriculumModule, ConceptProgression,
} from './types/curriculum';
export type {
  NationalStandard, Concept, Topic, Grade, Curriculum,
  SecondaryTrack, SecondaryCurriculumModule, ConceptProgression,
};
export { SECONDARY_TRACK_LABELS, SECONDARY_TRACK_TO_MATURA_TRACKS } from './types/curriculum';

export type {
  School, StudentProfile, StudentAccount, TeachingProfile, ChatMessage,
} from './types/user';

export * from './types/feedback';
export * from './types/aiContent';
export * from './types/planning';
export * from './types/matura';
export * from './types/gradebook';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { onInput?: (e: Event) => void; 'virtual-keyboard-mode'?: string; placeholder?: string; };
    }
  }
}
