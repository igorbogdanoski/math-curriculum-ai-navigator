import { realGeminiService } from './geminiService.real';

// Switched to the real Gemini service as per user request to get non-mock results.
export const geminiService = realGeminiService;

// To switch back to mock data for offline development, you can use:
// import { mockGeminiService } from './geminiService.mock';
// export const geminiService = mockGeminiService;
