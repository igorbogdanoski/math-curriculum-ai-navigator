import type { LessonPlan, SharedAnnualPlan } from '../types';
import { z } from 'zod';

declare const pako: any; // pako is loaded from a script tag in index.html

// Zod schemas for runtime validation of decoded share data
const SharedLessonPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  objectives: z.array(z.object({
    text: z.string(),
    bloomsLevel: z.string().optional()
  })).or(z.array(z.string())), // Allow migration from old format
  grade: z.number(),
  topicId: z.string(),
  conceptIds: z.array(z.string()),
  materials: z.array(z.string()).default([]),
  subject: z.string().default(''),
  theme: z.string().default(''),
  assessmentStandards: z.array(z.string()).default([]),
  scenario: z.object({
    introductory: z.object({ text: z.string() }).or(z.string()).default(''),
    main: z.array(z.object({ text: z.string(), bloomsLevel: z.string().optional() })).or(z.array(z.string())).default([]),
    concluding: z.object({ text: z.string() }).or(z.string()).default(''),
  }).default({ introductory: { text: '' }, main: [], concluding: { text: '' } }),
  progressMonitoring: z.array(z.string()).default([]),
}).passthrough();

const SharedAnnualPlanSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    type: z.string(),
    date: z.string(),
    title: z.string(),
  }).passthrough()),
  lessonPlans: z.array(SharedLessonPlanSchema),
});

const SharedQuizSchema = z.object({
  title: z.string(),
  questions: z.array(z.object({
    id: z.number().optional(),
    type: z.string(),
    question: z.string(),
    options: z.array(z.string()).optional(),
    answer: z.string(),
    solution: z.string().optional(),
    cognitiveLevel: z.string().optional()
  }))
});

export const shareService = {
  generateShareData(lessonPlan: LessonPlan): string {
    try {
      const jsonString = JSON.stringify(lessonPlan);
      return btoa(encodeURIComponent(jsonString));
    } catch (error) {
      console.error("Error generating share data:", error);
      return '';
    }
  },
  
  decodeShareData(data: string): Omit<LessonPlan, 'id'> | null {
    try {
      const jsonString = decodeURIComponent(atob(data));
      const parsed = SharedLessonPlanSchema.safeParse(JSON.parse(jsonString));
      
      if (!parsed.success) {
        console.error("Invalid share data schema:", parsed.error.issues);
        return null;
      }
      
      const plan = parsed.data as LessonPlan;
      const { id, ...planWithoutId } = plan;
      return planWithoutId;
    } catch (error) {
      console.error("Error decoding share data:", error);
      return null;
    }
  },
  
  generateAnnualShareData(planData: SharedAnnualPlan): string {
    try {
      if (typeof pako === 'undefined') {
        throw new Error("Pako compression library is not loaded.");
      }
      const jsonString = JSON.stringify(planData);
      const compressed = pako.deflate(jsonString, { to: 'string' });
      return btoa(compressed);
    } catch (error) {
      console.error("Error generating annual share data:", error);
      return '';
    }
  },
  
  decodeAnnualShareData(data: string): SharedAnnualPlan | null {
    try {
      if (typeof pako === 'undefined') {
        throw new Error("Pako compression library is not loaded.");
      }
      const compressedString = atob(data);
      const jsonString = pako.inflate(compressedString, { to: 'string' });
      const parsed = SharedAnnualPlanSchema.safeParse(JSON.parse(jsonString));

      if (!parsed.success) {
        console.error("Invalid annual share data schema:", parsed.error.issues);
        return null;
      }
      
      return parsed.data as SharedAnnualPlan;
    } catch (error) {
      console.error("Error decoding annual share data:", error);
      return null;
    }
  },

  generateQuizShareData(quizData: any): string {
    try {
      const jsonString = JSON.stringify(quizData);
      if (typeof pako !== 'undefined') {
        const compressed = pako.deflate(jsonString, { to: 'string' });
        return btoa(compressed);
      }
      return btoa(encodeURIComponent(jsonString));
    } catch (error) {
      console.error("Error generating quiz share data:", error);
      return '';
    }
  },

  decodeQuizShareData(data: string): any | null {
    try {
      let jsonString;
      const rawData = atob(data);
      if (typeof pako !== 'undefined') {
        try {
          jsonString = pako.inflate(rawData, { to: 'string' });
        } catch (e) {
          jsonString = decodeURIComponent(rawData);
        }
      } else {
        jsonString = decodeURIComponent(rawData);
      }
      
      const parsed = SharedQuizSchema.safeParse(JSON.parse(jsonString));
      if (!parsed.success) {
        console.error("Invalid quiz share data schema:", parsed.error.issues);
        return null;
      }
      return parsed.data;
    } catch (error) {
      console.error("Error decoding quiz share data:", error);
      return null;
    }
  }
};
