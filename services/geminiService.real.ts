// Barrel — all implementations live in services/gemini/* domain files.
// Keep this file as a thin re-export so every existing import path keeps working.

import { assessmentAPI } from './gemini/assessment';
import { plansAPI } from './gemini/plans';
import { chatAPI } from './gemini/chat';
import { tutorAPI } from './gemini/tutor';
import { pedagogyAPI } from './gemini/pedagogy';
import { visionAPI } from './gemini/vision';
import { reportsAPI } from './gemini/reports';
import { testgenAPI } from './gemini/testgen';
import { annualAPI } from './gemini/annual';

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
  ...reportsAPI,
  ...testgenAPI,
  ...annualAPI,
};
