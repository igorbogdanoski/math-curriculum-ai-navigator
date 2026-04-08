import { beforeEach, describe, expect, it, vi } from 'vitest';

const { saveScanArtifactRecordMock, captureExceptionMock } = vi.hoisted(() => ({
  saveScanArtifactRecordMock: vi.fn(),
  captureExceptionMock: vi.fn(),
}));

vi.mock('./firestoreService', () => ({
  firestoreService: {
    saveScanArtifactRecord: saveScanArtifactRecordMock,
  },
}));

vi.mock('./sentryService', () => ({
  captureException: captureExceptionMock,
}));

import { persistScanArtifactWithObservability } from './scanArtifactPersistence';

describe('persistScanArtifactWithObservability', () => {
  beforeEach(() => {
    saveScanArtifactRecordMock.mockReset();
    captureExceptionMock.mockReset();
  });

  it('returns artifact id when persistence succeeds', async () => {
    saveScanArtifactRecordMock.mockResolvedValue('artifact-123');

    const outcome = await persistScanArtifactWithObservability({
      teacherUid: 't-1',
      mode: 'content_extraction',
      sourceType: 'web',
      extractedText: 'demo',
      normalizedText: 'demo',
    }, {
      flow: 'generator_extraction',
      stage: 'web',
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.artifactId).toBe('artifact-123');
    expect(outcome.durationMs).toBeTypeOf('number');
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('captures exception context when persistence fails', async () => {
    saveScanArtifactRecordMock.mockRejectedValue(new Error('write failed'));

    const outcome = await persistScanArtifactWithObservability({
      teacherUid: 't-2',
      mode: 'test_grading',
      sourceType: 'image',
      conceptIds: ['c1', 'c2'],
      extractedText: 'feedback',
      normalizedText: 'feedback',
    }, {
      flow: 'written_test_review',
      stage: 'vision_grade_submission',
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.error).toBeInstanceOf(Error);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);

    const context = captureExceptionMock.mock.calls[0][1];
    expect(context).toMatchObject({
      feature: 'scan_archive_persistence',
      flow: 'written_test_review',
      mode: 'test_grading',
      sourceType: 'image',
      teacherUid: 't-2',
      conceptCount: 2,
      hasExtractedText: true,
    });
  });
});
