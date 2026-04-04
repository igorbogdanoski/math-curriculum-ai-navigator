/**
 * GDPR / ЗЗЛП Service — Н1
 * Право на бришење и право на преносливост на податоци.
 */

import {
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
  writeBatch,
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';

const BATCH_SIZE = 400; // Well under Firestore's 500-op limit

async function commitBatchedDeletes(
  docs: Array<{ ref: ReturnType<typeof doc> }>
): Promise<void> {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function deleteCollectionByField(
  collectionName: string,
  field: string,
  uid: string
): Promise<number> {
  const snap = await getDocs(
    query(collection(db, collectionName), where(field, '==', uid))
  );
  await commitBatchedDeletes(snap.docs);
  return snap.size;
}

async function collectByField(
  collectionName: string,
  field: string,
  uid: string
): Promise<Array<Record<string, unknown>>> {
  const snap = await getDocs(
    query(collection(db, collectionName), where(field, '==', uid))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function collectByFieldSafe(
  collectionName: string,
  field: string,
  uid: string,
  warnings: string[]
): Promise<Array<Record<string, unknown>>> {
  try {
    return await collectByField(collectionName, field, uid);
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : 'unknown_error';
    warnings.push(`${collectionName}: ${msg}`);
    return [];
  }
}

/**
 * Брише СИТЕ кориснички податоци од Firestore + Storage.
 * Не го брише Firebase Auth акаунтот — тоа е одговорност на повикувачот.
 */
export async function deleteAllUserData(uid: string): Promise<void> {
  const teacherCollections = [
    'quiz_results',
    'concept_mastery',
    'student_gamification',
    'cached_ai_materials',
    'classes',
    'class_memberships',
    'assignments',
    'material_feedback',
    'saved_questions',
    'announcement',
    'chat_sessions',
    'spaced_rep',
  ];

  await Promise.allSettled([
    // Collections with teacherUid field
    ...teacherCollections.map((c) => deleteCollectionByField(c, 'teacherUid', uid)),

    // Collections with different owner fields
    deleteCollectionByField('live_sessions', 'hostUid', uid),
    deleteCollectionByField('live_quizzes', 'hostUid', uid),
    deleteCollectionByField('national_library', 'publishedByUid', uid),
    deleteCollectionByField('academic_annual_plans', 'userId', uid),
    deleteCollectionByField('user_tokens', 'uid', uid),

    // User profile document
    deleteDoc(doc(db, 'users', uid)),

    // Profile picture in Firebase Storage (no-op if missing)
    deleteObject(ref(storage, `profilePictures/${uid}`)).catch(() => undefined),
  ]);
}

/**
 * Собира сите лични податоци на корисникот за GDPR Data Export.
 * Враќа JSON-серијализабилен објект.
 */
export async function exportUserData(
  uid: string
): Promise<Record<string, unknown>> {
  const warnings: string[] = [];

  const [
    profileSnap,
    quizResults,
    conceptMastery,
    materials,
    materialFeedback,
    aiMaterialFeedbackEvents,
    worksheetApprovals,
    classes,
    assignments,
    chatSessions,
    annualPlans,
    savedQuestions,
    liveSessions,
    nationalLibrary,
  ] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    collectByFieldSafe('quiz_results', 'teacherUid', uid, warnings),
    collectByFieldSafe('concept_mastery', 'teacherUid', uid, warnings),
    collectByFieldSafe('cached_ai_materials', 'teacherUid', uid, warnings),
    collectByFieldSafe('material_feedback', 'teacherUid', uid, warnings),
    collectByFieldSafe('ai_material_feedback_events', 'teacherUid', uid, warnings),
    collectByFieldSafe('worksheet_approvals', 'teacherUid', uid, warnings),
    collectByFieldSafe('classes', 'teacherUid', uid, warnings),
    collectByFieldSafe('assignments', 'teacherUid', uid, warnings),
    collectByFieldSafe('chat_sessions', 'teacherUid', uid, warnings),
    collectByFieldSafe('academic_annual_plans', 'userId', uid, warnings),
    collectByFieldSafe('saved_questions', 'teacherUid', uid, warnings),
    collectByFieldSafe('live_sessions', 'hostUid', uid, warnings),
    collectByFieldSafe('national_library', 'publishedByUid', uid, warnings),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    uid,
    profile: profileSnap.exists() ? profileSnap.data() : null,
    quizResults,
    conceptMastery,
    materials,
    materialFeedback,
    aiMaterialFeedbackEvents,
    worksheetApprovals,
    classes,
    assignments,
    chatSessions,
    annualPlans,
    savedQuestions,
    liveSessions,
    nationalLibrary,
    ...(warnings.length > 0 ? { exportWarnings: warnings } : {}),
  };
}

/**
 * Прима Export резултат и го преземa како JSON фајл во прелистувачот.
 */
export function downloadUserDataAsJson(
  data: Record<string, unknown>,
  uid: string
): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-navigator-data-${uid.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
