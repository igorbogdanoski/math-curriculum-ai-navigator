/**
 * National Benchmark Service — Ж6.4
 *
 * Opt-in anonymous class performance benchmarking.
 * Teachers submit only aggregated, non-personal stats — no student names,
 * no individual results. Used to compute class percentile vs national average.
 *
 * Firestore path: national_benchmark/{teacherUid}
 * Security rules: read = any auth; write = own document only
 *
 * Педагошка основа: Data-Driven Decision Making, National Formative Standards
 */

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BenchmarkEntry {
  teacherUid: string;
  gradeLevel: number;         // 6 | 7 | 8 | 9
  avgPercentage: number;      // class average quiz score %
  masteryRate: number;        // % students ≥ 85%
  passRate: number;           // % students ≥ 70%
  totalAttempts: number;
  conceptCount: number;       // distinct concepts tested
  submittedAt: unknown;       // Firestore Timestamp
}

export interface BenchmarkResult {
  percentile: number;         // 0–100, e.g. 73 = "above 73% of classes"
  nationalAvg: number;        // mean avgPercentage across all entries for grade
  sampleSize: number;         // how many classes contributed data
  yourAvg: number;
  gradeLevel: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const nationalBenchmarkService = {

  /**
   * Submit this teacher's aggregated class stats to the benchmark.
   * Overwrites any previous submission (one entry per teacher).
   * ONLY aggregated numbers — zero personal data.
   */
  submitBenchmark: async (entry: Omit<BenchmarkEntry, 'submittedAt'>): Promise<void> => {
    const ref = doc(db, 'national_benchmark', entry.teacherUid);
    await setDoc(ref, { ...entry, submittedAt: serverTimestamp() });
  },

  /**
   * Fetch this teacher's own benchmark entry (if previously submitted).
   */
  getOwnEntry: async (teacherUid: string): Promise<BenchmarkEntry | null> => {
    try {
      const snap = await getDoc(doc(db, 'national_benchmark', teacherUid));
      if (!snap.exists()) return null;
      return snap.data() as BenchmarkEntry;
    } catch {
      return null;
    }
  },

  /**
   * Calculate percentile for a teacher's class among all submissions
   * for the same grade level.
   *
   * Percentile = % of other classes that scored BELOW this class.
   */
  calcPercentile: async (
    teacherUid: string,
    gradeLevel: number,
    yourAvg: number,
  ): Promise<BenchmarkResult | null> => {
    try {
      const col = collection(db, 'national_benchmark');
      const snaps = await getDocs(col);
      const entries: BenchmarkEntry[] = [];
      snaps.forEach(s => {
        const d = s.data() as BenchmarkEntry;
        if (d.gradeLevel === gradeLevel && s.id !== teacherUid) {
          entries.push(d);
        }
      });

      if (entries.length === 0) {
        return {
          percentile: 50,
          nationalAvg: yourAvg,
          sampleSize: 1,
          yourAvg,
          gradeLevel,
        };
      }

      const below = entries.filter(e => e.avgPercentage < yourAvg).length;
      const percentile = Math.round((below / entries.length) * 100);
      const nationalAvg = Math.round(
        entries.reduce((s, e) => s + e.avgPercentage, 0) / entries.length,
      );

      return {
        percentile,
        nationalAvg,
        sampleSize: entries.length + 1, // include own
        yourAvg,
        gradeLevel,
      };
    } catch {
      return null;
    }
  },
};
