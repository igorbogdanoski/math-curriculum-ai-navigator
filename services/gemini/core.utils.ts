import { logger } from '../../utils/logger';
import { RateLimitError, AuthError, ServerError, ApiError } from '../apiErrors';
import { GenerationContext } from '../../types';

export function sanitizePromptInput(text: string | undefined | null, maxLength = 1000): string {
  if (!text) return '';
  let s = text.normalize('NFKC');
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try { s = decodeURIComponent(s.replace(/\+/g, ' ')); } catch { /* malformed — keep as-is */ }
  }
  return s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/ignore\s+(previous|above|instructions?)/gi, '[filtered]')
    .replace(/system\s*:/gi, '[filtered]')
    .replace(/<\|im_start\|>|<\|im_end\|>|<\|endoftext\|>/gi, '[filtered]')
    .replace(/\[\s*INST\s*\]|\[\s*\/INST\s*\]/gi, '[filtered]')
    .replace(/disregard\s+(all\s+)?(prior|previous|above|earlier)\s+(instructions?|prompts?|context)/gi, '[filtered]')
    .replace(/forget\s+(everything|all|prior|previous)/gi, '[filtered]')
    .replace(/act\s+as\s+(if\s+you\s+are|a\s+)?(?:dan|jailbreak|unrestricted|evil)/gi, '[filtered]')
    .replace(/\{\{.*?\}\}/g, '[filtered]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function handleGeminiError(error: unknown, customMessage?: string): never {
    logger.error("Gemini Service Error:", error);
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : "";
    if (errorMessage.includes("rate limit") || errorMessage.includes("429")) throw new RateLimitError();
    if (errorMessage.includes("api key not valid") || errorMessage.includes("permission denied") || errorMessage.includes("403")) throw new AuthError();
    if (errorMessage.includes("server error") || errorMessage.includes("500") || errorMessage.includes("overloaded")) throw new ServerError();
    throw new ApiError(customMessage || (error instanceof Error ? error.message : "An unknown error occurred with the AI service."));
}

export function cleanJsonString(text: string): string {
    if (!text) return "";
    let cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    let startIndex = -1;
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) startIndex = firstBrace;
    else if (firstBracket !== -1) startIndex = firstBracket;
    if (startIndex !== -1) cleaned = cleaned.substring(startIndex);
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    let endIndex = -1;
    if (lastBrace !== -1 && (lastBracket === -1 || lastBrace > lastBracket)) endIndex = lastBrace;
    else if (lastBracket !== -1) endIndex = lastBracket;
    if (endIndex !== -1) cleaned = cleaned.substring(0, endIndex + 1);
    cleaned = cleaned.replace(/\\(?![^"nrtbf\/u\\])/g, '\\\\');
    return cleaned.trim();
}

export function minifyContext(context: GenerationContext): any {
    if (!context) return {};
    const safeString = (str: string | undefined, maxLength: number) => (str || '').substring(0, maxLength);
    return {
        type: context.type,
        gradeLevel: context.grade?.level,
        topic: context.topic ? { title: context.topic.title, description: safeString(context.topic.description, 200) } : undefined,
        concepts: context.concepts?.map(c => ({
            title: c.title,
            description: safeString(c.description, 150),
            contentPoints: c.content?.slice(0, 5),
            assessmentStandards: c.assessmentStandards,
            suggestedActivities: c.activities?.slice(0, 4),
            prerequisiteConcepts: context.prerequisitesByConceptId?.[c.id] ?? [],
        })),
        standard: context.standard ? { code: context.standard.code, description: safeString(context.standard.description, 200) } : undefined,
        scenario: safeString(context.scenario, 500),
        bloomEmphasis: context.bloomDistribution && Object.keys(context.bloomDistribution).length > 0
            ? Object.keys(context.bloomDistribution) : undefined,
        verticalProgression: context.verticalProgression?.length ? context.verticalProgression : undefined,
    };
}
