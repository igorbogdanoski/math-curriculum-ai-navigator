# World-Class Platform Execution Plan

> Датум на старт: 05.04.2026
> Статус: ACTIVE
> Production домен: <https://ai.mismath.net>

## 1. Цел

Да ја водиме платформата како production-grade систем од светско ниво:

- јасна администрација и ownership
- строга дисциплина на испорака
- мерливи KPI и evidence log
- стабилност, безбедност и observability пред нов scope

## 2. Не-преговарачки правила

1. Секоја production промена мора да има owner, risk note, rollback note и validation evidence.
2. Ниту еден high-impact rollout не оди broad ако reliability или security gate е црвен.
3. SLO, CI и incident taxonomy се оперативен извор на вистина, не само dashboard за презентација.
4. Документацијата се ажурира во истата работна сесија кога се менува operational behavior.
5. Секој значаен чекор остава audit trail во оваа датотека.

## 3. Тековни приоритети

### W1 — Reliability Operations

- Заклучување на SLO dashboard/backend само за admin.
- Усогласување на SLO прагови со канонските world-class gate-ови.
- Auto-refresh и свежина на operational податоци.
- Production-ready tokens за GitHub и Sentry summary.

### W2 — Matura Platform Excellence

- Мatura data path мора да работи и без Firestore drift.
- Историските тестови 2024/2025 да бидат секогаш видливи во practice/simulation.
- M5/M6 да се реализираат само врз стабилна, мерлива основа.

### W3 — Governance and Evidence

- Секоја затворена задача да има краток evidence запис.
- Секој blocker да има owner и next action.
- EOD report да може да се извезе и користи како официјален ops запис.

### W4 — Curriculum-Matura Integration Foundation

- Матура модулот не смее да остане изолиран од `Истражи програма`, curriculum graph и generator/planner алатките.
- Секоја M5/M6 capability мора да се гради врз стабилен alignment layer, не врз ad-hoc string matching по view-и.
- Врската меѓу матура прашањата и гимназискиот курикулум мора да биде reusable во practice, simulation, analytics и remediation flows.

## 4. Immediate Sprint (Start Now)

### P1 — SLO Hardening

Цел: SLO dashboard да биде реален production-ops модул, не само UI.

Definition of done:

- `/slo` достапен само за `admin`
- `/api/slo-summary` бара валиден Firebase token и `admin` role
- без wildcard CORS
- dashboard auto-refresh на 60s
- cache window усогласен со ops use-case
- праговите усогласени со S16 plan

### P2 — Production Config Readiness

Definition of done:

- поставени `GITHUB_TOKEN`, `GITHUB_REPO`
- поставени `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- поставен `ALLOWED_ORIGIN=https://ai.mismath.net`
- направена smoke проверка на SLO panels

### P3 — Matura Delivery Track

Definition of done:

- practice и simulation прикажуваат локален fallback content кога Firestore недостига
- MATURA docs остануваат канонски усогласени со имплементацијата
- следниот модул за имплементација е M5 analytics

### P4 — Matura-Curriculum Alignment Sprint

Цел: матурата да стане first-class дел од екосистемот на курикулум, цели, активности и алатки.

Definition of done:

- `MaturaQuestion` моделот има стабилни `curriculumRefs`
- постои foundation utility/hook за curriculum alignment со gymnasium track
- alignment логиката е reusable за M5 analytics, practice remediation и simulation results
- не се воведува дуплиран curriculum state или hardcoded coupling меѓу view-и
- секоја промена е validated со `tsc` + build и без регресии во постојните matura flows

## 5. Evidence Log

| Датум | Workstream | Промена | Evidence | Статус |
| --- | --- | --- | --- | --- |
| 2026-04-05 | P1 | Start of SLO hardening program | plan formalized in this document | ACTIVE |
| 2026-04-05 | P2 | Local env audit completed | core app keys present; SLO/GitHub/Sentry ops secrets still require manual setup | ACTIVE |
| 2026-04-05 | P4 | Curriculum-Matura integration formalized | W4/P4 added as gating foundation before full M5 rollout | ACTIVE |
| 2026-04-05 | P4/M5 | Curriculum-Matura Foundation Layer implemented | `MaturaCurriculumRefs` in `types.ts`; `maturaCurriculum.ts` utility; `useMaturaCurriculumAlignment` hook; tsc + build PASS | DONE |
| 2026-04-05 | M5.1 | M5 Analytics View (Phase 1) launched | `useMaturaStats` hook; `MaturaAnalyticsView`; route `/matura-stats`; sidebar entry; simulation → M5 CTA button; tsc + build PASS | DONE |
| 2026-04-05 | M5.2 | M5 Cloud Persistence (Phase 2) implemented | `MaturaStoredResult`; `saveUserMaturaResult()`; `getUserMaturaResults()`; stats hook merges Firestore + localStorage; tsc + build PASS | DONE |
| 2026-04-05 | M5.3 | Recovery Session Loop implemented | `startRecoverySession()` in M5 → sessionStorage prefill → `MaturaPracticeView` auto-init; Recovery banner UI; tsc + build PASS | DONE |
| 2026-04-05 | M5.4 | Improvement Delta Tracking implemented | `ConceptDelta` type; localStorage snapshot on recovery start; `saveConceptProgress` in practice results; `+X% recovery` badge in M5 weak concepts panel; tsc + build PASS | DONE |
| 2026-04-05 | M5.5 | 7-Day Recovery Mission Plan implemented | `MaturaMissionPlan/Day` types + Firestore CRUD in service; `useMaturaMissions` hook; `MissionPanel` component; wired into M5 Analytics + MaturaPractice (completeDay on last question); Sidebar streak badge (🔥N); tsc + build PASS | DONE |

## 5.1 Env Audit Summary

### Веќе присутни локално

- Firebase client config
- reCAPTCHA site key
- Sentry browser DSN
- Google/Firebase admin credential via `GOOGLE_APPLICATION_CREDENTIALS_BASE64`
- Stripe local keys
- Upstash Redis credentials

### Додадени safe defaults

- `ALLOWED_ORIGIN=https://ai.mismath.net`
- `GITHUB_REPO=igorbogdanoski/math-curriculum-ai-navigator`
- `SENTRY_STATS_PERIOD=14d`

### Сѐ уште потребни рачно

- `GITHUB_TOKEN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`

### Опционални, не се blocker за тековниот sprint

- `VITE_FCM_VAPID_KEY`
- `VITE_GEMINI_PUBLIC_KEY`
- `VITE_API_BASE_URL`
- `VITE_DEMO_MODE`

## 5.2 Manual Setup Instructions

### Локално (`.env.local`)

1. Внеси `GITHUB_TOKEN` со read access до GitHub Actions metadata за репото.
2. Внеси `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` за production incident summary.
3. Задржи `ALLOWED_ORIGIN=https://ai.mismath.net`.

### Vercel Production

1. Project Settings -> Environment Variables.
2. Додади ги истите server-side вредности за `Production`.

- `ALLOWED_ORIGIN`
- `FIREBASE_SERVICE_ACCOUNT` или `GOOGLE_APPLICATION_CREDENTIALS_BASE64`
- `GITHUB_TOKEN`
- `GITHUB_REPO`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_STATS_PERIOD=14d`

1. Redeploy после update на env variables.

## 6. Operational Checklist

### Пред merge

1. `npx tsc --noEmit`
2. релевантни unit/e2e тестови
3. `npm run build`
4. update на evidence log ако има operational impact

### Пред production rollout

1. risk note
2. rollback note
3. env readiness check
4. SLO impact check

## 7. Next Execution Order

1. SLO security hardening
2. SLO threshold alignment
3. SLO auto-refresh + freshness
4. production env readiness for observability
5. Matura-curriculum foundation layer
6. Matura M5 analytics implementation
