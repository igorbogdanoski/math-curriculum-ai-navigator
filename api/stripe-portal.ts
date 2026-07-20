/**
 * POST /api/stripe-portal
 * Creates a Stripe Billing Portal session for the authenticated user.
 * Works for the current one-time-payment model too — Stripe's Portal shows
 * payment history / invoices for any customer, subscription or not — so this
 * is useful right now (2026-07-20, Wave 13.1), not just once subscriptions
 * are enabled (Wave 13.2). Requires Firebase Auth Bearer token.
 * Returns { url } — client redirects to the Stripe-hosted portal.
 *
 * Required env vars (Vercel dashboard):
 *   STRIPE_SECRET_KEY        — sk_live_... or sk_test_...
 *   ALLOWED_ORIGIN           — https://ai.mismath.net
 *   FIREBASE_SERVICE_ACCOUNT — base64-encoded service account JSON
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── 1. Verify Firebase token ──────────────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return res.status(500).json({ error: 'Server auth configuration error' });
  }

  let uid: string;
  try {
    const decoded = await admin.auth.verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // ── 2. Validate env vars ──────────────────────────────────────────────────
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const origin = process.env.ALLOWED_ORIGIN || 'https://math-curriculum-ai-navigator.vercel.app';

  if (!secretKey) {
    console.error('[stripe-portal] Missing STRIPE_SECRET_KEY');
    return res.status(503).json({ error: 'Payment service not configured' });
  }

  // ── 3. Look up the caller's Stripe customer id ────────────────────────────
  let customerId: string | undefined;
  try {
    const userDoc = await admin.db.collection('users').doc(uid).get();
    customerId = userDoc.data()?.stripeCustomerId;
  } catch (err) {
    console.error('[stripe-portal] Firestore lookup failed for uid:', uid, err);
    return res.status(500).json({ error: 'Failed to look up billing account' });
  }

  if (!customerId) {
    return res.status(404).json({ error: 'No billing history found for this account.' });
  }

  // ── 4. Create Stripe Billing Portal session ───────────────────────────────
  const stripe = new Stripe(secretKey);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/#/settings`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[stripe-portal] Stripe error:', msg);
    return res.status(500).json({ error: 'Failed to create billing portal session' });
  }
}
