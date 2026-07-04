/**
 * /api/cas-verify — server-side math-answer verification (Compute Engine backed).
 *
 * Used as a pre-Gemini gate for Matura Part 2 grading: when a claimed answer is
 * confirmed 'equivalent' to the stored correct answer, grading can skip the Gemini
 * call entirely — a real cost/latency saving visible in the existing SLO/cost
 * dashboards. Any other verdict falls through to the unchanged AI-grading path.
 *
 * No credit check — verification is deterministic and costs nothing to run.
 * Follows the same setCorsHeaders → auth → rate-limit → work → recordLatency shape
 * as /api/gemini.ts, but with its own lightweight body schema instead of the
 * Gemini-specific one.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders, getFirebaseAdmin } from './_lib/sharedUtils.js';
import { checkSlidingWindow, extractClientIp } from './_lib/rateLimitInMemory.js';
import { recordLatency } from './_lib/sloTracker.js';
import { verifyExpressionEquivalence, verifyEquationSolution, type CasVerifyResult } from '../utils/cas/casEngine.js';

const rlMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const handlerStart = Date.now();
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    recordLatency('cas-verify', Date.now() - handlerStart);
    return;
  }

  const firstIp = extractClientIp(req.headers, req.socket?.remoteAddress);
  let rlIdentifier = firstIp ?? 'anonymous';

  const auth = getFirebaseAdmin();
  if (auth) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header' });
      recordLatency('cas-verify', Date.now() - handlerStart);
      return;
    }
    try {
      const decoded = await auth.verifyIdToken(authHeader.slice(7));
      rlIdentifier = decoded.uid;
    } catch (err) {
      console.error('[cas-verify] Token verification failed:', err);
      res.status(401).json({ error: 'Invalid or expired authentication token' });
      recordLatency('cas-verify', Date.now() - handlerStart);
      return;
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.error('[cas-verify] CRITICAL: FIREBASE_SERVICE_ACCOUNT missing in production!');
    res.status(500).json({ error: 'Server authentication configuration error' });
    recordLatency('cas-verify', Date.now() - handlerStart);
    return;
  }

  if (!checkSlidingWindow(rlMap, rlIdentifier, { windowMs: RATE_LIMIT_WINDOW_MS, maxRequests: MAX_REQUESTS_PER_WINDOW })) {
    res.status(429).json({ error: 'Rate limit exceeded. Please wait a minute before requesting again.', quotaType: 'rate' });
    recordLatency('cas-verify', Date.now() - handlerStart);
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const mode = body.mode;

  try {
    let result: CasVerifyResult;
    if (mode === 'equivalence') {
      const { latexA, latexB } = body;
      if (typeof latexA !== 'string' || typeof latexB !== 'string') {
        res.status(400).json({ error: 'latexA and latexB are required strings for mode=equivalence.' });
        return;
      }
      result = verifyExpressionEquivalence(latexA, latexB);
    } else if (mode === 'equation') {
      const { equation, variable, claimedValue } = body;
      if (typeof equation !== 'string' || typeof variable !== 'string' || typeof claimedValue !== 'string') {
        res.status(400).json({ error: 'equation, variable, and claimedValue are required strings for mode=equation.' });
        return;
      }
      result = verifyEquationSolution(equation, variable, claimedValue);
    } else {
      res.status(400).json({ error: `Unknown mode: ${String(mode)}` });
      return;
    }
    res.status(200).json(result);
  } catch (err) {
    console.error('[cas-verify] Unexpected error:', err);
    res.status(500).json({ error: 'Verification failed.' });
  } finally {
    recordLatency('cas-verify', Date.now() - handlerStart);
  }
}
