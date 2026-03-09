
export interface School {
  id: string;
  name: string;
  city: string;
  teacherUids: string[];
  adminUid: string;
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

export interface Grade {
  id: string;
  level: number;
  title: string;
  topics: Topic[];
  transversalStandards?: NationalStandard[];
  levelDescription?: string;
}

export interface Curriculum {
  grades: Grade[];
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

export type MaterialType = 'SCENARIO' | 'ASSESSMENT' | 'RUBRIC' | 'FLASHCARDS' | 'QUIZ' | 'ILLUSTRATION' | 'EXIT_TICKET' | 'LEARNING_PATH' | 'WORKED_EXAMPLE';

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
  };
  main: Array<{
    text: string;
    bloomsLevel?: BloomsLevel;
    activityType?: string;
  }>;
  concluding: {
    text: string;
    activityType?: string;
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
  progressMonitoring: string[];
  levelDescription?: string;
  differentiation?: string;
  reflectionPrompt?: string;
  selfAssessmentPrompt?: string;
  tags?: string[];

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

export interface AssessmentQuestion {
  id?: number;
  type: QuestionType | string;
  question: string;
  options?: string[];
  answer: string;
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
      'math-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { onInput?: (e: Event) => void; };
    }
  }
}
e x p o r t   i n t e r f a c e   A I G e n e r a t e d A n n u a l P l a n T o p i c   {   t i t l e :   s t r i n g ;   d u r a t i o n W e e k s :   n u m b e r ;   o b j e c t i v e s :   s t r i n g [ ] ;   s u g g e s t e d A c t i v i t i e s :   s t r i n g [ ] ;   } 
 e x p o r t   i n t e r f a c e   A I G e n e r a t e d A n n u a l P l a n   {   g r a d e :   s t r i n g ;   s u b j e c t :   s t r i n g ;   t o t a l W e e k s :   n u m b e r ;   t o p i c s :   A I G e n e r a t e d A n n u a l P l a n T o p i c [ ] ;   }  
 