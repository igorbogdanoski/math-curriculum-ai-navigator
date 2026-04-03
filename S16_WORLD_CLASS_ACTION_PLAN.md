# S16 — World-Class Upgrade Plan (Stabilization First)
**Датум:** 03.04.2026  
**Статус:** ACTIVE — започнуваме

---

## 1) Цел на S16

Апликацијата прво да стане технички стабилна и предвидлива (test/build/perf/security), па потоа да се отвори патека за нови high-impact функции и enterprise скалирање.

Принцип:
- **Стабилизација пред експанзија**
- **Мерлив квалитет пред нови функции**
- **Канонски план со јасни gate-ови**

---

## 2) Тековна состојба (проверено)

- TypeScript: чист (`npx tsc --noEmit` поминува)
- Unit tests: поминуваат
- Build: поминува
- E2E: има **flaky auth-guard** тестови (поминуваат на retry)
- Најголем ризик за UX/scale: преголеми vendor chunk-ови во production build

---

## 3) Фази и редослед

### ФАЗА A — Core Stabilization Gate (критично, прво)

| ID | Задача | KPI за pass | Статус |
|---|---|---|---|
| A1 | E2E стабилизација на auth-guard тестови | 3 последователни run-ови без flaky во auth-guard suite | ✅ |
| A2 | Build/Runtime стабилност | 0 compile errors, 0 runtime-crash regression во smoke/e2e | ✅ |
| A3 | Error-system cleanup во legacy сервиси | Намален број raw `throw new Error` патеки во критични services | ✅ |
| A4 | CI reliability baseline | CI pass rate >= 95% на главни проверки | 🟨 in progress |

### ФАЗА B — Performance and Bundle Excellence

| ID | Задача | KPI за pass | Статус |
|---|---|---|---|
| B1 | Vendor split strategy (math/pdf/firebase/xlsx) | Нема chunk > 1.5MB minified | ✅ |
| B2 | Route-based lazy loading за heavy flows | Home/Student initial load побрз (мерено со Lighthouse/TTI) | 🟨 in progress |
| B3 | Perf budget enforcement | Build fail ако надмине договорен budget | ✅ |
| B4 | Lighthouse стабилизација | >=90 за Perf/A11y/Best Practices на PR | ⬜ |

### ФАЗА C — Security and Platform Hardening

| ID | Задача | KPI за pass | Статус |
|---|---|---|---|
| C1 | Prompt/Input sanitization coverage | 100% AI entry points минуваат низ sanitize path | ✅ |
| C2 | Auth/App Check consistency audit | Нема route со недефиниран auth behavior | ✅ |
| C3 | Incident observability | Централизиран error dashboard + top failure taxonomy | ✅ |
| C4 | Backup/restore drill | Верифициран restore runbook | 🟨 in progress |

### ФАЗА D — AI Quality System (World-Class Differentiator)

| ID | Задача | KPI за pass | Статус |
|---|---|---|---|
| D1 | Golden evaluation set за генерација | Минимум 100 канонски cases | ✅ |
| D2 | Автоматска AI евалуација (точност, DoK/Bloom, јазик) | Quality score trend стабилно нагоре | ✅ |
| D3 | Prompt/version governance | Секој major prompt има верзија + changelog + rollback | ✅ |
| D4 | Teacher feedback loop analytics | Видливи reject/edit patterns по material тип | ✅ |

### ФАЗА E — New High-Impact Features (само после A+B)

| ID | Задача | KPI за pass | Статус |
|---|---|---|---|
| E1 | Video Extractor MVP (S16.A) | URL -> preview -> confirm -> save работи стабилно | 🟨 in progress |
| E2 | Recovery Worksheet pipeline (S16.B) | Auto remedial flow со teacher confirm | ⬜ |
| E3 | Intent Router spike | Мерливо намалена латенција/cost по request | ⬜ |
| E4 | Vertex AI controlled spike | 1 production-safe path под feature flag | ⬜ |
| E5 | UX enrichment from reference app | Home + Extract + Teacher tools parity (phase-gated) | 🟨 in progress |

---

## 4) Акционен план — Sprint S16.0 (стартуваме веднаш)

### Цел на спринтот
Да затвориме stabilization gate и да спречиме лажен сигнал „има грешки насекаде“.

### Scope

1. **Auth-guard e2e deflake**
   - Ревизија на `tests/auth-guard.spec.ts`
   - Замена на фиксни `waitForTimeout` со condition-based wait
   - Стабилен selector strategy за login screen

2. **Build performance baseline capture**
   - Документирање на top 10 најголеми chunk-ови
   - Дефинирање target split за `vendor`/`math`/`pdf` bundle делови

3. **Error cleanup kick-off**
   - Миграција на прв сет legacy paths кон structured errors во критични сервиси

### Definition of Done (S16.0)

- Auth-guard suite: без flaky во 3 последователни run-ови
- Build: стабилен, без regressions
- План за chunk split договорен со конкретни target-и
- Прв batch на error-path cleanup доставен

### Прогрес белешка (03.04.2026)

- `tests/auth-guard.spec.ts` дефлакиран: 3 последователни run-ови, 10/10 passed.
- Bundle split подобрен (Vite manualChunks):
  - Largest vendor chunk: `2.70MB -> 1.39MB`.
  - Math chunk split: `vendor-math -> vendor-mathjs + vendor-mathlive`.
  - KPI B1 (`< 1.5MB` per chunk) е постигнат.
- Build е зелен (`EXIT_CODE=0`), со преостанато само warning за `>1000kB` (праг за warning, не build fail).
- A2 gate потврден со цел smoke run: `92/92` E2E passed, `380/380` unit passed, `npx tsc --noEmit` и build се зелени.
- A3 batch 1 завршена: мигрирани критични raw throws во `services/gemini/core.ts`, `services/gemini/svg.ts`, `services/storageService.ts`, `services/shareService.ts`.
- A3 batch 2 завршена: мигрирани remains throws во `hooks/useCurriculum.ts`, `views/AIVisionGraderView.tsx`, `views/CoverageAnalyzerView.tsx`, `views/LessonPlanDetailView.tsx`, `views/TeacherForumView.tsx`. **Сите сервисни слој throws се конвертирани во AppError/AIServiceError.**
- E2E + unit + build **сите зелени** по A3 batch 2.
- **A3 gate затворена, следи A4.**
- A4 инициран: додаден `CI Quality Gate` workflow (`.github/workflows/ci-quality.yml`) со `Typecheck + Unit + Build` како главни проверки за PR/push.
- A4 metric automation: додаден rolling pass-rate summary (последни 20 runs) со праг `>=95%`; workflow fail се активира ако има најмалку 10 runs и pass-rate е под праг.
- Deploy workflow е ограничен на `push` кон `main` за да нема дупли PR build run-ови и непотребен noise во reliability метриката.
- B2 incremental pass: `App.tsx` е оптимизиран со lazy load за глобално-mounted heavy UI (`AIGeneratorPanel`, `AIChatPanel`, `CommandPalette`) преку `safeLazy` + `Suspense`, за да се намали initial bundle pressure.
- Build валидација по B2 pass: успешен production build (`built in 29.28s`), со посебни async chunks за AI panel/module групите и без TypeScript/editor errors во `App.tsx`.
- B3 имплементиран: додаден е `scripts/enforce-perf-budget.mjs` + `npm run perf:budget` + CI чекор во `.github/workflows/ci-quality.yml`.
- B3 локална валидација: сите budget checks се зелени (`JS max 1426.50/1500 kB`, `CSS max 188.70/220 kB`, `total 9658.88/10000 kB`, `third-party 6758.87/7000 kB`).
- B4 локален smoke (LHCI) моментално е блокиран со `NO_FCP` runtime error; gate останува отворен додека не се стабилизира collect target (препорака: стабилна route URL + readiness pattern tweak во `.lighthouserc.json`).
- C1 kick-off: UI call-sites за AI custom prompts се заштитени (`GeneratedIdeas`, `GeneratedAssessment`, `RefineGenerationChat`, `PlannerItemModal`) со `sanitizePromptInput` пред AI повик.
- C1 hardening: во `services/geminiService.real.ts` додаден е service-level sanitize за критични текстуални entry points (`generateIllustration`, `solveSpecificProblemStepByStep`, `diagnoseMisconception`, `explainSpecificStep`, `enhanceText`, `parsePlannerInput`, `askTutor`, `refineMaterialJSON`, плус дел од reflective/test helpers).
- C1 closure pass: директни `callGeminiProxy` патеки во Academy и Quick Tools се усогласени со sanitize flow; compile gate останува зелен (`npx tsc --noEmit`).
- C2 kick-off: усогласен е public route auth gate во `App.tsx` преку централизирана allowlist (`isPublicHashRoute`) и додадени се `#/privacy` + `#/terms` за да нема неочекуван redirect кон login на јавни legal страници.
- C2 audit delta: додадени се `#/share/` и `#/quiz/` во public allowlist за shared линкови (lesson plan/annual plan/quiz) да бидат достапни без најава, без нарушување на protected routes.
- C2 validation: додадени e2e regression тестови во `tests/auth-guard.spec.ts` за public routes (`pricing/privacy/terms/share/quiz`); Playwright run: `16 passed`.
- C3 kick-off: `services/sentryService.ts` е унапреден со централизирани taxonomy tags при `captureException` (`app_error_code`, `app_error_retryable`, `app_error_name`, `error_type`) за подготвено групирање и филтрирање во Sentry dashboard.
- C3 automation delta: додаден е `scripts/sentry-incident-summary.mjs` + `npm run obs:incident-summary`, и нов CI job `Incident Observability Summary (Sentry)` во `.github/workflows/ci-quality.yml` (push/workflow_dispatch) за markdown извештај со top `ErrorCode` и top unresolved issues (graceful skip кога нема Sentry secrets).
- C3 closure delta: додаден taxonomy quality warning за `UNCLASSIFIED` ratio во incident summary (`SENTRY_UNCLASSIFIED_WARN_PCT`, default `30%`) и CI warning annotation без hard-fail, за континуирано подобрување на класификацијата.
- C4 kick-off: додаден е `BACKUP_RESTORE_RUNBOOK.md` со чекор-по-чекор backup verification + restore drill процедура (isolation-first), и `scripts/check-backup-readiness.mjs` + `npm run backup:readiness-check` како CI guardrail во `ci-quality.yml`.
- C4 automation delta: додаден е manual workflow `.github/workflows/firestore-restore-drill.yml` (workflow_dispatch со `source_project_id`, `restore_project_id`, `backup_date`) што стартува `gcloud firestore import` и враќа operation id за audit trail.
- C4 remaining step: потребен е најмалку еден успешен restore drill run на изолиран проект за финална верификација и затворање на C4 gate.
- D2 завршена: `scripts/run-eval.mjs` унапреден со score-history tracking (`eval/score-history.json`, max 100 entries), ASCII trend chart (`--show-trend`), и `--record-history` flag. Додаден е `eval/sample-outputs.json` (11 репрезентативни outputs за локален smoke test), `.github/workflows/ai-eval.yml` (weekly schedule + manual dispatch со `outputs_file`, `filter_tag`, `min_score`, `fail_below` inputs), и `npm run eval:show-trend`. Smoke test: `105 cases evaluated, 9 perfect, history entry recorded`.
- D1 завршена: создаден е `eval/golden-set.json` со **105 канонски evaluation cases** (assessment_question×60, lesson_ideas×15, step_by_step_solution×13, parallel_test×7, rubric×3, annual_plan×2) покривајќи одделенија 5-9, DoK 1-4, Bloom 1-6, и сите главни AI generation типови. Додаден е `scripts/run-eval.mjs` (D1+D2 runner scaffold) + `npm run eval:validate-schema` (CI چекор во `ci-quality.yml`). Schema validation: `105/105 valid cases`.
- D3 завршена: имплементиран е prompt governance систем со верзионирање и drift detection. Додадени се sentinel markers (`@prompt-start/@prompt-end`) за 8 major prompts во `services/gemini/core.ts`, `services/gemini/plans.ts`, `services/gemini/assessment.ts`, `services/gemini/svg.ts`; креирани се `prompts/prompt-registry.json` и `prompts/CHANGELOG.md`; додаден е `scripts/hash-prompts.mjs` со `--check/--update/--list`, npm скрипти (`prompts:check`, `prompts:update`, `prompts:list`) и CI gate чекор `Prompt registry drift check` во `ci-quality.yml`. Финална валидација: `8/8 prompts match registry`.
- D4 delta (kick-off): имплементиран е telemetry loop за teacher feedback patterns. Додадени се `logAIMaterialFeedbackEvent` и `fetchAIMaterialFeedbackSummary` во `firestoreService.materials.ts`, нови типови во `firestoreService.types.ts`, instrumentation на action-и во `GeneratedAssessment.tsx` и `GeneratedIdeas.tsx` (edit/reject/accept), и нов Overview panel во `TeacherAnalyticsView.tsx` што прикажува `edit/reject/accept` pattern-и по material type за последни 30 дена.
- D4 delta (coverage expansion): telemetry е проширен и во `GeneratedPresentation.tsx` (`edit_regenerated`, `reject_visual`, `accept_saved`) и `GeneratedRubric.tsx` (`accept_saved` преку export actions), за поширока видливост на teacher feedback pattern-и надвор од assessment/ideas flow.
- D4 delta (coverage expansion 2): telemetry е додаден и во `GeneratedLearningPaths.tsx` и `GeneratedIllustration.tsx` (export/download/print -> `accept_saved`), и `AIMaterialType` е проширен со `learning_paths` и `illustration` за прецизна сегментација во analytics summary.
- D4 closure validation: извлечен е pure aggregator `buildAIMaterialFeedbackSummaryFromEvents` во `firestoreService.materials.ts` и додадени се unit тестови `services/firestoreService.materials.test.ts` (3/3 зелени) за edit/reject/accept категоризација, sorting и fallback path; compile gate останува зелен (`npx tsc --noEmit`).
- E1 kick-off (MVP scaffold): додаден е нов `MaterialType` — `VIDEO_EXTRACTOR`, со генератор опција во `MaterialsGeneratorView.tsx` и нов UI блок во `MaterialOptions.tsx` за внес на YouTube/Vimeo URL + preview чекор (`fetchVideoPreview` преку oEmbed). Во `useGeneratorActions.ts` е додаден `VIDEO_EXTRACTOR` generate path што гради сценарио од video metadata+URL контекст, а save flow е мапиран преку `useGeneratorSave.ts` како `ideas`. Поддржани helper-и: `utils/videoPreview.ts`. Compile валидација: `npx tsc --noEmit` зелено.
- E1 hardening validation: додадени се unit тестови `utils/videoPreview.test.ts` (8/8 зелени) за YouTube/Vimeo URL normalization, unsupported URL fallback и oEmbed error path. Остаток за финално затворање на E1: runtime smoke (URL -> preview -> generate -> save) во UI flow.
- E1 runtime smoke (diagnostic e2e): додаден е `tests/video-extractor-smoke.spec.ts` со teacher mocks (auth + oEmbed + Gemini response), но flow е нестабилен во automation поради onboarding/tour overlay и генератор runtime состојба што останува во loading под mock env; тестот е оставен како `skip` до стабилизација на overlay/flow hooks.
- E1 deep validation update: потврден е hard deadlock во mocked runtime path (не е само timeout) и по 120s прозорец. Следен чекор за root-cause: trace-led анализа на `generateLessonPlanIdeas` chain + queue/auth/cache calls во isolated e2e harness пред повторно активирање на smoke gate.
- E5 phase-1 (Home enrichment): во `HomeView.tsx` е додаден нов quote/insight блок („Мисла на денот“) и 3 action cards (Video Extractor, Digital Library, Test Generator) со директни CTA рути/акции за побрз влез во core workflows.
- E5 phase-2 (Extraction UX uplift): во `AIVisionGraderView.tsx` додадени се `MD/JSON` export actions за резултат, collapsible „Напредни опции“ (режим на анализа), и појасен workspace flow за работа со OCR резултати.

### E5 path — имплементациски пат за нови елементи според референтните слики

1. Home uplift (hero + value cards)
   - Пренос на „Мисла на денот“ и feature cards како composable блокови во `HomeView` со reuse на постоечки CTA рути.
2. Extraction workspace parity
   - Унифицирана toolbar зона (URL input + model selector + advanced options) и persistent export actions (MD/JSON/PDF/Word) како sticky action row.
3. Teacher toolbox parity
   - Картички за брз пристап кон `assessment`, `quiz`, `presentation`, `flashcards`, `homework`, `study guide` со ист taxonomy како generator material types.
4. Library list ergonomics
   - Filter bar со grade/topic/DoK/difficulty + sort + multi-select + batch export, со ист дизајн јазик како во референтните листи.
5. AI assist per item
   - „Побарај помош од AI Tutor“ action на item-level во library/extraction резултати со context-preserving prompt handoff.
6. Rollout strategy
   - Feature flags по модул (home/extraction/teacher/library), A/B telemetry за adoption и постепено вклучување без regression на тековниот UX.

---

## 5) Governance и правило за приоритети

- Нови функции **не влегуваат** пред завршување на ФАЗА A и B gate.
- Секој нов PR мора да наведе: impact, risk, rollback и тест-стратегија.
- Секој спринт завршува со краток quality report (tests, perf, bugs, incidents).

---

## 6) Очекуван ефект

Ако A+B се изведат дисциплинирано, квалитетот ќе се крене значително:

- Помалку нестабилни тестови и побрз release циклус
- Подобро време на вчитување и помал risk за production падови
- Поцврста основа за S16.A/S16.B и за следен Vertex AI обид без заглавување

---

## 7) Старт команда за тимот

**Започнуваме со S16.0 — Stability Sprint веднаш.**
Прв приоритет: auth-guard deflake + performance baseline + error cleanup batch 1.
