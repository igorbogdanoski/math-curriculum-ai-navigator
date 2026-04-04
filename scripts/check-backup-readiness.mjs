import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const workflowPath = path.join(repoRoot, '.github', 'workflows', 'firestore-backup.yml');

const checks = [];

function addCheck(name, passed, detail) {
  checks.push({ name, passed, detail });
}

if (!fs.existsSync(workflowPath)) {
  console.error('Missing workflow: .github/workflows/firestore-backup.yml');
  process.exit(1);
}

const workflow = fs.readFileSync(workflowPath, 'utf8');

addCheck('Has nightly schedule', /schedule:\s*[\s\S]*cron:\s*'0 2 \* \* \*'/.test(workflow), "Expected cron '0 2 * * *'");
addCheck('Has manual trigger', /workflow_dispatch/.test(workflow), 'Expected workflow_dispatch trigger for manual drills');
addCheck('Authenticates with service account', /FIREBASE_SERVICE_ACCOUNT/.test(workflow), 'Expected FIREBASE_SERVICE_ACCOUNT secret usage');
addCheck('Runs Firestore export', /gcloud firestore export/.test(workflow), 'Expected gcloud firestore export command');
addCheck('Targets project secret', /VITE_FIREBASE_PROJECT_ID/.test(workflow), 'Expected project id secret in backup workflow');
addCheck('Has retention prune logic', /Prune old backups/.test(workflow) && /gsutil -m rm -r/.test(workflow), 'Expected prune step with gsutil deletion');

const failed = checks.filter((c) => !c.passed);

console.log('Backup readiness report:');
for (const check of checks) {
  console.log(`- [${check.passed ? 'OK' : 'FAIL'}] ${check.name}: ${check.detail}`);
}

if (failed.length > 0) {
  console.error('\nBackup readiness check failed.');
  process.exit(1);
}

console.log('\nBackup readiness check passed.');
