
/**
 * Единствена точка за извоз на Gemini сервисот.
 * Користиме 'realGeminiService' за продукција и реални податоци.
 */
export const geminiService = realGeminiService;

// Забелешка: Доколку некогаш ви требаат тест податоци (mock), 
// само сменете го импортот погоре во: 
// import { mockGeminiService as realGeminiService } from './geminiService.mock';
