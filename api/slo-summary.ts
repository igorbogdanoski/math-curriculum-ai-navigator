/**
 * /api/slo-summary — L1 SLO data aggregation endpoint.
 *
 * Returns CI reliability data (GitHub Actions) + production health (Sentry).
 * Protected: admin-only via Firebase ID token + Firestore role check.
 * Gracefully degrades when vendor tokens are not configured — returns { available: false }.
 *
 * Response is cached briefly for ops freshness.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAllowedOrigins(): string[] {
  const configured = (process.env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  return Array.from(new Set([
    'https://ai.mismath.net',
    'https://math-curriculum-ai-navigator.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
    ...configured,
  ]));
}

function setCors(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin && getAllowedOrigins().includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
    if (!sa) return null;
    try {
      const decoded = sa.trim().startsWith('{') ? sa : Buffer.from(sa, 'base64').toString('utf8');
      initializeApp({ credential: cert(JSON.parse(decoded)) });
    } catch {
      return null;
    }
  }

  return { auth: getAuth(), db: getFirestore() };
}

async function authorizeAdmin(req: VercelRequest): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing Authorization header' };
  }

  const admin = getFirebaseAdmin();
  if (!admin) {
    return { ok: false, status: 500, error: 'Server authentication configuration error' };
  }

  try {
    const decoded = await admin.auth.verifyIdToken(authHeader.slice(7), false);
    const userSnap = await admin.db.collection('users').doc(decoded.uid).get();
    const role = userSnap.data()?.role;
    if (role !== 'admin') {
      return { ok: false, status: 403, error: 'Admin access required' };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 401, error: 'Invalid or expired authentication token' };
  }
}

// ─── GitHub Actions CI data ───────────────────────────────────────────────────

interface CIReliabilityData {
  available: boolean;
  passRate: number | null;
  successCount: number | null;
  totalCount: number | null;
  closeTriggerReached: boolean;
  lastRunAt: string | null;
}

async function fetchCIReliability(): Promise<CIReliabilityData> {
  const token = process.env.GITHUB_TOKEN;
  const repo  = process.env.GITHUB_REPO ?? 'igorbogdanoski/math-curriculum-ai-navigator';

  if (!token) return { available: false, passRate: null, successCount: null, totalCount: null, closeTriggerReached: false, lastRunAt: null };

  const [owner, repoName] = repo.split('/');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' };

  try {
    const runsRes = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/ci-quality.yml/runs?per_page=50&status=completed`,
      { headers }
    );
    if (!runsRes.ok) return { available: false, passRate: null, successCount: null, totalCount: null, closeTriggerReached: false, lastRunAt: null };

    const runsJson = await runsRes.json() as { workflow_runs: { id: number; created_at: string }[] };
    const runs = (runsJson.workflow_runs ?? []).slice(0, 20);

    const QUALITY_GATE_JOB = 'Typecheck + Unit + Build';
    const results: ('success' | 'failure')[] = [];
    let lastRunAt: string | null = runs[0]?.created_at ?? null;

    for (const run of runs) {
      try {
        const jobsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/actions/runs/${run.id}/jobs?per_page=100`,
          { headers }
        );
        if (!jobsRes.ok) continue;
        const jobsJson = await jobsRes.json() as { jobs: { name: string; conclusion: string }[] };
        const qg = (jobsJson.jobs ?? []).find(j => j.name === QUALITY_GATE_JOB);
        if (qg?.conclusion === 'success' || qg?.conclusion === 'failure') {
          results.push(qg.conclusion as 'success' | 'failure');
        }
      } catch { continue; }
    }

    const total = results.length;
    const success = results.filter(r => r === 'success').length;
    const passRate = total > 0 ? (success / total) * 100 : null;
    const closeTriggerReached = total >= 20 && (passRate ?? 0) >= 95;

    return { available: true, passRate, successCount: success, totalCount: total, closeTriggerReached, lastRunAt };
  } catch {
    return { available: false, passRate: null, successCount: null, totalCount: null, closeTriggerReached: false, lastRunAt: null };
  }
}

// ─── Sentry incident summary ───────────────────────────────────────────────────

interface SentryHealthData {
  available: boolean;
  unresolvedIssues: number | null;
  totalEvents: number | null;
  unclassifiedRatio: number | null;
  topErrors: { code: string; count: number }[];
  periodDays: number;
}

async function fetchSentryHealth(): Promise<SentryHealthData> {
  const token   = process.env.SENTRY_AUTH_TOKEN;
  const org     = process.env.SENTRY_ORG     ?? 'math-navigator';
  const project = process.env.SENTRY_PROJECT ?? 'math-curriculum-ai-navigator';
  const period  = process.env.SENTRY_STATS_PERIOD ?? '14d';

  if (!token) return { available: false, unresolvedIssues: null, totalEvents: null, unclassifiedRatio: null, topErrors: [], periodDays: 14 };

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const base = `https://sentry.io/api/0/projects/${org}/${project}`;
  const emptyResult = { available: false, unresolvedIssues: null, totalEvents: null, unclassifiedRatio: null, topErrors: [], periodDays: 14 } as const;

  try {
    // Parallel: all unresolved + unclassified (no app_error_code tag) + tag value breakdown
    // NOTE: The Sentry Issues list API returns tags as {key, totalValues} WITHOUT value — so we
    // must use Sentry's query engine (!has:) for the ratio and the Tags Values API for topErrors.
    const [allRes, unclassRes, tagValRes] = await Promise.all([
      fetch(`${base}/issues/?query=is%3Aunresolved&statsPeriod=${period}&limit=100`, { headers }),
      fetch(`${base}/issues/?query=is%3Aunresolved%20%21has%3Aapp_error_code&statsPeriod=${period}&limit=100`, { headers }),
      fetch(`${base}/tags/app_error_code/values/?statsPeriod=${period}&limit=20`, { headers }),
    ]);

    if (!allRes.ok) return emptyResult;

    const allIssues = await allRes.json() as { count: string }[];
    const unresolvedIssues = allIssues.length;
    const totalEvents = allIssues.reduce((s, i) => s + parseInt(i.count ?? '0', 10), 0);

    // Unclassified: events from issues that have NO app_error_code tag at all
    let unclassifiedCount = 0;
    if (unclassRes.ok) {
      const unclassIssues = await unclassRes.json() as { count: string }[];
      unclassifiedCount = unclassIssues.reduce((s, i) => s + parseInt(i.count ?? '0', 10), 0);
    }

    const unclassifiedRatio = totalEvents > 0 ? unclassifiedCount / totalEvents : null;

    // Top errors from the tag-values endpoint (accurate per-value counts)
    let topErrors: { code: string; count: number }[] = [];
    if (tagValRes.ok) {
      const tagValues = await tagValRes.json() as { value: string; count: number }[];
      topErrors = (Array.isArray(tagValues) ? tagValues : [])
        .filter(v => v.value && v.value !== 'UNKNOWN')
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map(v => ({ code: v.value, count: v.count }));
    }

    const periodDays = parseInt(period.replace('d', ''), 10) || 14;
    return { available: true, unresolvedIssues, totalEvents, unclassifiedRatio, topErrors, periodDays };
  } catch {
    return emptyResult;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authz = await authorizeAdmin(req);
  if (!authz.ok) {
    return res.status(authz.status).json({ error: authz.error });
  }

  const [ci, sentry] = await Promise.all([fetchCIReliability(), fetchSentryHealth()]);

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=30');
  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    ci,
    sentry,
  });
}
