/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AlgebraTilesCanvas } from './AlgebraTilesCanvas';

vi.mock('../common/MathRenderer', () => ({
  MathRenderer: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock('../../utils/visualShareUrl', () => ({
  buildTileShareUrl: vi.fn(() => 'https://example.test/share'),
}));

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