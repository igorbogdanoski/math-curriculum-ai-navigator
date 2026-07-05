import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MathToolsView } from './MathToolsView';
import { useNavigation } from '../contexts/NavigationContext';

const navigate = vi.fn();
vi.mock('../contexts/NavigationContext', () => ({ useNavigation: vi.fn() }));

vi.mock('../components/common/MathToolsPanel', () => ({
  MathToolsPanel: ({ defaultTab, onClose }: { defaultTab?: string; onClose?: () => void }) => (
    <div>
      <span data-testid="default-tab">{defaultTab ?? 'none'}</span>
      <button type="button" onClick={onClose}>close</button>
    </div>
  ),
}));

describe('MathToolsView', () => {
  beforeEach(() => {
    vi.mocked(useNavigation).mockReturnValue({ navigate });
    navigate.mockClear();
    window.location.hash = '#/math-tools';
  });

  it('passes no defaultTab when the URL has no ?tab= param', () => {
    render(<MathToolsView />);
    expect(screen.getByTestId('default-tab').textContent).toBe('none');
  });

  it('passes a valid ?tab= param through as defaultTab', () => {
    window.location.hash = '#/math-tools?tab=desmos';
    render(<MathToolsView />);
    expect(screen.getByTestId('default-tab').textContent).toBe('desmos');
  });

  it('ignores an unrecognized ?tab= value', () => {
    window.location.hash = '#/math-tools?tab=not-a-real-tab';
    render(<MathToolsView />);
    expect(screen.getByTestId('default-tab').textContent).toBe('none');
  });

  it('navigates to /data-viz when the panel is closed', () => {
    render(<MathToolsView />);
    fireEvent.click(screen.getByText('close'));
    expect(navigate).toHaveBeenCalledWith('/data-viz');
  });
});
