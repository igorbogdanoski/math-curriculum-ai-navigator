/**
 * Component-level tests for the `proof_steps` and `geometry_construct`
 * answer-input UI added to DuggaQuestionCard — these two S61 question types
 * had complete grading logic but no editor/player UI before this pass.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QuestionCard } from '../components/dugga/DuggaQuestionCard';
import { LanguageProvider } from '../i18n/LanguageContext';
import type { DuggaQuestion } from '../services/firestoreService.dugga';

function renderCard(props: React.ComponentProps<typeof QuestionCard>) {
  return render(<LanguageProvider><QuestionCard {...props} /></LanguageProvider>);
}

beforeEach(() => {
  localStorage.setItem('preferred_language', 'mk');
});

function makeQ(patch: Partial<DuggaQuestion>): DuggaQuestion {
  return {
    id: 'q1',
    type: 'proof_steps',
    text: 'Докажи дека...',
    dok: 3,
    points: 6,
    ...patch,
  };
}

describe('proof_steps answer input', () => {
  const q = makeQ({
    expectedProof: {
      steps: [
        { id: 's1', text: 'Чекор 1' },
        { id: 's2', text: 'Чекор 2' },
      ],
      distractors: [{ id: 'd1', text: 'Погрешен чекор' }],
    },
  });

  it('renders all steps + distractors as a single reorderable pool', () => {
    renderCard({ q, idx: 0, answer: '', onChange: () => {}, showResults: false });
    expect(screen.getByText('Чекор 1')).toBeTruthy();
    expect(screen.getByText('Чекор 2')).toBeTruthy();
    expect(screen.getByText('Погрешен чекор')).toBeTruthy();
  });

  it('shows the same shuffled order across independent mounts (seeded by question id)', () => {
    const first = render(<LanguageProvider><QuestionCard q={q} idx={0} answer="" onChange={() => {}} showResults={false} /></LanguageProvider>);
    const items = within(first.container).getAllByText(/Чекор|Погрешен/).map(el => el.textContent);
    first.unmount();

    const second = render(<LanguageProvider><QuestionCard q={q} idx={0} answer="" onChange={() => {}} showResults={false} /></LanguageProvider>);
    const itemsAgain = within(second.container).getAllByText(/Чекор|Погрешен/).map(el => el.textContent);
    second.unmount();

    expect(itemsAgain).toEqual(items);
  });

  it('moving a step up/down emits a JSON array via onChange', () => {
    const onChange = vi.fn();
    renderCard({ q, idx: 0, answer: '', onChange, showResults: false });
    const downButtons = screen.getAllByLabelText('Помести надолу');
    fireEvent.click(downButtons[0]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const [, value] = onChange.mock.calls[0];
    const parsed = JSON.parse(value);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(3);
  });

  it('respects an existing JSON-array answer over the default shuffle', () => {
    renderCard({ q, idx: 0, answer: JSON.stringify(['s2', 's1', 'd1']), onChange: () => {}, showResults: false });
    const items = screen.getAllByText(/Чекор|Погрешен/).map(el => el.textContent);
    expect(items).toEqual(['Чекор 2', 'Чекор 1', 'Погрешен чекор']);
  });
});

describe('geometry_construct answer input', () => {
  const q = makeQ({
    type: 'geometry_construct',
    text: 'Конструирај симетрала.',
    expectedConstruction: { description: 'Симетрала на отсечка AB.' },
  });

  it('shows the expected-construction description as a hint banner', () => {
    renderCard({ q, idx: 0, answer: '', onChange: () => {}, showResults: false });
    expect(screen.getByText(/Симетрала на отсечка AB/)).toBeTruthy();
  });

  it('renders a free-text textarea bound to the answer', () => {
    const onChange = vi.fn();
    renderCard({ q, idx: 0, answer: '', onChange, showResults: false });
    const textarea = screen.getByPlaceholderText(/Опиши ги чекорите/);
    fireEvent.change(textarea, { target: { value: 'Прво нацртав кружници...' } });
    expect(onChange).toHaveBeenCalledWith('q1', 'Прво нацртав кружници...');
  });

  it('does not render the hint banner when no expectedConstruction is set', () => {
    const bare = makeQ({ type: 'geometry_construct', expectedConstruction: undefined });
    renderCard({ q: bare, idx: 0, answer: '', onChange: () => {}, showResults: false });
    expect(screen.queryByText(/Барана конструкција/)).toBeNull();
  });
});
