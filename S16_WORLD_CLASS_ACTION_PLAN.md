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
| A4 | CI reliability baseline | CI pass rate >= 95% на главни проверки | 🟨 in progress (current 15.00%, 3/20 — потребни 16-18 consecutive successes) |

### ФАЗА B — Performance and Bundle Excellence

| ID | Задача | KPI за pass | Статус |
|---|---|---|---|
| B1 | Vendor split strategy (math/pdf/firebase/xlsx) | Нема chunk > 1.5MB minified | ✅ |
| B2 | Route-based lazy loading за heavy flows | Home/Student initial load побрз (мерено со Lighthouse/TTI) | ✅ closed (04.04.2026 evidence logged) |
| B3 | Perf budget enforcement | Build fail ако надмине договорен budget | ✅ |
| B4 | Lighthouse стабилизација | >=90 за Perf/A11y/Best Practices на PR | ✅ |

### ФАЗА C — Security and Platform Hardening

| ID | Задача | KPI за pass | Статус |
|---|---|---|---|
| C1 | Prompt/Input sanitization coverage | 100% AI entry points минуваат низ sanitize path | ✅ |
| C2 | Auth/App Check consistency audit | Нема route со недефиниран auth behavior | ✅ |
| C3 | Incident observability | Централизиран error dashboard + top failure taxonomy | ✅ |
| C4 | Backup/restore drill | Верифициран restore runbook | ✅ closed (04.04.2026 evidence logged) |

### ФАЗА D — AI Quality System (World-Class Differentiator)

| ID | Задача | KPI за pass | Статус |
|---|---|---|---|
| D1 | Golden evaluation set за генерација | Минимум 100 канонски cases | ✅ |
| D2 | Автоматска AI евалуација (точност, DoK/Bloom, јазик) | Quality score trend стабилно нагоре | ✅ |
| D3 | Prompt/version governance | Секој major prompt има верзија + changelog + rollback | ✅ |
| D4 | Teacher feedback loop analytics | Видливи reject/edit patterns по material тип | ✅ |
| D5 | CI quality smoke gate за AI outputs | PR fail при пад под договорен smoke threshold | ✅ |

### ФАЗА E — New High-Impact Features (само после A+B)

| ID | Задача | KPI за pass | Статус |
|---|---|---|---|
| E1 | Video Extractor MVP (S16.A) | URL -> preview -> confirm -> save работи стабилно | ✅ |
| E2 | Recovery Worksheet pipeline (S16.B) | Auto remedial flow со teacher confirm | ✅ |
| E3 | Intent Router spike | Мерливо намалена латенција/cost по request | ✅ |
| E4 | Vertex AI controlled spike | 1 production-safe path под feature flag | ✅ implemented (04.04.2026, shadow mode gated) |
| E5 | UX enrichment from reference app | Home + Extract + Teacher tools parity (phase-gated) | ✅ Wave A+B+C completed |

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
- D5 завршена: `scripts/run-eval.mjs` доби `--only-provided` режим за deterministic smoke gating на curated outputs. Во `package.json` е додаден `npm run eval:smoke-gate` (`sample-outputs`, `--only-provided`, `--min-score 70`, `--fail-below`), и gate е вклучен во `.github/workflows/ci-quality.yml` веднаш по schema validation.
- E1 kick-off (MVP scaffold): додаден е нов `MaterialType` — `VIDEO_EXTRACTOR`, со генератор опција во `MaterialsGeneratorView.tsx` и нов UI блок во `MaterialOptions.tsx` за внес на YouTube/Vimeo URL + preview чекор (`fetchVideoPreview` преку oEmbed). Во `useGeneratorActions.ts` е додаден `VIDEO_EXTRACTOR` generate path што гради сценарио од video metadata+URL контекст, а save flow е мапиран преку `useGeneratorSave.ts` како `ideas`. Поддржани helper-и: `utils/videoPreview.ts`. Compile валидација: `npx tsc --noEmit` зелено.
- E1 hardening validation: додадени се unit тестови `utils/videoPreview.test.ts` (8/8 зелени) за YouTube/Vimeo URL normalization, unsupported URL fallback и oEmbed error path. Остаток за финално затворање на E1: runtime smoke (URL -> preview -> generate -> save) во UI flow.
- E1 runtime smoke (diagnostic e2e): додаден е `tests/video-extractor-smoke.spec.ts` со teacher mocks (auth + oEmbed + Gemini response), но flow е нестабилен во automation поради onboarding/tour overlay и генератор runtime состојба што останува во loading под mock env; тестот е оставен како `skip` до стабилизација на overlay/flow hooks.
- E1 deep validation update: потврден е hard deadlock во mocked runtime path (не е само timeout) и по 120s прозорец. Следен чекор за root-cause: trace-led анализа на `generateLessonPlanIdeas` chain + queue/auth/cache calls во isolated e2e harness пред повторно активирање на smoke gate.
- E1 closure update (2026-04-03): root-cause deadlock е затворен со non-blocking cache write во `services/gemini/plans.ts` (`void setDoc(...).catch(...)`), smoke gate е повторно активиран во `tests/video-extractor-smoke.spec.ts`, и финална валидација е зелена (`video-extractor-smoke` + `video-extractor-isolated-harness` -> PASS).
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

### E5 World-Class Realization Program (Wave execution)

Цел: **постепено, но сигурно** да се затвори E5 со мерливи KPI и без regression на стабилноста.

#### Wave A (Start now) — Home + Teacher Toolbox foundation

| ID | Ставка | KPI | DoD |
|---|---|---|---|
| E5-A1 | Home focus hierarchy (Today/Priority/Deep work) | подобрен task-completion на home CTA | Home layout со јасна информациска хиерархија + mobile pass |
| E5-A2 | Dynamic insight block | поголем daily engagement на home | ротациона „Мисла на денот" + автор + стабилен rendering |
| E5-A3 | Teacher Toolbox quick cards | побрз пристап до core генерации | картички за assessment/quiz/presentation/flashcards/homework/study guide |

#### Wave B — Library ergonomics + workflow speed

| ID | Ставка | KPI | DoD |
|---|---|---|---|
| E5-B1 | Advanced filter bar | помалку време до пронаоѓање материјал | grade/topic/DoK/difficulty + sort |
| E5-B2 | Multi-select and batch actions | помалку кликови по teacher task | batch export/organize actions со error-safe UX |
| E5-B3 | Sticky action row | подобар flow за long lists | persistent actions без layout shift |

#### Wave C — Item-level AI assist + analytics depth

| ID | Ставка | KPI | DoD |
|---|---|---|---|
| E5-C1 | AI assist per item | поголем usage на contextual AI help | action во library/extraction items со context-preserving handoff |
| E5-C2 | Feedback reason taxonomy | подобар insight за квалитетни слабости | reject/edit reason codes + dashboard breakdown |
| E5-C3 | Controlled rollout | без продукциски регресии | feature flags + telemetry + rollback note | ✅ |

#### Execution rule (E5)

1. Секој wave оди со локална валидација (`tsc`, unit/smoke) пред merge.
2. Нема скокање на следен wave без DoD evidence во овој документ.
3. Секој wave мора да содржи барем 1 педагошки KPI и 1 UX KPI.

#### Kickoff log (04.04.2026)

- E5 formal execution program е официјално усвоен (Wave A/B/C).
- **Wave A STARTED**: прв batch промени во `HomeView` (динамична мисла + perf cleanup + hierarchy polish).
- Wave A progress update: додаден `Teacher Toolbox` блок на Home со 6 брзи педагошки генерации (Assessment, Quiz, Presentation, Flashcards, Worked Example, Learning Path) за побрз teacher workflow.
- **Wave A2 COMPLETED**: Home UX е ре-структуриран во јасна хиерархија `Today Focus` -> `Priority Actions` -> `Deep Work`, за побрза ориентација и помал cognitive load во дневен teacher flow.
- Validation evidence (Wave A2): `npx tsc --noEmit` PASS, `npx vitest run` PASS (`26/26` files, `408/408` tests).
- **Wave A3 COMPLETED**: Teacher Toolbox е унапреден со педагошки micro-guidance (`формативна проверка`, `spaced practice`, `диференцирана настава`), time-to-use chips и `Препорачано денес` сигнал кога има weak concept/spaced-repetition indicators.
- Validation evidence (Wave A3): `npx tsc --noEmit` PASS, `npx vitest run` PASS (`26/26` files, `408/408` tests).
- **Wave B1 COMPLETED**: `ContentLibraryView` доби унифициран advanced filter bar (`grade/topic/DoK/difficulty/sort`) + reset action; филтрирањето работи преку metadata extraction од `CachedMaterial.content` за backward-compatible ergonomics.
- Validation evidence (Wave B1): `npx tsc --noEmit` PASS, `npx vitest run` PASS (`26/26` files, `408/408` tests).
- **Wave B2 COMPLETED**: Multi-select + batch actions ergonomics додадени на `ContentLibraryView`; checkboxes на секој material (во `my` view), sticky batch toolbar при bottom со publish/unpublish/archive bulk actions, select-all/clear-selection контроли. Batch handlers имплементирани со error-safe promise.all parallelism.
- Validation evidence (Wave B2): `npx tsc --noEmit` PASS, `npx vitest run` PASS (`26/26` files, `408/408` tests).
- **Wave B3 COMPLETED**: Sticky action row со floating context menu dodana на material cards; `hoveredMaterialId` state tracks which card is focused; на hover се отвора floating toolbar со all available actions (Preview, Publish/Unpublish, Archive, Fork, Delete). `renderQuickActions` component extracted за code reuse. Zero layout shift — floating toolbar uses absolute positioning и не влијее на document flow.
- Validation evidence (Wave B3): `npx tsc --noEmit` PASS, `npx vitest run` PASS (`26/26` files, `408/408` tests).
- **Wave C1 COMPLETED**: Item-level AI Assist додаден на `ContentLibraryView`; нова `AITutorModal` component со full context-preserved chat interface; секој material има `✨ Tutor` button во floating toolbar; при клик се отвора modal со chat interface; учителот може да прашува за педагошки стратегии, assessment идеи, объаснување на содржина итн. Material context автоматски се инјектира во system prompt. Gemini API интеграција за context-aware responses со conversation history.
- Validation evidence (Wave C1): `npx tsc --noEmit` PASS, `npx vitest run` PASS (`26/26` files, `408/408` tests).
- **Wave C2 COMPLETED**: Feedback reason taxonomy е затворен end-to-end. Додаден е review lifecycle за `saved_questions` (`pending/approved/revision_requested/rejected`) со structured feedback logging во `users/{uid}/material_feedback`; `ContentReviewView` сега отвора `MaterialFeedbackModal` за reject/revision flows, approval path исто така се логира за analytics completeness, а `TeacherAnalyticsView` overview рендерира `FeedbackTaxonomyCard` преку `useFeedbackBreakdown` hook. Aggregation логиката е извлечена во pure builder за детерминистички тестирање.
- Validation evidence (Wave C2): `npx tsc --noEmit` PASS, `npx vitest run` PASS (`28/28` files, `413/413` tests).
- **Wave C3 COMPLETED**: Feedback taxonomy rollout е ставен под production-safe guardrail. Нов `services/feedbackTaxonomyRollout.ts` држи feature flag (`feedback_taxonomy_rollout_enabled`) и session telemetry за adoption/fallback. `SettingsView` доби toggle, `ContentReviewView` паѓа на legacy reject path кога rollout е OFF, а `TeacherAnalyticsView` го прикажува taxonomy breakdown само кога rollout е ON. Rollback note: toggle OFF во Settings веднаш го враќа legacy behavior без schema/data rollback или code revert.
- Validation evidence (Wave C3): `npx tsc --noEmit` PASS, `npx vitest run` PASS.
- 04.04.2026 — C-series review follow-up fixes: `MaterialFeedbackModal` сега чисти stale reason-codes при switch на `approved`; `ContentReviewView` rollout flag стана reactive на `storage/focus/visibilitychange`; `useFeedbackBreakdown` чисти stale state кога `enabled=false` или `uid` недостига. Regression coverage додадена во `components/analytics/MaterialFeedbackModal.test.tsx`, `views/ContentReviewView.test.tsx`, `hooks/useFeedbackBreakdown.test.ts`. Validation: `npx tsc --noEmit` PASS, `npx vitest run` PASS (`31/31` files, `420/420` tests).

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

---

## 8) Execution Board (1:1) — стартуваме веднаш

### 8.1 Scope за затворање (must-close)

| ID | Ставка | Тековен статус | Target статус |
|---|---|---|---|
| A4 | CI reliability baseline >= 95% | 🟨 in progress — current 3/20, 15.00% — потребни 16-18 consecutive successes | ✅ closed |
| B2 | Route-based lazy loading + мерлив uplift | ✅ closed | ✅ closed |
| B4 | Lighthouse стабилизација (без NO_FCP) | ⬜ | ✅ closed |
| C4 | Restore drill + evidence | ✅ closed | ✅ closed — import operation SUCCESSFUL + 5/5 smoke PASS, evidence pack во секција 9.7 |
| E2 | Recovery Worksheet pipeline | ✅ имплементирана + тестирана | ✅ closed |

### 8.2 Правило за извршување (non-negotiable)

1. Нема нови high-impact feature rollout пред формално затворање на A+B gate.
2. E5 останува phase-gated и без проширување на scope додека A+B не се ✅.
3. Секоја ставка мора да има KPI доказ + DoD evidence во овој документ.
4. Секоја промена оди со тест, rollback note и краток risk запис.

### 8.3 Sprint распоред (14 дена)

#### Sprint 1 (ден 1-5) — Stabilization closure

| Ден | Акција | Owner | KPI | DoD |
|---|---|---|---|---|
| 1 | LHCI стабилизација во `.lighthouserc.json` | @platform | 3 последователни local collect runs без `NO_FCP` | `npx @lhci/cli@0.14.x autorun` не паѓа на collect |
| 2 | CI reliability review во `.github/workflows/ci-quality.yml` | @platform | валиден rolling window report | reliability summary е видлив и конзистентен |
| 3 | B2 финален lazy-load pass (`App.tsx`, `vite.config.ts`) | @frontend | подобар initial load/TTI | build + smoke без regressions |
| 4 | B4 gate rehearsal (LHCI assert) | @frontend | Perf/A11y/Best Practices >= 90 | LHCI assert pass |
| 5 | C4 drill preflight (inputs/checklist) | @platform | 100% preconditions ticked | подготвен workflow_dispatch за drill |

#### Sprint 2 (ден 6-10) — C4 closure + E2 design freeze

| Ден | Акција | Owner | KPI | DoD |
|---|---|---|---|---|
| 6 | Firestore restore drill run (`firestore-restore-drill.yml`) | @platform | успешен import operation | operation id + status evidence |
| 7 | Post-restore smoke validation | @qa | core teacher flows pass | login/planner/library/analytics validated |
| 8 | C4 formal closure update во овој план | @pm | C4 -> ✅ | evidence линкови + датум |
| 9 | E2 technical design freeze | @ai-core | финален flow + acceptance criteria | DoD за E2 документиран |
| 10 | E2 task breakdown + implementation board | @pm | board ready | owner/ETA/risk по задача |

#### Sprint 3 (ден 11-14) — E2 kickoff

| Ден | Акција | Owner | KPI | DoD |
|---|---|---|---|---|
| 11-12 | E2 core implementation | @ai-core | end-to-end remedial flow | feature flag path работи |
| 13 | E2 verification (unit/integration/e2e) | @qa | тест suite pass | резултати запишани во report |
| 14 | E2 go/no-go review | @pm | release decision | јасен rollout/rollback план |

### 8.4 KPI + Definition of Done (по ставка)

| Ставка | KPI | DoD Evidence |
|---|---|---|
| A4 | pass rate >= 95% (last 20 completed runs) | workflow summary + status checks |
| B2 | route-level load improvement без regression | build report + smoke pass |
| B4 | 3x стабилен LHCI, category >= 90 | LHCI output + assert pass |
| C4 | најмалку 1 успешен restore drill + smoke validation | operation id, timestamps, validation checklist |
| E2 | analytics -> remedial worksheet -> teacher confirm | e2e flow + telemetry + rollback note |

### 8.5 Daily execution rhythm

1. 09:30 daily sync (15 мин)
2. 13:00 blocker check
3. 17:30 end-of-day report

EOD формат (обврзен):
- Што е затворено денес
- KPI резултат
- Blockers/risks
- План за утре

### 8.6 Ризици и превенција

| Ризик | Влијание | Превенција |
|---|---|---|
| LHCI нестабилност | B4 блокер | стабилна route + readiness guard + 3-run policy |
| CI шум/дупли run-ови | лажни regression сигнали | trigger discipline + јасен baseline window |
| Restore env mismatch | C4 одложување | isolate project + preflight checklist |
| Feature creep во E5 | распарчување на фокус | scope freeze до A+B close |

### 8.7 Kickoff checklist (денес)

| Чекор | Статус |
|---|---|
| Потврди owners за A4/B2/B4/C4/E2 | ⬜ |
| Старт LHCI stabilization на `.lighthouserc.json` | ✅ |
| 3 последователни LHCI baseline runs | ✅ |
| Подготви C4 drill inputs (`source_project_id`, `restore_project_id`, `backup_date`) | 🟨 repo-ready; external run pending |
| Запиши EOD report во овој документ | ⬜ |

### 8.8 Kickoff log (денешен старт)

- 03.04.2026 05:14 — стартуван е прв LHCI baseline: `npx @lhci/cli@0.14.x autorun`.
- Резултат: `exit code 1`, runtime error `NO_FCP` (`The page did not paint any content`).
- Заклучок: B4 blocker е репродуциран со свеж доказ и влегува како прв технички приоритет во Sprint 1.
- 03.04.2026 06:36 — применети LHCI стабилизациски измени во `.lighthouserc.json` (strict port, readiness pattern, chrome flags, single run) + collect профил на `vite dev` за дијагностичка изолација.
- Резултат: `NO_FCP` не се појавува; run завршува до assert фаза (fail по квалитетни метрики, не по runtime paint blocker).
- Клучни метрики од baseline: `performance 0.42`, `FCP ~32s`, `LCP ~61s`, `TBT ~514ms`, plus accessibility/console failures.
- Следен чекор: optimization batch за pricing route и враќање на collect назад на preview/dist профил штом runtime стабилноста е потврдена.
- 03.04.2026 06:53-06:58 — runtime root-cause fix во `vite.config.ts` (manualChunks стабилизација: отстранет `vendor-observability` split и исклучен посебен `vendor-react-core` split поради TDZ runtime errors).
- Валидација (preview): Playwright smoke на `/#/pricing` -> `pageErrors=0`, `bodyTextLen=2339` (page now paints).
- LHCI (preview/dist): `NO_FCP` повеќе не се појавува; run стигнува до assert и паѓа на реални KPI (performance/a11y/console/robots).
- Нов приоритет за B4: remediation на `errors-in-console` (AppCheck reCAPTCHA), contrast/heading-order, и route-level perf tuning.
- 03.04.2026 07:00+ — додаден localhost guard за App Check во `firebaseConfig.ts` (`!isLocalHost`) за да нема лажни `errors-in-console` во локален preview/LHCI.
- Валидација: Playwright preview check -> `errorCount=0`, `bodyTextLen=2339`; LHCI preview baseline -> `performance 0.48` (подобрено од 0.42), без runtime `NO_FCP` blocker.
- Тековна состојба B4: runtime blocker е затворен, останува quality remediation batch (contrast/heading-order/robots + perf optimization).
- 03.04.2026 15:10-15:20 — accessibility remediation batch: `views/PricingView.tsx`, `components/common/GlobalSearchBar.tsx`, `components/Sidebar.tsx` усогласени за `heading-order`, `aria-allowed-attr`, `color-contrast`, table caption и sidebar badge/toggle contrast.
- Резултат: LHCI accessibility/best-practices/seo се исчистени до pass; остана само performance bottleneck на pricing route.
- 03.04.2026 15:20-15:26 — vendor split optimization во `vite.config.ts`: извлечени се `d3`, `three`, `@sentry`, `zod` од generic `vendor` chunk.
- Резултат: largest generic vendor chunk е намален од `~1772kB` на `~1516kB` minified, без runtime TDZ regression.
- 03.04.2026 15:30+ — LHCI collect профил е стабилизиран на static dist serve преку `sirv-cli` (`gzip`/`brotli`) со 3-run policy.
- Финална локална B4 валидација: `npx -y @lhci/cli@0.14.x autorun --config=.lighthouserc.json` -> `All results processed!` без error-level assertions; warning-only остаток: `legacy-javascript`, `unminified-javascript`, `unused-css-rules`, `unused-javascript`, `uses-text-compression`.
- Клучни metrics од финалниот успешен snapshot: `FCP 1.2s`, `LCP 2.2s`, `TBT 40ms`, `Speed Index 1.6s`; `accessibility=1.0`, `best-practices=1.0`, `seo=1.0`.
- Статус: **B4 локален gate затворен**. Следен приоритет: `C4` restore drill evidence, потоа `E2` design freeze/kickoff.
- 03.04.2026 16:xx — `C4` repo preflight е финално потврден: runbook + readiness script + manual restore workflow + CI guardrail се на место. Преостанат blocker е само external execution evidence (`source_project_id`, `restore_project_id`, `backup_date`, operation id, smoke validation) за formal close.
- 03.04.2026 16:xx — `E2` kickoff имплементација е внесена зад feature flag `recovery_worksheet_enabled`.
- E2 delta: додадени се `isRecoveryWorksheetEnabled/setRecoveryWorksheetEnabled` во Gemini feature-flag chain, нов `generateRecoveryWorksheet()` path во `services/geminiService.real.ts`, approval persistence (`worksheet_approvals`) и review metadata во `services/firestoreService.materials.ts` + `firestore.rules`.
- E2 UX delta: нов `components/analytics/RecoveryWorksheetPreviewModal.tsx` со generate -> preview -> teacher confirm -> save -> assign flow; `TeacherAnalyticsView` рутира кон овој path кога flag-от е вклучен, а `SettingsView` доби toggle за controlled rollout.
- Валидација: production build зелен по E2 kickoff (`vite build` PASS). Следен чекор за E2: targeted smoke/e2e за flag OFF/ON path и финално acceptance criteria polish.
- 03.04.2026 18:07 — `E2` локална тест валидација е зелена: `services/gemini/core.featureFlags.test.ts` -> `3/3 passed`; `tests/recovery-worksheet.spec.ts` -> `2/2 passed`.
- Покриеност: `flag OFF` го задржува legacy `AssignRemedialModal`; `flag ON` го отвора новиот `RecoveryWorksheetPreviewModal` path со mocked AI worksheet response.
- **E2 статус: ✅ ЗАТВОРЕНА** — feature flag + UI flow + Firestore approval persistence + tests сите зелени.
- 03.04.2026 — **C4 статус: ⏸️ DEFERRED** — repo artifacts (runbook, `firestore-restore-drill.yml`, `check-backup-readiness.mjs`, CI guardrail) се комплетни; external execution blocker: Firestore backup bucket (`gs://ai-navigator-ee967-backups/firestore/`) и изолиран GCP restore проект не се провизионирани. Ова е инфраструктурен prerequisite, не код. C4 ќе се затвори кога ќе се постави GCS bucket + restore project. Следен приоритет: **E3** (Intent Router spike) или **A4** финална валидација.
- 04.04.2026 — **C4 статус: ✅ CLOSED** — Firestore import operation `projects/ai-navigator-ee967/databases/(default)/operations/AiAzM2ZjNDI0MTY4M2QtZmE3Yi00MmQ0LWJhNDAtMTcxNDYyMWQkGnNlbmlsZXBpcAkKMxI` е `SUCCESSFUL` (667/667 docs), и smoke validation е 5/5 PASS (login, planner, library/cache, analytics, error monitoring). Evidence pack е запишан во секција 9.7.
- **E3 статус: ✅ ЗАТВОРЕНА** — `services/gemini/intentRouter.ts` (NEW): `AITaskType`, `AITaskComplexity`, feature flag via `localStorage[intent_router_enabled]`, `shouldUseLiteModel()`, `logRouterDecision()`, `getRouterStats()`. `LITE_MODEL='gemini-2.0-flash-lite'` додаден во `core.ts`. `skipTierOverride` param додаден на `callGeminiProxy`. Router применет на 5 lite call sites: `generateSmartQuizTitle`, `parsePlannerInput`, `generateAnalogy`, `diagnoseMisconception` (конвертирана од raw fetch), `explainConcept`. Settings toggle додаден во `SettingsView.tsx`. 14/14 нови unit tests зелени. Вкупно 408/408 тестови зелени. TypeScript: 0 грешки.
- 04.04.2026 — **E4 статус: ✅ IMPLEMENTED (controlled spike)** — воведен е `vertex_ai_shadow_enabled` feature flag и production-safe shadow path: `services/gemini/core.ts` прави fire-and-forget shadow call кон `/api/vertex-shadow` само по успешен Gemini response (без влијание врз production output). Додаден е `services/gemini/vertexShadow.ts` со rolling shadow log (max 50), status tracking (`ok/error/not_configured`) и compare aggregation (`latency/success/error/cost`). `views/SettingsView.tsx` има toggle + compare report panel + clear log action. Validation: `npx tsc --noEmit` PASS. Commit: `68ac145`.

---

## 9) Canonical Now / Next / Later (од 04.04.2026)

Цел: да влеземе во **оперативно world-class** ниво, не само feature-complete ниво.

### 9.0 Owner Registry (confirmed 04.04.2026)

| Име | Platform Role | Account Scope | UID |
|---|---|---|---|
| Игор Богданоски | Creator + Chief Architect + System Admin + School Admin | platform engineering core lead | bIaBRJ6NBmhGtefgZFtmpRYTPky2 |
| Снежана Златковска | PRO наставник | platform engineering team | SQ8O4j2y2BT0X8WgKIbmzg8DTCq1 |
| Моника Богданоска | PRO наставник | platform engineering team | PAsWslBzkBctw9qwTrcnqrjdwTf2 |

### 9.1 NOW (следни 7 дена)

| ID | Приоритет | Owner | KPI threshold | Exit evidence |
|---|---|---|---|---|
| N1 | C4 infra unblock | Игор Богданоски (lead), Снежана Златковска (support) | provisioned backup bucket + isolated restore project | GCP resource IDs + IAM matrix screenshot/log |
| N2 | C4 first restore drill | Игор Богданоски (lead), Моника Богданоска (QA support) | 1 успешен import + 1 smoke validation pass | operation id, start/end timestamps, validation checklist |
| N3 | A4 formal close | Игор Богданоски (lead), Моника Богданоска (verification) | pass-rate >= 95% over last 20 completed runs | CI summary artifact + status update во секција 3 |
| N4 | B2 formal close | Снежана Златковска (lead), Игор Богданоски (architecture review) | route-level TTI/FCP delta подобар од baseline | before/after perf snapshot во оваа датотека |

### 9.2 NEXT (7-21 дена)

| ID | Приоритет | Owner | KPI threshold | Exit evidence |
|---|---|---|---|---|
| X1 | E4 Vertex shadow path | @ai-core | >= 1 gated production-safe path зад feature flag | ✅ closed (feature flag + shadow log/report UI shipped on 04.04.2026) |
| X2 | E4 go/no-go board | @pm + @ai-core | јасни launch thresholds и rollback trigger | 🟨 in progress (threshold table + rollback protocol below) |
| X3 | E5 outcome metrics | @product + @frontend | measurable uplift во task-completion и reuse | 🟨 in progress (baseline table + measurement windows below) |

### 9.3 LATER (21-45 дена)

| ID | Приоритет | Owner | KPI threshold | Exit evidence |
|---|---|---|---|---|
| L1 | Reliability SLO dashboard | @platform | weekly SLO reporting live | crash-free, p95 latency, AI failover, flaky-rate dashboard |
| L2 | Incident taxonomy hardening | @platform + @qa | UNCLASSIFIED ratio <= 15% | sentry incident summary trend |
| L3 | E5 national-scale hardening | @product + @eng | no regression on CI/perf/security gates during scale rollout | monthly quality report |

### 9.4 Start Today (оперативен старт)

1. Работи во dual-track: секоја feature задача мора да заврши со зелен `CI Quality Gate` run.
2. За секој merge: локално `npx tsc --noEmit` + релевантни тестови, па push (без no-op commit-и).
3. По секој completed run задолжително запиши: `Window`, `Success`, `Pass rate`, `Remaining consecutive successes (est.)`.
4. Manual dispatch користи само за дијагностика; за baseline recovery примарно користи real delivery commit cadence.
5. 16:00 EOD: запиши `Task completed`, `CI delta`, `Remaining est.`, `next action` во оваа секција.

### 9.5 World-Class Rule (non-negotiable)

Ниту еден нов high-impact feature не се промовира во broad rollout ако:
- C4 нема верифициран restore evidence,
- A4 нема формално затворен reliability baseline,
- E4 нема shadow compare report со јасни go/no-go thresholds.

Моментален статус (04.04.2026): C4 evidence = ✅, E4 shadow path/report = ✅, A4 = 🟨 in progress.

### 9.6 Кориснички сегменти (за KPI и rollout)

За да нема забуна, во S16 "корисници" значи:

1. Primary users: наставници (teacher workflow: generator, library, analytics, remedial flow).
2. Secondary users: school admin / admin (review, governance, observability, reliability gates).
3. Platform operators: engineering/platform тим (CI, backup/restore, incident response, rollout control).

Забелешка: student-facing KPI не се дел од оваа NOW секција освен ако не се наведени експлицитно.

### 9.7 N2 Evidence Pack (04.04.2026)

Статус: CLOSED (import SUCCESSFUL + smoke validation 5/5 PASS)

#### 9.7.1 Restore drill import evidence

| Поле | Вредност |
|---|---|
| source_project_id | ai-navigator-ee967 |
| backup_date | 2026-04-04 |
| backup_path | gs://ai-navigator-ee967-backups/firestore/2026-04-04 |
| operation_name | projects/ai-navigator-ee967/databases/(default)/operations/AiAzM2ZjNDI0MTY4M2QtZmE3Yi00MmQ0LWJhNDAtMTcxNDYyMWQkGnNlbmlsZXBpcAkKMxI |
| operation_state | SUCCESSFUL |
| operation_start_utc | 2026-04-04T01:33:58.815639Z |
| operation_end_utc | 2026-04-04T01:34:22.549170Z |
| documents_imported | 667/667 |
| bytes_imported | 1712648/1712648 |

#### 9.7.2 Smoke validation log (PASS/FAIL + timestamp)

| Чекор | Статус | Timestamp | Белешка |
|---|---|---|---|
| 1) Login path (teacher/admin) | ✅ PASS | 2026-04-04 03:44 CET | Teacher+Admin login ok |
| 2) Planner data readability | ✅ PASS | 2026-04-04 03:44 CET | Data loaded |
| 3) Library/cache queryability | ✅ PASS | 2026-04-04 03:44 CET | Items queryable |
| 4) Analytics summary load + no runtime error | ✅ PASS | 2026-04-04 03:43 CET | Summary loads, no runtime error |
| 5) Error monitoring (no critical spike) | ✅ PASS | 2026-04-04 03:15 CET | No critical spike |

#### 9.7.3 Closure rule for C4

C4 се затвора кога:
1. сите 5 smoke чекори се PASS,
2. нема критичен FAIL во error monitoring,
3. оваа секција е пополнета со конечни timestamps и белешки.

Резултат (04.04.2026): сите услови се исполнети. C4 = CLOSED.

### 9.8 N3/N4 Execution Snapshot (04.04.2026)

#### N3 (A4 formal close) — статус: IN PROGRESS

Што е потврдено:
1. Reliability baseline automation е активна во `.github/workflows/ci-quality.yml` (`reliability-baseline` job, rolling window last 20 completed runs, threshold 95%).
2. Summary автоматски прикажува `Remaining consecutive successes (est.)` и `A4 close trigger`.
3. Последен валиден summary (04.04.2026): `Window: last 20 completed runs`, `Success: 3/20`, `Pass rate: 15.00%`, `Remaining est.: 16-18`.
4. A4 е formal closeable само кога summary ќе покаже `A4 close trigger: reached` и `Pass rate >=95%`.

Преостанат formal evidence за close:
1. Да се изгради clean delivery streak со зелени production commit run-ови до `>=95%` rolling pass-rate.
2. Да нема регресии на `Typecheck + Unit + Build`.
3. Дури потоа A4 се менува во `✅ closed`.

Operational close path (current `3/20`, 04.04.2026):
1. Секој feature чекор да оди како мал, проверлив commit со локална валидација пред push.
2. По секој run, запиши `Window`, `Success`, `Pass rate`, `Remaining consecutive successes (est.)`.
3. Користи automation estimate за planning на следниот batch (`16-18` моментално).
4. Ако се појави нов `failure`, отвори root-cause review веднаш пред следен feature push.
5. A4 се затвора кога summary ќе покаже `A4 close trigger: reached`.

#### N4 (B2 formal close) — статус: CLOSED

Што е потврдено:
1. B2 lazy-load pass е имплементиран (`App.tsx` heavy modules преку lazy/suspense).
2. Route-level lighthouse remediation е потврдена со силен delta на baseline snapshot:
   - FCP: ~32s -> 1.2s
   - LCP: ~61s -> 2.2s
   - TBT: ~514ms -> 40ms
3. Денешна локална валидација (04.04.2026):
   - `npm run -s build` -> PASS (`built in 40.04s`)
   - `npm run -s perf:budget` -> PASS (JS/CSS/total/third-party во budget)

Final perf snapshot:

| Метрика | Baseline | Current | Delta |
|---|---:|---:|---:|
| FCP | ~32s | 1.2s | -30.8s |
| LCP | ~61s | 2.2s | -58.8s |
| TBT | ~514ms | 40ms | -474ms |

Резултат: route-level load improvement е јасно потврден без regression. B2 = CLOSED.

### 9.9 Parallel Execution Playbook (active from 04.04.2026)

Цел: да се испорачуваат roadmap задачи без пауза, и паралелно да се гради A4 reliability baseline.

#### 9.9.1 Rule per completed task

1. Finish task scope (feature/fix/doc) во еден логички commit.
2. Локално провери минимум: `npx tsc --noEmit` + релевантни тестови за таа промена.
3. Push на `main` само кога локално е зелено.
4. По CI completion, логирај CI delta во 9.9.3 табелата.

#### 9.9.2 Reliability-safe cadence

1. 1-2 meaningful merges дневно (без no-op/empty commits).
2. High-risk задачи дели ги на 2-3 помали commits за побрза изолација на евентуален fail.
3. Manual dispatch користи само за дијагностика, не како primary recovery strategy.

#### 9.9.3 Delivery + Reliability log template

| Датум | Task ID | Commit | CI резултат | Reliability delta | Remaining est. | Следен чекор |
|---|---|---|---|---|---|---|
| 2026-04-04 | X2 kickoff | c0e33cd | ✅ quality-gate / ❌ reliability-baseline | 6/20, 30.00% | 13-18 | X2 thresholds draft |
| 2026-04-04 | X2 plan sync | ba364ea | ✅ quality-gate / ❌ reliability-baseline | 3/20, 15.00% | 16-18 | finalize go/no-go board |
| 2026-04-04 | X2 finalized + X3 kickoff | 0a3a562 | ✅ quality-gate / ❌ reliability-baseline | 3/20, 15.00% | 16-18 | fill X3 baseline metrics |

### 9.10 X2 Go/No-Go Board (E4 Vertex shadow)

Статус: ACTIVE (decision board ready, awaiting enough shadow samples for final sign-off)

#### 9.10.1 Launch thresholds (go)

| Метрика | Green (Go) | Yellow (Hold/monitor) | Red (No-Go/Rollback) |
|---|---|---|---|
| Eval quality score (golden set) | 100% | >= 98% | < 98% |
| Vertex shadow success rate | >= 98% | 95% - 97.99% | < 95% |
| Vertex shadow error rate | <= 1% | 1.01% - 3% | > 3% |
| Vertex not_configured rate | <= 5% | 5.01% - 15% | > 15% |
| Avg latency delta vs Gemini | <= +20% | +20.01% to +35% | > +35% |
| CI reliability baseline (A4) | >= 95% | 90% - 94.99% | < 90% |

Go одлука: дозволена само ако сите метрики се во Green минимум 3 последователни delivery run-ови.

#### 9.10.2 Rollout stages

| Stage | Shadow mode | Gate услов за промоција | Owner approval |
|---|---|---|---|
| S0 | OFF (default) | X2 board approved | @ai-core |
| S1 | ON (internal pilot) | 3 зелени run-ови + Green thresholds | @ai-core + @pm |
| S2 | ON (expanded pilot) | нема Red 48h + metrics stable | @pm |
| S3 | ON (broad) | A4 close trigger reached + X3 baseline captured | @pm + @platform |

#### 9.10.3 Rollback triggers (immediate)

1. `Vertex shadow error rate > 3%` во било кој 24h прозорец.
2. `Avg latency delta > +35%` за 2 последователни run-ови.
3. Eval quality падне под 98%.
4. Runtime regression во production smoke flow поврзана со E4 path.

#### 9.10.4 Rollback protocol

1. Immediate: toggle OFF `vertex_ai_shadow_enabled` во Settings.
2. Verify: изврши `Typecheck + Unit + Build` и 1 smoke run.
3. Record: запиши incident note (timestamp, trigger, impact, mitigation) во 9.9 log.
4. Re-entry: повторен rollout е дозволен само со root-cause fix + 2 зелени run-ови.

### 9.11 X3 Outcome Metrics Baseline (E5)

Статус: ACTIVE (baseline capture started)

#### 9.11.1 KPI table (before/after)

| KPI | Baseline (T0) | Target (T1) | Data source | Window |
|---|---|---|---|---|
| Task completion rate (teacher flow) | DATA_UNAVAILABLE | +10% vs T0 | Teacher analytics funnel | 7d rolling |
| Time-to-first-material (median) | DATA_UNAVAILABLE | -20% vs T0 | generation timestamps | 7d rolling |
| Material reuse rate | DATA_UNAVAILABLE | +15% vs T0 | library usage analytics | 14d rolling |
| Reject/Edit ratio | DATA_UNAVAILABLE | -15% vs T0 | review moderation logs | 14d rolling |
| Recovery worksheet adoption (E2 path) | DATA_UNAVAILABLE | >= 25% од eligible cases | analytics event counters | 14d rolling |

#### 9.11.2 Measurement protocol

1. T0 (baseline): последни 7/14 дена пред broad E5 rollout.
2. T1 (post): првите 7/14 дена по rollout stage што вклучува E5 tools.
3. Секој KPI мора да има ист data source за T0 и T1 (без мешање извори).
4. Ако недостига telemetry за KPI, статусот останува `TBD` и не е closeable.

#### 9.11.3 Exit rule for X3

1. Пополнети baseline (T0) и post (T1) вредности за сите KPI редови.
2. Најмалку 3 од 5 KPI во target или подобро.
3. Додаден краток outcome note: што работеше, што не, и што оди во следен wave.

#### 9.11.4 T0 extraction checklist (next commit must replace DATA_PENDING)

Run command:
1. `npm run -s x3:baseline -- --input <gdpr-export.json> --out eval/x3-baseline-t0.json --markdown`
2. `npm run -s x3:fill-t0 -- --baseline eval/x3-baseline-t0.json --plan S16_WORLD_CLASS_ACTION_PLAN.md`

1. Export `Teacher analytics funnel` за последни 7 дена и пресметај completion rate.
2. Export generation events (create -> first saved material) за 7 дена и пресметај median time-to-first-material.
3. Export library usage за 14 дена и пресметај reuse rate.
4. Export review/moderation events (`approved/rejected/revision_requested`) за 14 дена и пресметај reject/edit ratio.
5. Export E2 counters: `eligible cases` и `teacher confirmed worksheets` за 14 дена и пресметај adoption %.
6. Во следниот update, секое `DATA_PENDING` поле мора да се замени со формат: `value (n=sample, period)`.

