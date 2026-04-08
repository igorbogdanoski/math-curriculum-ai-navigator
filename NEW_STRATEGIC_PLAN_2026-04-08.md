# Нов Стратешки План — Фазно Извршување (08.04.2026)

Статус: АКТИВЕН
Цел: Извршување по ред, фаза по фаза, со строг evidence trail.

## 1) Фазен редослед

| Фаза | Име | Статус | Owner | Start | End | Evidence |
|---|---|---|---|---|---|---|
| F1 | Пост-аудит стабилизација на платформата | DONE | Core Team | 2026-04-08 | 2026-04-08 | F1 smoke report + 103/103 e2e |
| F2 | Interactive Math hardening + acceptance matrix | DONE | Core Team | 2026-04-08 | 2026-04-08 | Reopen verification clean: 106/106 e2e |
| F3 | Bundle strategy и code-splitting оптимизација | IN_PROGRESS | Core Team | 2026-04-08 | - | F3 kickoff baseline collected |
| F4 | S19 formal closure criteria и milestone lock | PENDING | Core Team | - | - | - |
| F5 | Финален EN/AL translation sweep (section-by-section) | PENDING | Core Team | - | - | - |

## 2) Фаза 1 — Пост-аудит стабилизација (СТАРТУВАНО)

Цел:
- Да се потврди дека последните промени се стабилни низ критичните flow-ови.
- Да се елиминираат регресии пред следната фаза.

Scope (F1):
1. Cross-flow smoke матрица: curriculum, activities, presentations, quiz, live quiz, academy.
2. Stability checks: typecheck, build, critical tests.
3. Regression review на последни high-impact модули (AlgebraTiles, Gamma, Quiz, extractor pipeline).
4. Phase exit report со PASS/FAIL и јасни next actions.

Exit Criteria (DONE):
1. Нема блокирачки runtime дефекти во критичните flow-ови.
2. Build и typecheck се зелени.
3. Regression findings (ако има) се или поправени или евидентирани со ticket/next-step.
4. Подготвен formal handoff кон F2.

## 3) Evidence Log (нов циклус)

| Датум | Фаза | Активност | Резултат | Линк/Белешка |
|---|---|---|---|---|
| 2026-04-08 | F1 | Фаза 1 старт | DONE | План инициран |
| 2026-04-08 | F1 | Full quality gate (`npm run test:e2e`) | PASS | 103 passed (1.9m), без flaky |
| 2026-04-08 | F1->F2 | Formal handoff | DONE | F1 exit criteria satisfied; F2 стартувана |
| 2026-04-08 | F2 | Kickoff checklist + acceptance matrix skeleton | DONE | `F2_KICKOFF_CHECKLIST_2026-04-08.md`, `F2_ACCEPTANCE_MATRIX_2026-04-08.md` |
| 2026-04-08 | F2 | Baseline gate: typecheck + build | PASS | `npx tsc --noEmit` (exit 0), `npm run build` (exit 0, chunk warnings) |
| 2026-04-08 | F2 | Baseline gate: unit + e2e | PASS | `npm test` (38/38 files, 446 tests), `npm run test:e2e` (103 passed, 1.9m) |
| 2026-04-08 | F2 | Step 1: Iteration 1 hardening tasks defined | DONE | Interactive Generation + Presentation Runtime tasks in acceptance matrix |
| 2026-04-08 | F2 | Step 2: Mini DoD per matrix row | DONE | BASELINE_PASS -> DONE criteria added row-by-row |
| 2026-04-08 | F2 | Step 1 executed: IG + PR targeted hardening runs | PASS | 9/9 IG, 9/9 PR, 19/19 cross-flow (`outputs/f2-iteration1-2026-04-08/`) |
| 2026-04-08 | F2 | Step 2 executed: F3 performance threshold proposal | DONE | Measurable chunk thresholds added for F3 handoff |
| 2026-04-08 | F2 | Step 1 executed: Quiz Bridge targeted stability | PASS | 19/19 (`tests/teacher-quiz.spec.ts` + `tests/quiz-flow.spec.ts`) |
| 2026-04-08 | F2 | Step 2 executed: Student Runtime targeted stability | PASS | 16/16 (`tests/student-play.spec.ts` + `tests/webinar-critical-flows.spec.ts`) |
| 2026-04-08 | F2 | Step 1 executed: Interactive Navigation stability | PASS | 5/5 + 5/5 (`tests/smoke.spec.ts` two consecutive runs) |
| 2026-04-08 | F2 | Step 2 executed: Regression Safety stability | PASS | 21/21 (`tests/auth-guard.spec.ts` + `tests/webinar-critical-flows.spec.ts`) |
| 2026-04-08 | F2 | Full-gate verification after steps 1+2 | FLAKY | 105 passed + 1 flaky (`tests/student-play.spec.ts` wizard path, retry PASS) |
| 2026-04-08 | F2 | Reopen Step 1: Student wizard stress verification | PASS | 24/24 (`tests/student-play.spec.ts -g wizard --repeat-each=8 --workers=1`) |
| 2026-04-08 | F2 | Reopen Step 2: Full-gate rerun | PASS | 106 passed (1.6m), без flaky (`outputs/f2-reopen-2026-04-08/`) |
| 2026-04-08 | F2->F3 | Formal phase transition | DONE | F2 exit criteria satisfied; F3 kickoff started |
| 2026-04-08 | F3 | Kickoff baseline: build + perf budget | PARTIAL | Build PASS; perf budget FAIL on total assets 10557.50 kB > 10000 kB (`outputs/f3-kickoff-2026-04-08/`) |
| 2026-04-08 | F3 | Step 1 analysis: top bundle contributors + wave-1 shortlist | DONE | Prioritized targets documented in `F3_KICKOFF_CHECKLIST_2026-04-08.md` |
| 2026-04-08 | F3 | Step 2 wave-1: on-demand export deps refactor + re-measure | PARTIAL | Build PASS; perf budget still FAIL (total 10557.74 kB > 10000 kB) |
| 2026-04-08 | F3 | Step 2 wave-2: math evaluator optimization + re-measure | PASS | Perf budget PASS (total 9909.57 kB; third-party 6114.36 kB) |
| 2026-04-08 | F3 | Regression validation after wave-2 | PASS | `tests/smoke.spec.ts` + `tests/auth-guard.spec.ts` => 21/21 PASS |

## 4) Оперативни правила

1. Нема прескокнување фаза без затворен exit criteria.
2. Секоја промена мора да има evidence запис.
3. Ако има конфликт помеѓу брзина и стабилност, приоритет има стабилност.
4. Translation sweep (F5) останува финална фаза по договор.

## 5) F2 Kickoff Артефакти

1. Checklist: `F2_KICKOFF_CHECKLIST_2026-04-08.md`
2. Acceptance matrix skeleton: `F2_ACCEPTANCE_MATRIX_2026-04-08.md`
