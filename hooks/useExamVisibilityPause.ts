/**
 * useExamVisibilityPause (T2.2 / T2.3)
 *
 * Cross-cutting helper extracted from MaturaExamSession (T2.1) so the legacy
 * MaturaPracticeView and MaturaSimulationView can adopt the same pause-on-
 * hidden behaviour without a full rewrite.
 *
 * Watches `document.visibilityState` and invokes the supplied callbacks when
 * the document becomes hidden/visible. SSR-safe (no-op when `document` is
 * undefined). Disabled when `enabled` is false.
 */
import { useEffect } from 'react';

export interface UseExamVisibilityPauseOptions {
  enabled?: boolean;
  onPause?: () => void;
  onResume?: () => void;
}

export function useExamVisibilityPause(opts: UseExamVisibilityPauseOptions): void {
  const { enabled = true, onPause, onResume } = opts;

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    const handler = () => {
      if (document.visibilityState === 'hidden') onPause?.();
      else onResume?.();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [enabled, onPause, onResume]);
}
