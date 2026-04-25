/**
 * S43-A1/A2 — Quick-generate sessionStorage contract tests.
 *
 * Validates the round-trip: ExtractionHub writes materialType into the
 * sessionStorage payload → MaterialsGeneratorView reads it back.
 * Pure logic tests — no DOM/React rendering needed.
 */
import { describe, expect, it, beforeEach } from 'vitest';

// ─── Payload builder (mirrors ExtractionHub sendToGenerator logic) ────────────

type QuickGenType = 'SCENARIO' | 'QUIZ' | 'FLASHCARDS' | 'ASSESSMENT';

function buildExtractionPayload(materialType: QuickGenType, scenarioText: string, source: string) {
  return {
    contextType: 'SCENARIO' as const,
    materialType,
    scenarioText: `[Извлечено од: ${source}]\n\n${scenarioText}`,
  };
}

// ─── Payload reader (mirrors MaterialsGeneratorView pre-fill logic) ───────────

interface ParsedPrefill {
  contextType: string;
  materialType: string | null;
  scenarioText: string;
  shouldAdvance: boolean;
}

function parseExtractionPayload(raw: string): ParsedPrefill | null {
  try {
    const payload = JSON.parse(raw) as { contextType?: string; scenarioText?: string; materialType?: string };
    if (payload.contextType === 'SCENARIO' && payload.scenarioText) {
      return {
        contextType: payload.contextType,
        materialType: payload.materialType ?? null,
        scenarioText: payload.scenarioText,
        shouldAdvance: true,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExtractionHub → Generator sessionStorage contract', () => {
  it('builds a payload with contextType always SCENARIO', () => {
    const payload = buildExtractionPayload('QUIZ', '1. Task one', 'video.url');
    expect(payload.contextType).toBe('SCENARIO');
  });

  it('includes the selected materialType in the payload', () => {
    const payloadQuiz = buildExtractionPayload('QUIZ', 'text', 'src');
    expect(payloadQuiz.materialType).toBe('QUIZ');

    const payloadFlash = buildExtractionPayload('FLASHCARDS', 'text', 'src');
    expect(payloadFlash.materialType).toBe('FLASHCARDS');

    const payloadAssess = buildExtractionPayload('ASSESSMENT', 'text', 'src');
    expect(payloadAssess.materialType).toBe('ASSESSMENT');

    const payloadScenario = buildExtractionPayload('SCENARIO', 'text', 'src');
    expect(payloadScenario.materialType).toBe('SCENARIO');
  });

  it('prefixes scenarioText with the source reference', () => {
    const payload = buildExtractionPayload('QUIZ', 'My task content', 'https://youtube.com/abc');
    expect(payload.scenarioText).toContain('https://youtube.com/abc');
    expect(payload.scenarioText).toContain('My task content');
  });

  it('parseExtractionPayload returns contextType and materialType', () => {
    const raw = JSON.stringify(buildExtractionPayload('QUIZ', 'task text', 'doc.pdf'));
    const result = parseExtractionPayload(raw);
    expect(result).not.toBeNull();
    expect(result?.contextType).toBe('SCENARIO');
    expect(result?.materialType).toBe('QUIZ');
    expect(result?.shouldAdvance).toBe(true);
  });

  it('parseExtractionPayload handles legacy payload without materialType', () => {
    const legacyRaw = JSON.stringify({ contextType: 'SCENARIO', scenarioText: 'old text' });
    const result = parseExtractionPayload(legacyRaw);
    expect(result).not.toBeNull();
    expect(result?.materialType).toBeNull();
    expect(result?.scenarioText).toBe('old text');
    expect(result?.shouldAdvance).toBe(true);
  });

  it('parseExtractionPayload returns null for malformed JSON', () => {
    expect(parseExtractionPayload('not-json')).toBeNull();
  });

  it('parseExtractionPayload returns null when contextType is not SCENARIO', () => {
    const raw = JSON.stringify({ contextType: 'CONCEPT', scenarioText: 'text' });
    expect(parseExtractionPayload(raw)).toBeNull();
  });

  it('parseExtractionPayload returns null when scenarioText is empty', () => {
    const raw = JSON.stringify({ contextType: 'SCENARIO', scenarioText: '' });
    expect(parseExtractionPayload(raw)).toBeNull();
  });

  it('round-trip: build then parse preserves all materialType values', () => {
    const types: QuickGenType[] = ['SCENARIO', 'QUIZ', 'FLASHCARDS', 'ASSESSMENT'];
    for (const t of types) {
      const raw = JSON.stringify(buildExtractionPayload(t, 'task', 'src'));
      const parsed = parseExtractionPayload(raw);
      expect(parsed?.materialType).toBe(t);
    }
  });

  it('scenarioText in payload is non-empty string', () => {
    const tasks = ['1. Задача еден\n$x^2 + 1 = 0$', '2. Задача два\n$2x = 4$'];
    const text = tasks.join('\n\n');
    const payload = buildExtractionPayload('QUIZ', text, 'документ');
    expect(payload.scenarioText.length).toBeGreaterThan(0);
    expect(payload.scenarioText).toContain('Задача');
  });
});
