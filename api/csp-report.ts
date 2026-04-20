/**
 * SEC-3 — CSP Violation Report Endpoint
 *
 * Browsers send a POST here when a Content-Security-Policy violation occurs.
 * Reports are stored in Upstash Redis (sorted set, capped at 500 entries) and
 * sent to Sentry as breadcrumbs so violations appear in the Sentry dashboard.
 *
 * The header in vercel.json must include: report-uri /api/csp-report
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from './_lib/sharedUtils.js';

interface CspViolation {
  'document-uri'?: string;
  'violated-directive'?: string;
  'blocked-uri'?: string;
  'original-policy'?: string;
  'source-file'?: string;
  'line-number'?: number;
  'column-number'?: number;
  disposition?: string;
}

interface CspReport {
  'csp-report'?: CspViolation;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as CspReport;
    const violation = body['csp-report'];
    if (!violation) { res.status(400).end(); return; }

    const entry = {
      ts: Date.now(),
      directive: violation['violated-directive'] ?? 'unknown',
      blocked: violation['blocked-uri'] ?? 'unknown',
      document: violation['document-uri'] ?? '',
      source: violation['source-file'] ?? '',
      line: violation['line-number'] ?? 0,
      disposition: violation['disposition'] ?? 'enforce',
    };

    // 1. Upstash Redis — sorted set capped at 500 entries
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
      try {
        const { Redis } = await import('@upstash/redis');
        const redis = new Redis({ url, token });
        const key = 'csp:violations';
        await redis.zadd(key, { score: entry.ts, member: JSON.stringify(entry) });
        // Keep only most recent 500
        await redis.zremrangebyrank(key, 0, -501);
      } catch { /* non-fatal */ }
    }

    // 2. Sentry breadcrumb — shows up in Issues dashboard
    try {
      const sentryPkg = '@sentry/node';
      const Sentry = await import(/* @vite-ignore */ sentryPkg).catch(() => null);
      if (Sentry?.addBreadcrumb) {
        Sentry.addBreadcrumb({
          category: 'security.csp',
          message: `CSP violation: ${entry.directive}`,
          data: entry,
          level: 'warning',
        });
      }
    } catch { /* Sentry not available */ }

    console.warn('[csp-report]', JSON.stringify(entry));
    res.status(204).end();
  } catch {
    res.status(400).end();
  }
}
