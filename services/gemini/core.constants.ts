// Shared constants, primitive types, and interfaces used across all core sub-modules.
// No imports from other core.* files — this is the dependency root.

export const CACHE_COLLECTION = 'cached_ai_materials';
export const LITE_MODEL = 'gemini-3.1-flash-lite-preview';
export const DEFAULT_MODEL = 'gemini-3-flash-preview';
export const PRO_MODEL = 'gemini-3-pro-preview';
export const ULTIMATE_MODEL = 'gemini-3.1-pro-preview';
export const IMAGEN_MODEL = 'gemini-3.1-flash-image';
export const EMBEDDING_MODEL = 'gemini-embedding-2';
export const MAX_RETRIES = 2;
export const GENERATION_TIMEOUT_MS = 60_000;

export const AI_COSTS = {
    TEXT_BASIC: 1,
    ILLUSTRATION: 5,
    PRESENTATION: 10,
    BULK: 5,
    LEARNING_PATH: 3,
    VARIANTS: 3,
    ANNUAL_PLAN: 10,
    TEST: 4,
    KAHOOT: 3,
    ASSESSMENT: 3,
    IDEAS: 2,
    /** Zero-cost bucket for a call that's one part of an already separately-priced bundle
     *  (e.g. generateABCTest's 2nd/3rd variant, bulk-generate's later steps) — the bundle's
     *  own costKey covers the whole operation, so its other legs must not double-charge. */
    BUNDLE_PART: 0,
};

/**
 * Server-side floor on credits deducted per model, regardless of the client-supplied costKey.
 * `costKey` is chosen by the CALLING code, not verified against the model actually used — a
 * request made directly against the API (bypassing the UI) could otherwise pair an expensive
 * model with a cheap costKey and get premium generations for far less than their real cost.
 * The amount deducted is always max(AI_COSTS[costKey], MODEL_MIN_COST[model actually used]).
 */
export const MODEL_MIN_COST: Record<string, number> = {
    [LITE_MODEL]: 1,
    [DEFAULT_MODEL]: 1,
    [PRO_MODEL]: 5,
    [ULTIMATE_MODEL]: 8,
};

export enum Type {
    OBJECT = "object",
    ARRAY = "array",
    STRING = "string",
    INTEGER = "integer",
    NUMBER = "number",
    BOOLEAN = "boolean",
}

export interface Part {
    text?: string;
    inlineData?: { mimeType: string; data: string };
}

export interface Content {
    role: 'user' | 'model';
    parts: Part[];
}

export interface SafetySetting {
    category: string;
    threshold: string;
}

export interface ImagenProxyResponse {
    inlineData?: { mimeType: string; data: string };
    error?: string;
}

export type StreamChunk = { kind: 'text'; text: string } | { kind: 'thinking'; text: string };
