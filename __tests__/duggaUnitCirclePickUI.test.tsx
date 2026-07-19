/**
 * Component test for the `unit_circle_pick` answer-input UI added to
 * DuggaQuestionCard — wraps the extracted UnitCirclePicker (from
 * TrigonometryLab) as a controlled answer input.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionCard } from '../components/dugga/DuggaQuestionCard';
import type { DuggaQuestion } from '../services/firestoreService.dugga';
import { LanguageProvider } from '../i18n/LanguageContext';

function makeQ(patch: Partial<DuggaQuestion>): DuggaQuestion {
  return {
    id: 'q1',
    type: 'unit_circle_pick',
    text: 'Означи го аголот 90°.',
    dok: 2,
    points: 3,
    expectedUnitCircle: { angle: 90, unit: 'deg' },
    ...patch,
  };
}

function renderCard(props: React.ComponentProps<typeof QuestionCard>) {
  return render(<LanguageProvider><QuestionCard {...props} /></LanguageProvider>);
}

describe('unit_circle_pick answer input', () => {
  beforeEach(() => { localStorage.setItem('preferred_language', 'mk'); });

  it('renders the unit circle picker', () => {
    renderCard({ q: makeQ({}), idx: 0, answer: '', onChange: () => {}, showResults: false });
    expect(screen.getByRole('img', { name: /единечна кружница/i })).toBeTruthy();
  });

  it('emits a JSON {angle,x,y} answer when the angle slider changes', () => {
    const onChange = vi.fn();
    renderCard({ q: makeQ({}), idx: 0, answer: '', onChange, showResults: false });
    fireEvent.change(screen.getByRole('slider'), { target: { value: '90' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [, value] = onChange.mock.calls[0];
    const parsed = JSON.parse(value);
    expect(parsed.angle).toBe(90);
    expect(parsed.x).toBeCloseTo(0, 5);
    expect(parsed.y).toBeCloseTo(1, 5);
  });

  it('restores a previously-saved angle from the answer JSON', () => {
    renderCard({
      q: makeQ({}),
      idx: 0,
      answer: JSON.stringify({ angle: 45, x: 0.707, y: 0.707 }),
      onChange: () => {},
      showResults: false,
    });
    expect(screen.getByRole('img', { name: /45/ })).toBeTruthy();
  });
});
