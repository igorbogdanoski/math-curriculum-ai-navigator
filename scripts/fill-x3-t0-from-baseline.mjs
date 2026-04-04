#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PLAN = 'S16_WORLD_CLASS_ACTION_PLAN.md';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}

function fmtPct(value, sampleText) {
  if (value === null || value === undefined) return 'DATA_UNAVAILABLE';
  return `${Number(value).toFixed(2)}% (${sampleText})`;
}

function fmtMs(value, sampleText) {
  if (value === null || value === undefined) return 'DATA_UNAVAILABLE';
  return `${Math.round(Number(value))} ms (${sampleText})`;
}

function fmtRatio(value, sampleText) {
  if (value === null || value === undefined) return 'DATA_UNAVAILABLE';
  return `${Number(value).toFixed(2)} (${sampleText})`;
}

function replaceRow(planText, rowLabel, newBaselineValue) {
  const escaped = rowLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(`(^\\|\\s*${escaped}\\s*\\|)\\s*([^|]+?)\\s*(\\|)`, 'm');
  return planText.replace(rx, `$1 ${newBaselineValue} $3`);
}

const baselinePath = arg('--baseline');
if (!baselinePath) {
  console.error('Usage: node scripts/fill-x3-t0-from-baseline.mjs --baseline <eval/x3-baseline-t0.json> [--plan S16_WORLD_CLASS_ACTION_PLAN.md]');
  process.exit(1);
}

const planPath = arg('--plan', DEFAULT_PLAN);
const baseline = JSON.parse(fs.readFileSync(path.resolve(baselinePath), 'utf8'));
let plan = fs.readFileSync(path.resolve(planPath), 'utf8');

const sample = baseline.sample || {};
const kpis = baseline.kpis || {};

const rows = [
  {
    label: 'Task completion rate (teacher flow)',
    value: fmtPct(kpis.taskCompletionRatePct_7d, `n=${sample.events7 ?? 0}, 7d`),
  },
  {
    label: 'Time-to-first-material (median)',
    value: fmtMs(kpis.timeToFirstMaterialMedianMs_7d, `n=${sample.events7 ?? 0}, 7d`),
  },
  {
    label: 'Material reuse rate',
    value: fmtPct(kpis.materialReuseRatePct_14d, `n=${sample.materials14 ?? 0}, 14d`),
  },
  {
    label: 'Reject/Edit ratio',
    value: fmtRatio(kpis.rejectEditRatio_14d, `n=${sample.events14 ?? 0}, 14d`),
  },
  {
    label: 'Recovery worksheet adoption (E2 path)',
    value: fmtPct(kpis.recoveryWorksheetAdoptionPct_14d, `approvals=${sample.approvals14 ?? 0}, eligible=${sample.eligibleRecovery14 ?? 0}, 14d`),
  },
];

for (const row of rows) {
  const updated = replaceRow(plan, row.label, row.value);
  if (updated === plan) {
    console.error(`Could not update row: ${row.label}`);
    process.exit(2);
  }
  plan = updated;
}

fs.writeFileSync(path.resolve(planPath), plan, 'utf8');
console.log(`Updated X3 T0 rows in ${planPath} from ${baselinePath}`);
