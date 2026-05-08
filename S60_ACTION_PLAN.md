# S60 — Action Plan (по S59 ревизија)

> Креирано: 05.05.2026 | Влез: S59 преглед на Matura модул + тест-покриеност + поврзаност + Math is Fun gap анализа
> Цел: затварање на празнините идентификувани во S59 пред матурската сезона (јуни 2026)

---

## Принципи

1. **Test-first** за критични flows (vitest + Playwright).
2. Секој таск има **acceptance criteria** + **тест артефакт** + **commit prefix**.
3. Не се мрднуваме на следен tier додека сите P0 не се ✅.
4. Eval gate (`eval:smoke-gate`) задолжително пред merge ако се менува prompt/AI flow.

---

## Tier 0 — Hotfix / Quick wins (ден 1-2)

### T0.1 — Sidebar: додај `/matura-portal` NavItem
- **Зошто:** Portal е router entry, но недостапен од sidebar (корисниците не го наоѓаат).
- **Фајл:** `components/Sidebar.tsx`
- **AC:** NavItem со ICONS.education, label "Матурски портал", сместен најгоре во matura групата.
- **Тест:** `__tests__/sidebarMaturaNav.test.ts` (render, click → navigate('/matura-portal')).
- **Commit:** `fix-s60-sidebar-matura-portal-link`

### T0.2 — `MaturaLibraryView` → SPA navigate (не window.location)
- **Зошто:** `window.location.href = '/matura-import'` ги ресетира ReactQuery cache + history.
- **Фајл:** `views/MaturaLibraryView.tsx:236`
- **AC:** Користи `useNavigation().navigate('/matura-import')`.
- **Тест:** Постоечкиот `__tests__/maturaLibraryFlow.test.ts` extend.
- **Commit:** `fix-s60-matura-library-spa-nav`

### T0.3 — Sentry release tagging со git SHA
- **Зошто:** P8 завршен но без `release` → grouping ниво на грешки лошо.
- **Фајл:** `services/sentryService.ts` или иницијализација во `main.tsx`.
- **AC:** `release: import.meta.env.VITE_GIT_SHA` (Vercel auto-injects); fallback `dev`.
- **Тест:** unit за initialization options.
- **Commit:** `chore-s60-sentry-release-tag`

---

## Tier 1 — Test coverage (ден 3-5)

Цел: подигни ги Matura модул unit тестовите од 6 → 14+ и додај 3 Playwright spec-а.

### T1.1 — Vitest за `services/firestoreService.matura.ts`
- Mocks за `getStudentMaturaProfile`, `createStudentMaturaProfile`, `saveMaturaSession`, `listMaturaSessions`.
- AC: 90% line coverage на сервисот.
- Test file: `__tests__/firestoreServiceMatura.test.ts`

### T1.2 — Vitest за `hooks/useMaturaStats.ts`
- Тест: empty state, computed avgPct/bestPct, topicStats sort.
- File: `hooks/useMaturaStats.test.ts`

### T1.3 — Vitest за `hooks/useMaturaMissions.ts`
- Тест: streak counter, skipDay logic, todayDay roll-over.
- File: `hooks/useMaturaMissions.test.ts`

### T1.4 — Vitest за `views/maturaPractice/maturaPracticeGrading.ts`
- Веќе помошник модул; додај golden cases (multiple choice, free text, partial credit).
- File: `views/maturaPractice/maturaPracticeGrading.test.ts`

### T1.5 — Vitest за `components/matura/MaturaCountdown.tsx`
- Render snapshot + день/недела/час буџет.
- File: `components/matura/MaturaCountdown.test.tsx`

### T1.6 — Playwright `matura-practice.spec.ts`
- Flow: `/matura-portal → /matura-practice → setup (algebra, 5 q) → solve → review`.
- AC: тајмер видлив, score breakdown по тема, "Повтори грешки" copy-button.

### T1.7 — Playwright `matura-simulation.spec.ts`
- Flow: 90-min simulation шорт-circuit (env: `VITE_E2E_FAST_TIMER=1`); провери auto-submit.

### T1.8 — Playwright `matura-grading-vision.spec.ts`
- Mock photo upload; assert AI grading panel renders rubric.

---

## Tier 2 — `MaturaExamSession` рефактор (S59 P3 deliverable, недовршен) (ден 6-9)

### T2.1 — Издвој компонента `components/matura/MaturaExamSession.tsx`
- State machine: `setup → exam → review` (xstate-style reducer; постои `__tests__/quizSessionReducer.test.ts` како прототип).
- Props: `mode: 'practice' | 'simulation'`, `topics`, `dokFilter`, `count`, `durationSec`.
- Внатре: `MaturaQuestionCard` × n, тајмер, paused-state, локален draft (autosave во localStorage).
- AC:
  - 0 props drilling до `MaturaQuestionCard`.
  - Тајмер pause при `visibilitychange === 'hidden'` (configurable).
  - Submit handler враќа `{ answers, perTopic, perDoK, durationMs }`.
- Тест: `components/matura/MaturaExamSession.test.tsx` (state transitions + submit payload).

### T2.2 — `MaturaPracticeView` користи `<MaturaExamSession mode="practice" />`
- Зачувај URL params (deep-link).
- Бекф-компат: постоечките линкови продолжуваат да работат.

### T2.3 — `MaturaSimulationView` користи `<MaturaExamSession mode="simulation" />`
- 90-мин тајмер, без feedback по прашање.
- На submit запиши `maturaSessions` (Firestore) + Sentry breadcrumb.

### T2.4 — Историја на сесии во `MaturaAnalyticsView`
- Нова tab "Сесии" со листа од Firestore + drill-down (точност по тема, време/прашање).

---

## Tier 3 — Spaced Repetition spojuvanje (ден 10-12)

### T3.1 — Поврзи `spacedRepetition` со грешени матурски прашања
- Кога ученик греши, push до `studentSpacedQueue` (postojeci helper во `services/spacedRepetitionService.ts` ако постои; ако не — нов).
- `MaturaPortalView`: панел "Денешно повторување — N прашања" → `/matura-practice?mode=spaced`.

### T3.2 — UI индикатор во `MaturaQuestionCard` за "due for review"
- Бадж "🔁 Повторно" при следно појавување.

---

## Tier 4 — Math is Fun-инспирирани интерактиви (ден 13-18)

Приоритет: инструменти што директно поддржуваат матурски теми каде моментално нема визуелен помагач.

### T4.1 — `components/math/FunctionTransformer.tsx`
- a·f(b·x + c) + d живи слајдери врз f(x) = sin/cos/log/x²/√x.
- Каде се користи: `MaturaTutorChat` → "Покажи трансформација"; `AcademyLessonView` за функции.
- Тест: snapshot + slider events.

### T4.2 — `components/math/ProbabilitySimulator.tsx`
- Coins / dice / urn (drag balls). Live histogram vs theoretical.
- За `kombinatorika` тема.

### T4.3 — `components/math/ConicSectionExplorer.tsx`
- Interactive cut на cone → ellipse/parabola/hyperbola; сравни со equation-form input.

### T4.4 — `components/math/InequalitySolver.tsx`
- Number-line drag за |x-a| < b и polynomial inequalities.
- Step-by-step disclosure (expand/collapse).

### T4.5 — Glossary popovers во `MaturaQuestionCard`
- Mark математички термини; on-hover tooltip од `data/mathGlossary.ts` (ново).

---

## Tier 5 — Eval & quality gates (континуирано)

### T5.1 — `eval/matura-grading-golden.json`
- 30 примери (photo+expected score+rubric); reproducible Vision AI gate.

### T5.2 — `eval/matura-tutor-golden.json`
- 20 student questions + expected pedagogical answer characteristics.

### T5.3 — Re-baseline `eval:smoke-gate` за 768-dim embedding
- Пушти `npm run eval:run` со текстот од x3-baseline; зачувај нов baseline.

### T5.4 — Perf budget gate во CI
- `npm run perf:budget` мора да pass-не: initial bundle ≤ 1.5MB.

---

## Дневен ред (предложен)

| Ден | Tier | Tasks |
|-----|------|-------|
| 1 | T0 | T0.1, T0.2, T0.3 |
| 2 | T0 + T5 | резерва за hotfix; T5.3 re-baseline |
| 3-4 | T1 | T1.1, T1.2, T1.3, T1.4, T1.5 |
| 5 | T1 | T1.6, T1.7, T1.8 |
| 6-7 | T2 | T2.1, T2.2 |
| 8-9 | T2 | T2.3, T2.4 |
| 10-12 | T3 | T3.1, T3.2 |
| 13-15 | T4 | T4.1, T4.2 |
| 16-18 | T4 | T4.3, T4.4, T4.5 |
| 19+ | T5 | eval gates + buffer |

---

## Definition of Done за S60

- [ ] Сите T0 ✅ commit + deploy
- [ ] Tier 1: ≥14 vitest + ≥3 playwright за matura, без флакови
- [ ] T2.1–T2.4 ✅; стариот код-патот за simulation е уништен (нема дупло одржување)
- [ ] T3 ✅; spaced repetition активна за минимум 1 ученик во staging
- [ ] T4: барем T4.1 + T4.2 deployed; интегрирани во барем 1 view
- [ ] `npm run lint && npm run test && npm run test:e2e && npm run eval:smoke-gate && npm run perf:budget` сите green
- [ ] Production деплој на ai.mismath.net потврден

---

## Тракинг

Повторно отвори овој документ на крајот од секој ден; означи ги завршените таскови со `✅` и линкувај commit hash.

| Task | Статус | Commit | Дата |
|------|--------|--------|------|
| T0.1 | ✅ | `9e893a7` | 05.05.2026 |
| T0.2 | ✅ | `9e893a7` | 05.05.2026 |
| T0.3 | ✅ | `9e893a7` | 05.05.2026 |
| T1.1 | ✅ | `3aa1b72` | 05.05.2026 |
| T1.2 | ✅ | `3aa1b72` | 05.05.2026 |
| T1.3 | ✅ | `3aa1b72` | 05.05.2026 |
| T1.4 | ✅ | `3aa1b72` | 05.05.2026 |
| T1.5 | ✅ | `3aa1b72` | 05.05.2026 |
| T1.6 | ✅ | `03c9a4d` | 06.05.2026 |
| T1.7 | ✅ | `03c9a4d` | 06.05.2026 |
| T1.8 | ✅ | `03c9a4d` | 06.05.2026 |
| T2.1 | ✅ | `4468300` | 06.05.2026 |
| T2.2 | ⏳ | — | — |
| T2.3 | ⏳ | — | — |
| T2.4 | ✅ | `e8471c5` | 06.05.2026 |
| T3.1 | ✅ | `1ecd28e` | 06.05.2026 |
| T3.2 | ✅ | `1ecd28e` | 06.05.2026 |
| T4.1 | ✅ | `807c913` | 06.05.2026 |
| T4.2 | ✅ | `1ac36c8` | 06.05.2026 |
| T4.3 | ✅ | `64331fc` | 06.05.2026 |
| T4.4 | ✅ | `64331fc` | 06.05.2026 |
| T4.5 | ✅ | `46350e4` | 06.05.2026 |
| T5.1 | ✅ | pending | 06.05.2026 |
| T5.2 | ✅ | pending | 06.05.2026 |
| T5.3 | ⏳ | — | — |
| T5.4 | ⏳ | — | — |
