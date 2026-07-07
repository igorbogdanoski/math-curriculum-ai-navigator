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
