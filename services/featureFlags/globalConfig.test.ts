import { describe, it, expect, vi, beforeEach } from 'vitest';
import { onSnapshot, setDoc } from 'firebase/firestore';
import {
  initGlobalFeatureFlags,
  getGlobalDefault,
  setGlobalDefault,
  _resetForTests,
} from './globalConfig';

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ __ref: 'app_config/featureFlags' })),
  onSnapshot: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../firebaseConfig', () => ({ db: {} }));

describe('globalConfig — fleet-wide feature-flag defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetForTests();
  });

  it('returns undefined for any flag before the listener has delivered a snapshot', () => {
    expect(getGlobalDefault('vertex_ai_shadow_enabled')).toBeUndefined();
  });

  it('caches the snapshot data once onSnapshot delivers it', () => {
    let capturedCallback: ((snap: { data: () => unknown }) => void) | undefined;
    vi.mocked(onSnapshot).mockImplementation((_ref, onNext) => {
      capturedCallback = onNext as never;
      return vi.fn();
    });

    initGlobalFeatureFlags();
    capturedCallback!({ data: () => ({ vertex_ai_shadow_enabled: true, intent_router_enabled: false }) });

    expect(getGlobalDefault('vertex_ai_shadow_enabled')).toBe(true);
    expect(getGlobalDefault('intent_router_enabled')).toBe(false);
    expect(getGlobalDefault('recovery_worksheet_enabled')).toBeUndefined();
  });

  it('only wires the onSnapshot listener once across repeated init calls', () => {
    vi.mocked(onSnapshot).mockReturnValue(vi.fn());
    initGlobalFeatureFlags();
    initGlobalFeatureFlags();
    initGlobalFeatureFlags();
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  it('setGlobalDefault writes a merged update to app_config/featureFlags', async () => {
    await setGlobalDefault('feedback_taxonomy_rollout_enabled', true);
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      { feedback_taxonomy_rollout_enabled: true },
      { merge: true },
    );
  });
});
