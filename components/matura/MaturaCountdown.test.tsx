/**
 * Tests for components/matura/MaturaCountdown.tsx (T1.5).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MaturaCountdown } from './MaturaCountdown';

// Stable "now" so countdown values are deterministic.
const NOW = new Date('2026-04-01T09:00:00Z').getTime();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('MaturaCountdown', () => {
  it('renders four pads (denovi/časovi/minuti/sekundi) when target is in the future', () => {
    const future = new Date(NOW + 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5 * 1000);
    render(<MaturaCountdown examDate={future} />);
    expect(screen.getByText('денови')).toBeTruthy();
    expect(screen.getByText('часови')).toBeTruthy();
    expect(screen.getByText('минути')).toBeTruthy();
    expect(screen.getByText('секунди')).toBeTruthy();
  });

  it('formats day/hour/minute/second values with zero-padding', () => {
    const future = new Date(NOW + 2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5 * 1000);
    render(<MaturaCountdown examDate={future} />);
    expect(screen.getByText('02')).toBeTruthy();
    expect(screen.getByText('03')).toBeTruthy();
    expect(screen.getByText('04')).toBeTruthy();
    expect(screen.getByText('05')).toBeTruthy();
  });

  it('shows "Среќна матура!" when target is in the past', () => {
    const past = new Date(NOW - 60 * 60 * 1000);
    render(<MaturaCountdown examDate={past} />);
    expect(screen.getByText(/Среќна матура/)).toBeTruthy();
  });

  it('shows "Среќна матура!" when target is exactly now', () => {
    const exact = new Date(NOW);
    render(<MaturaCountdown examDate={exact} />);
    expect(screen.getByText(/Среќна матура/)).toBeTruthy();
  });

  it('falls back to default 6 June 2026 label when examDate not given', () => {
    render(<MaturaCountdown />);
    expect(screen.getByText(/6 јуни 2026/)).toBeTruthy();
  });

  it('renders a localized date label when examDate is provided', () => {
    const future = new Date('2026-05-15T09:00:00Z');
    render(<MaturaCountdown examDate={future} />);
    // mk-MK locale date string contains the year and month name
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it('correctly computes 7-day delta', () => {
    const future = new Date(NOW + 7 * 86_400_000);
    render(<MaturaCountdown examDate={future} />);
    expect(screen.getByText('07')).toBeTruthy();
  });

  it('clears interval on unmount (no errors after unmount)', () => {
    const future = new Date(NOW + 86_400_000);
    const { unmount } = render(<MaturaCountdown examDate={future} />);
    expect(() => unmount()).not.toThrow();
  });
});
