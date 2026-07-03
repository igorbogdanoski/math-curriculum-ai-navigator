import type { Grade, Topic, Concept, NationalStandard } from './curriculum';
import type { FeedbackReasonCode } from './feedback';

// ─── Webb's Depth of Knowledge ────────────────────────────────────────────────
export const DOK_META = {
  1: { label: 'DoK 1', title: 'Recall & Reproduction', mk: 'Припомнување', color: 'bg-sky-100 text-sky-700 border-sky-200', dot: 'bg-sky-500', hex: '#0ea5e9' },
  2: { label: 'DoK 2', title: 'Skills & Concepts',     mk: 'Вештини',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', hex: '#10b981' },
  3: { label: 'DoK 3', title: 'Strategic Thinking',    mk: 'Стратешко',     color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', hex: '#f59e0b' },
  4: { label: 'DoK 4', title: 'Extended Thinking',     mk: 'Проширено',     color: 'bg-rose-100 text-rose-700 border-rose-200', dot: 'bg-rose-500', hex: '#f43f5e' },
} as const;

export type DokLevel = 1 | 2 | 3 | 4;

export type MaterialType = 'SCENARIO' | 'ASSESSMENT' | 'RUBRIC' | 'FLASHCARDS' | 'QUIZ' | 'ILLUSTRATION' | 'EXIT_TICKET' | 'LEARNING_PATH' | 'WORKED_EXAMPLE' | 'PRESENTATION' | 'VIDEO_EXTRACTOR' | 'IMAGE_EXTRACTOR' | 'WEB_EXTRACTOR';

export interface PresentationSlide {
  title: string;
  content: string[];
  solution?: string[];       // Revealed on demand (task/example)
  rightContent?: string[];   // Second column for comparison slides
  concept?: string;          // Teaching concept focus for contextual continuity
  formulas?: string[];       // Explicit formulas introduced on this slide
  priorFormulas?: string[];  // Formula references from previous slide(s)
  visualPrompt?: string;     // English prompt for AI SVG illustration
  speakerNotes?: string;     // Hidden notes visible only in speaker mode
  estimatedSeconds?: number; // Suggested time on this slide (default: 60)
  // chart-embed: DataViz chart injected directly into Gamma Mode
  chartData?: { headers: string[]; rows: (string | number)[][] };
  chartConfig?: Record<string, unknown>;
  // shape-3d: interactive 3D geometry viewer in Gamma Mode
  shape3dShape?: string;
  // algebra-tiles: interactive algebra tiles manipulative in Gamma Mode
  algebraTilesExpression?: string;
  type: 'title' | 'content' | 'example' | 'task' | 'summary' | 'step-by-step'
      | 'formula-centered' | 'chart-embed' | 'comparison' | 'proof' | 'shape-3d' | 'algebra-tiles';
  /** Webb's Depth of Knowledge level for this slide's primary task/objective */
  dokLevel?: 1 | 2 | 3 | 4;
}

export interface AIGeneratedPresentation {
  title: string;
  topic: string;
  gradeLevel: number;
  slides: PresentationSlide[];
}

export interface WorkedExampleStep {
  phase: 'solved' | 'partial' | 'quiz';
  title: string;
  problem: string;
  solution?: string[];
  partialPlaceholder?: string;
}

export interface AIGeneratedWorkedExample {
  concept: string;
  gradeLevel: number;
  steps: [WorkedExampleStep, WorkedExampleStep, WorkedExampleStep];
}

// Г1 — Адаптивна домашна задача по квиз
export interface HomeworkExercise {
  number: number;
  problem: string;
  hint?: string;
}

export interface AdaptiveHomework {
  conceptTitle: string;
  gradeLevel: number;
  level: 'remedial' | 'standard' | 'challenge';
  levelLabel: string;
  encouragement: string;
  exercises: HomeworkExercise[];
}

export type BloomsLevel = 'Remembering' | 'Understanding' | 'Applying' | 'Analyzing' | 'Evaluating' | 'Creating';

// AI Service Types
export enum QuestionType {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  SHORT_ANSWER = 'SHORT_ANSWER',
  TRUE_FALSE = 'TRUE_FALSE',
  ESSAY = 'ESSAY',
  FILL_IN_THE_BLANK = 'FILL_IN_THE_BLANK',
}

export type DifferentiationLevel = 'standard' | 'support' | 'advanced';

/** Structured data table for statistics/data-work questions */
export interface QuestionTableData {
  headers: string[];
  rows: (string | number)[][];
  caption?: string;
}

export interface AssessmentQuestion {
  id?: number;
  type: QuestionType | string;
  question: string;
  options?: string[];
  answer: string;
  imageUrl?: string;
  /** AI-generated inline SVG diagram (geometry questions) */
  svgDiagram?: string;
  /** Structured data table (statistics questions) */
  tableData?: QuestionTableData;
  /** DataViz chart embedded in the question (Statistics/Data questions) — teacher-added */
  chartData?: { headers: string[]; rows: (string | number)[][] };
  chartConfig?: { type?: string; title?: string; xLabel?: string; yLabel?: string; unit?: string; colorPalette?: string[]; bins?: number };
  levelDescription?: string;

  solution?: string;
    isWorkedExample?: boolean;
    workedExampleType?: 'full' | 'partial';

  // For context-based generation
  cognitiveLevel: 'Remembering' | 'Understanding' | 'Applying' | 'Analyzing' | 'Evaluating' | 'Creating';
  difficulty_level?: 'Easy' | 'Medium' | 'Hard';
  alignment_justification?: string;
  concept_evaluated?: string;
  /** Webb's Depth of Knowledge level (1=Recall, 2=Skill/Concept, 3=Strategic Thinking, 4=Extended Thinking) */
  dokLevel?: 1 | 2 | 3 | 4;
  /** Algebra tiles expression to render as visual aid alongside the question */
  algebraTilesExpression?: string;
}

export interface SavedQuestion {
  id: string;
  teacherUid: string;
  question: string;
  type: string;
  options?: string[];
  answer: string;
  imageUrl?: string;
  solution?: string;
    isWorkedExample?: boolean;
    workedExampleType?: 'full' | 'partial';
  cognitiveLevel?: string;
  difficulty_level?: string;
  /** Webb's Depth of Knowledge level */
  dokLevel?: 1 | 2 | 3 | 4;
  conceptId?: string;
  conceptTitle?: string;
  topicId?: string;
  gradeLevel?: number;
  savedAt?: any;
  isVerified?: boolean;
  verifiedAt?: any;
  isPublic?: boolean;
  isApproved?: boolean;
  reviewStatus?: 'pending' | 'approved' | 'revision_requested' | 'rejected';
  reviewReasonCodes?: FeedbackReasonCode[];
  reviewComments?: string;
  reviewedBy?: string;
  reviewedAt?: any;
  upvotes?: number;
  downvotes?: number;
}

export interface AIGeneratedAssessment {
  title: string;
  type: 'TEST' | 'WORKSHEET' | 'QUIZ' | 'FLASHCARDS';
  questions: AssessmentQuestion[];
  selfAssessmentQuestions?: string[];
  illustrationUrl?: string; // AI Generated Contextual Illustration
  error?: string;
  levelDescription?: string;
  differentiationLevel?: DifferentiationLevel;

  // For context-based generation
  alignment_goal?: string;
  totalQuestions?: number;

  // NEW for differentiation
  differentiatedVersions?: {
    profileName: string;
    questions: AssessmentQuestion[];
  }[];

  /** Set to true when AI response was truncated due to token limits and structurally recovered */
  _isPartial?: boolean;
}

export interface AIGeneratedIdeas {
  title: string;
  openingActivity: string;
  mainActivity: Array<{
    text: string;
    bloomsLevel: BloomsLevel;
  }>;
  differentiation: string;
  assessmentIdea: string;
  assessmentStandards?: string[];
  concepts?: string[];
  illustrationUrl?: string; // AI Generated Contextual Illustration
  error?: string;
  levelDescription?: string;
  generationContext?: GenerationContext;
  extractionBundle?: {
    formulas: string[];
    theories: string[];
    tasks: string[];
    rawSnippet: string;
  };
  sourceMeta?: {
    sourceType: 'video' | 'image' | 'web';
    sourceUrl?: string;
    sourceUrls?: string[];
    videoSegments?: Array<{
      startSec: number;
      endSec: number;
      text: string;
      segmentType: 'theory' | 'task' | 'example' | 'illustration' | 'mixed';
      illustrationPrompt?: string;
    }>;
    conceptIds?: string[];
    topicId?: string;
    gradeLevel?: number;
    secondaryTrack?: string;
    extractionQuality?: {
      score: number;
      label: 'poor' | 'fair' | 'good' | 'excellent';
      formulaCoverage: number;
      theoryCoverage: number;
      taskCoverage: number;
      textSignal: number;
    };
  };
}

export type VisionAssessmentMode = 'homework_feedback' | 'test_grading' | 'content_extraction';

export interface PedagogicalFeedbackEntry {
  itemRef: string;
  misconceptionType?: string;
  feedback: string;
  correctionSteps?: string[];
  confidence?: number;
}

export interface ScanArtifactRecord {
  id: string;
  createdAt: string;
  updatedAt?: string;
  teacherUid: string;
  schoolId?: string;
  mode: VisionAssessmentMode;
  sourceType: 'image' | 'pdf' | 'web' | 'video';
  sourceUrl?: string;
  sourceUrls?: string[];
  storagePath?: string;
  mimeType?: string;
  gradeLevel?: number;
  topicId?: string;
  conceptIds?: string[];
  extractedText?: string;
  normalizedText?: string;
  extractionBundle?: {
    formulas: string[];
    theories: string[];
    tasks: string[];
    rawSnippet: string;
  };
  pedagogicalFeedback?: PedagogicalFeedbackEntry[];
  gradingSummary?: {
    earnedPoints?: number;
    maxPoints?: number;
    percentage?: number;
  };
  artifactQuality?: {
    score: number;
    label: 'poor' | 'fair' | 'good' | 'excellent';
    truncated?: boolean;
  };
  teacherOverride?: {
    updatedBy: string;
    updatedAt: string;
    reason?: string;
  };
}

export interface AIGeneratedPracticeMaterial {
    title: string;
    items: {
        type: 'problem' | 'question';
        text: string;
        answer?: string;
    }[];
    error?: string;
}

export interface RubricLevel {
  levelName: string; // e.g., "Напредно ниво (5)"
  description: string;
  points: string; // e.g., "9-10"
}

export interface RubricCriterion {
  criterion: string; // e.g., "Математичка точност"
  levels: RubricLevel[];
}

export interface AIGeneratedRubric {
  title: string;
  criteria: RubricCriterion[];
  error?: string;
}

export interface AIGeneratedIllustration {
  imageUrl: string;
  prompt: string;
  error?: string;
}

// NEW: Learning Path Types
export interface LearningPathStep {
    stepNumber: number;
    activity: string;
    type: 'Introductory' | 'Practice' | 'Consolidation' | 'Assessment' | 'Project';
}

export interface LearningPath {
    profileName: string;
    steps: LearningPathStep[];
}

export interface AIGeneratedLearningPaths {
    title: string;
    paths: LearningPath[];
    error?: string;
}

// AI Coverage Analysis Types
export interface PartiallyCoveredStandard {
    id: string;
    reason: string;
}

export interface GradeCoverageAnalysis {
    gradeLevel: number;
    coveredStandardIds: string[];
    partiallyCoveredStandards: PartiallyCoveredStandard[];
    uncoveredStandardIds: string[];
    summary: string;
    totalStandardsInGrade: number;
}

export interface CoverageAnalysisReport {
    analysis: GradeCoverageAnalysis[];
    error?: string;
}

export interface AIRecommendationAction {
    label: string;
    path: string;
    params?: {
        grade?: string;
        topicId?: string;
        conceptId?: string;
        contextType?: GenerationContextType;
        scenario?: string;
        standardId?: string;
        materialType?: 'SCENARIO' | 'ASSESSMENT' | 'RUBRIC' | 'FLASHCARDS' | 'QUIZ' | 'ILLUSTRATION' | 'LEARNING_PATH';
    }
}

export interface AIRecommendation {
    category: string; // Changed from strict union to string to support diverse AI responses
    title: string;
    recommendationText: string;
    action?: AIRecommendationAction;
}

export interface PedagogicalAnalysisCriteria {
  status: string;
  details: string;
}

export interface AIPedagogicalAnalysis {
  pedagogicalAnalysis: {
    overallImpression: string;
    alignment: PedagogicalAnalysisCriteria;
    engagement: PedagogicalAnalysisCriteria;
    cognitiveLevels: PedagogicalAnalysisCriteria;
    balanceRecommendations?: string;
  };
  error?: string;
}

// Modal Types
export enum ModalType {
  PlannerItem = 'plannerItem',
  LessonQuickView = 'lessonQuickView',
  TransversalStandards = 'transversalStandards',
  AIAnnualPlanGenerator = 'aiAnnualPlanGenerator',
  AIThematicPlanGenerator = 'aiThematicPlanGenerator',
  LessonReflection = 'lessonReflection',
  NationalStandardDetails = 'nationalStandardDetails',
  Confirm = 'confirm',
}

// Context Generator Types
export type GenerationContextType = 'CONCEPT' | 'TOPIC' | 'STANDARD' | 'SCENARIO' | 'ACTIVITY';

export type BloomDistribution = {
    [key in 'Remembering' | 'Understanding' | 'Applying' | 'Analyzing' | 'Evaluating' | 'Creating']?: number;
};

export interface GenerationContext {
    type: GenerationContextType;
    grade: Grade;
    topic?: Topic;
    concepts?: Concept[];
    standard?: NationalStandard;
    scenario?: string;
    bloomDistribution?: BloomDistribution;
    /** Resolved prerequisite titles per conceptId — populated by buildContext() */
    prerequisitesByConceptId?: Record<string, string[]>;
    /** Vertical progression for each selected concept across grades — populated by buildContext() */
    verticalProgression?: Array<{
        conceptId: string;
        title: string;
        progression: Array<{ grade: number; conceptTitle: string }>;
    }>;
}

export interface TestQuestion {
    id: string;
    text: string;
    type: 'multiple-choice' | 'open-ended' | 'short-answer' | 'word-problem';
    options?: string[];
    correctAnswer: string;
    points: number;
    difficulty?: 'easy'|'medium'|'hard';
    cognitiveLevel?: string;
    dokLevel?: 1 | 2 | 3 | 4;
}

export interface TestGroup {
    groupName: string;
    questions: TestQuestion[];
}

export interface GeneratedTest {
    title: string;
    gradeLevel: number;
    topic: string;
    groups: TestGroup[];
    createdAt: string;
}

// ── Pro Assessment Models ─────────────────────────────────────────────────────

/** The 4 summative assessment models supported by the Pro Test Generator */
export type AssessmentModel = 'standard' | 'differentiated' | 'mastery' | 'cbe';

/** One Bloom's-taxonomy level within a differentiated test */
export interface DifferentiatedLevel {
  level: 1 | 2 | 3;
  /** Bloom label, e.g. "Паметење/Разбирање", "Примена", "Анализа/Синтеза" */
  bloomLabel: string;
  pointsPerTask: number;
  taskCount: number;
}

/** Extended test — supports all 4 models + multi-topic + rubric */
export interface ProGeneratedTest extends GeneratedTest {
  id?: string;
  model: AssessmentModel;
  topics: string[];
  levels?: DifferentiatedLevel[];   // for 'differentiated'
  rubric?: string;                  // AI-generated scoring rubric
  masteryThreshold?: number;        // for 'mastery', e.g. 80
  nationalStandardIds?: string[];   // for 'cbe'
  savedAt?: string;
}

export interface InfographicSection { heading: string; icon: string; points: string[]; }
export interface InfographicVocabTerm { term: string; definition: string; }
export interface InfographicLayout {
  title: string;
  grade: string;
  subject: string;
  keyMessage: string;
  objectives: string[];
  sections: InfographicSection[];
  vocabulary: InfographicVocabTerm[];
  palette: 'blue' | 'green' | 'purple' | 'orange';
}
