import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { logger } from '../../utils/logger';

/**
 * Fleet-wide, admin-controlled defaults for the feature flags in SettingsDevPanel.
 * Precedence at each call site stays: explicit per-user localStorage override (unchanged
 * behavior) > this global default (admin-set) > the flag's original hardcoded default.
 */
export type GlobalFlagKey =
  | 'mk_local_context_enabled'
  | 'recovery_worksheet_enabled'
  | 'intent_router_enabled'
  | 'vertex_ai_shadow_enabled'
  | 'feedback_taxonomy_rollout_enabled';

const CONFIG_DOC = ['app_config', 'featureFlags'] as const;

let cache: Partial<Record<GlobalFlagKey, boolean>> = {};
let unsubscribeFn: (() => void) | null = null;

/** Subscribes once to app_config/featureFlags. Safe to call repeatedly — only the first call wires the listener. */
export function initGlobalFeatureFlags(): void {
  if (unsubscribeFn) return;
  try {
    unsubscribeFn = onSnapshot(
      doc(db, ...CONFIG_DOC),
      (snap) => { cache = (snap.data() as Partial<Record<GlobalFlagKey, boolean>>) ?? {}; },
      (error) => logger.error('Failed to subscribe to global feature flags:', error),
    );
  } catch (error) {
    logger.error('Failed to init global feature flags listener:', error);
  }
}

/** The admin-set fleet-wide default for a flag, or undefined if not yet configured/loaded. */
export function getGlobalDefault(key: GlobalFlagKey): boolean | undefined {
  return cache[key];
}

/** Writes a new fleet-wide default. Firestore rules restrict this write to admins. */
export async function setGlobalDefault(key: GlobalFlagKey, value: boolean): Promise<void> {
  await setDoc(doc(db, ...CONFIG_DOC), { [key]: value }, { merge: true });
}

/** Test-only helper to reset internal state. */
export function _resetForTests(): void {
  cache = {};
  unsubscribeFn?.();
  unsubscribeFn = null;
}
