import { logger } from '../../utils/logger';
import { Type, DEFAULT_MODEL, MAX_RETRIES, generateAndParseJSON, JSON_SYSTEM_INSTRUCTION } from './core';
import { isMacedonianContextEnabled, MACEDONIAN_CONTEXT_SNIPPET } from './core.instructions';
import type { TeachingProfile } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MMNode {
    id: string;
    label: string;
    level: 0 | 1 | 2;
    parentId: string | null;
    emoji?: string;
}

export interface MindMapData {
    nodes: MMNode[];
}

// ── Generation ────────────────────────────────────────────────────────────────

export async function generateMindMap(topic: string, gradeLevel: number, profile?: TeachingProfile): Promise<MindMapData> {
    // Secondary grades (10-12) don't have БРО standard codes — those apply only to
    // primary/lower-secondary (1-9), same convention as buildTopicStandardsHint (plans.ts).
    const standardsNote = gradeLevel > 9
        ? 'Не користи БРО кодови (пр. III-А.3) — тие важат само за основно образование (1-9 одд.). За средно образование фокусирај се на концепти и компетенции.'
        : '';
    const mkContext = isMacedonianContextEnabled() ? MACEDONIAN_CONTEXT_SNIPPET : '';

    const prompt = `
Ти си наставник по математика за ${gradeLevel}. одделение.
Создади ИНТЕРАКТИВНА КОНЦЕПТУАЛНА КАРТА (Mind Map) за темата: "${topic}"

СТРУКТУРА (задолжителна):
- 1 root јазол (level 0): самата тема
- 5–7 branch јазли (level 1): главните под-теми / клучни поими
- 2–4 leaf јазли по branch (level 2): детали, формули, примери, врски

Правила за label:
- Root: кратко (1–3 збора)
- Branch: концепт или поим (2–5 збора)
- Leaf: конкретно: формула, пример или кратко објаснување (≤12 збора)
- emoji: краток симбол (1 знак) за визуелна поддршка (опционален)

Генерирај конкретна математичка содржина, не генерички зборови.
Јазик: македонски.
${standardsNote}
${mkContext}
`.trim();

    const schema = {
        type: Type.OBJECT,
        properties: {
            nodes: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id:       { type: Type.STRING },
                        label:    { type: Type.STRING },
                        level:    { type: Type.NUMBER },
                        parentId: { type: Type.STRING, nullable: true },
                        emoji:    { type: Type.STRING, nullable: true },
                    },
                    required: ['id', 'label', 'level', 'parentId'],
                },
            },
        },
        required: ['nodes'],
    };

    logger.info('[S79] generateMindMap', { topic, gradeLevel });

    return generateAndParseJSON<MindMapData>(
        [{ text: prompt }],
        schema,
        DEFAULT_MODEL,
        undefined,
        MAX_RETRIES,
        false,
        JSON_SYSTEM_INSTRUCTION,
        profile?.tier,
        { costKey: 'ASSESSMENT' },
    );
}
