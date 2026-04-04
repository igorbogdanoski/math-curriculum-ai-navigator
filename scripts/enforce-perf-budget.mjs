import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const budgetPath = path.join(repoRoot, 'performance-budget.json');

if (!fs.existsSync(budgetPath)) {
  console.error('Missing performance-budget.json');
  process.exit(1);
}

const budgets = JSON.parse(fs.readFileSync(budgetPath, 'utf8'));
const distDir = path.join(repoRoot, 'dist');

if (!fs.existsSync(distDir)) {
  console.error('Missing dist directory. Run build first.');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

const files = walk(distDir);

function toPosix(p) {
  return p.replace(/\\/g, '/');
}

function fileKb(filePath) {
  return fs.statSync(filePath).size / 1024;
}

function matchPattern(filePath, pattern) {
  const rel = toPosix(path.relative(repoRoot, filePath));
  if (pattern === 'dist/**/*.js') return rel.startsWith('dist/') && rel.endsWith('.js');
  if (pattern === 'dist/**/*.css') return rel.startsWith('dist/') && rel.endsWith('.css');
  if (pattern === 'dist/assets/*.js') return rel.startsWith('dist/assets/') && rel.endsWith('.js');
  if (pattern === 'dist/assets/*.css') return rel.startsWith('dist/assets/') && rel.endsWith('.css');
  return false;
}

const failures = [];
const report = [];

for (const budget of budgets) {
  if (budget.path) {
    const matched = files.filter((f) => matchPattern(f, budget.path));
    if (matched.length === 0) {
      report.push({
        check: `path:${budget.path}`,
        status: 'warn',
        message: 'No files matched',
      });
      continue;
    }

    const over = matched
      .map((f) => ({ file: f, kb: fileKb(f) }))
      .filter((x) => x.kb > budget.budget)
      .sort((a, b) => b.kb - a.kb);

    if (over.length > 0) {
      failures.push(
        ...over.map((x) => `${toPosix(path.relative(repoRoot, x.file))} is ${x.kb.toFixed(2)} kB > ${budget.budget} kB`),
      );
    }

    const max = matched.map(fileKb).reduce((a, b) => Math.max(a, b), 0);
    report.push({
      check: `path:${budget.path}`,
      status: over.length === 0 ? 'pass' : 'fail',
      message: `max ${max.toFixed(2)} kB / budget ${budget.budget} kB`,
    });
    continue;
  }

  if (budget.resourceType === 'total') {
    const totalKb = files
      .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
      .map(fileKb)
      .reduce((sum, n) => sum + n, 0);

    if (totalKb > budget.budget) {
      failures.push(`total assets is ${totalKb.toFixed(2)} kB > ${budget.budget} kB`);
    }

    report.push({
      check: 'resource:total',
      status: totalKb <= budget.budget ? 'pass' : 'fail',
      message: `${totalKb.toFixed(2)} kB / budget ${budget.budget} kB`,
    });
    continue;
  }

  if (budget.resourceType === 'third-party') {
    const thirdPartyKb = files
      .filter((f) => {
        const base = path.basename(f);
        return (f.endsWith('.js') || f.endsWith('.css')) && base.startsWith('vendor-');
      })
      .map(fileKb)
      .reduce((sum, n) => sum + n, 0);

    if (thirdPartyKb > budget.budget) {
      failures.push(`third-party vendor assets are ${thirdPartyKb.toFixed(2)} kB > ${budget.budget} kB`);
    }

    report.push({
      check: 'resource:third-party',
      status: thirdPartyKb <= budget.budget ? 'pass' : 'fail',
      message: `${thirdPartyKb.toFixed(2)} kB / budget ${budget.budget} kB`,
    });
  }
}

console.log('Performance budget report:');
for (const row of report) {
  const icon = row.status === 'pass' ? 'OK' : row.status === 'warn' ? 'WARN' : 'FAIL';
  console.log(`- [${icon}] ${row.check}: ${row.message}`);
}

if (failures.length > 0) {
  console.error('\nBudget check failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nAll performance budgets passed.');
