/**
 * Tests for hooks/useExamVisibilityPause (T2.2 / T2.3).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExamVisibilityPause } from '../hooks/useExamVisibilityPause';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('useExamVisibilityPause', () => {
  beforeEach(() => {
    setVisibility('visible');
  });
  afterEach(() => {
    setVisibility('visible');
  });

  it('calls onPause when document becomes hidden', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    renderHook(() => useExamVisibilityPause({ onPause, onResume }));
    act(() => setVisibility('hidden'));
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();
  });

  it('calls onResume when document becomes visible again', () => {
    const onPause = vi.fn();
    const onResume = vi.fn();
    renderHook(() => useExamVisibilityPause({ onPause, onResume }));
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('does nothing when enabled=false', () => {
    const onPause = vi.fn();
    renderHook(() => useExamVisibilityPause({ enabled: false, onPause }));
    act(() => setVisibility('hidden'));
    expect(onPause).not.toHaveBeenCalled();
  });

  it('removes listener on unmount', () => {
    const onPause = vi.fn();
    const { unmount } = renderHook(() => useExamVisibilityPause({ onPause }));
    unmount();
    act(() => setVisibility('hidden'));
    expect(onPause).not.toHaveBeenCalled();
  });
});
