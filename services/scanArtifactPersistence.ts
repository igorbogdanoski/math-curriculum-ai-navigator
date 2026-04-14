import { logger } from '../utils/logger';
import type { ScanArtifactRecord } from '../types';
import { firestoreService } from './firestoreService';
import { captureException } from './sentryService';

type ScanArtifactPayload = Omit<ScanArtifactRecord, 'id' | 'createdAt' | 'updatedAt'>;

type ScanArtifactFlow = 'vision_homework' | 'written_test_review' | 'generator_extraction';

interface PersistScanArtifactMeta {
  flow: ScanArtifactFlow;
  stage?: string;
}

interface PersistScanArtifactOutcome {
  ok: boolean;
  artifactId?: string;
  durationMs: number;
  error?: unknown;
}

export const persistScanArtifactWithObservability = async (
  record: ScanArtifactPayload,
  meta: PersistScanArtifactMeta,
): Promise<PersistScanArtifactOutcome> => {
  const startedAt = Date.now();

  try {
    const artifactId = await firestoreService.saveScanArtifactRecord(record);
    const durationMs = Date.now() - startedAt;
    logger.info('[scan-archive] persisted', {
      flow: meta.flow,
      stage: meta.stage,
      mode: record.mode,
      sourceType: record.sourceType,
      teacherUid: record.teacherUid,
      artifactId,
      durationMs,
    });
    return { ok: true, artifactId, durationMs };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    captureException(error, {
      feature: 'scan_archive_persistence',
      flow: meta.flow,
      stage: meta.stage,
      mode: record.mode,
      sourceType: record.sourceType,
      teacherUid: record.teacherUid,
      hasExtractedText: Boolean(record.extractedText?.trim()),
      conceptCount: record.conceptIds?.length ?? 0,
      durationMs,
    });
    logger.warn('[scan-archive] persistence failed', {
      flow: meta.flow,
      stage: meta.stage,
      mode: record.mode,
      sourceType: record.sourceType,
      teacherUid: record.teacherUid,
      durationMs,
    });
    return { ok: false, error, durationMs };
  }
};
