/**
 * Component test for the `function_match` answer-input UI added to
 * DuggaQuestionCard — reuses FunctionTransformer with a locked base function
 * and a target curve overlay, wired through this pass.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionCard } from '../components/dugga/DuggaQuestionCard';
import { LanguageProvider } from '../i18n/LanguageContext';
import type { DuggaQuestion } from '../services/firestoreService.dugga';

function renderCard(props: React.ComponentProps<typeof QuestionCard>) {
  return render(<LanguageProvider><QuestionCard {...props} /></LanguageProvider>);
}

function makeQ(patch: Partial<DuggaQuestion>): DuggaQuestion {
  return {
    id: 'q1',
    type: 'function_match',
    text: 'Совпадни ја кривата.',
    dok: 3,
    points: 5,
    expectedTransform: { fnKey: 'sin', target: { a: 2, b: 1, c: 0, d: 1 } },
    ...patch,
  };
}

describe('function_match answer input', () => {
  beforeEach(() => {
    localStorage.setItem('preferred_language', 'mk');
  });

  it('renders FunctionTransformer with the base function locked (no selector)', () => {
    renderCard({ q: makeQ({}), idx: 0, answer: '', onChange: () => {}, showResults: false });
    expect(screen.getByTestId('function-transformer')).toBeTruthy();
    expect(screen.queryByTestId('function-transformer-select')).toBeNull();
    expect(screen.getByTestId('function-transformer-target')).toBeTruthy();
  });

  it('emits JSON params via onChange when a slider moves', () => {
    const onChange = vi.fn();
    renderCard({ q: makeQ({}), idx: 0, answer: '', onChange, showResults: false });
    const sliderA = screen.getByTestId('function-transformer-slider-a');
    fireEvent.change(sliderA, { target: { value: '2' } });
    expect(onChange).toHaveBeenCalledWith('q1', JSON.stringify({ a: 2, b: 1, c: 0, d: 0 }));
  });

  it('restores initialParams from a previously-saved JSON answer', () => {
    renderCard({
      q: makeQ({}),
      idx: 0,
      answer: JSON.stringify({ a: 2, b: 1, c: 0, d: 1 }),
      onChange: () => {},
      showResults: false,
    });
    expect(screen.getByTestId('function-transformer-match-status').textContent).toContain('Ја погоди');
  });

  it('shows an error message when expectedTransform is missing', () => {
    renderCard({ q: makeQ({ expectedTransform: undefined }), idx: 0, answer: '', onChange: () => {}, showResults: false });
    expect(screen.getByText(/нема поставена цел/)).toBeTruthy();
  });
});
