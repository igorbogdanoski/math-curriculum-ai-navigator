// ─── Wave C2 — Feedback Reason Taxonomy ────────────────────────────────────
export type FeedbackReasonCode =
  | 'grammar'           // Language/grammar issues
  | 'pedagogy'          // Pedagogically questionable
  | 'incomplete'        // Missing key content
  | 'clarity'           // Unclear or confusing
  | 'accuracy'          // Mathematically/factually incorrect
  | 'example_needed'    // Needs concrete examples
  | 'structure'         // Poor organization/structure
  | 'language'          // Language appropriateness
  | 'depth'             // Too shallow or too advanced
  | 'relevance'         // Not relevant to learning objective
  | 'assessment_alignment' // Misaligned with assessment standard
  | 'other';            // Other/custom reason

export interface FeedbackReasonLabel {
  code: FeedbackReasonCode;
  label: string;
  description: string;
  category: 'content' | 'pedagogy' | 'clarity' | 'alignment' | 'other';
}

export const FEEDBACK_REASON_TAXONOMY: Record<FeedbackReasonCode, FeedbackReasonLabel> = {
  grammar: {
    code: 'grammar',
    label: 'Grammar/Spelling',
    description: 'Language or spelling errors',
    category: 'clarity',
  },
  pedagogy: {
    code: 'pedagogy',
    label: 'Pedagogically Unsound',
    description: 'Not aligned with best teaching practices',
    category: 'pedagogy',
  },
  incomplete: {
    code: 'incomplete',
    label: 'Incomplete Content',
    description: 'Missing key information or topics',
    category: 'content',
  },
  clarity: {
    code: 'clarity',
    label: 'Unclear/Confusing',
    description: 'Not clear or easy to understand',
    category: 'clarity',
  },
  accuracy: {
    code: 'accuracy',
    label: 'Inaccurate',
    description: 'Mathematically or factually incorrect',
    category: 'content',
  },
  example_needed: {
    code: 'example_needed',
    label: 'Needs Examples',
    description: 'Needs concrete examples or illustrations',
    category: 'content',
  },
  structure: {
    code: 'structure',
    label: 'Poor Structure',
    description: 'Poorly organized or structured',
    category: 'clarity',
  },
  language: {
    code: 'language',
    label: 'Language Issues',
    description: 'Language level inappropriate for target audience',
    category: 'clarity',
  },
  depth: {
    code: 'depth',
    label: 'Depth Problem',
    description: 'Too shallow or too advanced for grade level',
    category: 'content',
  },
  relevance: {
    code: 'relevance',
    label: 'Not Relevant',
    description: 'Not relevant to learning objective',
    category: 'alignment',
  },
  assessment_alignment: {
    code: 'assessment_alignment',
    label: 'Assessment Misalignment',
    description: 'Not aligned with assessment standards',
    category: 'alignment',
  },
  other: {
    code: 'other',
    label: 'Other Reason',
    description: 'Other reason (see feedback comments)',
    category: 'other',
  },
};

export interface MaterialFeedback {
  id: string;
  materialId: string;
  reviewedBy: string;
  reviewedAt: any;          // Firestore timestamp
  status: 'approved' | 'rejected' | 'revision_requested';
  reasonCodes: FeedbackReasonCode[];  // Primary reason codes
  comments: string;         // Free-text feedback
  suggestedEdits?: {
    section: string;
    original: string;
    suggested: string;
  }[];
}

export interface FeedbackReasonBreakdown {
  totalFeedback: number;
  approved: number;
  rejected: number;
  revision_requested: number;
  reasonCounts: Record<FeedbackReasonCode, number>;
  reasonPercentages: Record<FeedbackReasonCode, number>;
  topReasons: Array<{ code: FeedbackReasonCode; count: number; percentage: number }>;
  periodDays: number;
  generatedAt: any;
}
