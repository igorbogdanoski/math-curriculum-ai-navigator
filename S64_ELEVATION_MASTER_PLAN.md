# S64 — MisMath Elevation Master Plan
## Целта: Апликација на највисоко можно ниво — без компромис

**Датум:** 2026-05-10 → 2026-05-11  
**Статус:** ✅ ЗАВРШЕНА (C4/E2/E4 → S65)  
**API Tier:** Tier 1 (највисок — неограничени rate limits, пристап до сите preview модели)

## Финален статус на задачи

| Task | Статус | Commit | Белешка |
|------|--------|--------|---------|
| A1–A4 | ✅ | b7f6215 | Model constants, intent router, quota, security |
| B1 | ✅ | c6b0c10 | UsageDashboardView |
| B2 | ✅ | 480799b | UpgradePrompt.tsx (compact + card) |
| B3 | ✅ | (pre-S64) | TeacherOnboardingWizard 5-step modal |
| B4 | ✅ | (pre-S64) | SharedPlanView, SharedQuizView |
| C1 | ✅ | (pre-S64) | Matura JSON: dynamic import already |
| C2 | ✅ | b23cae8 | useCurriculum context value memoized |
| C3 | ✅ | (pre-S64) | GeneratorPanelContext |
| C4 | ⏩ S65 | — | Service Worker — архитектурна промена |
| D1 | ✅ | 09fe3c1 | SRS Firestore persistence |
| D2 | ✅ | (pre-S64) | duggaFeynmanGrading.ts rubric |
| D3 | ✅ | 480799b | Scroll progress bar + "Чекор X од N" |
| D4 | ✅ | e9bcc56 | DokClassifier reset button |
| E1 | ✅ | e9bcc56 | Sitemap expanded |
| E2 | ⏩ S65 | — | SSR concept pages — бара Next.js |
| E3 | ✅ | b7f6215 | PricingView.tsx |
| E4 | ⏩ S65 | — | Blog — опционално |
| F1 | ✅ | b23cae8 | SVD Jacobi n×n |
| F2 | ✅ | 480799b | Jordan QR+nullbasis n×n |
| F3 | ✅ | 64ea81b | Eigenvalue animation requestAnimationFrame |
| G1 | ✅ | 64ea81b | CommandPalette keyboard nav |
| G2 | ✅ | 64ea81b | aria-label on icon buttons |
| G3 | ✅ | 64ea81b | Color contrast audit |

**TSC: 0 грешки | Tests: 1710/1710 | 2 commit-а во оваа сесија (480799b, 835072f)**

---

## AI Модели (core.constants.ts) — Тековна состојба

| Константа | Модел | Употреба |
|-----------|-------|---------|
| `LITE_MODEL` | `gemini-3.1-flash-lite-preview` | Брзи операции, hint-ови, кратка форма |
| `DEFAULT_MODEL` | `gemini-3-flash-preview` | Стандардни задачи (туторинг, генерација) |
| `PRO_MODEL` | `gemini-3-pro-preview` | Standard tier корисници |
| `ULTIMATE_MODEL` | `gemini-3.1-pro-preview` | Pro/Unlimited tier, сложени задачи |
| `IMAGEN_MODEL` | `imagen-4.0-generate-001` | Генерација на илустрации |
| `EMBEDDING_MODEL` | `gemini-embedding-2` | RAG, семантичко пребарување |

**Со Tier 1 клуч:** Сите овие модели работат без лимит на rate. Intent router мора да биде активен по default.

---

## Матрица на завршени задачи (S51–S63)

### Линеарна алгебра лаб (matrixOps.ts + LinearAlgebraLab.tsx)
| Операција | Статус |
|-----------|--------|
| Гаусова елиминација (n×n) | ✅ S62 |
| Крамер (n×n) | ✅ S62 |
| Детерминанта — кофактор/Лаплас | ✅ S62 |
| Инверзија — adjugate | ✅ S62 |
| LU декомпозиција | ✅ S62 |
| Cholesky A=LLᵀ | ✅ S62 |
| **SVD (A=UΣVᵀ) — 2×2 и 3×3** | ✅ S62 (поправен formula) |
| **Матрична exponential (eᴬ) — n×n** | ✅ S62 |
| **Jordan нормална форма — 2×2 и 3×3** | ✅ S62 (поправен defective) |
| Visualizacija на трансформации | ✅ S62 |

**Забелешка:** Сите три операции означени како "S64+" во претходниот план се ЦЕЛОСНО ИМПЛЕМЕНТИРАНИ. Нема ништо да се додава тука освен евентуално итеративен QR алгоритам за n>3 SVD (опција S64-F).

---

## S64 — Приоритизирани задачи

---

### 🔴 S64-A: КРИТИЧНИ ПОПРАВКИ (Ден 1)

#### A1 — Замени 50 хардкодирани модел стрингови
**Проблем:** 50 места директно пишуваат `'gemini-2.5-flash'` наместо `DEFAULT_MODEL`.  
**Фајлови:** `components/academy/FeynmanChallenge.tsx:86`, `utils/duggaFeynmanGrading.ts:44` + 48 места низ services.  
**Акција:** `grep -rn "'gemini-2\." --include="*.ts" --include="*.tsx"` → замени со константи.

#### A2 — Активирај Intent Router по default
**Проблем:** `intentRouter.ts` е disabled by default (localStorage flag). Само 6/157 callsites го користат.  
**Фајл:** `services/gemini/intentRouter.ts`  
**Акција:** Промени default на `true`. Со Tier 1, нема разлика во cost, но добиваме правилен модел routing.

#### A3 — Врати функционален Quota Guard UI
**Проблем:** `checkDailyQuotaGuard()` е потполно no-op (return; на ред 44).  
**Фајл:** `services/gemini/core.quota.ts`  
**Акција:** Додај pre-flight UI warning (toast/banner) кога корисникот е близу до 429, не само по неа.

#### A4 — Санитизирај 7 незаштитени AI сервиси
**Проблем:** `chat.ts`, `assessment.ts`, `olympiad.ts`, `vision.ts`, `pedagogy.ts`, `kahootGenerator.ts`, `testgen.ts` праќаат user input директно во prompt без `sanitizePromptInput()`.  
**Ризик:** Prompt injection.  
**Акција:** Додај `sanitizePromptInput()` на сите user-controlled параметри.

---

### 🟠 S64-B: SAAS ELEVATION (Ден 2–3)

#### B1 — Usage Dashboard за наставник
**Тековно:** Нема UI за "колку AI кредити потрошив".  
**Додај:** `views/UsageDashboardView.tsx` — дневна/неделна/месечна AI генерација, breakdown по feature, cost estimate.  
**Firestore:** Постоечката `user_tokens` колекција + агрегирање.

#### B2 — Upgrade Flow — Subscription Tier Upgrade Prompts
**Тековно:** Stripe постои (stripe-checkout.ts) но нема contextual upgrade prompts.  
**Додај:**
- `components/common/UpgradePrompt.tsx` — inline card кога Standard корисник се обидува Pro feature
- Tier badge во Sidebar (Free / Standard / Pro / Unlimited)  
- `views/PricingView.tsx` — јавна страница за планови (важно за SEO!)

#### B3 — Teacher Onboarding Flow
**Тековно:** Нема guided onboarding за нови наставници.  
**Додај:** `views/OnboardingView.tsx` — 5 чекори: профил → razred → прв тест → прв квиз → live session.  
**Метрика:** Онбординг завршување rate во Firestore.

#### B4 — Referral & Sharing System
**Додај:** Sharable link за генерирани материјали (`/share/:id`). Serve-side render за social preview.  
**SEO бенефит:** User-generated URLs индексирани од Google.

---

### 🟠 S64-C: ПЕРФОРМАНСИ & АРХИТЕКТУРА (Ден 3–4)

#### C1 — Lazy Load Matura 3.1 MB Bundle
**Проблем:** 3.1 MB JSON data се вчитува при startup дури и за non-matura корисници.  
**Фајл:** Services кои статички import-аат matura data.  
**Акција:** `dynamic import()` само во MaturaTutorChat и MaturaExamView components.

#### C2 — Раздели useCurriculum.ts (371 линии → 3 hooks)
```
useCurriculumData.ts    — loading, caching, overrides
useCurriculumSearch.ts  — conceptMap, topicMap, gradeMap lookups  
useCurriculumFilters.ts — filtering by track/grade/dok
```
**Бенефит:** 50+ компоненти ќе re-render поретко, поедноставно тестирање.

#### C3 — Memoize Generator State во Context
**Проблем:** `useGeneratorActions` прима 13 параметри — prop drilling.  
**Акција:** Подигни generator state во `GeneratorContext`, hooks само консумираат.

#### C4 — Service Worker Cache Strategyy за API Responses
**Додај:** Background sync за offline-first quiz играње. Ученикот може да игра без интернет, резултатот се sync-ира кога ќе се поврзе.

---

### 🟡 S64-D: ACADEMY ELEVATION (Ден 4–5)

#### D1 — SRS Persistence во Firestore
**Проблем:** SM-2 spaced repetition картички живеат само во localStorage — губат се со бришење кеш.  
**Акција:** `firestoreService.spaced_rep` — persist cards per user, sync cross-device.  
**Firestore doc:** `spaced_rep/{userId}/cards/{conceptId}`

#### D2 — Feynman Grading Benchmark Validation
**Проблем:** AI рубриката (40+25+25+10) никогаш не е калибрирана со учителски оценки.  
**Акција:** 
1. Направи скрипта за bulk grading на 30 примерни Feynman одговори
2. Спореди со teacher-provided оценки
3. Подеси weight-овите ако AI е lenient/strict

#### D3 — Academy Step Indicator & Progress
**Додај:** Visual step indicator кај Academy Lesson view — "Чекор 2 од 5".  
**Додај:** `useEffect(() => window.scrollTo(0,0), [lessonId])` на промена на лекција.

#### D4 — DokClassifier Reset Button
**Фајл:** `views/AcademyLessonView.tsx`  
**Додај:** "Ресетирај" button на DokClassifier кога веќе има класификација.

---

### 🟡 S64-E: SEO ELEVATION (Ден 5)

**Тековна состојба:** Веќе одлична база — JSON-LD, OG, hreflang×4, sitemap.xml, robots.txt, canonical.

#### E1 — Dynamic Sitemap Generator
**Тековно:** Static `sitemap.xml`.  
**Додај:** `api/sitemap.ts` — generira sitemap со сите концепти, теми и grade pages.  
**Пример URLs:**
```
/concepts/kvadratna-ravenka
/topics/trigonometrija  
/grade/10
/matura/gimnanzija-2024
```

#### E2 — Public Landing Pages per Concept
**Додај:** Server-side rendered концепт pages со пристапни meta tags.  
**SEO вредност:** 500+ индексирани pages за математички концепти на македонски.

#### E3 — Pricing Page за Органски Saobraќaj
**Додај:** `views/PricingView.tsx` (public, без auth) — опишува Free/Standard/Pro/Unlimited.  
**URL:** `#/pricing` — роутирана и без auth, индексирана.

#### E4 — Blog/Changelog (опционално)
**Додај:** Статичен `views/BlogView.tsx` со педагошки статии на македонски — за органски долгорочен SEO.

---

### 🟡 S64-F: MATH LAB EXTENSIONS (Ден 6)

#### F1 — SVD за n>3 (Итеративен QR Алгоритам)
**Тековно:** SVD работи само за 2×2 и 3×3.  
**Додај:** Итеративен Power/Golub-Reinsch алгоритам за n×n SVD.  
**Во:** `utils/matrixOps.ts` — нова функција `svdDecomposeNxN(A: Mat): SVDResult`.

#### F2 — Jordan за n>3
**Тековно:** Jordan нормална форма само за 2×2 и 3×3.  
**Додај:** Општ алгоритам базиран на характеристичен полином + кернел computation.  
**Ограничување:** Само реални eigenvalues (complex Jordan blocks = S65+).

#### F3 — Eigenvalue Visualization (GeometricInterpretation)
**Додај:** Анимиран приказ на eigenvectors во LinearAlgebraLab за 2×2 матрици.  
**Идеја:** Приказ на единечна кружница трансформирана со матрицата.

---

### 🟢 S64-G: A11Y & UX POLISH (Тековно)

#### G1 — Keyboard Navigation во Command Palette
**Тековно:** CommandPalette постои, но keyboard focus management е нецелосна.  
**Додај:** Proper focus trap, Escape, ArrowUp/Down, Enter.

#### G2 — Screen Reader Labels
**Тековно:** Повеќе места немаат aria-label.  
**Акција:** Audit на сите icon-only buttons (Close, Search, Filter) — додај `aria-label`.

#### G3 — Color Contrast Audit
**Тековно:** Tailwind дефолт боење — некои text-gray-400 на white не минуваат WCAG AA.  
**Акција:** Replace text-gray-400 → text-gray-500 за body text, text-gray-300 → text-gray-400 за disabled.

---

## Приоритет и Временска Рамка

```
Ден 1  | S64-A1 A2 A3 A4 — Критични поправки (model constants, quota, security)
Ден 2  | S64-B1 B2       — Usage Dashboard + Pricing View
Ден 3  | S64-B3 B4       — Onboarding + Sharing
Ден 4  | S64-C1 C2       — Performance (lazy matura, split useCurriculum)
Ден 5  | S64-D1 D2 D3 D4 — Academy elevation
Ден 6  | S64-E1 E2 E3    — SEO enhancements
Ден 7  | S64-F1 F2 F3    — Math Lab extensions
Ден 8  | S64-G1 G2 G3    — A11y polish + final audit
```

---

## Технички Верификациски Протокол (за секоја задача)

```bash
# 1. TypeScript — нула грешки
npx tsc --noEmit

# 2. Tests — сите минуваат
npx vitest run

# 3. Build — без warnings
npm run build

# 4. Bundle size — не расте > 50KB per задача
npx vite-bundle-visualizer

# 5. Accessibility
npx axe-core на target views
```

---

## SaaS Tier Map (тековна имплементација)

| Tier | Модел | AI Кредити/ден | Features |
|------|-------|----------------|---------|
| **Free** | LITE_MODEL | 10 генерации | Тестови, квизови, туторинг |
| **Standard** | PRO_MODEL | 50 генерации | + Gamma, Live Quiz, Analytics |
| **Pro** | ULTIMATE_MODEL | 200 генерации | + Matura AI, Dugga, Academy |
| **Unlimited** | ULTIMATE_MODEL | Неограничено | Сè + priority support |

---

## KPI Метрики за успех

| Метрика | Тековно | Цел S64 |
|---------|---------|---------|
| Lighthouse Performance | ~72 | ≥90 |
| Lighthouse SEO | ~85 | ≥98 |
| Lighthouse A11y | ~68 | ≥85 |
| Initial bundle (main) | >200KB | <150KB |
| Matura load time | eager 3.1MB | <200ms lazy |
| TypeScript errors | 0 | 0 (мора) |
| Test coverage | ~65% | ≥80% |
| AI model routing | 6/157 sites | 157/157 sites |

---

## Напомена за AI Модели — Tier 1 Привилегии

Со Tier 1 API клуч:
- **Rate limits:** 1000+ RPM (vs 15 RPM free tier)
- **Context window:** До 2M tokens за Gemini 3 Pro
- **Thinking:** Extended thinking достапен за ULTIMATE_MODEL
- **Streaming:** Без ограничувања на stream duration
- **Imagen 4:** Комерцијална употреба дозволена
- **Gemini Embedding 2:** Batch embeddings за RAG

**Препорака:** Со Tier 1, намалувањето на AI cost не е приоритет. Наместо тоа, фокусирај се на КВАЛИТЕТ на AI одговорите — користи ULTIMATE_MODEL почесто, enable extended thinking за Feynman grading.

---

*Планот е жив документ — ажурирај статусите со ✅ при завршување на секоја задача.*
