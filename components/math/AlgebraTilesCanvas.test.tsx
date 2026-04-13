/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AlgebraTilesCanvas, buildExpression } from './AlgebraTilesCanvas';

vi.mock('../common/MathRenderer', () => ({
  MathRenderer: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('../../utils/visualShareUrl', () => ({
  buildTileShareUrl: vi.fn(() => 'https://example.test/share'),
}));

// ─── buildExpression pure function ───────────────────────────────────────────

type T = Parameters<typeof buildExpression>[0][number];
const tile = (kind: T['kind'], sign: T['sign'], n = 1): T[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${kind}${sign}${i}`, kind, sign, x: 0, y: 0 }));

describe('buildExpression', () => {
  it('returns 0 for empty canvas', () => {
    expect(buildExpression([])).toBe('0');
  });

  it('single positive unit', () => {
    expect(buildExpression(tile('1', 1))).toBe('1');
  });

  it('single negative unit', () => {
    expect(buildExpression(tile('1', -1))).toBe('-1');
  });

  it('single x tile', () => {
    expect(buildExpression(tile('x', 1))).toBe('x');
  });

  it('single negative x tile', () => {
    expect(buildExpression(tile('x', -1))).toBe('-x');
  });

  it('single x² tile', () => {
    expect(buildExpression(tile('x2', 1))).toBe('x^2');
  });

  it('single negative x² tile', () => {
    expect(buildExpression(tile('x2', -1))).toBe('-x^2');
  });

  it('x²+3x+2', () => {
    const tiles = [...tile('x2', 1), ...tile('x', 1, 3), ...tile('1', 1, 2)];
    expect(buildExpression(tiles)).toBe('x^2 + 3x + 2');
  });

  it('2x+4', () => {
    const tiles = [...tile('x', 1, 2), ...tile('1', 1, 4)];
    expect(buildExpression(tiles)).toBe('2x + 4');
  });

  it('x²-4 (difference of squares)', () => {
    const tiles = [...tile('x2', 1), ...tile('1', -1, 4)];
    expect(buildExpression(tiles)).toBe('x^2 - 4');
  });

  it('x²-x-2', () => {
    const tiles = [...tile('x2', 1), ...tile('x', -1), ...tile('1', -1, 2)];
    expect(buildExpression(tiles)).toBe('x^2 - x - 2');
  });

  it('zero-pair cancellation: +x and -x → 0 x term', () => {
    const tiles = [...tile('x', 1, 2), ...tile('x', -1, 2), ...tile('1', 1, 3)];
    expect(buildExpression(tiles)).toBe('3');
  });

  it('all zero-pairs → 0', () => {
    const tiles = [...tile('x2', 1), ...tile('x2', -1), ...tile('x', 1), ...tile('x', -1)];
    expect(buildExpression(tiles)).toBe('0');
  });

  it('negative leading x² coefficient', () => {
    const tiles = [...tile('x2', -1, 2), ...tile('x', 1, 3)];
    expect(buildExpression(tiles)).toBe('-2x^2 + 3x');
  });

  it('coefficient > 1 on all terms: 2x²+3x+5', () => {
    const tiles = [...tile('x2', 1, 2), ...tile('x', 1, 3), ...tile('1', 1, 5)];
    expect(buildExpression(tiles)).toBe('2x^2 + 3x + 5');
  });
});

// ─── onExpressionChange callback ────────────────────────────────────────────

describe('onExpressionChange (A1.9)', () => {
  it('fires with initial expression on mount for a preset', async () => {
    const onChange = vi.fn();
    render(<AlgebraTilesCanvas presetExpression="x²+3x+2" onExpressionChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('x^2 + 3x + 2'));
  });

  it('fires with "0" on empty canvas mount', async () => {
    const onChange = vi.fn();
    render(<AlgebraTilesCanvas onExpressionChange={onChange} />);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('0'));
  });

  it('fires updated expression after user adds a tile', async () => {
    const onChange = vi.fn();
    render(<AlgebraTilesCanvas onExpressionChange={onChange} />);

    // Click the +x tile in the palette
    fireEvent.click(screen.getByRole('button', { name: /^\+x$/ }));

    await waitFor(() => {
      const calls = onChange.mock.calls.map(c => c[0]);
      expect(calls).toContain('x');
    });
  });
});

// ─── Component acceptance ─────────────────────────────────────────────────────

describe('AlgebraTilesCanvas acceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks the guided factoring preset as solved', async () => {
    const onSolve = vi.fn();

    render(<AlgebraTilesCanvas presetExpression="x²+3x+2" onSolve={onSolve} />);

    fireEvent.click(screen.getByRole('button', { name: /Водена факторизација/i }));

    expect(screen.getByText(/факторизацијата е точна/i)).toBeTruthy();
    await waitFor(() => expect(onSolve).toHaveBeenCalledTimes(1));
  });

  it('recognizes a balanced preset challenge in balance mode', async () => {
    const onSolve = vi.fn();

    render(<AlgebraTilesCanvas mode="balance" onSolve={onSolve} />);

    fireEvent.click(screen.getByRole('button', { name: 'x+x+2 = 2x+2' }));

    expect(screen.getByText(/Балансирано!/i)).toBeTruthy();
    await waitFor(() => expect(onSolve).toHaveBeenCalledTimes(1));
  });

  it('hides editing controls in read-only mode', () => {
    render(<AlgebraTilesCanvas presetExpression="2x+4" readOnly />);

    expect(screen.queryByText('Палета')).toBeNull();
    expect(screen.queryByRole('button', { name: /Водена факторизација/i })).toBeNull();
    expect(screen.getByText(/\$2x \+ 4\$/)).toBeTruthy();
  });
});