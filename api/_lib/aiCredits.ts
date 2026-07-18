/**
 * api/_lib/aiCredits.ts — server-side AI credit deduction.
 *
 * Previously, credit deduction only ever happened if the CLIENT called the
 * `deductCredits` Firebase Callable (functions/src/index.ts) after a
 * successful generation — wired up from only 3 of ~35 AI-generation call
 * sites, so most AI usage never actually spent a credit. This moves
 * deduction into the same request that already generated the content,
 * mirroring functions/src/index.ts's transaction (read balance, bypass
 * check, floor at 0) so it can't be skipped by the client forgetting to ask.
 */
import { AI_COSTS, MODEL_MIN_COST } from '../../services/gemini/core.constants.js';
import { getFirebaseAdmin, evaluateCreditGate } from './sharedUtils.js';

/**
 * Deducts the cost of `costKey` from `uid`'s aiCreditsBalance. Unknown keys
 * fall back to TEXT_BASIC rather than rejecting — by the time this runs the
 * Gemini call already succeeded, so an unrecognized/missing key should never
 * block bookkeeping. Never throws: a transaction failure is logged and
 * swallowed, since failing the HTTP response over a bookkeeping error would
 * be strictly worse than a missed deduction (the user already paid the
 * upstream Gemini cost and is about to receive their result).
 *
 * `model` (the model actually used for this generation, not just requested) is optional but
 * strongly recommended: it enforces MODEL_MIN_COST as a floor so a caller bypassing the normal
 * UI can't pair an expensive model with an under-declared costKey to pay far less than the
 * real cost. Omitting it (e.g. embed/imagen routes with no meaningful model-tier choice) simply
 * skips the floor, matching today's behavior.
 */
export async function deductCreditsServerSide(uid: string, costKey: string | undefined, model?: string): Promise<void> {
  if (!getFirebaseAdmin()) return; // local dev without a service account — no-op

  const declaredAmount = (costKey && AI_COSTS[costKey as keyof typeof AI_COSTS]) ?? AI_COSTS.TEXT_BASIC;
  const floor = model ? (MODEL_MIN_COST[model] ?? 0) : 0;
  const amount = Math.max(declaredAmount, floor);

  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) return;

      const data = userDoc.data() ?? {};
      const { bypassed, balance } = evaluateCreditGate(data);
      if (bypassed) return;

      const newBalance = Math.max(0, balance - amount);
      transaction.update(userRef, { aiCreditsBalance: newBalance });
    });
  } catch (err) {
    console.error('[credits] server-side deduction failed:', err);
  }
}

export interface ReserveResult {
  /** True if the caller may proceed with the paid generation. */
  ok: boolean;
  /** Amount actually reserved (0 if bypassed/unbilled/not ok) — pass this to refundCredits() on failure. */
  amount: number;
}

/**
 * Atomically checks balance AND deducts in the same Firestore transaction — closes a race
 * where concurrent requests at low balance could each independently pass a separate
 * check-then-later-deduct pair (the old requireSufficientCredits + deductCreditsServerSide
 * shape) and all get billed generations for the price of one. Called once modelName/costKey
 * are known, right before the (slow) Gemini call — NOT at the top of the handler, since the
 * model floor (MODEL_MIN_COST) isn't resolved that early in most routes.
 *
 * requireSufficientCredits() is still called earlier in each handler and is unchanged — it
 * remains a cheap fast-path rejection (auth/service-account/profile-exists, plus an
 * optimistic pre-check) so a certainly-out-of-credit caller doesn't pay for normalizing
 * request content first. This function is the actual atomic enforcement point.
 */
export async function reserveCredits(uid: string, costKey: string | undefined, model?: string): Promise<ReserveResult> {
  if (!getFirebaseAdmin()) return { ok: true, amount: 0 }; // local dev without a service account — no-op

  const declaredAmount = (costKey && AI_COSTS[costKey as keyof typeof AI_COSTS]) ?? AI_COSTS.TEXT_BASIC;
  const floor = model ? (MODEL_MIN_COST[model] ?? 0) : 0;
  const amount = Math.max(declaredAmount, floor);

  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    return await db.runTransaction(async (transaction): Promise<ReserveResult> => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) return { ok: false, amount: 0 };

      const data = userDoc.data() ?? {};
      const { bypassed, balance } = evaluateCreditGate(data);
      if (bypassed) return { ok: true, amount: 0 };
      if (balance <= 0) return { ok: false, amount: 0 };

      const newBalance = Math.max(0, balance - amount);
      transaction.update(userRef, { aiCreditsBalance: newBalance });
      return { ok: true, amount };
    });
  } catch (err) {
    console.error('[credits] reservation failed:', err);
    return { ok: false, amount: 0 };
  }
}

/**
 * Refunds a previously-reserved amount (generation failed, or the response turned out
 * unusable) — a plain additive transaction, no upper bound needed since it only ever
 * restores what reserveCredits() just took. No-op for amount <= 0 (covers the
 * bypassed/local-dev case where reserveCredits() reserved nothing).
 */
export async function refundCredits(uid: string, amount: number): Promise<void> {
  if (!getFirebaseAdmin() || amount <= 0) return;

  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    await db.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) return;
      const data = userDoc.data() ?? {};
      const balance = typeof data.aiCreditsBalance === 'number' ? data.aiCreditsBalance : 0;
      transaction.update(userRef, { aiCreditsBalance: balance + amount });
    });
  } catch (err) {
    console.error('[credits] refund failed:', err);
  }
}
