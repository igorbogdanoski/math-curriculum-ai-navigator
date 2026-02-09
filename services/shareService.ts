import type { LessonPlan, SharedAnnualPlan } from '../types';
import { z } from 'zod';

declare const pako: any; // pako is loaded from a script tag in index.html

// Zod schemas for runtime validation of decoded share data
const SharedLessonPlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  objectives: z.array(z.string()),
  grade: z.number(),
  topicId: z.string(),
  conceptIds: z.array(z.string()),
  materials: z.array(z.string()).default([]),
  subject: z.string().default(''),
  theme: z.string().default(''),
  assessmentStandards: z.array(z.string()).default([]),
  scenario: z.object({
    introductory: z.string().default(''),
    main: z.array(z.string()).default([]),
    concluding: z.string().default(''),
  }).default({ introductory: '', main: [], concluding: '' }),
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
  }
};