import { logger } from '../utils/logger';
import type { LessonPlan, SharedAnnualPlan } from '../types';
import { z } from 'zod';
import { AppError, ErrorCode } from '../utils/errors';

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

const SharedMaturaRecoverySchema = z.object({
  v: z.literal(1).optional(),
  expiresAt: z.string().optional(),
  generatedAt: z.string(),
  attempts: z.number(),
  avgPct: z.number(),
  bestPct: z.number(),
  passRatePct: z.number(),
  weakConcepts: z.array(z.object({
    title: z.string(),
    pct: z.number(),
    questions: z.number(),
    delta: z.number().nullable().optional(),
  })),
  mission: z.object({
    sourceConceptTitle: z.string(),
    progressCompleted: z.number(),
    progressTotal: z.number(),
    streakCount: z.number(),
    badgeEarned: z.boolean(),
  }).nullable().optional(),
});

export interface SharedMaturaRecoveryData {
  v?: 1;
  expiresAt?: string;
  generatedAt: string;
  attempts: number;
  avgPct: number;
  bestPct: number;
  passRatePct: number;
  weakConcepts: Array<{
    title: string;
    pct: number;
    questions: number;
    delta?: number | null;
  }>;
  mission?: {
    sourceConceptTitle: string;
    progressCompleted: number;
    progressTotal: number;
    streakCount: number;
    badgeEarned: boolean;
  } | null;
}

export type MaturaRecoveryShareDecodeError = 'invalid' | 'expired';

const MAX_MATURA_SHARE_B64_LENGTH = 12000;

export const shareService = {
  isSignedMaturaRecoveryToken(token: string): boolean {
    return /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
  },

  generateShareData(lessonPlan: LessonPlan): string {
    try {
      const jsonString = JSON.stringify(lessonPlan);
      return btoa(encodeURIComponent(jsonString));
    } catch (error) {
      logger.error("Error generating share data:", error);
      return '';
    }
  },
  
  decodeShareData(data: string): Omit<LessonPlan, 'id'> | null {
    try {
      const jsonString = decodeURIComponent(atob(data));
      const parsed = SharedLessonPlanSchema.safeParse(JSON.parse(jsonString));
      
      if (!parsed.success) {
        logger.error("Invalid share data schema:", parsed.error.issues);
        return null;
      }
      
      const plan = parsed.data as LessonPlan;
      const { id, ...planWithoutId } = plan;
      return planWithoutId;
    } catch (error) {
      logger.error("Error decoding share data:", error);
      return null;
    }
  },
  
  generateAnnualShareData(planData: SharedAnnualPlan): string {
    try {
      if (typeof pako === 'undefined') {
        throw new AppError(
          'Pako compression library is not loaded.',
          ErrorCode.AI_UNAVAILABLE,
          'Сервисот за компресија моментално не е достапен. Обидете се повторно.',
          true,
        );
      }
      const jsonString = JSON.stringify(planData);
      const compressed = pako.deflate(jsonString, { to: 'string' });
      return btoa(compressed);
    } catch (error) {
      logger.error("Error generating annual share data:", error);
      return '';
    }
  },
  
  decodeAnnualShareData(data: string): SharedAnnualPlan | null {
    try {
      if (typeof pako === 'undefined') {
        throw new AppError(
          'Pako compression library is not loaded.',
          ErrorCode.AI_UNAVAILABLE,
          'Сервисот за компресија моментално не е достапен. Обидете се повторно.',
          true,
        );
      }
      const compressedString = atob(data);
      const jsonString = pako.inflate(compressedString, { to: 'string' });
      const parsed = SharedAnnualPlanSchema.safeParse(JSON.parse(jsonString));

      if (!parsed.success) {
        logger.error("Invalid annual share data schema:", parsed.error.issues);
        return null;
      }
      
      return parsed.data as SharedAnnualPlan;
    } catch (error) {
      logger.error("Error decoding annual share data:", error);
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
      logger.error("Error generating quiz share data:", error);
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
        logger.error("Invalid quiz share data schema:", parsed.error.issues);
        return null;
      }
      return parsed.data;
    } catch (error) {
      logger.error("Error decoding quiz share data:", error);
      return null;
    }
  },

  generateMaturaRecoveryShareData(payload: SharedMaturaRecoveryData, options?: { expiresInDays?: number }): string {
    try {
      const expiresInDays = options?.expiresInDays ?? 30;
      const withMeta: SharedMaturaRecoveryData = {
        ...payload,
        v: 1,
        expiresAt: payload.expiresAt ?? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      };

      const jsonString = JSON.stringify(withMeta);

      // Prefer compressed payload for shorter URLs when pako is available.
      if (typeof pako !== 'undefined') {
        const compressed = pako.deflate(jsonString, { to: 'string' });
        return `z:${btoa(compressed)}`;
      }

      return `u:${btoa(encodeURIComponent(jsonString))}`;
    } catch (error) {
      logger.error('Error generating matura recovery share data:', error);
      return '';
    }
  },

  decodeMaturaRecoveryShareDataWithStatus(data: string): { data: SharedMaturaRecoveryData | null; error?: MaturaRecoveryShareDecodeError } {
    try {
      if (!data || data.length > MAX_MATURA_SHARE_B64_LENGTH) {
        return { data: null, error: 'invalid' };
      }

      let encoded = data;
      let mode: 'z' | 'u' | 'legacy' = 'legacy';

      if (data.startsWith('z:')) {
        mode = 'z';
        encoded = data.slice(2);
      } else if (data.startsWith('u:')) {
        mode = 'u';
        encoded = data.slice(2);
      }

      let jsonString = '';
      if (mode === 'z') {
        if (typeof pako === 'undefined') {
          return { data: null, error: 'invalid' };
        }
        jsonString = pako.inflate(atob(encoded), { to: 'string' });
      } else {
        jsonString = decodeURIComponent(atob(encoded));
      }

      const parsed = SharedMaturaRecoverySchema.safeParse(JSON.parse(jsonString));
      if (!parsed.success) {
        logger.error('Invalid matura recovery share data schema:', parsed.error.issues);
        return { data: null, error: 'invalid' };
      }

      const payload = parsed.data as SharedMaturaRecoveryData;
      if (payload.expiresAt && new Date(payload.expiresAt).getTime() < Date.now()) {
        return { data: null, error: 'expired' };
      }

      return { data: payload };
    } catch (error) {
      logger.error('Error decoding matura recovery share data:', error);
      return { data: null, error: 'invalid' };
    }
  },

  decodeMaturaRecoveryShareData(data: string): SharedMaturaRecoveryData | null {
    return this.decodeMaturaRecoveryShareDataWithStatus(data).data;
  }
};
