#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function readArg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseTimestamp(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  if (typeof value === 'number') {
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  if (typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      const dt = value.toDate();
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
    const seconds = value.seconds ?? value._seconds;
    const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
    if (typeof seconds === 'number') {
      const ms = seconds * 1000 + Math.floor(nanos / 1e6);
      const dt = new Date(ms);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }
  return null;
}

function pct(numerator, denominator) {
  if (!denominator || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function median(nums) {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return Math.round(sorted[mid]);
}

function withinDays(date, days, now) {
  if (!date) return false;
  const diff = now.getTime() - date.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

function computeBaseline(data, now = new Date()) {
  const events = Array.isArray(data.aiMaterialFeedbackEvents) ? data.aiMaterialFeedbackEvents : [];
  const materials = Array.isArray(data.materials) ? data.materials : [];
  const approvals = Array.isArray(data.worksheetApprovals) ? data.worksheetApprovals : [];

  const events14 = events.filter(e => withinDays(parseTimestamp(e.occurredAt), 14, now));
  const events7 = events.filter(e => withinDays(parseTimestamp(e.occurredAt), 7, now));

  const accept7 = events7.filter(e => String(e.action || '').startsWith('accept_')).length;
  const actionable7 = events7.filter(e => {
    const a = String(e.action || '');
    return a.startsWith('accept_') || a.startsWith('reject_') || a.startsWith('edit_');
  }).length;

  // Task completion proxy: share of actionable events ending in accept_saved in 7d window
  const taskCompletionRate = pct(accept7, actionable7);

  // Time-to-first-material proxy: first event -> first accept for same material in 7d
  const byMaterial = new Map();
  for (const e of events7) {
    const materialId = e.materialId || `no-material-${Math.random()}`;
    const ts = parseTimestamp(e.occurredAt);
    if (!ts) continue;
    if (!byMaterial.has(materialId)) {
      byMaterial.set(materialId, { first: ts, firstAccept: null });
    }
    const rec = byMaterial.get(materialId);
    if (ts < rec.first) rec.first = ts;
    if (String(e.action || '').startsWith('accept_')) {
      if (!rec.firstAccept || ts < rec.firstAccept) rec.firstAccept = ts;
    }
  }
  const leadTimesMs = [];
  for (const rec of byMaterial.values()) {
    if (rec.first && rec.firstAccept && rec.firstAccept >= rec.first) {
      leadTimesMs.push(rec.firstAccept.getTime() - rec.first.getTime());
    }
  }
  const ttfmMedianMs = median(leadTimesMs);

  // Reuse proxy in 14d: materials with explicit source marker
  const materials14 = materials.filter(m => withinDays(parseTimestamp(m.createdAt), 14, now));
  const reused14 = materials14.filter(m => Boolean(m.sourceQuizId || m.approvalRef || m.isForked)).length;
  const materialReuseRate = pct(reused14, materials14.length);

  // Reject/Edit ratio in 14d
  const reject14 = events14.filter(e => String(e.action || '').startsWith('reject_')).length;
  const edit14 = events14.filter(e => String(e.action || '').startsWith('edit_')).length;
  const rejectEditRatio = edit14 > 0 ? Number((reject14 / edit14).toFixed(2)) : null;

  // Recovery worksheet adoption in 14d
  const recoveryGenerated14 = materials14.filter(m => m.isRecoveryWorksheet === true).length;
  const approvals14 = approvals.filter(a => withinDays(parseTimestamp(a.createdAt), 14, now)).length;
  const eligible14 = recoveryGenerated14;
  const recoveryAdoptionPct = pct(approvals14, eligible14);

  return {
    generatedAt: now.toISOString(),
    windows: { sevenDays: '7d', fourteenDays: '14d' },
    sample: {
      events7: events7.length,
      events14: events14.length,
      materials14: materials14.length,
      approvals14,
      eligibleRecovery14: eligible14,
    },
    kpis: {
      taskCompletionRatePct_7d: taskCompletionRate,
      timeToFirstMaterialMedianMs_7d: ttfmMedianMs,
      materialReuseRatePct_14d: materialReuseRate,
      rejectEditRatio_14d: rejectEditRatio,
      recoveryWorksheetAdoptionPct_14d: recoveryAdoptionPct,
    },
    notes: [
      'Task completion rate is computed as accept/actionable event share in 7d.',
      'Time-to-first-material uses first event to first accept per material in 7d.',
      'Reuse proxy counts sourceQuizId/approvalRef/isForked markers in materials.',
      'Reject/Edit ratio is reject_* divided by edit_* events in 14d.',
      'Recovery adoption uses worksheet_approvals over generated recovery worksheets in 14d.'
    ]
  };
}

function toDisplay(value, unit = '') {
  if (value === null || value === undefined) return 'DATA_UNAVAILABLE';
  if (typeof value === 'number') {
    if (unit === '%') return `${value.toFixed(2)}%`;
    if (unit === 'ms') return `${value} ms`;
    return String(value);
  }
  return String(value);
}

function printMarkdown(result) {
  console.log('X3 T0 baseline extract');
  console.log('');
  console.log(`Generated at: ${result.generatedAt}`);
  console.log('');
  console.log('| KPI | T0 value | Sample |');
  console.log('|---|---|---|');
  console.log(`| Task completion rate (teacher flow) | ${toDisplay(result.kpis.taskCompletionRatePct_7d, '%')} | n=${result.sample.events7} events (7d) |`);
  console.log(`| Time-to-first-material (median) | ${toDisplay(result.kpis.timeToFirstMaterialMedianMs_7d, 'ms')} | n=${result.sample.events7} events (7d) |`);
  console.log(`| Material reuse rate | ${toDisplay(result.kpis.materialReuseRatePct_14d, '%')} | n=${result.sample.materials14} materials (14d) |`);
  console.log(`| Reject/Edit ratio | ${toDisplay(result.kpis.rejectEditRatio_14d)} | n=${result.sample.events14} events (14d) |`);
  console.log(`| Recovery worksheet adoption (E2 path) | ${toDisplay(result.kpis.recoveryWorksheetAdoptionPct_14d, '%')} | approvals=${result.sample.approvals14}, eligible=${result.sample.eligibleRecovery14} (14d) |`);
}

const input = readArg('--input');
const out = readArg('--out');

if (!input) {
  console.error('Usage: node scripts/compute-x3-baseline.mjs --input <gdpr-export.json> [--out <result.json>] [--markdown]');
  process.exit(1);
}

const raw = fs.readFileSync(path.resolve(input), 'utf8');
const payload = JSON.parse(raw);
const result = computeBaseline(payload);

if (out) {
  fs.writeFileSync(path.resolve(out), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(`Wrote baseline JSON: ${out}`);
}

if (hasFlag('--markdown')) {
  printMarkdown(result);
}

if (!out && !hasFlag('--markdown')) {
  console.log(JSON.stringify(result, null, 2));
}
