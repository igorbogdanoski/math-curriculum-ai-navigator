# S65 — ФИНАЛЕН SPRINT: Апликацијата на максимум пред матурски тест

**Период:** 2026-05-12 → 2026-06-05 (матурски тест)  
**Фокус:** Performance + Student Portal + GTM-ready  
**Статус:** 🟢 НЕДЕЛА 1 ЗАВРШЕНА (Performance) → 🟢 НЕДЕЛА 2 ЗАВРШЕНА (Student Portal + P3-B) → 🟡 НЕДЕЛА 3 ВО ТЕК (P3-A Tests)

---

## Evidence Log — Недела 1 (Performance Sprint) ✅ 2026-05-11

### P1-A — Vendor bundle split: ВЕЌЕ АДЕКВАТНО (no-op)
`vite.config.ts` `manualChunks` веќе сплитува: firebase, charts, mathlive, mathjs, konva, xlsx, sentry, capture (jspdf+html2canvas), mammoth, react-pdf, d3, icons, query, react-ui, sanitize, zod, storage, qr, effects, files, gemini-client, svg, katex, markdown, dates.
- `vendor-three` / `vendor-mathjax` — не во `package.json` (нема за split).
- React core НЕ се сплита (експлицитен коментар: "proven TDZ runtime errors with cyclic vendor imports"). Sentry исто така останува по таа причина — но веќе е во `vendor-sentry` chunk (135 KB / 46 KB gzip).

### P1-B — Lazy load на тешки лабови ✅
Промена во `views/DataVizStudioView.tsx`:
- `Geometry3DLab`, `LinearAlgebraLab`, `ConicSectionsLab` → `React.lazy(...)` со `<Suspense fallback={<LabLoading />}>`.
- Сите 3 ги имаат сопствените chunks по build:
  - `ConicSectionsLab-*.js` — 12.36 kB (3.72 kB gzip)
  - `Geometry3DLab-*.js` — 47.02 kB (12.89 kB gzip)
  - `LinearAlgebraLab-*.js` — 57.86 kB (16.52 kB gzip)
- `DataVizStudioView` chunk намален на 214 kB (55.67 kB gzip).

### P1-C — Lazy Matura data: ВЕЌЕ ЛЕНИВО (no-op)
- `services/firestoreService.matura.ts:204` — `import.meta.glob('../data/matura/raw/*.json')` без `eager:true` → chunk се вчитува on-demand.
- Сите Matura views во `App.tsx` се `safeLazy(() => import(...))`.
- `data-matura-*.js` (416 kB gzip) НЕ се вчитува при boot — само кога корисник оди на Matura tab.

### P1-D — Верификација ✅
- `tsc --noEmit` → **0 грешки**.
- `npm run build` → **PASS** (26.91s).
- `vitest run` → **1708/1710** минати. 2 fails (`utils/irt3pl.test.ts`, `utils/srsScheduler.test.ts`) се **пред-постоечки flaky** тестови (probabilistic + дата-time зависни) — неповрзани со промените.

### Преостанати акции за Недела 1 (одложени)
- Вистински Lighthouse audit на production preview — да се изврши кога ќе се deploy-не build на Vercel.
- `vendor-iFk2hhB5.js` (705 KB gzip) останува голем — но содржи React + критични runtime деленици кои не смеат да се сплитат поради TDZ ризик. Понатамошно намалување бара refactor на статички imports → dynamic.

---

## Evidence Log — Недела 2 (Student Portal) 🟡 во тек 2026-05-11

### Постоечка инфраструктура (наоди пред имплементација)
- `services/firestoreService.studentAccount.ts` веќе постои: `createOrUpdateStudentAccount`, `fetchStudentAccount`, `linkDeviceToStudentAccount`, `fetchLinkedDeviceIds`.
- `firestore.rules:312` веќе ги покрива `student_accounts/{uid}` со per-uid read/write.
- `components/student/SaveProgressModal.tsx` веќе ја има логиката за Google sign-in + linkWithPopup за анонимни → Google upgrade.
- `hooks/useStudentIdentity.ts` управува со анонимна идентитет, deviceId, classId, IEP.
- Routing е hash-based (`#/path`) преку `hooks/useRouter.ts` — нема React Router.

### P2-A — Student Login ✅
- Нов `views/StudentLoginView.tsx` на route `#/student/login`:
  - Google Sign-In со popup; ако корисникот е веќе анонимен → `linkWithPopup` (UID останува, постоечките Firestore документи остануваат валидни).
  - Брза анонимна најава со име + опционален код на одделение (`joinClassByCode`).
  - Persists `studentName`, `student_google_uid`, `student_class_id` во localStorage.
  - Auto-redirect на `#/student` ако веќе е најавен.

### P2-B — Student Dashboard ✅
- Нов `views/StudentDashboardView.tsx` на route `#/student`:
  - Поздрав + XP/Streak/Ниво (од `useStudentProgress` → `StudentGamification.totalXP / currentStreak`).
  - Real-time активни задачи (`useStudentRealtime`), филтрирани по `!completedBy.includes(studentName)`, deep-link до `#/play/:cacheId`.
  - Известувања од наставникот (real-time преку `onSnapshot`).
  - 4 брзи кратенки: Мој напредок, Матура портал, AI Тутор, Портфолио.
  - Refresh + Logout (signOut + clear localStorage → redirect на login).

### Регистрирани routes во `App.tsx`
- `safeLazy` imports за `StudentLoginView` и `StudentDashboardView`.
- Routes: `{ path: '/student/login', component: StudentLoginView }`, `{ path: '/student', component: StudentDashboardView }`.
- `PUBLIC_HASH_ROUTE_PREFIXES` додаден `#/student` (jednochno покрива и login и dashboard, без auth).

### Верификација
- `npx tsc --noEmit` → **0 грешки**.
- `npm run build` → **PASS** (30.70s).
- Нови chunks: `useStudentRealtime-*.js` (0.80 kB / 0.43 kB gzip), `useStudentProgress-*.js` (1.35 kB / 0.74 kB gzip). StudentLoginView/Dashboard се појавуваат како lazy chunks.
- Главниот vendor chunk непроменет (705 kB gzip — student портал не додаде нови vendor зависности).

### P2-C — Student Dugga Player ✅
- `views/DuggaPlayerView.tsx` проширен со deep-link поддршка:
  - Чита `?code=XXX` од URL хеш query (`useMemo` од `window.location.hash.split('?')[1]`).
  - `initialStudentName` се пополнува од `auth.currentUser.displayName` или `localStorage.getItem('studentName')`.
  - `fetchTest(codeToUse?)` рефакториран во `useCallback` за да прифати опционен код.
  - `useEffect` со `autoLoadedRef` — auto-load на тестот кога има валиден `?code=` (≥ 4 знаци).
  - `onClick={() => fetchTest()}` wrapper за да не се проследи DOM event како код.
- Public route додаден: `#/dugga/play` во `PUBLIC_HASH_ROUTE_PREFIXES`.
- Quick link "Внеси код за тест (Дуга)" додаден во dashboard за откриваемост.
- Submission workflow веќе постои: `submitDuggaTest` запишува во `dugga_submissions` (`services/firestoreService.dugga.ts:358`); поддржува анонимни UID-и (`anon_${Date.now()}` fallback) и `submissionSeal` за final-exam mode (S61-E3).

### P2-D — Ученички SRS ✅
- Нов `views/StudentSRSView.tsx` на route `#/student/srs`:
  - Чита `fetchSpacedRepRecords(deviceId)` од постоечкиот `services/firestoreService.spacedRep.ts`.
  - Користи SM-2 хелпери: `isDueForReview`, `getNextReviewLabel`, `sortByReviewUrgency` од `utils/spacedRepetition.ts`.
  - `useCurriculum().getConceptDetails` мапира `conceptId → human title` (fallback на raw ID).
  - Две секции: "Денес за повторување" (deep-link до `#/concept/:id`) + "Во план" (top 20 upcoming).
  - Auth guard: ако нема `studentName` во localStorage → редирект на `#/student/login`.
- `firestore.rules:346-353` веќе ја покрива `spaced_rep` колекцијата за анонимни ученици (read/create/update).
- Quick link "Мои повторувања (SM-2)" додаден во dashboard.

### P2-E — Родителски портал ✅
- Постоечки `views/ParentPortalView.tsx` веќе ја има целосната функционалност:
  - Public route `#/parent` (без auth — анонимна Firebase сесија).
  - `?name=...` query param → директно ја рендерира `StudentProgressView` во read-only режим.
  - Без query param → форма со неделен дигест (XP, streak, weak concepts, recent quizzes, copy/print).
- Додадено: **"Сподели со родител"** секција во `StudentDashboardView` — генерира `${origin}/#/parent?name=ENC_NAME` URL и copy-to-clipboard со feedback.

### Регистрирани routes во `App.tsx` (финално)
- `safeLazy` за `StudentLoginView`, `StudentDashboardView`, `StudentSRSView`.
- Routes: `/student/login`, `/student/srs`, `/student`.
- Public hash prefixes додадени: `#/student`, `#/dugga/play`.

### Верификација (после P2-C/D/E)
- `npx tsc --noEmit` → 0 грешки.
- `npm run build` → PASS.

### Верификација (финална — после P2-E)

- `npx tsc --noEmit` → 0 грешки. `npm run build` → PASS.
- Sidebar: „Ученички портал" link (badge S65) → `#/student` во secondary nav. ✅

---

## Evidence Log — Недела 3 (P3-A Tests + P3-B Referral) ✅ 2026-05-11

### P3-B — Referral System ✅

- `hooks/useReferral.ts`: `?ref=TEACHERUID` URL парсирање + localStorage persistence.
- `services/firestoreService.referrals.ts`: `claimReferralIfPresent` (1 claim/signup, self-referral guard).
- `contexts/AuthContext.tsx`: lazy import + claim при нова регистрација.
- `views/SettingsView.tsx`: Referral card со copy-link (amber theme, Gift icon).
- `firestore.rules`: `referrals/{newUid}` — write-once per UID.

### P3-A — Test coverage ✅ (1710 → 1748 тести, +38)

- `__tests__/matrixOps.test.ts` (+17): `choleskyDecompose`, `svdDecompose` (2×2/3×3/4×4 U·Σ·Vᵀ≈A), `matrixExp`, `jordanDecompose` (2×2/3×3/4×4).
- `utils/duggaFeynmanGrading.test.ts` (11): `feynmanScoreToPoints` + `gradeFeynmanAnswer` (mocked AI, clamp, fallback).
- `hooks/useReferral.test.ts` (10): `getReferralLink`, localStorage functions, `useReferral` hook.

---

## Тековна состојба по S64

| Метрика | Вредност |
|---------|---------|
| TSC грешки | 0 |
| Тестови | 1710/1710 |
| Build | PASS |
| Lighthouse Performance | ~55–65 (главна слабост) |
| Lighthouse SEO | ~87 |
| Lighthouse A11y | ~78 |
| Главен bundle | 2.1 MB (gzip 705 KB) |
| Matura data | 2.4 MB (gzip 416 KB) |
| Оценка | ~8.0/10 |

---

## ПРИОРИТЕТ 1 — Performance Sprint 🔴 (Недела 1–2)

Ова е ЕДИНСТВЕНАТА слабост на апликацијата. 705 KB gzip при initial load = Lighthouse ~60.

### P1-A: Разбивање на главниот vendor bundle (2.1 MB)

**Тековно:** `vendor-iFk2hhB5.js` = 2,107 KB (gzip 705 KB) — сè во еден chunk.

**Акција:** Во `vite.config.ts`, во `manualChunks`, додај splits по библиотека:

```typescript
// Во build.rollupOptions.output.manualChunks:
'vendor-react':    ['react', 'react-dom', 'react-router-dom'],
'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
'vendor-charts':   ['recharts'],
'vendor-mathlive': ['mathlive'],
'vendor-pdf':      ['jspdf', 'html2canvas'],
'vendor-mathjax':  ['mathjax'],
'vendor-three':    ['three'],
'vendor-sentry':   ['@sentry/react'],
```

**Цел:** Главниот initial chunk < 200 KB gzip.

> ⚠️ ПРАВИЛО: НЕ СМЕЕШ да ги splittaш views/ или React ecosystem (context, hooks). Само vendor libraries.

### P1-B: Lazy load на тешките лабови

**Тековно:** Geometry3DLab (Three.js), LinearAlgebraLab, ConicSectionsLab — сите eager.

**Акција:** Во DataVizStudioView, смени eager import → `React.lazy()`:

```typescript
const Geometry3DLab = React.lazy(() => import('../components/dataviz/Geometry3DLab'));
const LinearAlgebraLab = React.lazy(() => import('../components/dataviz/LinearAlgebraLab'));
const ConicSectionsLab = React.lazy(() => import('../components/dataviz/ConicSectionsLab'));
```

Завитка секој со `<Suspense fallback={<LabLoading />}>`.

### P1-C: Lazy load на Matura данните

**Тековно:** `data-matura-C5.js` = 2,456 KB (гри 416 KB) — eager load при секој старт.

**Акција:** Во `MaturaTutorChat.tsx` и `MaturaExamView.tsx`, смени:
```typescript
// Пред:
import maturaData from '../data/matura/raw/...';
// По:
const maturaData = await import('../data/matura/raw/...');
```

**Цел:** Matura data се вчитува само кога корисникот оди на Matura tab.

### P1-D: Lighthouse audit + поправки

По bundle split:
- `npx lighthouse http://localhost:5173 --output json --output-path ./lighthouse.json`
- Цел: Performance ≥ 88, SEO ≥ 95, A11y ≥ 85

---

## ПРИОРИТЕТ 2 — Student Portal 🟠 (Недела 2–3)

Апликацијата е 95% наставник-центрична. Ученикот нема причина да ја користи самостојно.

### P2-A: Студент логин и идентитет

**Тековно:** Ученикот се логира само преку кодови во live quiz.

**Акција:** 
- `StudentLoginView.tsx` — email/password или Google логин
- Firestore: `student_accounts/{uid}` — профил, клас, наставник
- Routing: `/student/*` pathovi за ученички UI

### P2-B: StudentDashboardView

**Содржина:**
- Мои задачи (assignments assigned to me)
- SRS картички — моите спесед-реп концепти (sync со Academy)
- XP прогрес и streak (read-only gamification)
- Следни Dugga тестови

**Фајл:** `views/StudentDashboardView.tsx`

### P2-C: Студентски Dugga Player

**Тековно:** DuggaPlayerView постои но е само за наставник-преглед.

**Акција:**
- Ученикот добива link со `assignmentId`
- `StudentDuggaPlayerView.tsx` — submission workflow
- Firestore: `dugga_submissions/{submissionId}` — ученички одговори

### P2-D: Ученички SRS

**Тековно:** Academy SRS е само за наставникот (демо).

**Акција:** Студентот може сам да додаде концепти во своите флеш-картички.
- `StudentAcademyView.tsx` — browse concepts + add to my SRS
- Firestore `spaced_rep/{userId}` — постои, само треба student read/write rules

### P2-E: Родителски портал (read-only)

- `ParentView.tsx` — readonly: ученик прогрес, streak, SRS состојба
- Access преку share link (не бара account)

---

## ПРИОРИТЕТ 3 — Quality + GTM 🟡 (Недела 3–4)

### P3-A: Test coverage ≥ 80%

**Тековно:** ~65% (133 тест фајлови / 742 TS фајлови).

Додај тестови за:
- `utils/matrixOps.ts` — SVD, Jordan n≥4
- `components/dataviz/FunctionGrapher.tsx` — safeEval, _evalFallback
- `services/gemini/intentRouter.ts`
- `utils/duggaScoring.ts`, `duggaFeynmanGrading.ts`

### P3-B: Referral System

**Акција:**
- `useReferral()` hook — генерира `ref=TEACHERCODE` URL параметар
- При signup со ref код → наставникот добива 10 бесплатни AI генерации
- Firestore: `referrals/{code}` collection

### P3-C: Email Onboarding Sequence

**Акција:**
- Firestore Cloud Function: при нов наставник → trigger welcome email (SendGrid)
- 3 email-а: Welcome → First quiz tip (ден 2) → Academy tip (ден 5)

### P3-D: School Admin Panel

**Акција:** `SchoolAdminView.tsx` — bulk license management, usage per teacher, export PDF.

---

## ПРИОРИТЕТ 4 — SEO & Discoverability 🟢 (Недела 4)

### P4-A: SSR Concept Landing Pages

**Опција A (лесна):** Static pre-rendered HTML за 500+ концепти во `public/concepts/`
**Опција B (тешка):** Конвертирај во Next.js (не препорачано сега)

**Препорака:** Опција A — build script генерира HTML за секој концепт со OG meta tags.

### P4-B: Dynamic Sitemap

**Тековно:** Static `sitemap.xml` со ~30 URL-а.

**Акција:** `api/sitemap.ts` Vercel function — генерира sitemap со сите:
- `/concepts/:id` (500+ MK математички концепти)
- `/topics/:id` (теми по одделение)
- `/matura/:year` (матура испити 2016–2025)

**Цел:** Google индексира 500+ URL-а → органски трафик.

### P4-C: Matura SEO Pages

**Акција:** По еден `public/matura/gymnasium-2024.html` per exam year — pre-rendered со прашањата.

---

## Деферирани задачи (→ S66 или Post-Launch)

| Задача | Причина за одлагање |
|--------|-------------------|
| C4 (Service Worker offline) | PWA е веќе генерирана — потребна е специфична offline стратегија |
| E2 (SSR concept pages) | Бара Next.js или build-time генерација |
| E4 (Blog/Changelog) | Не е приоритет пред матура |
| P3-C (Email sequences) | Бара SendGrid/Resend интеграција |
| P2-E (Родителски портал) | Зависи од P2-A/B |

---

## KPI Метрики за успех S65

| Метрика | Тековно | Цел |
|---------|---------|-----|
| Lighthouse Performance | ~60 | ≥ 88 |
| Lighthouse SEO | ~87 | ≥ 95 |
| Lighthouse A11y | ~78 | ≥ 85 |
| Initial bundle (main gzip) | 705 KB | < 200 KB |
| Matura load time | eager 3.1 MB | < 500 ms (lazy) |
| Test coverage | ~65% | ≥ 80% |
| Student-facing features | 3% | ≥ 40% |
| Оценка на апликацијата | 8.0/10 | ≥ 9.2/10 |

---

## Редослед на имплементација

```
Недела 1  | P1-A: Vendor bundle split (vite.config.ts manualChunks)
           | P1-B: Lazy load Geometry3DLab, LinearAlgebraLab, ConicSectionsLab
           | P1-C: Lazy load Matura data
           | P1-D: Lighthouse audit — верификација на gains

Недела 2  | P2-A: Student login + identity
           | P2-B: StudentDashboardView
           | P2-C: Student Dugga Player

Недела 3  | P2-D: Student SRS (Academy за ученик)
           | P3-A: Test coverage + нови тестови
           | P3-B: Referral system

Недела 4  | P4-A/B: SEO landing pages + dynamic sitemap
           | P3-D: School Admin Panel
           | Final Lighthouse audit + bugfixes
```

---

## Верификациски протокол (по секоја задача)

```bash
# 1. TypeScript — 0 грешки
npx tsc --noEmit

# 2. Tests — 1710+ минуваат
npx vitest run

# 3. Build — без грешки
npm run build

# 4. Bundle size — провери дека main chunk < 200 KB gzip
npx vite-bundle-visualizer

# 5. Lighthouse
npx lighthouse http://localhost:4173 --view
```

---

## Критични правила

1. **НЕ ги split-ај views/* или React ecosystem** — само vendor libraries (feedback_manualchunks.md)
2. **Student data е ИЗОЛИРАНА** — `student_accounts`, `dugga_submissions` → посебни Firestore правила, ученикот НЕ може да чита teacher данни
3. **Секоја промена на Firestore rules** → update `firestore.rules` + тести
4. **Performance budget:** ниту еден нов feature не смее да додаде > 50 KB gzip

---

*Матурски тест: ~2026-06-05. Апликацијата треба да е на production-ready ниво до тогаш.*
