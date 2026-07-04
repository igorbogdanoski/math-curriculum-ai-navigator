/**
 * Component test for the `unit_circle_pick` answer-input UI added to
 * DuggaQuestionCard — wraps the extracted UnitCirclePicker (from
 * TrigonometryLab) as a controlled answer input.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuestionCard } from '../components/dugga/DuggaQuestionCard';
import type { DuggaQuestion } from '../services/firestoreService.dugga';

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

describe('unit_circle_pick answer input', () => {
  it('renders the unit circle picker', () => {
    render(<QuestionCard q={makeQ({})} idx={0} answer="" onChange={() => {}} showResults={false} />);
    expect(screen.getByRole('img', { name: /единечна кружница/i })).toBeTruthy();
  });

  it('emits a JSON {angle,x,y} answer when the angle slider changes', () => {
    const onChange = vi.fn();
    render(<QuestionCard q={makeQ({})} idx={0} answer="" onChange={onChange} showResults={false} />);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '90' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    const [, value] = onChange.mock.calls[0];
    const parsed = JSON.parse(value);
    expect(parsed.angle).toBe(90);
    expect(parsed.x).toBeCloseTo(0, 5);
    expect(parsed.y).toBeCloseTo(1, 5);
  });

  it('restores a previously-saved angle from the answer JSON', () => {
    render(
      <QuestionCard
        q={makeQ({})}
        idx={0}
        answer={JSON.stringify({ angle: 45, x: 0.707, y: 0.707 })}
        onChange={() => {}}
        showResults={false}
      />,
    );
    expect(screen.getByRole('img', { name: /45/ })).toBeTruthy();
  });
});
