# 📋 Евиденција на подобрувања — Math Curriculum AI Navigator

> Последно ажурирање: 9 февруари 2026

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

## 🔲 Останато (по приоритет)

### 🔴 П1: Tailwind CSS — PostCSS миграција
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

## 🔲 Останато (по приоритет)

### 🟡 П3: Focus trapping во модали
- **Статус**: Tab копчето излегува надвор од отворен модал — WCAG нарушување
- **План**: Додади `focus-trap-react` или рачно focus management
- **Засегнати**: Сите модали во `ModalManager.tsx`
- **Очекуван ефект**: Пристапност за корисници со тастатура и screen reader

### 🟢 П4: TypeScript `strict: true`
- **Статус**: 47× `any` типови низ кодот, `strict` е исклучен
- **План**: Инкрементално — прво `noImplicitAny`, потоа `strictNullChecks`, потоа целосен `strict`
- **Очекуван ефект**: Спречува undefined/null багови долгорочно

### 🔵 П5: Компонентни тестови
- **Статус**: Vitest + Testing Library инсталирани, но 0 UI компонентни тестови
- **План**: Тестови за критични патеки — Login flow, Planner CRUD, AI Generator, Share decode
- **Очекуван ефект**: Доверба при идни промени, regression заштита

---

## 📊 Метрики

| Метрика | Пред | Сега | Цел |
|---------|------|------|-----|
| Bundle (main chunk) | 1,555 KB | **323 KB** | < 500 KB ✅ |
| API keys во bundle | 1 (Gemini) | 0 | 0 ✅ |
| Context re-renders | Секој render | Memoized (×9) | Memoized ✅ |
| `window.confirm` | 4 места | 0 | 0 ✅ |
| Tailwind | CDN Play (~300KB JS) | PostCSS build (71KB CSS) | PostCSS ✅ |
| `any` типови | ~47 | ~47 | 0 |
| UI тестови | 0 | 0 | 20+ |

---

## 🛠 Технички стек

- **Frontend**: React 19.2.1, TypeScript 5.8, Vite 6.x
- **Backend**: Firebase 12.4 (Auth + Firestore), Vercel Serverless Functions
- **AI**: Google Gemini (преку server proxy)
- **Deployment**: Vercel (auto-deploy од `main` гранка)
- **Repo**: `igorbogdanoski/math-curriculum-ai-navigator`
