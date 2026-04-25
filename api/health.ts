/**
 * /api/health — S41-D5 lightweight uptime probe.
 *
 * Public endpoint suitable for status-page monitors (UptimeRobot,
 * BetterStack, etc.) and Vercel health checks.
 *
 * GET → 200 { status: 'ok', service, version, timestamp, uptimeMs, region }
 * HEAD → 200 (no body) for the cheapest probe path.
 *
 * No auth, no DB calls, no PII. Designed to respond < 50 ms cold and
 * < 10 ms warm. If the function itself responds, the platform layer is
 * healthy enough to serve traffic.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

const STARTED_AT = Date.now();
const SERVICE = 'math-curriculum-ai-navigator';

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ status: 'error', error: 'Method not allowed' });
    return;
  }

  res.status(200).json({
    status: 'ok',
    service: SERVICE,
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? 'local',
    region: process.env.VERCEL_REGION ?? 'unknown',
    environment: process.env.VERCEL_ENV ?? 'development',
    timestamp: new Date().toISOString(),
    uptimeMs: Date.now() - STARTED_AT,
  });
}
