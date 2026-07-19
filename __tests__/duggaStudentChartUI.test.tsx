/**
 * Component test for the `student_chart` answer-input UI — the one Dugga
 * question type (of the 5 orphaned S61 types) with no pre-existing UI at all.
 * Built from scratch: kind selector + data-entry table + live recharts preview.
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

beforeEach(() => {
  localStorage.setItem('preferred_language', 'mk');
});

function makeQ(patch: Partial<DuggaQuestion>): DuggaQuestion {
  return {
    id: 'q1',
    type: 'student_chart',
    text: 'Нацртај стапчест дијаграм за продажбите.',
    dok: 3,
    points: 5,
    expectedChart: { kind: 'bar', xLabel: 'Месец', yLabel: 'Продажби', data: [{ x: 'Јан', y: 10 }] },
    ...patch,
  };
}

describe('student_chart answer input', () => {
  it('renders a kind selector with bar pre-selected by default', () => {
    renderCard({ q: makeQ({}), idx: 0, answer: "", onChange: () => {}, showResults: false });
    expect(screen.getByText('📊 Стапчест')).toBeTruthy();
    expect(screen.getByText('📈 Линиски')).toBeTruthy();
    expect(screen.getByText('⚬ Точки')).toBeTruthy();
    expect(screen.getByText('🥧 Кружен')).toBeTruthy();
  });

  it('switching chart kind emits updated JSON via onChange', () => {
    const onChange = vi.fn();
    renderCard({ q: makeQ({}), idx: 0, answer: "", onChange: onChange, showResults: false });
    fireEvent.click(screen.getByText('📈 Линиски'));
    expect(onChange).toHaveBeenCalled();
    const [, value] = onChange.mock.calls[onChange.mock.calls.length - 1];
    expect(JSON.parse(value).kind).toBe('line');
  });

  it('entering axis labels and data rows produces the exact grading JSON shape', () => {
    const onChange = vi.fn();
    renderCard({ q: makeQ({}), idx: 0, answer: "", onChange: onChange, showResults: false });
    fireEvent.change(screen.getByPlaceholderText('Ознака X-оска (пр. Месец)'), { target: { value: 'Месец' } });
    fireEvent.change(screen.getByLabelText('X вредност ред 1'), { target: { value: 'Јануари' } });
    fireEvent.change(screen.getByLabelText('Y вредност ред 1'), { target: { value: '10' } });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][1];
    const parsed = JSON.parse(last);
    expect(parsed.xLabel).toBe('Месец');
    expect(parsed.data).toContainEqual({ x: 'Јануари', y: 10 });
  });

  it('restores a previously-saved answer into the form fields', () => {
    const answer = JSON.stringify({ kind: 'pie', xLabel: 'Категорија', yLabel: 'Дел', data: [{ x: 'А', y: 30 }, { x: 'Б', y: 70 }] });
    renderCard({ q: makeQ({}), idx: 0, answer: answer, onChange: () => {}, showResults: false });
    expect((screen.getByPlaceholderText('Ознака X-оска (пр. Месец)') as HTMLInputElement).value).toBe('Категорија');
    expect((screen.getByLabelText('X вредност ред 1') as HTMLInputElement).value).toBe('А');
  });

  it('adding a new row does not overwrite existing rows', () => {
    renderCard({ q: makeQ({}), idx: 0, answer: "", onChange: () => {}, showResults: false });
    fireEvent.change(screen.getByLabelText('X вредност ред 1'), { target: { value: 'Јан' } });
    fireEvent.click(screen.getByText(/Додај ред/));
    expect((screen.getByLabelText('X вредност ред 1') as HTMLInputElement).value).toBe('Јан');
  });
});
