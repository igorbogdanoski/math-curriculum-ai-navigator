/**
 * /api/web-vitals — П23 Real telemetry beacon endpoint.
 *
 * POST  → ingest a single (or batched) Web Vitals sample sent by the browser
 *         via `navigator.sendBeacon()` from `services/sentryService.reportWebVitals()`.
 *         Body shape: { name: 'LCP'|'CLS'|'INP'|'FCP'|'TTFB', value: number }
 *                  or { samples: Array<{ name, value }> }
 *
 * GET   → returns the in-memory aggregated snapshot (p50/p75/p95) per metric.
 *         Public read — values are aggregates, not user-identifying. The
 *         endpoint is mostly meant for ops dashboards / health probes.
 *
 * NOTE: Cold starts reset the buffer; this is a "warm container" signal.
 *       Sentry remains the durable store via `Sentry.captureEvent` in
 *       `services/sentryService.ts::reportWebVitals()`.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  recordWebVital,
  getWebVitalsSnapshot,
  isSupportedMetric,
  type WebVitalName,
} from './_lib/webVitalsBuffer.js';

function setCors(res: VercelResponse): void {
  // Beacon endpoint must accept any origin so it works during dev / preview.
  // Payload is a small fire-and-forget aggregate (no auth, no PII), matching
  // the standard Web Vitals collection pattern.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

interface SamplePayload {
  name: unknown;
  value: unknown;
}

function ingest(payload: SamplePayload): boolean {
  if (!isSupportedMetric(payload.name)) return false;
  const value = typeof payload.value === 'number' ? payload.value : Number(payload.value);
  return recordWebVital(payload.name as WebVitalName, value);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ samples: getWebVitalsSnapshot() });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Body may arrive as parsed JSON (Vercel default) or, for sendBeacon with
  // text/plain, as a raw string.
  let body: unknown = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' });
      return;
    }
  }

  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Empty body' });
    return;
  }

  let accepted = 0;
  let rejected = 0;
  const obj = body as { samples?: unknown; name?: unknown; value?: unknown };
  if (Array.isArray(obj.samples)) {
    for (const s of obj.samples) {
      if (s && typeof s === 'object' && ingest(s as SamplePayload)) accepted++;
      else rejected++;
    }
  } else if ('name' in obj && 'value' in obj) {
    if (ingest(obj as SamplePayload)) accepted++;
    else rejected++;
  } else {
    res.status(400).json({ error: 'Body must include { name, value } or { samples: [...] }' });
    return;
  }

  res.status(202).json({ accepted, rejected });
}
