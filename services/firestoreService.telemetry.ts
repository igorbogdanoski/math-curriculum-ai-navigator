import { logger } from '../utils/logger';
import {
  collection, addDoc, query, where, getDocs, orderBy, limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StepEvent {
  studentId: string;
  teacherUid?: string;
  conceptId: string;
  problemText: string;
  stepIndex: number;
  timeSpentMs: number;
  hintsUsed: number;
  attempts: number;
  correct: boolean;
}

export interface StepTelemetryRecord extends StepEvent {
  id: string;
  recordedAt: string;
}

export interface StepAggregate {
  stepIndex: number;
  totalAttempts: number;
  avgTimeMs: number;
  avgHints: number;
  successRate: number;
  sampleCount: number;
}

const COLLECTION = 'cognitive_telemetry';

// ─── Write (fire-and-forget) ──────────────────────────────────────────────────

export function logStepEvent(event: StepEvent): void {
  addDoc(collection(db, COLLECTION), {
    ...event,
    recordedAt: serverTimestamp(),
  }).catch(e => logger.warn('[telemetry] logStepEvent failed:', e));
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function fetchConceptTelemetry(
  conceptId: string,
  maxRecords = 500,
): Promise<StepTelemetryRecord[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('conceptId', '==', conceptId),
      orderBy('recordedAt', 'desc'),
      limit(maxRecords),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StepTelemetryRecord));
  } catch (e) {
    logger.warn('[telemetry] fetchConceptTelemetry failed:', e);
    return [];
  }
}

export async function fetchTeacherTelemetry(
  teacherUid: string,
  maxRecords = 1000,
): Promise<StepTelemetryRecord[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('teacherUid', '==', teacherUid),
      orderBy('recordedAt', 'desc'),
      limit(maxRecords),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as StepTelemetryRecord));
  } catch (e) {
    logger.warn('[telemetry] fetchTeacherTelemetry failed:', e);
    return [];
  }
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

export function aggregateByStep(records: StepTelemetryRecord[]): StepAggregate[] {
  const byStep = new Map<number, StepTelemetryRecord[]>();
  for (const r of records) {
    const arr = byStep.get(r.stepIndex) ?? [];
    arr.push(r);
    byStep.set(r.stepIndex, arr);
  }
  return Array.from(byStep.entries())
    .sort(([a], [b]) => a - b)
    .map(([stepIndex, recs]) => ({
      stepIndex,
      sampleCount: recs.length,
      totalAttempts: recs.reduce((s, r) => s + r.attempts, 0),
      avgTimeMs: Math.round(recs.reduce((s, r) => s + r.timeSpentMs, 0) / recs.length),
      avgHints: Math.round((recs.reduce((s, r) => s + r.hintsUsed, 0) / recs.length) * 10) / 10,
      successRate: Math.round((recs.filter(r => r.correct).length / recs.length) * 100),
    }));
}

export function aggregateByConcept(
  records: StepTelemetryRecord[],
): { conceptId: string; problemText: string; avgHints: number; avgTime: number; hardestStepIndex: number }[] {
  const byConcept = new Map<string, StepTelemetryRecord[]>();
  for (const r of records) {
    const arr = byConcept.get(r.conceptId) ?? [];
    arr.push(r);
    byConcept.set(r.conceptId, arr);
  }
  return Array.from(byConcept.entries()).map(([conceptId, recs]) => {
    const agg = aggregateByStep(recs);
    const hardest = agg.reduce((a, b) => (a.avgHints > b.avgHints ? a : b), agg[0]);
    return {
      conceptId,
      problemText: recs[0]?.problemText ?? '',
      avgHints: Math.round((recs.reduce((s, r) => s + r.hintsUsed, 0) / recs.length) * 10) / 10,
      avgTime: Math.round(recs.reduce((s, r) => s + r.timeSpentMs, 0) / recs.length),
      hardestStepIndex: hardest?.stepIndex ?? 0,
    };
  });
}

export const telemetryService = {
  logStepEvent,
  fetchConceptTelemetry,
  fetchTeacherTelemetry,
  aggregateByStep,
  aggregateByConcept,
};
