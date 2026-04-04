# Backup & Restore Runbook (Firestore)

Last updated: 2026-04-04
Owner: Platform / DevOps

## Purpose

Define a repeatable backup and restore drill for Firestore so incidents can be recovered with predictable steps and low risk.

## Existing Automation

- Nightly backup workflow: .github/workflows/firestore-backup.yml
- Restore drill workflow (manual): .github/workflows/firestore-restore-drill.yml
- Schedule: 02:00 UTC daily
- Destination pattern: `gs://<PROJECT_ID>-backups/firestore/YYYY-MM-DD`
- Retention: prune folders older than 30 days

## Preconditions

- GitHub secrets configured:
  - FIREBASE_SERVICE_ACCOUNT
  - VITE_FIREBASE_PROJECT_ID
- Google Cloud APIs enabled on target project:
  - Firestore API
  - Cloud Storage API
- Service account permissions:
  - Datastore Import Export Admin
  - Storage Object Admin (for backup bucket path)

## Backup Verification (Daily)

1. Open latest Firestore Nightly Backup workflow run in GitHub Actions.
2. Confirm export step completed and summary includes destination bucket path.
3. Confirm prune step ran (or skipped safely) without blocking the workflow.
4. Validate that latest date folder exists in bucket:

   - `gs://<PROJECT_ID>-backups/firestore/YYYY-MM-DD`

## Restore Drill (Monthly Recommended)

Preferred path (GitHub Actions):

1. Run workflow `.github/workflows/firestore-restore-drill.yml` via `workflow_dispatch`.
2. Provide inputs:

   - `source_project_id`
   - `backup_date` (`YYYY-MM-DD`)

3. The currently executed production drill path imports back into the source project itself as a controlled validation step.
4. Capture operation id from workflow summary.
5. Track completion using:

```bash
gcloud firestore operations describe <OPERATION_NAME> --project="<SOURCE_PROJECT_ID>"
```

Preferred future state:

- Use an isolated restore target project when IAM access is available.
- Keep the current same-project import drill as a fallback evidence path, not the ideal steady-state architecture.

Alternative path (local gcloud):

1. Pick a backup date and path:

   - `gs://<PROJECT_ID>-backups/firestore/YYYY-MM-DD`

2. Preferred: use an isolated restore target project first:

   - `<PROJECT_ID>-restore-drill`

3. Fallback executed on 2026-04-04: import back into the source project for drill evidence when restore-project IAM is blocked.
4. Authenticate in gcloud with privileged account/service account.
5. Run Firestore import:

```bash
PROJECT="<SOURCE_PROJECT_ID_OR_RESTORE_PROJECT_ID>"
BACKUP_PATH="gs://<SOURCE_PROJECT_ID>-backups/firestore/<YYYY-MM-DD>"

gcloud firestore import "${BACKUP_PATH}" --project="${PROJECT}" --async
```

1. Wait for operation completion:

```bash
gcloud firestore operations list --project="${PROJECT}"
```

1. Verify restored data using smoke checks:

   - users collection has expected documents
   - cached_ai_materials is queryable
   - planner-related collections can be read

1. Capture drill evidence:

   - operation id
   - start/end timestamps
   - number of collections/documents sampled
   - pass/fail + issues found

## Production Restore Decision Gate

Before restoring to production:

1. Incident commander approval is recorded.
2. Blast radius is documented.
3. Latest healthy backup timestamp is agreed.
4. Stakeholder communication is sent.

## Post-Restore Validation

1. Application login works.
2. Core teacher flows work:

   - load planner
   - load lesson library
   - load analytics summary

3. Error rate does not spike unexpectedly in Sentry.

## Rollback and Safety

- If restore target is a drill project, destroy the drill project after validation.
- If same-project drill or production restore introduces regressions, pause writes and execute incident rollback plan.

## Evidence Template

- Drill date:
- Operator:
- Source backup path:
- Restore project:
- Import operation id:
- Validation checklist result:
- Follow-up actions:
