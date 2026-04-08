# F2 Kickoff Checklist — 08.04.2026

Фаза: F2 Interactive Math hardening + acceptance matrix
Статус: IN_PROGRESS

## Execution Parameters

- Owner: Core Team
- Daily evidence cadence: 18:00 update во `NEW_STRATEGIC_PLAN_2026-04-08.md`
- Target за baseline hardening pass: 2026-04-10

## A) Scope Freeze

- [x] Потврди точен F2 scope (Interactive Math hardening само, без translation sweep).
- [x] Потврди дека F1 artifacts се заклучени (smoke report + strategic status).
- [x] Дефинирај owner и cadence за дневно evidence логирање.

## B) Hardening Baseline

- [x] Собери baseline на критични runtime патеки за teacher/student.
- [x] Потврди дека нема runtime crash на `/curriculum`, `/activity`, `/quiz`, `/student/*`.
- [x] Нормализирај flaky-sensitive assertions (видливост, локализација, чекори).

## C) Acceptance Matrix Setup

- [x] Пополни matrix owner/status за секој flow во `F2_ACCEPTANCE_MATRIX_2026-04-08.md`.
- [x] Мапирај постоечки e2e покриеност кон секој acceptance item.
- [x] Обележи празнини каде треба нови/прецизирани e2e checks.

## D) Test Gate за F2 циклус

- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [x] `npm test`
- [x] `npm run test:e2e`

## E) Exit-Ready Tracking

- [x] Отвори F2 evidence entries во `NEW_STRATEGIC_PLAN_2026-04-08.md`.
- [ ] При прв FAIL: RCA + proposed fix + re-test evidence.
- [ ] Пред closure: full gate без flaky на финален run.

## Evidence Notes

- F1 handoff source: `F1_SMOKE_REPORT_2026-04-08.md` (103/103 e2e pass)
- Strategic state: `NEW_STRATEGIC_PLAN_2026-04-08.md` (F2 = IN_PROGRESS)