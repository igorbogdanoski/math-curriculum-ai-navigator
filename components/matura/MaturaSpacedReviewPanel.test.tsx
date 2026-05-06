/**
 * Tests for MaturaSpacedReviewPanel (T3.1).
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const navigateMock = vi.fn();

vi.mock('../../contexts/NavigationContext', () => ({
  useNavigation: () => ({ navigate: navigateMock }),
}));
vi.mock('../../hooks/useMaturaSpacedQueue', () => ({
  useMaturaSpacedQueue: vi.fn(),
}));

import { useMaturaSpacedQueue } from '../../hooks/useMaturaSpacedQueue';
import { MaturaSpacedReviewPanel } from './MaturaSpacedReviewPanel';

const mocked = vi.mocked(useMaturaSpacedQueue);

beforeEach(() => {
  navigateMock.mockReset();
  mocked.mockReset();
});

afterEach(() => cleanup());

function setQueue(args: { count?: number; loading?: boolean }) {
  mocked.mockReturnValue({
    loading: args.loading ?? false,
    records: [],
    due: [],
    count: args.count ?? 0,
    refresh: vi.fn(),
  });
}

describe('MaturaSpacedReviewPanel', () => {
  it('shows the loading skeleton', () => {
    setQueue({ loading: true });
    render(<MaturaSpacedReviewPanel />);
    expect(screen.getByTestId('matura-spaced-panel-loading')).toBeTruthy();
  });

  it('shows the empty state when nothing is due', () => {
    setQueue({ count: 0 });
    render(<MaturaSpacedReviewPanel />);
    expect(screen.getByTestId('matura-spaced-panel-empty')).toBeTruthy();
  });

  it('shows the count and navigates to /matura-practice?mode=spaced on click', () => {
    setQueue({ count: 5 });
    render(<MaturaSpacedReviewPanel />);
    const panel = screen.getByTestId('matura-spaced-panel');
    expect(panel).toBeTruthy();
    expect(screen.getByText(/5 прашања/)).toBeTruthy();
    const button = panel.querySelector('button')!;
    fireEvent.click(button);
    expect(navigateMock).toHaveBeenCalledWith('/matura-practice?mode=spaced');
  });

  it('uses the singular "прашање" form when count is 1', () => {
    setQueue({ count: 1 });
    render(<MaturaSpacedReviewPanel />);
    expect(screen.getByText(/1 прашање/)).toBeTruthy();
  });

  it('respects a custom practicePath', () => {
    setQueue({ count: 2 });
    render(<MaturaSpacedReviewPanel practicePath="/custom-path" />);
    fireEvent.click(screen.getByTestId('matura-spaced-panel').querySelector('button')!);
    expect(navigateMock).toHaveBeenCalledWith('/custom-path');
  });
});
