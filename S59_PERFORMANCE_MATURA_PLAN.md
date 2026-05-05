# S59 — Performance + Matura UX Plan
> Генерирано: 28.04.2026 | По: S58 (сите гапови затворени) | Статус: ВО ТEК

---

## Контекст
S54–S58 целосно завршени. Build чист, 0 TS грешки, 1153/1153 тестови.
Следните приоритети се по импакт врз production корисници (Македонски наставници + ученици).

---

## Tier 1 — Критично (Performance)

### P1 — Bundle split: lazy load matura data ✅ ВО ТЕК
**Проблем:** `data-matura-C5-ffXQ1.js` = 2.46MB chunk се вчитува при секое отворање на апликацијата.
**Решение:** Динамичен `import()` на matura data само кога корисникот влезе во Matura секцијата.
**Фајлови:** `vite.config.ts`, `views/MaturaLibraryView.tsx` или каде се вчитуваат matura JSON фајлови
**Очекуван резултат:** Иницијален bundle -2.4MB → побрзо вчитување на главната апликација

### P2 — PWA precache оптимизација
**Проблем:** 13.6MB precache при прво посетување — рурални општини со бавен интернет
**Решение:** Исклучи matura data од precache; стратегија NetworkFirst за AI endpoints
**Фајлови:** `vite.config.ts` (workbox конфигурација)

---

## Tier 2 — Висок импакт (User-facing)

### P3 — Matura Practice UX (Мај 2026 — ИТНО)
**Проблем:** Матурски испити се во мај. Моменталниот QuizPlayer е generic.
**Решение:** Dedicated MaturaExamSession компонента:
- 40-прашање сесија со тајмер (90 мин)
- Score breakdown по тема/категорија
- Детални образложенија по секое прашање
- Режим: Вежба (со feedback) vs Симулација (без hints)
- Историја на сесии + напредок по тема
**Фајлови:** `views/MaturaLibraryView.tsx`, нов `components/matura/MaturaExamSession.tsx`

### P4 — WORKED_EXAMPLE + PRESENTATION аудит
**Проблем:** "НОВО"/"PRO" типови — GeneratorResultPanel рендерирање нетестирано end-to-end
**Решение:** Manual тест + fix на рендерирање; rich viewer за worked examples

### P5 — IMAGE_EXTRACTOR Vision flow
**Проблем:** Vision AI постои но UI за прикачување + preview на резултат не е полиран
**Решение:** Drag-and-drop upload UI + before/after preview на извлечените задачи

---

## Tier 3 — Платформа

| # | Задача |
|---|--------|
| P6 | Matura AI-грејдирање за отворени прашања |
| P7 | Teacher onboarding flow (wizard за нов наставник) |
| P8 | Sentry DSN конфигурација во Vercel |

### P9 — Gemini Embedding 2 upgrade ✅ ЗАВРШЕНО

**Проблем:** RAG инфраструктурата користеше `text-embedding-004` без task types → суб-оптимален recall

**Решение:**

- `api/embed.ts` — accept `taskType` + `outputDimensionality` параметри
- `core.proxy.ts` — `callEmbeddingProxy()` прима `taskType` + `outputDimensionality`
- `ragService.ts` — query со `RETRIEVAL_QUERY` + 768 dims; cache key bump → `v2`
- `api/_lib/sharedUtils.ts` — Zod schema extended со task type enum + dims validation
- `scripts/index-curriculum-embeddings.ts` — upgraded: `gemini-embedding-2` + `RETRIEVAL_DOCUMENT` + 768 dims + model metadata во Firestore
**Matryoshka benefit:** 768 dims vs 3072 default → 4× помали вектори во Firestore, побрз cosine similarity
**Следен чекор:** `npx tsx scripts/index-curriculum-embeddings.ts` → re-индексирај curriculum со новиот модел

---

## Статус

| Task | Статус | Commit |
|------|--------|--------|
| P1 — Bundle split matura | ✅ ЗАВРШЕНО | vite.config globIgnores |
| P2 — PWA precache | ✅ ЗАВРШЕНО | -4.8MB precache (-35%) |
| P3 — Matura Practice UX | ✅ ЗАВРШЕНО | MaturaPortalView weak-topic buttons |
| P4 — Generator audit | ✅ ЗАВРШЕНО | `cc2c3fb` — 5 slide types + PPTX |
| P5 — IMAGE_EXTRACTOR | ✅ ЗАВРШЕНО | `0b24b4b` — imageMode + ExtractionInspector |
| P6 — Matura AI-грејдирање | ✅ ЗАВРШЕНО | `7a31650` — Vision grading (photo → Gemini), 4x QRSolutionUpload bug fix |
| P7 — Teacher onboarding wizard | ✅ ЗАВРШЕНО | `ff0a48e` — 5-step wizard + class creation + join code |
| P8 — Sentry DSN | ✅ ЗАВРШЕНО | VITE_SENTRY_DSN поставен на Vercel (Preview + Production, Mar 16) |
| P9 — Gemini Embedding 2 | ✅ ЗАВРШЕНО | `c88561e` + re-indexed 169 concepts |
| QR Solution Upload | ✅ ЗАВРШЕНО | `581d91a` — QRSolutionUpload + SolutionUploadPage + Storage rules |
| MaturaAssignmentView | ✅ ЗАВРШЕНО | `581d91a` — student view на teacher-assigned matura |
| Geometry2D Quadrilaterals | ✅ ЗАВРШЕНО | `cecf17e` — 7th tab: drag ABCD, auto-detect type, Varignon |
| Geometry3D Prism/Pyramid | ✅ ЗАВРШЕНО | `cecf17e` — 5th tab: n/h/R sliders, 3D drag, V/E/F, formulas |
