# C4 Execution Checklist (Infra + Restore Drill)

Date: 2026-04-04
Scope: N1 + N2 from S16 NOW block
Status: Ready for execution

## 1) Owners

- Lead: Igor Bogdanoski
- Infra support: Snezhana Zlatkovska
- QA support: Monika Bogdanoska

## 2) Objective

Close C4 by delivering:
1. Provisioned backup bucket and isolated restore project.
2. One successful Firestore import operation in restore project.
3. Smoke validation evidence for core teacher flows.

## 3) Required Inputs

- source_project_id: production/source Firebase project id
- restore_project_id: isolated restore target project id
- backup_date: YYYY-MM-DD with known healthy backup
- backup_bucket_path: gs://<source_project_id>-backups/firestore/

### 3.1 How to find each input (step-by-step)

1) source_project_id
- Primary source in repo: `.firebaserc` (default project).
- Current inferred value from repo: `ai-navigator-ee967`.
- Cross-check in GitHub secrets: `VITE_FIREBASE_PROJECT_ID` used by workflows.
- Optional CLI check:

```powershell
firebase use
```

Expected: active/default project should match `ai-navigator-ee967`.

2) backup_bucket_path
- It is derived from source project in backup workflow.
- Formula: `gs://<source_project_id>-backups/firestore/`.
- With current inferred source project:

```text
gs://ai-navigator-ee967-backups/firestore/
```

- Optional existence check:

```powershell
gcloud storage ls gs://ai-navigator-ee967-backups/firestore/
```

3) backup_date
- Must be an existing folder under backup bucket in `YYYY-MM-DD` format.
- Find latest known healthy date by listing folders:

```powershell
gcloud storage ls gs://ai-navigator-ee967-backups/firestore/
```

- Pick one date that exists, for example `2026-04-03` (example only; use real listed date).

4) restore_project_id
- This is a separate isolated GCP project for drill restore (not production source project).
- Recommended naming pattern: `<source_project_id>-restore-drill`.
- Example candidate:

```text
ai-navigator-ee967-restore-drill
```

- Confirmed for this session:

```text
ai-navigator-ee967-restore
```

- Verify it exists:

```powershell
gcloud projects list --filter="projectId:ai-navigator-ee967-restore-drill"
```

- If no result, create/provision this project first (N1 prerequisite).

### 3.2 Final input template (fill before workflow_dispatch)

```text
source_project_id=ai-navigator-ee967
restore_project_id=ai-navigator-ee967-restore
backup_date=<YYYY-MM-DD-from-bucket-list>
backup_bucket_path=gs://ai-navigator-ee967-backups/firestore/
```

### 3.3 Ready workflow_dispatch payload (N2)

Use this in GitHub Actions -> `firestore-restore-drill.yml` -> Run workflow:

```text
source_project_id: ai-navigator-ee967
restore_project_id: ai-navigator-ee967-restore
backup_date: <replace-with-real-date-from-bucket>
```

## 4) Infra Prerequisites (N1)

### 4.1 Create/verify backup bucket

- Bucket exists at: gs://<source_project_id>-backups/firestore/
- Versioning: enabled
- Lifecycle: retention >= 30 days
- Access policy: least privilege

### 4.2 Restore project readiness

- Restore project exists and is isolated
- Firestore API enabled
- Cloud Storage API enabled

### 4.3 Service account permissions

Required roles for workflow/operator account:
- Datastore Import Export Admin
- Storage Object Admin (scoped to backup bucket path)

## 5) Run Restore Drill (N2)

Preferred path: GitHub Actions manual workflow
- Workflow: .github/workflows/firestore-restore-drill.yml
- Inputs:
  - source_project_id
  - restore_project_id
  - backup_date

Expected output from workflow summary:
- Import operation name
- Backup source path used

Optional local verification command:
- gcloud firestore operations describe <OPERATION_NAME> --project <RESTORE_PROJECT_ID>

## 6) Smoke Validation Checklist

Run against restore project after import is DONE:

1. Login path works for teacher/admin test accounts.
2. Planner data is readable.
3. Library/cached materials are queryable.
4. Analytics summary loads without runtime errors.
5. No critical spikes in error monitoring for restore target.

Mark each item as PASS/FAIL with timestamp.

## 7) Evidence Pack (required to close C4)

Collect and store in S16 log:
- source_project_id
- restore_project_id
- backup_date
- operation_name
- operation start/end timestamps
- smoke checklist results
- blocker list (if any)

## 8) C4 Closure Criteria

C4 can be moved from deferred to closed only when all are true:
1. N1 prerequisites are complete.
2. N2 restore import completed successfully.
3. Smoke checklist has no critical FAIL.
4. Evidence pack is recorded in S16_WORLD_CLASS_ACTION_PLAN.md.

## 9) Rollback/Safety Rule

If smoke validation finds critical regression:
- Stop further rollout decisions dependent on C4.
- Keep restore target isolated.
- Open incident ticket with findings and corrective actions.
