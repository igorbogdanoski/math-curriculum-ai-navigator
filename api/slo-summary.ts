/**
 * /api/slo-summary — L1 SLO data aggregation endpoint.
 *
 * Returns CI reliability data (GitHub Actions) + production health (Sentry).
 * Gracefully degrades when tokens are not configured — returns { available: false }.
 *
 * Response is cached for 1 hour via Cache-Control.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

  try {
    const issuesRes = await fetch(
      `${base}/issues/?query=is:unresolved&statsPeriod=${period}&limit=100`,
      { headers }
    );
    if (!issuesRes.ok) return { available: false, unresolvedIssues: null, totalEvents: null, unclassifiedRatio: null, topErrors: [], periodDays: 14 };

    const issues = await issuesRes.json() as { title: string; count: string; tags?: { key: string; value: string }[] }[];

    const unresolvedIssues = issues.length;
    const totalEvents = issues.reduce((s, i) => s + parseInt(i.count ?? '0', 10), 0);

    // Count UNCLASSIFIED (no app_error_code tag or tag = 'UNKNOWN')
    let classifiedCount = 0;
    let unclassifiedCount = 0;
    for (const issue of issues) {
      const count = parseInt(issue.count ?? '0', 10);
      const hasCode = Array.isArray(issue.tags) && issue.tags.some(
        t => t.key === 'app_error_code' && t.value && t.value !== 'UNKNOWN'
      );
      if (hasCode) classifiedCount += count;
      else unclassifiedCount += count;
    }
    const unclassifiedRatio = totalEvents > 0 ? unclassifiedCount / totalEvents : null;

    // Top errors by count
    const errorMap = new Map<string, number>();
    for (const issue of issues) {
      const count = parseInt(issue.count ?? '0', 10);
      const codeTag = Array.isArray(issue.tags) ? issue.tags.find(t => t.key === 'app_error_code') : undefined;
      const code = codeTag?.value ?? 'UNKNOWN';
      errorMap.set(code, (errorMap.get(code) ?? 0) + count);
    }
    const topErrors = Array.from(errorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => ({ code, count }));

    const periodDays = parseInt(period.replace('d', ''), 10) || 14;
    return { available: true, unresolvedIssues, totalEvents, unclassifiedRatio, topErrors, periodDays };
  } catch {
    return { available: false, unresolvedIssues: null, totalEvents: null, unclassifiedRatio: null, topErrors: [], periodDays: 14 };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const [ci, sentry] = await Promise.all([fetchCIReliability(), fetchSentryHealth()]);

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=300');
  return res.status(200).json({
    generatedAt: new Date().toISOString(),
    ci,
    sentry,
  });
}
