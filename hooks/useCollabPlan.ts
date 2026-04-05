/**
 * Ж7.1 — Real-time collaborative annual plan editing.
 *
 * Uses Firestore onSnapshot to push remote changes to local state,
 * and a `viewers` subcollection for lightweight presence tracking.
 * This handles the teacher collaboration pattern (turn-based, not concurrent
 * cursor-level) without requiring Yjs or additional dependencies.
 */
import { useEffect, useRef, useState } from 'react';
import {
  doc, onSnapshot, setDoc, deleteDoc,
  collection, getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { AIGeneratedAnnualPlan } from '../types';

export interface PlanViewer {
  uid: string;
  displayName: string;
  seenAt: number; // epoch ms
}

interface CollabPlan {
  /** Remote plan data — apply to local state when it differs from local edits */
  remotePlan: AIGeneratedAnnualPlan | null;
  /** Users currently viewing/editing the plan (excluding self) */
  viewers: PlanViewer[];
  /** Whether another user saved the plan since we opened it */
  remoteUpdatedBy: string | null;
}

const VIEWERS_TTL_MS = 60_000; // prune viewers inactive > 60 s
const PRESENCE_INTERVAL_MS = 30_000; // heartbeat every 30 s

export function useCollabPlan(
  planId: string | undefined,
  selfUid: string | undefined,
  selfName: string | undefined,
): CollabPlan {
  const [remotePlan, setRemotePlan] = useState<AIGeneratedAnnualPlan | null>(null);
  const [viewers, setViewers] = useState<PlanViewer[]>([]);
  const [remoteUpdatedBy, setRemoteUpdatedBy] = useState<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!planId || !selfUid) return;

    const planRef = doc(db, 'academic_annual_plans', planId);
    const viewersCol = collection(db, 'academic_annual_plans', planId, 'viewers');
    const selfViewerRef = doc(viewersCol, selfUid);

    // Write own presence
    const writePresence = () =>
      setDoc(selfViewerRef, {
        displayName: selfName || 'Наставник',
        seenAt: serverTimestamp(),
      }).catch(() => {});

    writePresence();
    heartbeatRef.current = setInterval(writePresence, PRESENCE_INTERVAL_MS);

    // Watch plan doc for remote saves
    const unsubPlan = onSnapshot(planRef, snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      const updatedBy: string | undefined = data?.updatedBy;
      if (updatedBy && updatedBy !== selfUid) {
        setRemotePlan(data?.plan ?? null);
        setRemoteUpdatedBy(data?.updatedByName ?? updatedBy);
      }
    }, () => {});

    // Poll viewers subcollection every 15 s (cheap; small doc count)
    const refreshViewers = async () => {
      try {
        const now = Date.now();
        const snaps = await getDocs(viewersCol);
        const active: PlanViewer[] = [];
        snaps.forEach(d => {
          if (d.id === selfUid) return;
          const seenAt = (d.data().seenAt as Timestamp | null)?.toMillis() ?? 0;
          if (now - seenAt < VIEWERS_TTL_MS) {
            active.push({ uid: d.id, displayName: d.data().displayName, seenAt });
          }
        });
        setViewers(active);
      } catch { /* non-fatal */ }
    };

    refreshViewers();
    const viewerPoll = setInterval(refreshViewers, 15_000);

    // Also clean up on page hide (best-effort via sendBeacon).
    // pagehide is more lifecycle-friendly than beforeunload in modern browsers.
    const handleUnload = () => {
      // sendBeacon keeps the request alive after page unload
      // Firestore REST delete endpoint
      const projectId = selfViewerRef.firestore.app.options.projectId;
      if (projectId) {
        const path = `projects/${projectId}/databases/(default)/documents/academic_annual_plans/${planId}/viewers/${selfUid}`;
        navigator.sendBeacon?.(
          `https://firestore.googleapis.com/v1/${path}?delete=true`,
        );
      }
    };
    window.addEventListener('pagehide', handleUnload);

    return () => {
      unsubPlan();
      clearInterval(heartbeatRef.current!);
      clearInterval(viewerPoll);
      window.removeEventListener('pagehide', handleUnload);
      // Remove own presence on unmount
      deleteDoc(selfViewerRef).catch(() => {});
    };
  }, [planId, selfUid, selfName]);

  return { remotePlan, viewers, remoteUpdatedBy };
}
