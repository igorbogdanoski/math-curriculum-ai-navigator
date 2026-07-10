/**
 * POST /api/create-school
 * Creates a new school and promotes the calling user to school_admin.
 * Used by the School Onboarding Wizard (/school/register).
 *
 * Works even with unverified email (new director just registered).
 * Required env vars: FIREBASE_SERVICE_ACCOUNT
 *
 * Body: { schoolName: string, city: string, municipality?: string, address?: string }
 * Returns: { schoolId, joinCode, schoolName }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Reimplements auth/CORS locally instead of importing api/_lib/sharedUtils.ts — deliberate,
// not an oversight: this route's body shape (schoolName/city/...) doesn't match
// GeminiRequestSchema, and this endpoint has no per-user credit/rate concept (it's a one-shot
// onboarding action, not a metered AI call). Audited 2026-07 alongside the other AI routes'
// shared-helper consolidation; kept separate on purpose.
function setCors(res: VercelResponse): void {
  const origin = process.env.ALLOWED_ORIGIN || 'https://math-curriculum-ai-navigator.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    // Support both naming conventions (FIREBASE_SERVICE_ACCOUNT new, GOOGLE_APPLICATION_CREDENTIALS_BASE64 legacy)
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
    if (!sa) return null;
    try {
      const decoded = sa.trim().startsWith('{') ? sa : Buffer.from(sa, 'base64').toString('utf8');
      initializeApp({ credential: cert(JSON.parse(decoded)) });
    } catch {
      return null;
    }
  }
  return { auth: getAuth(), db: getFirestore() };
}

function generateJoinCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .substring(0, 6)
    .toUpperCase();
}

// Same in-memory sliding-window pattern used by webpage-extract.ts / vimeo-captions.ts /
// youtube-captions.ts — prevents mass school creation (write-cost + data pollution).
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const requestBuckets = new Map<string, number[]>();

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const bucket = (requestBuckets.get(identifier) ?? []).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (bucket.length >= MAX_REQUESTS_PER_WINDOW) {
    requestBuckets.set(identifier, bucket);
    return true;
  }
  bucket.push(now);
  requestBuckets.set(identifier, bucket);
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const admin = getFirebaseAdmin();
  if (!admin) return res.status(500).json({ error: 'Server configuration error' });

  let uid: string;
  try {
    // checkRevoked=false: allow newly-created users with unverified email
    const decoded = await admin.auth.verifyIdToken(authHeader.slice(7), false);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (isRateLimited(uid)) {
    return res.status(429).json({ error: 'Премногу обиди. Обидете се повторно за една минута.' });
  }

  // ── Authorization: only a brand-new account (no existing role/school) may
  // self-provision a school + school_admin role. Without this, ANY authenticated
  // user — including an existing student/teacher at a real school — could call
  // this endpoint to grant themselves school_admin, which has platform-wide
  // write access to shared curriculum collections (matura_exams/questions).
  const existingUserSnap = await admin.db.collection('users').doc(uid).get();
  const existingUserData = existingUserSnap.data();
  if (existingUserData?.role && existingUserData.role !== 'teacher') {
    return res.status(403).json({ error: 'Веќе имате улога во системот — контактирајте поддршка за промена на училиште.' });
  }
  if (existingUserData?.schoolId) {
    return res.status(403).json({ error: 'Веќе сте поврзани со училиште.' });
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  const { schoolName, city, municipality = '', address = '' } = req.body ?? {};
  if (!schoolName?.trim() || !city?.trim()) {
    return res.status(400).json({ error: 'schoolName и city се задолжителни.' });
  }

  // ── Create school + update user (atomic) ──────────────────────────────────
  const db = admin.db;
  const joinCode = generateJoinCode();
  const normalizedSchoolName = schoolName.trim();
  const normalizedCity = city.trim();
  const normalizedMunicipality = municipality.trim();
  const normalizedAddress = address.trim();

  try {
    const schoolRef = db.collection('schools').doc();
    const userRef = db.collection('users').doc(uid);
    const batch = db.batch();

    batch.set(schoolRef, {
      name: normalizedSchoolName,
      city: normalizedCity,
      municipality: normalizedMunicipality,
      address: normalizedAddress,
      adminUid: uid,
      adminUids: [uid],
      teacherUids: [uid], // Director is also a teacher-member
      joinCode,
      joinCodeGeneratedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });

    batch.set(userRef, {
      role: 'school_admin',
      schoolId: schoolRef.id,
      schoolName: normalizedSchoolName,
    }, { merge: true });

    await batch.commit();

    console.info(`[create-school] School "${normalizedSchoolName}" created. ID: ${schoolRef.id}, UID: ${uid}`);

    return res.status(200).json({
      schoolId: schoolRef.id,
      joinCode,
      schoolName: normalizedSchoolName,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[create-school] Error:', msg);
    return res.status(500).json({ error: 'Грешка при создавање на училиштето. Обидете се повторно.' });
  }
}
