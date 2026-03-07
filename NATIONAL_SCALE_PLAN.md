# План за Национална Скала — Math Curriculum AI Navigator
> **Датум:** 07.03.2026 | **Цел:** Елиминација на слабостите + подигање на апликацијата на државно ниво

---

## ФАЗА 1 — Отстранување на евидентирани слабости (Tehnicki Dolg)

| # | Задача | Приоритет | Статус | Commit |
| --- | --- | --- | --- | --- |
| W1 | Concept name resolution во SystemAdminView Stats (читливо ime наместо raw ID) | Висок | ✅ Завршено | `7f8a8ba` |
| W2 | Real-time sync со Firebase `onSnapshot` (огласи + задачи без refresh) | Висок | ✅ Завршено | `2560251` |
| W3 | StudentProgressView декомпозиција во sub-компоненти (<250 линии секоја) | Среден | ✅ Завршено | `d5c652a` |
| W4 | geminiService.real.ts поделба по домен (quiz / ideas / rubric / chat / paths) | Низок | Планирано | — |
| W5 | useGeneratorActions.ts поделба (useBulkGenerate / useVariantGenerate / useQuotaManager) | Низок | Планирано | — |

---

## ФАЗА 2 — Национална Скалабилност (Deployment-Ready)

| # | Задача | Приоритет | Статус | Commit |
| --- | --- | --- | --- | --- |
| N1 | Offline-First: IndexedDB кеш + Background Sync за рурални општини | Критичен | Планирано | — |
| N2 | CSV bulk import за ученици (upload список на имиња по клас) | Висок | ✅ Завршено | `ea776e8` |
| N3 | Firestore composite indexes за national stats queries (performance) | Среден | Планирано | — |

---

## ФАЗА 3 — AI Продлабочување

| # | Задача | Приоритет | Статус | Commit |
| --- | --- | --- | --- | --- |
| A1 | Curriculum-aware AI Tutor (context: концепт + грешки на ученикот) | Висок | ✅ Завршено | `a3899fc` |
| A2 | AI Родителски Извештај (автоматски месечен PDF per student со наратив) | Висок | ✅ Завршено | `600bce9` |
| A3 | Предиктивна аналитика — предупредувачки систем „ученик во ризик" | Среден | Планирано | — |
| A4 | Handwriting OCR — Vision API за скенирање домашни задачи | Низок | Планирано | — |

---

## ФАЗА 4 — Монетизација и B2B (Долгорочно)

| # | Задача | Приоритет | Статус | Commit |
| --- | --- | --- | --- | --- |
| M1 | Freemium модел — 10 генерации/месец free, Unlimited за претплатени училишта | — | Планирано | — |
| M2 | Marketplace за материјали — верификувани квизови со цена (National Library paid tier) | — | Планирано | — |
| M3 | API за издавачи — embedded generator за Просветно дело / Логос | — | Планирано | — |

---

## Детални технички спецификации

### W1 — Concept Name Resolution
**Проблем:** SystemAdminView прикажува суров `conceptId` (пр. `pythagorean-theorem`) наместо „Питагорова теорема".
**Решение:** `useCurriculum()` хук во SystemAdminView → lookup map `conceptId → title` → приказ на читливо ime.

### W2 — Real-Time Student Sync
**Проблем:** Ученикот мора рачно да refresh-не за да ги види новите огласи/задачи од наставникот.
**Решение:** Замена на `getDocs()` со `onSnapshot()` во `useStudentProgress.ts` за `announcements` и `assignments`. Cleanup listener во useEffect return.

### W3 — StudentProgressView Decomposition
**Проблем:** 904 линии во еден фајл.
**Решение:** Издвојување во 4 sub-компоненти:
- `components/student/ProgressHeader.tsx` — профил + XP + streak
- `components/student/MasteryGrid.tsx` — карта на знаење + next steps + prerequisites
- `components/student/ActivityFeed.tsx` — резултати + задачи + огласи
- `components/student/GamificationPanel.tsx` — достигнувања грид

### N1 — Offline-First Architecture
**Проблем:** Рурални општини = нестабилен интернет = неможност за квизови.
**Решение:**
1. `utils/offlineCache.ts` — IndexedDB wrapper (чита/пишува quiz_results локално)
2. `StudentPlayView` — пишува резултат прво во IndexedDB, потоа Firebase
3. Service Worker `background-sync` — синхронизира кога мрежата се врати
4. `OfflineBanner` компонент — индикатор дали работи офлајн

### N2 — CSV Bulk Student Import
**Решение:**
1. Upload на `.csv` во ClassesTab (Аналитика → Класи)
2. Parse: `name, gradeLevel` колони
3. Batch create `student_identity` записи
4. Preview + потврда пред увоз

### A1 — Curriculum-Aware AI Tutor
**Проблем:** Туторот е generic — не знае кој концепт го учи ученикот ни какви грешки имал.
**Решение:**
1. `/tutor?student=X&concept=Y` — прима URL params
2. Fetch последните 5 quiz_results за тој концепт
3. Инјектира контекст: „Ученикот имал 45% на [концепт]. Грешки: [X, Y]. Помогни му..."
4. „Вежбај со туторот" копче во StudentProgressView за секој слаб концепт

### A2 — AI Родителски Извештај
**Решение:**
1. `generateParentReport(studentName, results, mastery)` во geminiService
2. AI генерира наратив: силни страни, слаби области, препораки за дома
3. PDF преку `window.print()` на styled `<ParentReportView>`
4. Надградба на постоечкиот `/parent` QR портал

---

*Овој документ се ажурира по секој завршен sprint. Последно ажурирање: 07.03.2026. Следен преглед: 14.03.2026.*
