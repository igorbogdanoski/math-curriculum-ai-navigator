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

function setCors(res: VercelResponse): void {
  const origin = process.env.ALLOWED_ORIGIN || 'https://math-curriculum-ai-navigator.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
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

  // ── Validate body ─────────────────────────────────────────────────────────
  const { schoolName, city, municipality = '', address = '' } = req.body ?? {};
  if (!schoolName?.trim() || !city?.trim()) {
    return res.status(400).json({ error: 'schoolName и city се задолжителни.' });
  }

  // ── Create school + update user (atomic) ──────────────────────────────────
  const db = admin.db;
  const joinCode = generateJoinCode();

  try {
    // 1. Create school document
    const schoolRef = await db.collection('schools').add({
      name: schoolName.trim(),
      city: city.trim(),
      municipality: municipality.trim(),
      address: address.trim(),
      adminUid: uid,
      adminUids: [uid],
      teacherUids: [uid], // Director is also a teacher-member
      joinCode,
      joinCodeGeneratedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2. Update user profile: promote to school_admin + link to school
    await db.collection('users').doc(uid).set(
      {
        role: 'school_admin',
        schoolId: schoolRef.id,
        schoolName: schoolName.trim(),
      },
      { merge: true }
    );

    console.info(`[create-school] School "${schoolName}" created. ID: ${schoolRef.id}, UID: ${uid}`);

    return res.status(200).json({
      schoolId: schoolRef.id,
      joinCode,
      schoolName: schoolName.trim(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[create-school] Error:', msg);
    return res.status(500).json({ error: 'Грешка при создавање на училиштето. Обидете се повторно.' });
  }
}
