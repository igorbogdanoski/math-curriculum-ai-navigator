import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlanningErrorBoundary } from './PlanningErrorBoundary';

const GoodChild = () => <div data-testid="child">OK</div>;

const BadChild = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('test render crash');
  return <div data-testid="child">OK</div>;
};

// Suppress React's error console noise in tests.
const originalConsoleError = console.error;
beforeEach(() => { console.error = vi.fn(); });
afterEach(() => { console.error = originalConsoleError; });

describe('PlanningErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <PlanningErrorBoundary>
        <GoodChild />
      </PlanningErrorBoundary>,
    );
    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('renders error fallback when a child throws', () => {
    render(
      <PlanningErrorBoundary label="Тест планот">
        <BadChild shouldThrow />
      </PlanningErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/Тест планот не може да се вчита/i)).toBeDefined();
  });

  it('shows the retry button in the error state', () => {
    render(
      <PlanningErrorBoundary>
        <BadChild shouldThrow />
      </PlanningErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /обиди|retry/i })).toBeDefined();
  });

  it('resets to show children when retry is clicked', async () => {
    // We need a component that can switch between throwing and not throwing.
    let shouldThrow = true;
    const Toggle = () => {
      if (shouldThrow) throw new Error('crash');
      return <div data-testid="child">OK after retry</div>;
    };

    render(
      <PlanningErrorBoundary>
        <Toggle />
      </PlanningErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeDefined();

    // Prevent throwing on re-render
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /обиди|retry/i }));

    expect(screen.getByTestId('child')).toBeDefined();
  });

  it('uses default label when no label prop is provided', () => {
    render(
      <PlanningErrorBoundary>
        <BadChild shouldThrow />
      </PlanningErrorBoundary>,
    );
    expect(screen.getByText(/Планот не може да се вчита/i)).toBeDefined();
  });
});
