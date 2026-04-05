/**
 * /api/vertex-shadow — Vertex AI shadow proxy stub.
 *
 * Returns 501 Not Implemented during the controlled-spike phase (E4).
 * The client (vertexShadow.ts) treats 404/501 as `not_configured` — the entry
 * is recorded in the rolling shadow log without incrementing the error count.
 *
 * When Vertex AI is promoted to production, replace this with a real proxy that:
 *   1. Verifies the Bearer token (Firebase Admin)
 *   2. Forwards the request to Vertex AI Gemini endpoint
 *   3. Returns the raw Vertex AI JSON response
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse): void {
  res.status(501).json({
    error: 'Vertex AI proxy not yet deployed. Shadow mode records this as not_configured.',
    phase: 'E4-spike',
  });
}
