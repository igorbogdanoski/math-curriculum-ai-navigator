
export interface School {
  id: string;
  name: string;
  city: string;
  municipality?: string;
  address?: string;
  teacherUids: string[];
  /** Legacy single admin; new docs use adminUids[] */
  adminUid: string;
  adminUids?: string[];
  /** 6-char uppercase code teachers use to join (И1) */
  joinCode?: string;
  joinCodeGeneratedAt?: any;
  createdAt?: any;
}

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
  localContextExamples?: string[]; // Macedonian local context (MKD denars, cities, etc.)
  gradeLevel?: number; // Enriched at runtime from parent Grade.level
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
 * Secondary education track (Н4 — Средно образование).
 * - gymnasium:   Гимназиско, grades 10–12
 * - vocational4: Стручно 4-годишно, grades 10–12
 * - vocational3: Стручно 3-годишно, grades 10–11
 */
export type SecondaryTrack = 'gymnasium' | 'vocational4' | 'vocational3';

export const SECONDARY_TRACK_LABELS: Record<SecondaryTrack, string> = {
  gymnasium:   'Гимназиско (X–XII)',
  vocational4: 'Стручно 4-год (X–XII)',
  vocational3: 'Стручно 3-год (X–XI)',
};

export interface Grade {
  id: string;
  level: number;
  title: string;
  topics: Topic[];
  transversalStandards?: NationalStandard[];
  levelDescription?: string;
  /** Set on secondary grades — identifies the track they belong to */
  secondaryTrack?: SecondaryTrack;
}

export interface Curriculum {
  grades: Grade[];
}

/** Secondary curriculum: one Curriculum per track */
export interface SecondaryCurriculumModule {
  track: SecondaryTrack;
  label: string;
  curriculum: Curriculum;
}

export interface ConceptProgression {
  conceptId: string;
  title:string;
  progression: Array<{
    grade: number;
    concept: Concept;
  }>;
}

export enum PlannerItemType {
  LESSON = 'LESSON',
  EVENT = 'EVENT',
  HOLIDAY = 'HOLIDAY',
}

export type MaterialType = 'SCENARIO' | 'ASSESSMENT' | 'RUBRIC' | 'FLASHCARDS' | 'QUIZ' | 'ILLUSTRATION' | 'EXIT_TICKET' | 'LEARNING_PATH' | 'WORKED_EXAMPLE' | 'PRESENTATION';

export interface PresentationSlide {
  title: string;
  content: string[];
  solution?: string[]; // Revealed on demand in Gamma Mode (task/example slides)
  visualPrompt?: string; // Prompt for Imagen if teacher wants a background/image
  // chart-embed: DataViz chart injected directly into Gamma Mode
  chartData?: { headers: string[]; rows: (string | number)[][] };
  chartConfig?: Record<string, unknown>;
  type: 'title' | 'content' | 'example' | 'task' | 'summary' | 'step-by-step' | 'formula-centered' | 'chart-embed';
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

export interface LessonScenario {
  introductory: {
    text: string;
    activityType?: string;
    duration?: string;
  };
  main: Array<{
    text: string;
    bloomsLevel?: BloomsLevel;
    activityType?: string;
  }>;
  concluding: {
    text: string;
    activityType?: string;
    duration?: string;
  };
}

export interface LessonPlan {
  id: string;
  title: string;
  grade: number;
  topicId: string;
  conceptIds: string[];
  objectives: Array<{
    text: string;
    bloomsLevel?: BloomsLevel;
  }>;
  materials: string[];

  // Expanded fields to match official lesson plan structure
  subject: string;
  theme: string;
  lessonNumber?: number;
  assessmentStandards: string[];
  scenario: LessonScenario;
  illustrationUrl?: string;
  progressMonitoring: string[];
  levelDescription?: string;
  differentiation?: string;
  differentiationTabs?: { support: string; standard: string; advanced: string };
  reflectionPrompt?: string;
  selfAssessmentPrompt?: string;
  tags?: string[];

  // Math tool exports (GeoGebra / Desmos screenshots embedded in the plan)
  mathEmbeds?: Array<{ tool: 'geogebra' | 'desmos'; dataUrl: string; createdAt: string }>;

  // Community Features
  isPublished?: boolean;
  authorName?: string;
  schoolName?: string;
  shareScope?: 'public' | 'school';
  ratings?: number[];
  comments?: { authorName: string; text: string; date: string }[];
  originalId?: string; // To track where it was imported from
}

export interface LessonReflection {
  wentWell: string;
  challenges: string;
  nextSteps: string;
}

export interface HomeworkTask {
  id: string;       // crypto.randomUUID()
  title: string;
  dueDate?: string; // YYYY-MM-DD
  done: boolean;
}

export interface PlannerItem {
  id: string;
  type: PlannerItemType;
  date: string; // YYYY-MM-DD
  title: string;
  description?: string;
  lessonPlanId?: string;
  reflection?: LessonReflection;
  levelDescription?: string;
  /** cached_ai_materials doc ID of a linked exit ticket quiz */
  exitTicketCacheId?: string;
  /** Домашни задачи поврзани со оваа лекција */
  tasks?: HomeworkTask[];
}




export interface SharedAnnualPlan {
    items: PlannerItem[];
    lessonPlans: LessonPlan[];
}

export interface StudentProfile {
  id: string;
  name: string;
  description: string;
}

/**
 * С1 — Persistent студентски акаунт (Google Sign-In за ученици).
 * Зачуван во `student_accounts/{googleUid}` во Firestore.
 * Линкува повеќе deviceIds за cross-device sync на напредокот.
 */
export interface StudentAccount {
  uid: string;           // Google UID (= Firebase Auth UID после Sign-In)
  name: string;          // Студентско име (од прв quiz или Google профил)
  email?: string;        // Google email (опционален)
  photoURL?: string;     // Google аватар
  grade?: number;        // Одделение (опционално, за подобри препораки)
  linkedDeviceIds: string[]; // Сите deviceIds на студентот (за cross-device queries)
  createdAt: any;        // Firestore Timestamp
  updatedAt?: any;
}

export interface TeachingProfile {
  name: string;
  photoURL?: string;
  // RBAC and Multi-tenant fields
  role?: 'teacher' | 'school_admin' | 'admin';
  schoolId?: string;
  schoolName?: string;
  municipality?: string;
  
  // Monetization & Quota
  aiCreditsBalance?: number;
  isPremium?: boolean;
  hasUnlimitedCredits?: boolean;
  tier?: 'Free' | 'Pro' | 'Unlimited';

  isMentor?: boolean; // П-Д: voluntary mentor flag — shown as badge on shared materials

  /** Н4 — if set, teacher works in secondary education (not primary grades 1–9) */
  secondaryTrack?: SecondaryTrack;

  style: 'Constructivist' | 'Direct Instruction' | 'Inquiry-Based' | 'Project-Based';
  experienceLevel: 'Beginner' | 'Intermediate' | 'Expert';
  levelDescription?: string;
  studentProfiles?: StudentProfile[];
  favoriteConceptIds?: string[];
  favoriteLessonPlanIds?: string[];
  toursSeen?: Record<string, boolean>;
}

export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    levelDescription?: string;
    attachmentUrl?: string; // NEW: To display the image in chat history
}

export interface ProgressionByGrade {
  oddelenie: string;
  poimi: string;
  rezultati_od_ucenje: string;
  levelDescription?: string;
}

export interface ThematicProgression {
  tema: string;
  progresija: ProgressionByGrade[];
  levelDescription?: string;
}

export interface VerticalProgressionAnalysis {
  predmet: string;
  period: string;
  fokus: string;
  tematska_progresija: ThematicProgression[];
  levelDescription?: string;
}

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
  levelDescription?: string;

  solution?: string;
    isWorkedExample?: boolean;
    workedExampleType?: 'full' | 'partial';

  // For context-based generation
  cognitiveLevel: 'Remembering' | 'Understanding' | 'Applying' | 'Analyzing' | 'Evaluating' | 'Creating';
  difficulty_level?: 'Easy' | 'Medium' | 'Hard';
  alignment_justification?: string;
  concept_evaluated?: string;
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
  conceptId?: string;
  conceptTitle?: string;
  topicId?: string;
  gradeLevel?: number;
  savedAt?: any;
  isVerified?: boolean;
  verifiedAt?: any;
  isPublic?: boolean;
  isApproved?: boolean;
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

export interface ThematicPlanLesson {
  lessonNumber: number;
  lessonUnit: string;
  learningOutcomes: string;
  keyActivities: string;
  assessment: string;
  hours?: number;
  resources?: string;
  levelDescription?: string;
}

export interface AIGeneratedThematicPlan {
  thematicUnit: string;
  lessons: ThematicPlanLesson[];
  error?: string;
  levelDescription?: string;
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

// ── Grade Book ────────────────────────────────────────────────────────────────

export type GradeModel = 'traditional' | 'mastery' | 'sbg';

export interface GradeEntry {
  studentId: string;
  studentName: string;
  testId: string;
  testTitle: string;
  rawScore: number;
  maxScore: number;
  percentage: number;
  /** Mastery model: 'mastered' | 'approaching' | 'not_yet' */
  masteryStatus?: 'mastered' | 'approaching' | 'not_yet';
  /** SBG: proficiency per standard id → 1-4 */
  standardScores?: Record<string, 1 | 2 | 3 | 4>;
  gradedAt: string;
  notes?: string;
}

export interface GradeBookClass {
  id?: string;
  teacherUid: string;
  className: string;
  gradeLevel: number;
  model: GradeModel;
  entries: GradeEntry[];
  createdAt: string;
  updatedAt: string;
}


export interface LiveQuizSession {
    pin: string;
    teacherId: string;
    status: 'waiting' | 'active' | 'finished';
    questions: AssessmentQuestion[];
    currentQuestionIndex: number;
    title: string;
    createdAt: any;
}

export interface LiveQuizParticipant {
    id: string;
    name: string;
    score: number;
    answers: Record<string, string>; // questionId or index -> answer string
    joinedAt: any;
}


declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { onInput?: (e: Event) => void; 'virtual-keyboard-mode'?: string; placeholder?: string; };
    }
  }
}
export interface AIGeneratedAnnualPlanTopic { title: string; durationWeeks: number; objectives: string[]; suggestedActivities: string[]; }
export interface AIGeneratedAnnualPlan { grade: string; subject: string; totalWeeks: number; topics: AIGeneratedAnnualPlanTopic[]; }

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
