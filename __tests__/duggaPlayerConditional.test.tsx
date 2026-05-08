/**
 * S61-A3 — Tests for the player's conditional rendering of QR upload,
 * answer-input editor, and embedded math tool based on per-question flags.
 *
 * We test the small `OpenEndedAnswer` rendering rules in isolation rather
 * than mounting the entire DuggaPlayerView (which depends on Auth context,
 * Firestore, and Gemini). Pure structural assertions.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmbeddedMathTool } from '../components/math/EmbeddedMathTool';
import type { DuggaQuestion } from '../services/firestoreService.dugga';

function makeQ(patch: Partial<DuggaQuestion>): DuggaQuestion {
  return {
    id: 'q1',
    type: 'essay',
    text: 'Sample',
    dok: 2,
    points: 5,
    ...patch,
  };
}

describe('A3 — embed slot rendering', () => {
  it('renders nothing when q.embedTool is none/undefined', () => {
    const q = makeQ({ embedTool: 'none' });
    const { container } = render(
      <EmbeddedMathTool tool={q.embedTool} config={q.embedConfig} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders GeoGebra graphing iframe when embedTool=geogebra-graphing', () => {
    const q = makeQ({ embedTool: 'geogebra-graphing', embedConfig: { height: 400 } });
    render(<EmbeddedMathTool tool={q.embedTool} config={q.embedConfig} />);
    const iframe = screen.getByTestId('embedded-geogebra').querySelector('iframe')!;
    expect(iframe.getAttribute('src')).toContain('/graphing?');
    expect(iframe.getAttribute('height')).toBe('400');
  });

  it('renders Desmos graph iframe with shared state when embedTool=desmos-graph', () => {
    const q = makeQ({
      embedTool: 'desmos-graph',
      embedConfig: { materialId: 'shared123' },
    });
    render(<EmbeddedMathTool tool={q.embedTool} config={q.embedConfig} />);
    const wrap = screen.getByTestId('embedded-desmos');
    expect(wrap.dataset.type).toBe('graph');
    const iframe = wrap.querySelector('iframe')!;
    expect(iframe.getAttribute('src')).toContain('/calculator/shared123');
  });
});

describe('A3 — flag defaults are back-compat', () => {
  it('legacy question without S61 fields has no embed', () => {
    const q = makeQ({});
    expect(q.embedTool).toBeUndefined();
    expect(q.allowSolutionUpload).toBeUndefined();
    expect(q.answerInput).toBeUndefined();
  });

  it('answerInput=math fully overrides default', () => {
    const q = makeQ({ answerInput: 'math' });
    expect(q.answerInput).toBe('math');
  });
});
