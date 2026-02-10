# 📋 Евиденција на подобрувања — Math Curriculum AI Navigator

> Последно ажурирање: 10 февруари 2026

---

## ✅ Завршено

### Фаза 1 — Поправка на React Error #130 (commit `648938c`)
- **Проблем**: Апликацијата паѓаше на Vercel со React error #130 (undefined component)
- **Причина**: `ICONS.arrowRight` не постоеше во `constants.tsx`, а се користеше во повеќе компоненти
- **Решение**: Додадени `arrowRight`, `target`, `chartBar` икони во `constants.tsx`
- **Засегнати фајлови**: `constants.tsx`

---

### Фаза 2 — Quick Wins (commit `efff62f`)

| # | Подобрување | Фајл(ови) | Детали |
|---|-------------|-----------|--------|
| 1 | `lang="mk"` наместо `lang="en"` | `index.html` | SEO и accessibility за македонски јазик |
| 2 | Отстранет importmap блок | `index.html` | Остаток од AI Studio, не се користеше |
| 3 | Test deps → devDependencies | `package.json` | `vitest`, `@testing-library/react` преместени во devDependencies |
| 4 | useMemo на сите контексти (×9) | `AuthContext.tsx`, `PlannerContext.tsx`, `UserPreferencesContext.tsx`, `UIContext.tsx`, `GeneratorPanelContext.tsx`, `ModalContext.tsx`, `LastVisitedContext.tsx`, `NetworkStatusContext.tsx`, `NotificationContext.tsx` | Спречува непотребни re-renders на сите consumers |
| 5 | Скопиран CSS transition | `index.html` | `* { transition }` заменет со селектор само за интерактивни елементи (button, a, input, select, textarea) |
| 6 | Sidebar aria-label | `components/Sidebar.tsx` | Преведен на македонски: "Главна навигација" |
| 7 | Име на пакет | `package.json` | Од `copy-of-copy-of-...` → `math-curriculum-ai-navigator` |

---

### Фаза 3 — Medium Wins (commit `2618869`)

| # | Подобрување | Фајл(ови) | Детали |
|---|-------------|-----------|--------|
| 1 | SilentErrorBoundary | `components/common/SilentErrorBoundary.tsx` (НОВ), `App.tsx` | Обвива Sidebar, AIGeneratorPanel, ContextualFAB — ако паднат, не ја рушат целата апликација |
| 2 | Zod валидација на share decode | `services/shareService.ts` | Додадени `SharedLessonPlanSchema` и `SharedAnnualPlanSchema` — спречува injection преку share линкови |
| 3 | Отстранет дупликат getDocs | `contexts/PlannerContext.tsx` | Двапати се читаше од Firestore при mount; сега loading се следи само преку onSnapshot |
| 4 | Custom ConfirmDialog | `components/common/ConfirmDialog.tsx` (НОВ), `types.ts`, `components/common/ModalManager.tsx`, `views/LessonPlanLibraryView.tsx`, `views/MaterialsGeneratorView.tsx`, `components/ai/AIAnnualPlanGeneratorModal.tsx` | Замена на сите `window.confirm` со модален дијалог (danger/warning/info варијанти) |

---

### Фаза 4 — КРИТИЧНО: API Key Security (commit `0196296`)

- **Проблем**: Gemini API клучот беше видлив во client bundle (`process.env.API_KEY` → инјектиран од Vite)
- **Решение**: Server-side proxy преку Vercel Serverless Functions
- **Нови фајлови**:
  - `api/gemini.ts` — Non-streaming proxy (POST → JSON)
  - `api/gemini-stream.ts` — Streaming proxy (POST → SSE)
- **Рефакториран**: `services/geminiService.real.ts` — целосно отстранет `@google/genai` SDK од client, заменет со `fetch('/api/gemini')` и `fetch('/api/gemini-stream')`
- **Отстранет**: `process.env.API_KEY` define од `vite.config.ts`
- **Додаден**: `geminiDevProxy()` Vite plugin за локален development
- **Резултат**: Bundle намален од 1,555 KB → 1,296 KB (−259 KB / −17%)
- **Верифицирано**: 0 API key референци во production bundle; двата endpoints одговараат правилно на POST

---

### Фаза 5 — Tailwind PostCSS миграција (commit `8ded4ed`)

- **Проблем**: Tailwind Play CDN (`<script src="cdn.tailwindcss.com">`) — ~300KB JS runtime, FOUC, нема tree-shaking
- **Решение**: Инсталиран `tailwindcss@4.1.18` + `@tailwindcss/vite` со build-time CSS
- **Нов фајл**: `app.css` — `@import "tailwindcss"` + `@theme` со custom brand бои, shadows, animations + сите стилови од inline `<style>` блокови
- **Отстрането од `index.html`**: CDN script, inline tailwind.config, сите `<style>` блокови, мртов `index.css` линк (378 → 42 линии)
- **Ажурирани**: `vite.config.ts` (додаден `tailwindcss()` plugin), `index.tsx` (import `./app.css`)
- **Резултат**: 71.2 KB tree-shaken CSS (наместо ~300KB JS), без FOUC, без конзолно предупредување

---

### Фаза 6 — Bundle Splitting (commit `155c3eb`)

- **Проблем**: Main chunk 1,296 KB — сè на една хрпа
- **Поправки**:
  1. **AIGeneratorPanel** — `MaterialsGeneratorView` беше eager import (влечеше geminiService + zod + AI компоненти); заменет со `React.lazy()`
  2. **useCurriculum.ts** — `fullCurriculumData` беше sync top-level import (~228KB); заменет со `import()` dynamic
  3. **vite.config.ts** — додадени `manualChunks`: firebase-app, firebase-auth, firebase-firestore, firebase-storage, react, zod
  4. **Избришани**: 4 неискористени JSON фајлови (`data/grade-6/7/8/9.json`)
- **Резултат**: Main chunk **1,296 KB → 323 KB (−75%)**

| Chunk | Големина | gzip |
|-------|---------|------|
| index.js (main) | 323 KB | 96 KB |
| firebase-firestore | 386 KB | 97 KB |
| curriculum data | 228 KB | 40 KB |
| firebase-auth | 172 KB | 36 KB |
| MaterialsGeneratorView | 84 KB | 21 KB |
| vendor-zod | 54 KB | 12 KB |
| firebase-storage | 34 KB | 9 KB |
| vendor-react | 12 KB | 4 KB |

---

### Фаза 7 — Security & Stability Fixes (commit `fe90d46`)

| # | Поправка | Фајл(ови) | Детали |
|---|----------|-----------|--------|
| A | XSS fix во MathRenderer | `components/common/MathRenderer.tsx` | Додадена `escapeHtml()` функција; math content и error messages се escape-ираат пред инјектирање во `dangerouslySetInnerHTML` |
| B | CORS restriction на API | `api/gemini.ts`, `api/gemini-stream.ts` | `Access-Control-Allow-Origin: '*'` → ограничен на app домен (конфигурирачки преку `ALLOWED_ORIGIN` env var) |
| C | Outer ErrorBoundary | `App.tsx` | `<ErrorBoundary>` обвива целиот `<App>` tree — спречува бел екран при context-level crash |
| D | response.body null check | `services/geminiService.real.ts` | `response.body!.getReader()` → null check со описна грешка наместо crash |

---

### Фаза 8 — Математичко рендерирање (commit `96aef74`)
- **Проблем**: КРИТИЧНО — сите LaTeX формули (`\frac{1}{2}`, `\cdot`) се прикажуваа како обичен текст наместо рендерирана математика
- **Причина**: `convertToStandardLatex()` во MathRenderer.tsx имаше `processed.replace(/\$/g, '')` кој ги бришеше СИТЕ `$` знаци, вклучително и `$...$` math деилимитерите
- **Решение**:
  1. Заменет blanket `$` removal со targeted inner-`$` cleanup (lookbehind regex) кој чисти само залутани `$` ВНАТРЕ во формулите
  2. Додаден `wrapBareLatex()` — safety net кој автоматски детектира bare LaTeX команди надвор од деилимитери и ги обвива во `$...$`
  3. Поддржани: `\frac`, `\sqrt`, `\cdot`, `\times`, `\div`, `\pm`, грчки букви, суперскрипти, субскрипти, `\mathbb`, `\overline`, `\text{}`
- **Pipeline**: escape normalization → space fix → unit injection → environment spacing → **bare-LaTeX auto-wrap** → inner-$ cleanup
- **Засегнати фајлови**: `components/common/MathRenderer.tsx` (користен во 15+ компоненти)
---

### Фаза 8б — Backslash Recovery (commit `851d565`)
- AI понекогаш генерира `frac{1}{2}` наместо `\frac{1}{2}` (без backslash)
- Додаден Step 2.1 во `wrapBareLatex()`: автоматска детекција и поправка на bare LaTeX команди без `\`
- Поддржани: `frac`, `sqrt`, `cdot`, `times`, `div`, `pm`, `neq`, `leq`, `geq`, `approx`, `infty`

---

### Фаза 9 — P2: AbortController Timeout (commit `d892eb9`)
- **Проблем**: AI proxy повиците немаа timeout — можеа бесконечно да чекаат
- **Решение**: 60-секунден `AbortController` timeout на двата endpoint-а
  - `callGeminiProxy()` — стандарден 60s timeout
  - `streamGeminiProxy()` — timeout се ресетира на секој примен chunk
- **Нов**: `PROXY_TIMEOUT_MS = 60_000` константа во `geminiService.real.ts`

---

### Фаза 10 — P4: TypeScript `strict: true` (commit `cea06b9`)
- **Проблем**: `strict` беше исклучен; 477+ implicit `any` типови низ целиот код
- **Решение**: Инкрементално вклучување на сите strict флагови
  - Поправени 23 baseline TS грешки (Zod generic, React 19 class, `import.meta.env`)
  - Поправени **471 `noImplicitAny`** (TS7006) грешки во ~60 фајлови
  - Инсталирани `@types/react` + `@types/react-dom` — решени 3,820 JSX грешки
  - Поправени 19 дополнителни + 6 `strictNullChecks` грешки
  - Вклучен `"strict": true` во `tsconfig.json`
- **Засегнати**: **75 фајлови** (501 додавања / 452 бришења)
- **Резултат**: Целосен `strict: true`

---

### Фаза 11 — Content Generation Fix (КРИТИЧНО)
- **Проблем**: КРИТИЧНО — апликацијата престана да генерира содржина по рефакторирањето во Фаза 4
- **Причини**:
  1. **SDK Mismatch**: Проектот користи `@google/genai` (Gemini 2.0+ SDK), а не стандардниот `@google/generative-ai`.
  2. **Invalid Constructor**: SDK-то бара објект `{ apiKey }`, а не директен стринг.
  3. **Invalid Zod structure**: `generateAndParseJSON` праќаше објект наместо низа (array) за `contents`.
  4. **ThinkingConfig error**: Се праќаше `thinkingBudget` на `gemini-1.5-flash` кој не го поддржува.
- **Решенија**:
  - Заменет моделот со стабилен `gemini-1.5-flash`.
  - Коригиран конструкторот во `new GoogleGenAI({ apiKey })`.
  - Коригирана структурата на `contents` во `[{ parts: [...] }]` за Zod валидација.
  - Имплементиран правилен SDK паттерн (`ai.models.generateContent`) во сите handlers.
  - Отстранет `thinkingConfig` за 1.5-flash модели.
- **Засегнати фајлови**: `services/geminiService.real.ts`, `api/gemini.ts`, `api/gemini-stream.ts`, `api/_lib/sharedUtils.ts`, `vite.config.ts`

---


## Експертска оценка (10 февруари 2026)

| Категорија | Оценка | Белешки |
|------------|--------|---------|
| Архитектура | **7/10** | Добра сепарација (contexts/hooks/views/services). Hash routing лимитирачки но функционален. |
| Безбедност | **8/10** | API key серверски. CORS заклучен. Недостасува auth на proxy. |
| Перформанси | **7/10** | Lazy loading, chunks, useMemo/useCallback. Mega-context Pattern. |
| Type Safety | **8/10** | `strict: true` вклучен. 25 `as any` останати (тестови + SDK). |
| Тест покриеност | **4/10** | 9 тест фајлови за ~50+ компоненти. Нема view тестови. |

### Критични наоди

| # | Severity | Наод | Локација |
|---|----------|------|----------|
| 1 | CRITICAL | API proxy нема auth/rate limiting | `api/gemini.ts`, `api/gemini-stream.ts` |
| 2 | CRITICAL | `req.body` без Zod валидација — prompt injection | `api/gemini.ts` L33 |
| 3 | CRITICAL | `model` не е whitelist-иран — скап модел exploit | `api/gemini.ts` L33 |
| 4 | HIGH | API handlers `(req: any, res: any)` — без типови | `api/*.ts` |
| 5 | MEDIUM | PlannerContext mega-context (20+ вредности) | `PlannerContext.tsx` |
| 6 | MEDIUM | KaTeX CDN без SRI integrity hash | `index.html` |
| 7 | LOW | Нема `include` во tsconfig | `tsconfig.json` |

---

## Останато (по приоритет — ревидирано)

### П1: API Auth + Input Validation (КРИТИЧНО)
- **Статус**: Proxy endpoints отворени без auth
- **План**: Firebase ID token verify, Zod body validation, model whitelist, rate limiting

### П2: Focus Trapping (WCAG)
- **Статус**: Tab излегува од модали
- **План**: `focus-trap-react` во `ModalManager.tsx`

### П3: Тест покриеност (4/10 → 7/10)
- **План**: Тестови за `useRouter`, `PlannerContext`, `geminiService`, `MathRenderer`

### П4: PlannerContext Split
- **План**: `PlannerItemsContext` + `LessonPlansContext` + `CommunityPlansContext`

### П5: Cleanup `as any` (25 останати)
- **План**: Proper типови за SDK, SpeechRecognition, test mocks

---

## Метрики

| Метрика | Пред | Сега | Цел |
|---------|------|------|-----|
| Bundle (main chunk) | 1,555 KB | **325 KB** | < 500 KB |
| API keys во bundle | 1 (Gemini) | **0** | 0 |
| Context re-renders | Секој render | **Memoized (x9)** | Memoized |
| `window.confirm` | 4 места | **0** | 0 |
| Tailwind | CDN (~300KB JS) | **PostCSS (71KB CSS)** | PostCSS |
| TypeScript strict | Исклучен | **`strict: true`** | strict |
| `any` типови | ~477 | **25 `as any`** | <10 |
| API timeout | Нема | **60s AbortController** | 60s |
| Math rendering | Скршено | **LaTeX auto-wrap + recovery** | Working |
| Тестови | 9 фајлови | **9 фајлови** | 25+ |

---

## Хронологија на комити

| # | Commit | Фаза | Опис |
|---|--------|------|------|
| 1 | `648938c` | Фаза 1 | React Error #130 fix |
| 2 | `efff62f` | Фаза 2 | Quick Wins (7 подобрувања) |
| 3 | `2618869` | Фаза 3 | Medium Wins (ErrorBoundary, Zod, ConfirmDialog) |
| 4 | `0196296` | Фаза 4 | API Key Security (server proxy) |
| 5 | `8ded4ed` | Фаза 5 | Tailwind PostCSS миграција |
| 6 | `155c3eb` | Фаза 6 | Bundle Splitting (-75%) |
| 7 | `fe90d46` | Фаза 7 | Security и Stability (XSS, CORS, ErrorBoundary) |
| 8 | `96aef74` | Фаза 8 | Math Rendering Fix |
| 9 | `851d565` | Фаза 8б | Backslash Recovery |
| 10 | `d892eb9` | Фаза 9 | AbortController Timeout |
| 11 | `cea06b9` | Фаза 10 | TypeScript `strict: true` |

---

## Технички стек

- **Frontend**: React 19.2.4, TypeScript 5.8, Vite 6.4.1
- **Стилизирање**: Tailwind CSS v4.1.18 (`@tailwindcss/vite`)
- **Backend**: Firebase 12.4 (Auth + Firestore), Vercel Serverless Functions
- **AI**: Google Gemini (преку server proxy со 60s timeout)
- **Математика**: KaTeX 0.16.10 (CDN) со auto-wrap и backslash recovery
- **Type Safety**: TypeScript `strict: true`, Zod валидација
- **Deployment**: Vercel (auto-deploy од `main` гранка)
- **Repo**: `igorbogdanoski/math-curriculum-ai-navigator`
