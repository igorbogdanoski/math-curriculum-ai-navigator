// ─── Curriculum domain types ─────────────────────────────────────────────────
// Core curriculum data model: standards, concepts, topics, grades.
// These types are shared across the whole app but have no dependencies
// on planning, assessment, or user types.

export interface NationalStandard {
  id: string;
  code: string;
  description: string;
  category?: string;
  gradeLevel?: number;
  levelDescription?: string;
  relatedConceptIds?: string[];
}

export interface Concept {
  id: string;
  title: string;
  description: string;
  content?: string[];
  priorKnowledgeIds?: string[];
  assessmentStandards: string[];
  nationalStandardIds?: string[];
  activities?: string[];
  levelDescription?: string;
  localContextExamples?: string[];
  gradeLevel?: number;
}

export interface Topic {
  id: string;
  title: string;
  description?: string;
  suggestedHours?: number;
  concepts: Concept[];
  topicLearningOutcomes?: string[];
  levelDescription?: string;
}

/**
 * Secondary education track (Н4).
 * - gymnasium:          Гимназиско, grades 10–12
 * - vocational4:        Стручно 4-годишно, grades 10–12
 * - vocational3:        Стручно 3-годишно, grades 10–12
 * - vocational2:        Стручно 2-годишно, grades 10–11
 * - gymnasium_elective: Гимназиски изборни предмети
 */
export type SecondaryTrack = 'gymnasium' | 'vocational4' | 'vocational3' | 'vocational2' | 'gymnasium_elective';

export const SECONDARY_TRACK_LABELS: Record<SecondaryTrack, string> = {
  gymnasium:          'Гимназиско (X–XIII)',
  vocational4:        'Стручно 4-год (X–XIII)',
  vocational3:        'Стручно 3-год (X–XII)',
  vocational2:        'Стручно 2-год (X–XI)',
  gymnasium_elective: 'Гимназија — Изборни предмети',
};

/**
 * Maps curriculum SecondaryTrack → relevant exam track keys shown in MaturaLibraryView.
 */
export const SECONDARY_TRACK_TO_MATURA_TRACKS: Partial<Record<SecondaryTrack, string[]>> = {
  gymnasium:          ['gymnasium'],
  gymnasium_elective: ['gymnasium'],
  vocational4:        ['vocational-it', 'vocational-economics', 'vocational-electro', 'vocational-mechanical', 'vocational-health', 'vocational-civil', 'vocational-art'],
  vocational3:        ['vocational3-zavrshen', 'vocational-mechanical', 'vocational-civil'],
  vocational2:        ['vocational2-zavrshen'],
} as const;

export interface Grade {
  id: string;
  level: number;
  title: string;
  topics: Topic[];
  transversalStandards?: NationalStandard[];
  levelDescription?: string;
  secondaryTrack?: SecondaryTrack;
  weeklyHours?: 2 | 3 | 4;
}

export interface Curriculum {
  grades: Grade[];
}

export interface SecondaryCurriculumModule {
  track: SecondaryTrack;
  label: string;
  curriculum: Curriculum;
}

export interface ConceptProgression {
  conceptId: string;
  title: string;
  progression: Array<{
    grade: number;
    concept: Concept;
  }>;
}
