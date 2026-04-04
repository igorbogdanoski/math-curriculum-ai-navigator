import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFeedbackBreakdown } from './useFeedbackBreakdown';
import { computeFeedbackBreakdown } from '../services/firestoreService';

vi.mock('../services/firestoreService', () => ({
  computeFeedbackBreakdown: vi.fn(),
}));

describe('useFeedbackBreakdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears stale data when disabled', async () => {
    vi.mocked(computeFeedbackBreakdown).mockResolvedValue({
      totalFeedback: 1,
      approved: 1,
      rejected: 0,
      revision_requested: 0,
      reasonCounts: { clarity: 1 },
      reasonPercentages: { clarity: 100 },
      topReasons: [{ code: 'clarity', count: 1, percentage: 100 }],
      periodDays: 30,
      generatedAt: new Date(),
    } as any);

    const { result, rerender } = renderHook(
      (props: { enabled: boolean; uid?: string }) =>
        useFeedbackBreakdown({ uid: props.uid, enabled: props.enabled, periodDays: 30 }),
      {
        initialProps: { enabled: true, uid: 'teacher-1' },
      },
    );

    await waitFor(() => {
      expect(result.current.data?.totalFeedback).toBe(1);
    }, { timeout: 500 });

    rerender({ enabled: false, uid: 'teacher-1' });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 500 });
  });

  it('clears stale data when uid is removed', async () => {
    vi.mocked(computeFeedbackBreakdown).mockResolvedValue({
      totalFeedback: 2,
      approved: 1,
      rejected: 1,
      revision_requested: 0,
      reasonCounts: { accuracy: 1 },
      reasonPercentages: { accuracy: 50 },
      topReasons: [{ code: 'accuracy', count: 1, percentage: 50 }],
      periodDays: 30,
      generatedAt: new Date(),
    } as any);

    const { result, rerender } = renderHook(
      (props: { uid: string | undefined }) =>
        useFeedbackBreakdown({ uid: props.uid, enabled: true, periodDays: 30 }),
      {
        initialProps: { uid: 'teacher-2' },
      },
    );

    await waitFor(() => {
      expect(result.current.data?.totalFeedback).toBe(2);
    }, { timeout: 500 });

    rerender({ uid: '' });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 500 });
  });
});
