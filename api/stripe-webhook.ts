/**
 * POST /api/stripe-webhook
 * Handles Stripe webhook events.
 * Must be configured in Stripe Dashboard → Webhooks:
 *   Endpoint URL: https://ai.mismath.net/api/stripe-webhook
 *   Events: checkout.session.completed, invoice.paid, customer.subscription.deleted,
 *           invoice.payment_failed
 *
 * The last three only ever fire once subscription-mode checkout (Wave 13.2,
 * api/stripe-checkout.ts's STRIPE_SUBSCRIPTIONS_ENABLED flag) is turned on — they're
 * harmless no-ops under the current one-time-payment model, since Stripe never emits
 * them for a `mode: 'payment'` session.
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
      const upgradedAt = new Date();
      const proExpiresAt = new Date(upgradedAt);
      proExpiresAt.setFullYear(proExpiresAt.getFullYear() + 1);

      await db.collection('users').doc(uid).update({
        isPremium: true,
        tier: 'Pro',
        hasUnlimitedCredits: true,
        stripeCustomerId: session.customer ?? null,
        stripeSessionId: session.id,
        upgradedAt: upgradedAt.toISOString(),
        proExpiresAt: proExpiresAt.toISOString(),
      });

      console.info(`[stripe-webhook] User ${uid} upgraded to Pro. Session: ${session.id}`);
    } catch (err) {
      console.error('[stripe-webhook] Firestore update failed for uid:', uid, err);
      return res.status(500).end();
    }
  }

  // ── 3. Subscription-mode events (Wave 13.2 — inert until subscriptions are enabled) ───────
  // These look up the user by stripeCustomerId (set on the users doc by the
  // checkout.session.completed handler above) rather than by uid, since invoice/subscription
  // events don't carry client_reference_id or the app's uid metadata.
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

    if (customerId) {
      const db = getFirebaseAdmin();
      if (!db) {
        console.error('[stripe-webhook] Firebase Admin not available');
        return res.status(500).end();
      }
      try {
        const snap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (snap.empty) {
          console.error('[stripe-webhook] invoice.paid: no user found for customer', customerId);
        } else {
          const periodEndSec = invoice.lines?.data?.[0]?.period?.end;
          const proExpiresAt = periodEndSec
            ? new Date(periodEndSec * 1000)
            : (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d; })();

          await snap.docs[0].ref.update({
            isPremium: true,
            tier: 'Pro',
            hasUnlimitedCredits: true,
            proExpiresAt: proExpiresAt.toISOString(),
          });
          console.info(`[stripe-webhook] Subscription invoice paid — Pro renewed for customer ${customerId} until ${proExpiresAt.toISOString()}`);
        }
      } catch (err) {
        console.error('[stripe-webhook] Firestore update failed for invoice.paid, customer:', customerId, err);
        return res.status(500).end();
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

    if (customerId) {
      const db = getFirebaseAdmin();
      if (!db) {
        console.error('[stripe-webhook] Firebase Admin not available');
        return res.status(500).end();
      }
      try {
        const snap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
        if (snap.empty) {
          console.error('[stripe-webhook] customer.subscription.deleted: no user found for customer', customerId);
        } else {
          await snap.docs[0].ref.update({
            isPremium: false,
            hasUnlimitedCredits: false,
            tier: 'Free',
            subscriptionCanceledAt: new Date().toISOString(),
          });
          console.info(`[stripe-webhook] Subscription canceled for customer ${customerId} — downgraded to Free`);
        }
      } catch (err) {
        console.error('[stripe-webhook] Firestore update failed for customer.subscription.deleted, customer:', customerId, err);
        return res.status(500).end();
      }
    }
  }

  if (event.type === 'invoice.payment_failed') {
    // Deliberately not revoking access on the first failure — Stripe's own retry/dunning
    // schedule attempts payment multiple times before customer.subscription.deleted
    // eventually fires (which is what actually downgrades the user, above). Logged only,
    // so a spike in failures is visible in Vercel logs without an extra alerting setup.
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
    console.error(`[stripe-webhook] Payment failed for customer ${customerId ?? 'unknown'}, invoice ${invoice.id}`);
  }

  // Always acknowledge receipt to Stripe
  return res.status(200).json({ received: true });
}
