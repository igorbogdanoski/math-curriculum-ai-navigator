// Barrel — all implementations live in services/gemini/* domain files.
// Keep this file as a thin re-export so every existing import path keeps working.

import { assessmentAPI } from './gemini/assessment';
import { plansAPI } from './gemini/plans';
import { chatAPI } from './gemini/chat';
import { tutorAPI } from './gemini/tutor';
import { pedagogyAPI } from './gemini/pedagogy';
import { visionAPI } from './gemini/vision';
import { coachingAPI } from './gemini/coaching';
import { reportsAPI } from './gemini/reports';
import { testgenAPI } from './gemini/testgen';
import { annualAPI } from './gemini/annual';
import { creativeContentAPI } from './gemini/creativeContent';
import {
  generateKahootFromTasks,
  generateKahootFromPrompt,
  generateKahootFromDocument,
} from './gemini/kahootGenerator';
export type { KahootQuestion } from './gemini/kahootGenerator';

// Core flag/utility re-exports (consumed directly by views/hooks)
export {
  scheduleQuotaNotification,
  isDailyQuotaKnownExhausted,
  clearDailyQuotaFlag,
  getQuotaDiagnostics,
  isMacedonianContextEnabled,
  setMacedonianContextEnabled,
  isRecoveryWorksheetEnabled,
  setRecoveryWorksheetEnabled,
  buildDynamicSystemInstruction,
  getSecondaryTrackContext,
} from './gemini/core';

export {
  isVertexShadowEnabled,
  setVertexShadowEnabled,
  getShadowLog,
  clearShadowLog,
  getShadowCompareReport,
} from './gemini/vertexShadow';

export type { ShadowLogEntry, ShadowCompareReport } from './gemini/vertexShadow';

export const realGeminiService = {
  ...assessmentAPI,
  ...plansAPI,
  ...chatAPI,
  ...tutorAPI,
  ...pedagogyAPI,
  ...visionAPI,
  ...coachingAPI,
  ...reportsAPI,
  ...testgenAPI,
  ...annualAPI,
  ...creativeContentAPI,
  generateKahootFromTasks,
  generateKahootFromPrompt,
  generateKahootFromDocument,
};
