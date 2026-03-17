/**
 * POST /api/stripe-webhook
 * Handles Stripe webhook events.
 * Must be configured in Stripe Dashboard → Webhooks:
 *   Endpoint URL: https://math-curriculum-ai-navigator.vercel.app/api/stripe-webhook
 *   Events: checkout.session.completed
 *
 * Required env vars (Vercel dashboard):
 *   STRIPE_SECRET_KEY        — sk_live_... or sk_test_...
 *   STRIPE_WEBHOOK_SECRET    — whsec_...  (from Stripe Webhook dashboard)
 *   FIREBASE_SERVICE_ACCOUNT — base64-encoded service account JSON
 *
 * IMPORTANT: This endpoint must receive the raw request body (bodyParser disabled via exported config below).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Disable Vercel's body parser — Stripe needs raw body for signature verification
export const config = { api: { bodyParser: false } };

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
  return getFirestore();
}

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error('[stripe-webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return res.status(503).end();
  }

  const stripe = new Stripe(secretKey);

  // ── 1. Verify Stripe signature ────────────────────────────────────────────
  const rawBody = await getRawBody(req);
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[stripe-webhook] Signature verification failed:', msg);
    return res.status(400).json({ error: `Webhook signature error: ${msg}` });
  }

  // ── 2. Handle events ──────────────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const uid = session.client_reference_id || session.metadata?.uid;

    if (!uid) {
      console.error('[stripe-webhook] checkout.session.completed missing uid. Session:', session.id);
      return res.status(200).json({ received: true }); // Acknowledge to avoid retries
    }

    const db = getFirebaseAdmin();
    if (!db) {
      console.error('[stripe-webhook] Firebase Admin not available');
      return res.status(500).end();
    }

    try {
      await db.collection('users').doc(uid).update({
        isPremium: true,
        tier: 'Pro',
        hasUnlimitedCredits: true,
        stripeCustomerId: session.customer ?? null,
        stripeSessionId: session.id,
        upgradedAt: new Date().toISOString(),
      });

      console.info(`[stripe-webhook] User ${uid} upgraded to Pro. Session: ${session.id}`);
    } catch (err) {
      console.error('[stripe-webhook] Firestore update failed for uid:', uid, err);
      return res.status(500).end();
    }
  }

  // Always acknowledge receipt to Stripe
  return res.status(200).json({ received: true });
}
