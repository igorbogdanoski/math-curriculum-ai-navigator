
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
  priorKnowledgeIds: string[];
  assessmentStandards: string[];
  nationalStandardIds: string[];
  activities?: string[];
  levelDescription?: string;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
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

export type MaterialType = 'SCENARIO' | 'ASSESSMENT' | 'RUBRIC' | 'FLASHCARDS' | 'QUIZ' | 'ILLUSTRATION' | 'EXIT_TICKET' | 'LEARNING_PATH';

export interface LessonScenario {
  introductory: string;
  main: string[];
  concluding: string;
}

export interface LessonPlan {
  id: string;
  title: string;
  grade: number;
  topicId: string;
  conceptIds: string[];
  objectives: string[];
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
  ratings?: number[];
  comments?: { authorName: string; text: string; date: string }[];
  originalId?: string; // To track where it was imported from
}

export interface LessonReflection {
  wentWell: string;
  challenges: string;
  nextSteps: string;
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
  
  // For context-based generation
  cognitiveLevel: 'Remembering' | 'Understanding' | 'Applying' | 'Analyzing' | 'Evaluating' | 'Creating';
  difficulty_level?: 'Easy' | 'Medium' | 'Hard';
  alignment_justification?: string;
  concept_evaluated?: string;
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
  mainActivity: string;
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
}
