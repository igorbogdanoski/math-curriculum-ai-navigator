/**
 * S61-E4 — Tests for anti-cheat hooks + ExamWatermark.
 */
import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import { useTabSwitchCounter, useBlockCopyPaste } from '../hooks/useDuggaAntiCheat';
import { ExamWatermark } from '../components/dugga/ExamWatermark';

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('useTabSwitchCounter', () => {
  beforeEach(() => setVisibility('visible'));
  afterEach(() => setVisibility('visible'));

  it('starts at 0 and increments on hidden', () => {
    const { result } = renderHook(() => useTabSwitchCounter({ enabled: true }));
    expect(result.current).toBe(0);
    act(() => setVisibility('hidden'));
    expect(result.current).toBe(1);
    act(() => setVisibility('visible'));
    act(() => setVisibility('hidden'));
    expect(result.current).toBe(2);
  });

  it('does not count when disabled', () => {
    const { result } = renderHook(() => useTabSwitchCounter({ enabled: false }));
    act(() => setVisibility('hidden'));
    expect(result.current).toBe(0);
  });

  it('invokes onSwitch callback with the new count', () => {
    const events: number[] = [];
    renderHook(() => useTabSwitchCounter({ enabled: true, onSwitch: n => events.push(n) }));
    act(() => setVisibility('hidden'));
    act(() => setVisibility('visible'));
    act(() => setVisibility('hidden'));
    expect(events).toEqual([1, 2]);
  });
});

describe('useBlockCopyPaste', () => {
  it('blocks copy/paste/cut/contextmenu inside protected nodes', () => {
    renderHook(() => useBlockCopyPaste({ enabled: true }));
    const div = document.createElement('div');
    div.setAttribute('data-dugga-no-copy', '');
    document.body.appendChild(div);

    for (const evtName of ['copy', 'cut', 'paste', 'contextmenu'] as const) {
      const e = new Event(evtName, { bubbles: true, cancelable: true });
      div.dispatchEvent(e);
      expect(e.defaultPrevented, evtName).toBe(true);
    }
    document.body.removeChild(div);
  });

  it('does not block events outside protected nodes', () => {
    renderHook(() => useBlockCopyPaste({ enabled: true }));
    const div = document.createElement('div');
    document.body.appendChild(div);
    const e = new Event('copy', { bubbles: true, cancelable: true });
    div.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    document.body.removeChild(div);
  });

  it('is inert when disabled', () => {
    renderHook(() => useBlockCopyPaste({ enabled: false }));
    const div = document.createElement('div');
    div.setAttribute('data-dugga-no-copy', '');
    document.body.appendChild(div);
    const e = new Event('copy', { bubbles: true, cancelable: true });
    div.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
    document.body.removeChild(div);
  });
});

describe('ExamWatermark', () => {
  it('renders an aria-hidden watermark with student + test identity', () => {
    const { getByTestId } = render(
      <ExamWatermark
        studentName="Игор Богданоски"
        studentUid="uid-1234567890"
        testTitle="Матура 2026"
        printedAt="2026-05-10T10:11:12.000Z"
      />,
    );
    const wm = getByTestId('dugga-watermark');
    expect(wm.getAttribute('aria-hidden')).toBe('true');
    expect(wm.textContent).toContain('Матура 2026');
    expect(wm.textContent).toContain('Игор Богданоски');
    expect(wm.textContent).toContain('uid-1234');
    expect(wm.textContent).toContain('2026-05-10');
  });
});
