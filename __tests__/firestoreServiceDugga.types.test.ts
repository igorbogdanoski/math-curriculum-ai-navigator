/**
 * S61-A1 — Type-shape test for the extended DuggaQuestion fields.
 *
 * This is a compile-time + runtime structural check ensuring legacy
 * documents (without the new optional fields) and new documents (with them
 * fully populated) both satisfy the `DuggaQuestion` interface.
 */
import { describe, it, expect } from 'vitest';
import type {
  DuggaQuestion,
  DuggaEmbedTool,
  DuggaEmbedConfig,
  DuggaAnswerInput,
  DuggaDrawingMode,
} from '../services/firestoreService.dugga';

describe('DuggaQuestion S61-A1 schema extension', () => {
  it('accepts a legacy question with no S61 fields (back-compat)', () => {
    const q: DuggaQuestion = {
      id: 'q1',
      type: 'short_answer',
      text: 'Реши: 2x + 3 = 7',
      dok: 2,
      points: 3,
    };
    expect(q.id).toBe('q1');
    expect(q.allowSolutionUpload).toBeUndefined();
    expect(q.embedTool).toBeUndefined();
  });

  it('accepts a question with full per-question teacher controls', () => {
    const q: DuggaQuestion = {
      id: 'q2',
      type: 'essay',
      text: 'Докажи дека √2 е ирационален.',
      dok: 4,
      points: 10,
      allowSolutionUpload: true,
      embedTool: 'geogebra-cas',
      embedConfig: {
        materialId: 'abc123',
        height: 480,
        persistState: true,
      },
      answerInput: 'mixed',
      linkedConceptIds: ['concept.real-numbers', 'concept.proof'],
      studentDrawingMode: 'free-draw',
    };
    expect(q.allowSolutionUpload).toBe(true);
    expect(q.embedTool).toBe('geogebra-cas');
    expect(q.embedConfig?.materialId).toBe('abc123');
    expect(q.linkedConceptIds).toHaveLength(2);
    expect(q.studentDrawingMode).toBe('free-draw');
  });

  it('enumerates all DuggaEmbedTool variants', () => {
    const tools: DuggaEmbedTool[] = [
      'none',
      'geogebra-graphing',
      'geogebra-cas',
      'geogebra-geometry',
      'geogebra-3d',
      'desmos-calc',
      'desmos-graph',
    ];
    expect(tools).toHaveLength(7);
  });

  it('enumerates all DuggaAnswerInput variants', () => {
    const inputs: DuggaAnswerInput[] = ['text', 'math', 'mixed'];
    expect(inputs).toHaveLength(3);
  });

  it('enumerates all DuggaDrawingMode variants', () => {
    const modes: DuggaDrawingMode[] = ['none', 'bar-chart', 'line-chart', 'free-draw'];
    expect(modes).toHaveLength(4);
  });

  it('DuggaEmbedConfig allows partial config', () => {
    const cfg: DuggaEmbedConfig = { height: 320 };
    expect(cfg.height).toBe(320);
    expect(cfg.materialId).toBeUndefined();
  });
});
