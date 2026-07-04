import { logger } from '../utils/logger';
import { getAuthToken } from './gemini/core.proxy';
import type { CasVerifyResult } from '../utils/cas/casEngine';

/**
 * Thin client for /api/cas-verify — mirrors callImagenProxy's fetch+auth-token shape
 * in services/gemini/core.proxy.ts. Never throws: any network/auth/server failure
 * degrades to 'inconclusive' so a CAS outage can never block the caller's fallback
 * path (e.g. Matura grading falling through to Gemini as it already does today).
 */
async function callCasVerify(body: Record<string, unknown>): Promise<CasVerifyResult> {
  try {
    const token = await getAuthToken();
    const response = await fetch('/api/cas-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      logger.warn('[casVerificationClient] non-OK response', response.status);
      return { verdict: 'inconclusive', detail: `http_${response.status}` };
    }
    return await response.json() as CasVerifyResult;
  } catch (err) {
    logger.warn('[casVerificationClient] request failed', err);
    return { verdict: 'inconclusive', detail: 'network_error' };
  }
}

export function verifyExpressionEquivalenceRemote(latexA: string, latexB: string): Promise<CasVerifyResult> {
  return callCasVerify({ mode: 'equivalence', latexA, latexB });
}

export function verifyEquationSolutionRemote(
  equation: string,
  variable: string,
  claimedValue: string,
): Promise<CasVerifyResult> {
  return callCasVerify({ mode: 'equation', equation, variable, claimedValue });
}
