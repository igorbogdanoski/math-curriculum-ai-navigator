import fs from 'node:fs';

const token = process.env.SENTRY_AUTH_TOKEN;
const org = process.env.SENTRY_ORG;
const project = process.env.SENTRY_PROJECT;

const statsPeriod = process.env.SENTRY_STATS_PERIOD || '14d';
const issueQuery = process.env.SENTRY_ISSUE_QUERY || 'is:unresolved';
const issueLimit = Number(process.env.SENTRY_ISSUE_LIMIT || 100);
const unclassifiedWarnPct = Number(process.env.SENTRY_UNCLASSIFIED_WARN_PCT || 15); // L2 target: ≤15%

function appendSummary(markdown) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    console.log(markdown);
    return;
  }
  fs.appendFileSync(summaryPath, `${markdown}\n`);
}

function issueCount(issue) {
  const n = Number(issue?.count);
  return Number.isFinite(n) ? n : 0;
}

function getTag(issue, key) {
  const tags = Array.isArray(issue?.tags) ? issue.tags : [];
  const match = tags.find((t) => t?.key === key);
  return match?.value || null;
}

function short(text, max = 120) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

if (!token || !org || !project) {
  appendSummary('## Incident Observability (C3)\n\nSkipped: missing one or more required secrets (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`).');
  process.exit(0);
}

const url = new URL(`https://sentry.io/api/0/projects/${org}/${project}/issues/`);
url.searchParams.set('statsPeriod', statsPeriod);
url.searchParams.set('query', issueQuery);
url.searchParams.set('limit', String(issueLimit));

let issues = [];

try {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    appendSummary(`## Incident Observability (C3)\n\nCould not load Sentry issues: HTTP ${response.status}.`);
    process.exit(0);
  }

  const data = await response.json();
  issues = Array.isArray(data) ? data : [];
} catch (error) {
  appendSummary(`## Incident Observability (C3)\n\nCould not load Sentry issues: ${error instanceof Error ? error.message : 'unknown error'}.`);
  process.exit(0);
}

const unresolvedCount = issues.length;
const totalEvents = issues.reduce((sum, issue) => sum + issueCount(issue), 0);

const byCode = new Map();
for (const issue of issues) {
  const code = getTag(issue, 'app_error_code') || 'UNCLASSIFIED';
  byCode.set(code, (byCode.get(code) || 0) + issueCount(issue));
}

const topCodes = [...byCode.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

const unclassifiedEvents = byCode.get('UNCLASSIFIED') || 0;
const unclassifiedPct = totalEvents > 0 ? (unclassifiedEvents / totalEvents) * 100 : 0;
const shouldWarnUnclassified = totalEvents > 0 && unclassifiedPct > unclassifiedWarnPct;

const topIssues = [...issues]
  .sort((a, b) => issueCount(b) - issueCount(a))
  .slice(0, 10);

const lines = [];
lines.push('## Incident Observability (C3)');
lines.push('');
lines.push(`Window: last ${statsPeriod}`);
lines.push(`Unresolved issues: ${unresolvedCount}`);
lines.push(`Total events in window: ${totalEvents}`);
lines.push(`UNCLASSIFIED events: ${unclassifiedEvents} (${unclassifiedPct.toFixed(2)}%)`);
lines.push('');

if (shouldWarnUnclassified) {
  lines.push(`Warning: UNCLASSIFIED ratio ${unclassifiedPct.toFixed(2)}% is above threshold ${unclassifiedWarnPct}%.`);
  lines.push('');
  console.log(`::warning::UNCLASSIFIED ratio ${unclassifiedPct.toFixed(2)}% is above threshold ${unclassifiedWarnPct}%.`);
}

if (topCodes.length > 0) {
  lines.push('### Top Error Codes');
  lines.push('');
  lines.push('| ErrorCode | Events |');
  lines.push('|---|---:|');
  for (const [code, count] of topCodes) {
    lines.push(`| ${code} | ${count} |`);
  }
  lines.push('');
}

if (topIssues.length > 0) {
  lines.push('### Top Issues');
  lines.push('');
  lines.push('| Issue | Events | ErrorCode |');
  lines.push('|---|---:|---|');
  for (const issue of topIssues) {
    const link = issue.permalink ? `[${issue.shortId || 'Issue'}](${issue.permalink})` : (issue.shortId || 'Issue');
    const title = short(issue.title || issue.culprit || 'No title', 100);
    const code = getTag(issue, 'app_error_code') || 'UNCLASSIFIED';
    lines.push(`| ${link} ${title} | ${issueCount(issue)} | ${code} |`);
  }
  lines.push('');
}

if (issues.length === 0) {
  lines.push('No unresolved issues found for the selected period/query.');
}

appendSummary(lines.join('\n'));
