import { ChatMessage, TeachingProfile } from '../../types';
import {
    Part, DEFAULT_MODEL, streamGeminiProxy, checkDailyQuotaGuard, SAFETY_SETTINGS,
    callGeminiProxy, streamGeminiProxyRich, type StreamChunk,
    getResolvedTextSystemInstruction, getSecondaryTrackContext, sanitizePromptInput,
} from './core';

export const chatAPI = {

async *getChatResponseStream(history: ChatMessage[], profile?: TeachingProfile, attachment?: { base64: string, mimeType: string }, ragContext?: string): AsyncGenerator<string, void, unknown> {
    checkDailyQuotaGuard();
    let systemInstruction = `${getResolvedTextSystemInstruction()}${getSecondaryTrackContext(profile?.secondaryTrack)}\nПрофил на наставник: ${JSON.stringify(profile || {})}`;
    if (ragContext) {
        systemInstruction += `\n\n--- КОНТЕКСТ ОД БИБЛИОТЕКАТА НА НАСТАВНИКОТ ---\nСледните материјали се пронајдени како релевантни за прашањето. Користи ги при одговорот:\n\n${ragContext}\n--- КРАЈ НА БИБЛИОТЕЧЕН КОНТЕКСТ ---\n\nКога ги користиш овие материјали, споменувај ги по наслов и тип (пр. "Во вашиот зачуван квиз...").`;
    }
    const contents = history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] as Part[] }));
    if (attachment && contents.length > 0) {
        const lastMessage = contents[contents.length - 1];
        if (lastMessage.role === 'user') lastMessage.parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.base64 } });
    }
    yield* streamGeminiProxy({ model: DEFAULT_MODEL, contents, systemInstruction, safetySettings: SAFETY_SETTINGS });
  },

async *getChatResponseStreamWithThinking(history: ChatMessage[], profile?: TeachingProfile, attachment?: { base64: string, mimeType: string }, ragContext?: string): AsyncGenerator<StreamChunk, void, unknown> {
    checkDailyQuotaGuard();
    let systemInstruction = `${getResolvedTextSystemInstruction()}${getSecondaryTrackContext(profile?.secondaryTrack)}\nПрофил на наставник: ${JSON.stringify(profile || {})}`;
    if (ragContext) {
        systemInstruction += `\n\n--- КОНТЕКСТ ОД БИБЛИОТЕКАТА НА НАСТАВНИКОТ ---\nСледните материјали се пронајдени како релевантни за прашањето. Користи ги при одговорот:\n\n${ragContext}\n--- КРАЈ НА БИБЛИОТЕЧЕН КОНТЕКСТ ---\n\nКога ги користиш овие материјали, споменувај ги по наслов и тип (пр. "Во вашиот зачуван квиз...").`;
    }
    const contents = history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] as Part[] }));
    if (attachment && contents.length > 0) {
        const lastMessage = contents[contents.length - 1];
        if (lastMessage.role === 'user') lastMessage.parts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.base64 } });
    }
    yield* streamGeminiProxyRich({
        model: DEFAULT_MODEL, contents, systemInstruction, safetySettings: SAFETY_SETTINGS,
        generationConfig: { thinkingConfig: { thinkingBudget: 8000 } },
        userTier: profile?.tier,
    });
  },

async askTutor(message: string, history: Array<{ role: string; content: string }>): Promise<string> {
    const systemPrompt = `Ти си безбеден AI тутор по математика за ученици во основно образование. Твојата главна цел е да им помогнеш да ги разберат концептите, НЕ да им ги решаваш задачите.

ПРАВИЛА КОИ МОРА ДА ГИ СЛЕДИШ:
1. НИКОГАШ не го давај конечниот одговор на задача пред ученикот да се обиде сам.
2. Постави му прашање на ученикот за да го насочиш да размислува.
3. Доколку ученикот згреши, немој да го критикуваш - објасни му каде згрешил и обиди се повторно.
4. Користи јасен, едноставен јазик прилагоден за основци (на македонски јазик).
5. Разложувај ги проблемите на помали, полесни чекори.
6. Ако изгледа дека ученикот сака само да препише решение, потсети го дека твојата улога е да објаснуваш, а не да решаваш.`;

    const contents = [
      ...history.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: sanitizePromptInput(msg.content, 1000) }],
      })),
      { role: 'user' as const, parts: [{ text: sanitizePromptInput(message, 1000) }] },
    ];

    try {
      const response = await callGeminiProxy({ model: DEFAULT_MODEL, contents, systemInstruction: systemPrompt, safetySettings: SAFETY_SETTINGS });
      return response.text || 'Извини, се појави проблем при генерирањето на одговорот.';
    } catch (e) {
      const { logger } = await import('../../utils/logger');
      logger.error('Tutor API error:', e);
      return 'Настана грешка при комуникацијата со туторот. Обиди се повторно.';
    }
  },

};
