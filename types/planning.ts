import type { SecondaryTrack } from './curriculum';
import type { BloomsLevel } from './aiContent';

export enum PlannerItemType {
  LESSON = 'LESSON',
  EVENT = 'EVENT',
  HOLIDAY = 'HOLIDAY',
}

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
  secondaryTrack?: SecondaryTrack; // required context for grade > 9 (гимназиско vs стручно)
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
  /** AI-generated open-ended task with 3 ZPD tiers, accepted from the editor sidebar's "Богата задача" panel */
  richTask?: { context: string; task: string; support: string; standard: string; advanced: string; discussionQuestion: string };
  reflectionPrompt?: string;
  selfAssessmentPrompt?: string;
  teacherReflection?: LessonReflection;
  tags?: string[];

  // Math tool exports (GeoGebra / Desmos screenshots embedded in the plan)
  mathEmbeds?: Array<{ tool: 'geogebra' | 'desmos'; dataUrl: string; createdAt: string }>;

  // Upload attribution — set when a scenario is imported from an uploaded document
  originalAuthor?: string;
  originalSchool?: string;

  // Community Features
  isPublished?: boolean;
  authorName?: string;
  schoolName?: string;
  shareScope?: 'public' | 'school';
  ratings?: number[];
  comments?: { authorName: string; text: string; date: string }[];
  originalId?: string; // To track where it was imported from
  /** Set after this plan is published to the Scenario Bank — lets the editor target the same
   *  entry for later metadata edits (pedagogical model etc.) instead of creating a duplicate. */
  scenarioBankId?: string;
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

export interface ThematicPlanLessonScenario {
  intro: string;
  main: string[];
  closing: string;
  reflection: string;
  homework?: string;
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
  /** Structured scenario per official MoN format (S74) */
  scenario?: ThematicPlanLessonScenario;
}

export interface AIGeneratedThematicPlan {
  thematicUnit: string;
  lessons: ThematicPlanLesson[];
  error?: string;
  levelDescription?: string;
}

export interface AIGeneratedAnnualPlanTopic { title: string; durationWeeks: number; objectives: string[]; suggestedActivities: string[]; }
export interface AIGeneratedAnnualPlan { grade: string; subject: string; totalWeeks: number; topics: AIGeneratedAnnualPlanTopic[]; }
