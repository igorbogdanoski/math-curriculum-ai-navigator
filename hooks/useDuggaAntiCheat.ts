/**
 * S61-E4 — Anti-cheat hooks for the Дига Final Exam mode.
 *
 * Two small primitives composable on top of useExamVisibilityPause:
 *
 *   1. useTabSwitchCounter({ enabled }) → counter incrementing every time
 *      `document.visibilityState` becomes hidden. Player surfaces this in
 *      the proctor breadcrumb after submission.
 *   2. useBlockCopyPaste({ enabled }) → installs document-level capture
 *      listeners that block copy / cut / paste / contextmenu in
 *      open-ended answer inputs (`[data-dugga-no-copy]` opt-in selector).
 *      Ordinary navigation, tooling buttons and AI helpers stay untouched.
 *
 * Both hooks are SSR-safe and turn into no-ops when `enabled` is false.
 */
import { useEffect, useRef, useState } from 'react';

export interface UseTabSwitchCounterOptions {
  enabled?: boolean;
  onSwitch?: (count: number) => void;
}

export function useTabSwitchCounter(opts: UseTabSwitchCounterOptions = {}): number {
  const { enabled = true, onSwitch } = opts;
  const [count, setCount] = useState(0);
  const onSwitchRef = useRef(onSwitch);
  onSwitchRef.current = onSwitch;

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;
    const handler = () => {
      if (document.visibilityState === 'hidden') {
        setCount(prev => {
          const next = prev + 1;
          try { onSwitchRef.current?.(next); } catch { /* noop */ }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [enabled]);

  return count;
}

export interface UseBlockCopyPasteOptions {
  enabled?: boolean;
  /**
   * CSS selector identifying inputs/areas where copy/paste/cut should be
   * blocked. Default: `[data-dugga-no-copy]`.
   */
  selector?: string;
}

export function useBlockCopyPaste(opts: UseBlockCopyPasteOptions = {}): void {
  const { enabled = true, selector = '[data-dugga-no-copy]' } = opts;
  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    const isProtected = (target: EventTarget | null): boolean => {
      if (!(target instanceof Element)) return false;
      return target.closest(selector) !== null;
    };
    const block = (e: Event) => {
      if (isProtected(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const events: Array<keyof DocumentEventMap> = ['copy', 'cut', 'paste', 'contextmenu'];
    events.forEach(evt => document.addEventListener(evt, block, true));
    return () => {
      events.forEach(evt => document.removeEventListener(evt, block, true));
    };
  }, [enabled, selector]);
}
