# F2 Acceptance Matrix Skeleton — 08.04.2026

Фаза: F2 Interactive Math hardening
Статус: DRAFT

## Matrix

| Area | Flow | Acceptance Check | Existing Evidence | Gap | Owner | Target Date | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Interactive Navigation | Curriculum entry | Route loads без crash и со валиден UI state | `tests/smoke.spec.ts` | Iteration 3 валидирана; следи финален full-gate стабилизирачки run | Core Team | 2026-04-10 | DONE |
| Interactive Generation | Activity flow | Teacher може да стартува генерација и да види валиден output state | `tests/happy-path.spec.ts` | Iteration 1 валидирана; следи full-gate мониторинг | Core Team | 2026-04-10 | DONE |
| Presentation Runtime | Slide controls | Presentation controls работат без runtime regression | `tests/happy-path.spec.ts` | Iteration 1 валидирана; следи full-gate мониторинг | Core Team | 2026-04-10 | DONE |
| Quiz Bridge | Quiz from generated content | Generated content може да се префрли во quiz path стабилно | `tests/teacher-quiz.spec.ts`, `tests/quiz-flow.spec.ts` | Iteration 2 валидирана; следи финален full-gate check | Core Team | 2026-04-10 | DONE |
| Student Runtime | Student play onboarding | Student path е достапен и стабилен по deep-link | `tests/student-play.spec.ts` | Reopen verification завршен: wizard stress PASS и clean full-gate rerun | Core Team | 2026-04-10 | DONE |
| Regression Safety | Auth and role guards | Teacher/student restricted routes се однесуваат предвидливо | `tests/auth-guard.spec.ts`, `tests/webinar-critical-flows.spec.ts` | Iteration 3 валидирана; следи финален full-gate стабилизирачки run | Core Team | 2026-04-10 | DONE |
| Performance Safety | Build and chunk health | Build е green, runtime без blocker warning regression | `npm run build` (manual evidence) | Дефинирај threshold за chunk strategy во F3 handoff | Core Team | 2026-04-10 | BASELINE_PASS_WITH_WARNINGS |

## Baseline Evidence (08.04.2026)

1. `npx tsc --noEmit` -> PASS (exit 0)
2. `npm run build` -> PASS (exit 0), со chunk-size warnings
3. `npm test` -> PASS (38 files / 446 tests)
4. `npm run test:e2e` -> PASS (103 passed, 1.9m)
5. Log path: `outputs/f2-baseline-2026-04-08/`

## Iteration 1 (1 -> 2) World-Class Hardening Plan

Scope: Interactive Generation + Presentation Runtime

### 1) Interactive Generation (first)

| Task ID | Action | Target File | Evidence Command | Exit Signal |
| --- | --- | --- | --- | --- |
| IG-1 | Додај детерминистички assertion за generator UI readiness (без brittle text-only match) | `tests/happy-path.spec.ts` | `npx playwright test tests/happy-path.spec.ts -g "Annual Planner"` | Test стабилно PASS во 2 последователни runs |
| IG-2 | Потврди дека generate trigger има предвидлив state transition (idle -> loading -> ready или auth gate path) | `tests/happy-path.spec.ts` | `npx playwright test tests/happy-path.spec.ts -g "Generate button"` | Нема flaky во локален loop (2 runs) |
| IG-3 | Додади negative guard: runtime error banner не се појавува по submit/action | `tests/happy-path.spec.ts` | `npx playwright test tests/happy-path.spec.ts` | Нема regression во цел spec |

### 2) Presentation Runtime (second)

| Task ID | Action | Target File | Evidence Command | Exit Signal |
| --- | --- | --- | --- | --- |
| PR-1 | Додај route-level smoke check за presentation path што верифицира render без crash | `tests/happy-path.spec.ts` | `npx playwright test tests/happy-path.spec.ts -g "Public routes"` | Route check PASS без pageerror blockers |
| PR-2 | Додај контролен assertion за интерактивни presentation UI елементи (button/aria guard) | `tests/happy-path.spec.ts` | `npx playwright test tests/happy-path.spec.ts -g "Accessibility"` | A11y guard PASS и стабилен |
| PR-3 | Потврди дека presentation checks не деградираат quiz/student flows | `tests/teacher-quiz.spec.ts`, `tests/student-play.spec.ts` | `npx playwright test tests/teacher-quiz.spec.ts tests/student-play.spec.ts` | Cross-flow PASS |

### Iteration 1 Quality Protocol

1. Секоја измена мора да помине таргетиран spec run и еден поширок cross-flow run.
2. Ако се појави FAIL: истиот ден да се запише RCA + fix + re-test evidence.
3. Финална валидација за Iteration 1: `npm run test:e2e` без flaky.

### Iteration 1 Execution Evidence (08.04.2026)

1. IG targeted run: 9 passed (20.3s)
2. PR targeted run: 9 passed (20.9s)
3. Cross-flow run: 19 passed (50.9s)
4. Log path: `outputs/f2-iteration1-2026-04-08/`

### Iteration 2 Execution Evidence (08.04.2026)

1. Quiz Bridge targeted run: 19 passed (36.4s)
2. Student Runtime targeted run: 16 passed (37.4s)
3. Log path: `outputs/f2-iteration2-2026-04-08/`

### Iteration 3 Execution Evidence (08.04.2026)

1. Interactive Navigation run #1: 5 passed (15.1s)
2. Interactive Navigation run #2: 5 passed (14.5s)
3. Regression Safety targeted run: 21 passed (30.5s)
4. Full gate verification: 105 passed + 1 flaky (`tests/student-play.spec.ts` wizard path)
5. Log path: `outputs/f2-iteration3-2026-04-08/`

### Reopen Verification Evidence (08.04.2026)

1. Student wizard repeat run (`--repeat-each=8`, workers=1): 24 passed (1.6m)
2. Full gate rerun: 106 passed (1.6m), без flaky
3. Log path: `outputs/f2-reopen-2026-04-08/`

## Done Criteria за секој ред

1. Acceptance check е репродуцибилен.
2. Постојат јасни докази (test run, log, или screenshot/report).
3. Нема blocker regression поврзан со редот.

## Mini DoD (BASELINE_PASS -> DONE) по ред

| Area | Mini DoD (must all pass) |
| --- | --- |
| Interactive Navigation | 1) Route smoke PASS во 2 последователни runs; 2) Нема runtime error banner; 3) Evidence линк во strategic log |
| Interactive Generation | 1) Generate state transition е валидирана; 2) Auth-gate и logged-in path се предвидливи; 3) Нема flaky на таргетиран run |
| Presentation Runtime | 1) Presentation render PASS без pageerror blockers; 2) Контролите се видливи/достапни; 3) Cross-flow check PASS |
| Quiz Bridge | 1) Generation-to-quiz path е потврден; 2) Negative invalid-ID path останува PASS; 3) Нема регресија во assign/copy-link |
| Student Runtime | 1) Student deep-link load PASS; 2) Onboarding/wizard path е стабилен; 3) Progress/portfolio reachable checks PASS |
| Regression Safety | 1) Auth guard assertions се стабилни; 2) Нема нови route leaks; 3) Teacher/student boundary checks PASS |
| Performance Safety | 1) Build PASS; 2) Chunk warnings евидентирани без blocker; 3) F3 handoff note ажуриран со threshold proposal |

## F3 Threshold Proposal (Performance Safety handoff)

Baseline snapshot (from build evidence):
1. `dist/assets/vendor-Bkp9SWam.js` = 1515.78 kB
2. `dist/assets/index-BGbrFP-D.js` = 1239.98 kB
3. `dist/assets/vendor-pdf-D-PBYwG7.js` = 862.07 kB
4. `dist/assets/vendor-mathlive-DRnje_OS.js` = 816.48 kB

Proposed F3 measurable thresholds:
1. Largest chunk target <= 1300 kB (hard stop > 1500 kB).
2. Main app chunk target <= 1000 kB.
3. Heavy optional libs (`pdf`, `mathlive`, `pptx`, `xlsx`) must remain lazy-loaded and excluded from initial route critical path.
4. Any threshold breach requires explicit waiver note + rollback/mitigation plan before closure.

## F2 Exit Criteria (working draft)

1. Сите matrix редови се `DONE` или `WAIVED` со објаснување.
2. `npm run test:e2e` финален run е зелен без flaky.
3. Отворени ризици (ако има) се документирани со конкретен next owner/date.