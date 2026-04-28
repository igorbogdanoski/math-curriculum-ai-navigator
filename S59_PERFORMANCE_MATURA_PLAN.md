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
| P6 | Matura AI-грейдирање за отворени прашања |
| P7 | Teacher onboarding flow (wizard за нов наставник) |
| P8 | Sentry DSN конфигурација во Vercel |

---

## Статус

| Task | Статус | Commit |
|------|--------|--------|
| P1 — Bundle split matura | ⏳ ВО ТЕК | — |
| P2 — PWA precache | ⏳ Следно | — |
| P3 — Matura Practice UX | ⏳ Следно | — |
| P4 — Generator audit | ⏳ Планирано | — |
| P5 — IMAGE_EXTRACTOR | ⏳ Планирано | — |
