/**
 * POST /api/stripe-checkout
 * Creates a Stripe Checkout Session for the Pro plan.
 * Requires Firebase Auth Bearer token.
 * Returns { url } — client redirects to Stripe Hosted Checkout.
 *
 * Required env vars (Vercel dashboard):
 *   STRIPE_SECRET_KEY        — sk_live_... or sk_test_...
 *   STRIPE_PRO_PRICE_ID      — price_...  (Pro plan annual price)
 *   ALLOWED_ORIGIN           — https://math-curriculum-ai-navigator.vercel.app
 *   FIREBASE_SERVICE_ACCOUNT — base64-encoded service account JSON
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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
  return getAuth();
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

  const auth = getFirebaseAdmin();
  if (!auth) {
    return res.status(500).json({ error: 'Server auth configuration error' });
  }

  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await auth.verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
    email = decoded.email;
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // ── 2. Validate env vars ──────────────────────────────────────────────────
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  const origin = process.env.ALLOWED_ORIGIN || 'https://math-curriculum-ai-navigator.vercel.app';

  if (!secretKey || !priceId) {
    console.error('[stripe-checkout] Missing STRIPE_SECRET_KEY or STRIPE_PRO_PRICE_ID');
    return res.status(503).json({ error: 'Payment service not configured' });
  }

  // ── 3. Create Stripe Checkout Session ─────────────────────────────────────
  const stripe = new Stripe(secretKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',               // One-time annual payment (change to 'subscription' for recurring)
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: uid,      // Used in webhook to identify user
      customer_email: email,
      metadata: { uid, plan: 'pro' },
      success_url: `${origin}/#/settings?payment=success`,
      cancel_url: `${origin}/#/pricing?payment=cancelled`,
      locale: 'auto',
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[stripe-checkout] Stripe error:', msg);
    return res.status(500).json({ error: 'Failed to create payment session' });
  }
}
