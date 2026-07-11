/**
 * Tests for MaturaSessionsList (T2.4).
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MaturaSessionsList } from './MaturaSessionsList';
import type { MaturaSessionSummary } from '../../hooks/useMaturaSessions';

function makeSession(over: Partial<MaturaSessionSummary> = {}): MaturaSessionSummary {
  return {
    id: 's1',
    examId: 'e1',
    examTitle: 'Матура 2024 — Јунска',
    completedAt: '2026-04-01T10:00:00Z',
    completedAtTs: 1,
    totalScore: 40,
    maxScore: 60,
    pct: 66.6,
    durationSeconds: 5400,
    questionCount: 30,
    avgSecPerQuestion: 180,
    source: 'firestore',
    perTopic: [
      { key: 'algebra',  label: 'algebra',  correct: 10, max: 12, questions: 8, pct: 83.3 },
      { key: 'analiza',  label: 'analiza',  correct: 4,  max: 10, questions: 5, pct: 40.0 },
    ],
    perPart: [
      { key: '1', label: 'Дел 1', correct: 18, max: 20, questions: 20, pct: 90 },
      { key: '2', label: 'Дел 2', correct: 12, max: 20, questions: 5,  pct: 60 },
    ],
    perDoK: [
      { key: '1', label: 'DoK 1', correct: 10, max: 10, questions: 10, pct: 100 },
      { key: '2', label: 'DoK 2', correct: 5,  max: 10, questions: 5,  pct: 50 },
    ],
    questions: [],
    ...over,
  };
}

afterEach(() => cleanup());

describe('MaturaSessionsList', () => {
  it('renders empty state when no sessions exist', () => {
    render(<MaturaSessionsList sessions={[]} />);
    expect(screen.getByTestId('matura-sessions-empty')).toBeTruthy();
  });

  it('renders loading state when loading=true', () => {
    render(<MaturaSessionsList sessions={[]} loading />);
    expect(screen.getByTestId('matura-sessions-loading')).toBeTruthy();
  });

  it('renders one row per session and shows total count', () => {
    const a = makeSession({ id: 's-a', examTitle: 'Exam A' });
    const b = makeSession({ id: 's-b', examTitle: 'Exam B' });
    render(<MaturaSessionsList sessions={[a, b]} />);
    expect(screen.getByTestId('matura-sessions-list')).toBeTruthy();
    expect(screen.getByTestId('matura-session-row-s-a')).toBeTruthy();
    expect(screen.getByTestId('matura-session-row-s-b')).toBeTruthy();
    expect(screen.getByText(/2 вкупно/)).toBeTruthy();
  });

  it('expands the first session by default and shows drill-down details', () => {
    const a = makeSession({ id: 's-a' });
    render(<MaturaSessionsList sessions={[a]} />);
    expect(screen.getByTestId('matura-session-detail-s-a')).toBeTruthy();
    // Per-topic row label is mapped to "Алгебра"
    expect(screen.getByText('Алгебра')).toBeTruthy();
    expect(screen.getByText('Анализа')).toBeTruthy();
    // Per-part section is rendered
    expect(screen.getByText(/Точност по дел/)).toBeTruthy();
  });

  it('toggles expansion on click', () => {
    const a = makeSession({ id: 's-a' });
    const b = makeSession({ id: 's-b' });
    render(<MaturaSessionsList sessions={[a, b]} />);

    expect(screen.getByTestId('matura-session-detail-s-a')).toBeTruthy();
    expect(screen.queryByTestId('matura-session-detail-s-b')).toBeNull();

    // Click row B to expand it (closes A)
    const rowB = screen.getByTestId('matura-session-row-s-b').querySelector('button')!;
    fireEvent.click(rowB);
    expect(screen.getByTestId('matura-session-detail-s-b')).toBeTruthy();
    expect(screen.queryByTestId('matura-session-detail-s-a')).toBeNull();

    // Click again to collapse
    fireEvent.click(rowB);
    expect(screen.queryByTestId('matura-session-detail-s-b')).toBeNull();
  });

  it('shows the Cloud / Local source badge', () => {
    const cloud = makeSession({ id: 'sc', source: 'firestore' });
    const local = makeSession({ id: 'sl', source: 'local' });
    render(<MaturaSessionsList sessions={[cloud, local]} />);
    expect(screen.getAllByText(/Cloud/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Local/).length).toBeGreaterThan(0);
  });
});
