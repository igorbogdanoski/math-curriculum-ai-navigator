// Shared constants, primitive types, and interfaces used across all core sub-modules.
// No imports from other core.* files — this is the dependency root.

export const CACHE_COLLECTION = 'cached_ai_materials';
export const LITE_MODEL = 'gemini-3.1-flash-lite-preview';
export const DEFAULT_MODEL = 'gemini-3-flash-preview';
export const PRO_MODEL = 'gemini-3-pro-preview';
export const ULTIMATE_MODEL = 'gemini-3.1-pro-preview';
export const IMAGEN_MODEL = 'imagen-4.0-generate-001';
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
