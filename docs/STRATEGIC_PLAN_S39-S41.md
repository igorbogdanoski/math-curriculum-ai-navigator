# Стратегиски план S39 – S41

> **Состав:** 22.04.2026
> **Контекст:** ~200 регистрирани корисници, 4 имаат искористено сите 50 почетни кредити (credit-burn ≈ 2 %).
> **Статус на платформа:** S37 + S38 + SEC + S19-P2f завршени; TSC 0; 1009 / 1009 тестови.
> **Цел на овие 3 sprintа:** Прелаз од *production-ready код* кон *production-ready бизнис* + подготовка за разгледување од МОН.

---

## Sprint S39 — Activation & Funnel (3 – 5 дена)

### Зошто прв
2 % credit-burn значи дека продуктот функционира, но **не доставува вредност доволно брзо**. Без funnel-податоци, оптимизацијата е слепа.

### Содржина

| ID | Задача | Опис | Проценка |
|---|---|---|---|
| **S39-F1** | Telemetry SDK | PostHog (cloud, EU регион) — Vite plugin + `services/telemetryService.ts` | 0.5 ден |
| **S39-F2** | Event taxonomy | Фиксна листа: `signup_completed`, `first_quiz_generated`, `first_lesson_saved`, `first_extraction_run`, `credit_consumed`, `quota_warning_seen`, `feature_open_<name>`. Секој event со `userRole`, `gradeLevel`, `sessionN` | 0.5 ден |
| **S39-F3** | Onboarding wizard | 4-чекорен wizard за наставник (одделение → стил → прв квиз ≤ 60 сек → save) и 3-чекорен за ученик (одделение → ниво → прв тренинг) | 1.5 ден |
| **S39-F4** | Quota meter во header | Реално-временски broj на преостанати кредити; на ≤ 10 → `quota_warning_seen` event + CTA "Зголеми лимит" / "Отклучи" | 0.5 ден |
| **S39-F5** | DAU / WAU / MAU dashboard | Internal `views/SystemAdminView.tsx` proširi со cohort retention; читам директно од PostHog API | 1 ден |
| **S39-F6** | Activation kill-switch test | A/B: половина нови корисници добиваат wizard, половина не → мерење `first_quiz_generated` time-to-value | 0.5 ден |

### Излезни критериуми
- [ ] PostHog ивентите фундираат секој клучен step во funnel-от
- [ ] Time-to-first-quiz median < 90 секунди
- [ ] Quota warning се појавува при ≤ 10 кредити со конверзивен CTA
- [ ] Dashboard покажува дневен retention curve
- [ ] +5 unit тестови за `services/telemetryService.ts`

### Sentry / Sentry-related
- Sample rate за PostHog: 100 % за role=teacher, 50 % за student
- `process.env.NEXT_PUBLIC_POSTHOG_KEY` в Vercel env (со vercel:env:push скрипта)

---

## Sprint S40 — Mega-view split + Mobile audit (5 – 7 дена)

### Зошто
6 view-фајлови > 30 KB го блокираат hot-reload, bundle splitting и regression-safe измени. Mobile UX не е верификуван.

### Содржина

| ID | Задача | Опис | Проценка |
|---|---|---|---|
| **S40-A1** | `MaterialsGeneratorView` split (76 KB) | Издвој 3 модула: `MaterialsGeneratorContextForm.tsx`, `MaterialsGeneratorOptionsPanel.tsx`, `MaterialsGeneratorResultsPanel.tsx` + `materialsGeneratorHelpers.ts` за pure logic | 2 дена |
| **S40-A2** | `useGeneratorActions` split (41 KB) | Раздели на `useQuizGeneration`, `useLessonGeneration`, `useExtractionGeneration`. Постоечки hook како thin facade за back-compat | 1.5 ден |
| **S40-A3** | `LessonPlanEditorView` split (45 KB) | Издвој `LessonPlanPhasesEditor.tsx`, `LessonPlanResourcePicker.tsx` + helpers | 1 ден |
| **S40-M1** | Web Vitals device split | `api/web-vitals.ts` веќе пишува до Firestore — додај `device.type` (mobile/tablet/desktop) + `views/SLODashboardView` график по device | 0.5 ден |
| **S40-M2** | Mobile responsive audit | Playwright spec за 3 viewports (375×812 iPhone, 768×1024 iPad, 1440×900 desktop) на 5 критични flow | 1 ден |
| **S40-M3** | Lazy-load на heavy modules | `React.lazy()` за `DataVizStudio`, `Shape3DViewer`, `Gamma*` (тргни од initial bundle) | 1 ден |

### Излезни критериуми
- [ ] Ниту еден view > 30 KB
- [ ] Initial JS bundle < 350 KB gzipped (моментално ~ 480 KB)
- [ ] LCP на мобилно ≤ 2.5 s (P75)
- [ ] +20 нови тестови за издвоените helpers
- [ ] TSC 0 одржан

---

## Sprint S41 — MON-readiness (3 – 5 дена)

### Зошто
МОН-разгледувањето бара демо-окружување, документација за лични податоци и operational evidence (uptime, SLO).

### Содржина

| ID | Задача | Опис | Проценка |
|---|---|---|---|
| **S41-D1** | Demo seed script | `scripts/seed-mon-demo.mjs` — креира teacher@mon-demo, student1-12@mon-demo, 3 годишни планови, 8 квизови (DoK 1–4), 12 ученички профили со историја, 5 forum threads | 1 ден |
| **S41-D2** | Demo onboarding shortcut | URL `?demo=mon` префрла во read-only mode, скриен debug toolbar, бан на креирање нови налози | 0.5 ден |
| **S41-D3** | 5-min видео-туторијал | OBS recording: Login → AnnualPlan → Lesson → Material → Matura → Analytics; качен на YouTube unlisted; embed во `MON_USER_GUIDE_MK.md` | 1 ден |
| **S41-D4** | PIA документ | `docs/MON_PRIVACY_IMPACT_ASSESSMENT.md` — кои лични податоци се собираат, основ на обработка, рок на чување, права на субјект, EU регион доказ | 0.5 ден |
| **S41-D5** | Public status page | UptimeRobot или BetterStack за `/api/health` ping секоја минута; javen URL (`status.ai.mismath.net`) | 0.5 ден |
| **S41-D6** | OCR cyrillic golden set | `eval/ocr-mk-golden.json` — 50 слики (печатен + ракописен) од македонски ученици/учебници со ground-truth LaTeX; CI gate `npm run eval:ocr-recall` (min 80 %) | 1 ден |
| **S41-D7** | МОН презентациски пакет | ZIP со: линк до production, демо credentials, MON_USER_GUIDE_MK.md, видео-линк, PIA, status page URL | 0.5 ден |

### Излезни критериуми
- [ ] Demo налог функционира со seed-податоци
- [ ] Видео-туторијал јавно достапен
- [ ] PIA документ потпишан
- [ ] Status page јавен
- [ ] OCR golden set ги задоволува 80 %+ recall
- [ ] Презентациски пакет испратен на МОН (надвор од scope-от на оваа task)

---

## Cross-sprint метрики (да се следат секој ден)

| Метрика | Baseline (22.04.2026) | Цел кон крај на S41 |
|---|---|---|
| TSC грешки | 0 | 0 |
| Тестови | 1009 / 1009 (80 фајлови) | ≥ 1100 |
| `as any` / `@ts-ignore` | 0 / 0 | 0 / 0 |
| Initial JS bundle (gzip) | ~ 480 KB | ≤ 350 KB |
| Largest view | 76 KB | ≤ 30 KB |
| `useGeneratorActions` LOC | ~ 1100 | ≤ 400 на врвен фајл |
| Time-to-first-quiz (median) | непознато | < 90 s |
| Credit-burn (од 200) | 2 % | ≥ 8 % |
| WAU / Registered | непознато | измерено |
| Sentry release tagging | да | да |
| AI eval gate | min 70 | min 75 (на крај на S41) |

---

## Ризици и митигации

| Ризик | Веројатност | Удар | Митигација |
|---|---|---|---|
| PostHog quota exceed | Низок | Среден | Sample rate per-role, batch-flush |
| Mega-view split вовед на регресија | Среден | Висок | Feature-flag на split, paralelni testови, постепена миграција |
| OCR golden set го фали 80% gate | Среден | Низок | Pad со повеќе jasni primeri, ослабнување на праг до 70% во прв пас |
| MON бара локален хостинг (не EU) | Низок | Многу висок | Подготови fallback план за Hetzner Skopje или DigitalOcean Frankfurt |
| Mobile audit открива critical issues | Висок | Среден | Buffer ден на крај на S40 за hot-fixes |

---

## Принципи на изведба

1. **Не break-нувај** — секој split има back-compat thin facade.
2. **Test-first** за нови helpers; pure functions се секогаш `__tests__/*.test.ts`.
3. **TSC 0 + lint clean** на секој commit; husky pre-commit го обезбедува тоа.
4. **Conventional commits** во форма `feat-s39-<id>`, `fix-s40-<id>`, `chore-s41-<id>`.
5. **Roadmap evidence log** ажуриран по секоја завршена задача (`STRATEGIC_ROADMAP.md`).
6. **Vercel auto-deploy** на push до `main` → `ai.mismath.net` достапна во < 3 мин.

---

## Прв чекор (S39-F1) — спремен за старт

**Pre-condition:** PostHog account + project created (free tier до 1M events/месец).

**Чекори:**
1. `npm i posthog-js`
2. `services/telemetryService.ts` — wrapper со на-time disable во dev mode
3. `index.tsx` — early init после Sentry
4. `vercel.json` или env-push: `VITE_POSTHOG_KEY=...`, `VITE_POSTHOG_HOST=https://eu.posthog.com`
5. Smoke event од `LoginView` после успешна авторизација

**Acceptance:** PostHog dashboard покажува `signup_completed` event со `userRole` property.
