import { realGeminiService } from './geminiService.real';

/**
 * Единствена точка за извоз на Gemini сервисот.
 * Користиме 'realGeminiService' за продукција и реални податоци.
 */
export const geminiService = realGeminiService;
export { isDailyQuotaKnownExhausted, clearDailyQuotaFlag, scheduleQuotaNotification, getQuotaDiagnostics, isMacedonianContextEnabled, setMacedonianContextEnabled, isRecoveryWorksheetEnabled, setRecoveryWorksheetEnabled } from './geminiService.real';
export { isIntentRouterEnabled, setIntentRouterEnabled } from './gemini/intentRouter';
export { isVertexShadowEnabled, setVertexShadowEnabled, getShadowLog, clearShadowLog, getShadowCompareReport } from './geminiService.real';
export type { ShadowLogEntry, ShadowCompareReport } from './geminiService.real';
export type { KahootQuestion } from './geminiService.real';

// Забелешка: Доколку некогаш ви требаат тест податоци (mock), 
// само сменете го импортот погоре во: 
// import { mockGeminiService as realGeminiService } from './geminiService.mock';
