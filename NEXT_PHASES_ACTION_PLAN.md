# Акционен план: Следни Фази (Ажуриран 06.03.2026)

> Овој документ го заменува претходниот план и ги вклучува сите завршени работи до 06.03.2026.
> Базиран на: комплетна кодна ревизија + педагошка процена + мулти-училишни барања.

---

## ЧТО Е ЦЕЛОСНО ЗАВРШЕНО (до 06.03.2026)

| Фаза | Опис | Commit |
|------|------|--------|
| Правец 1–15, 19–22, П26–П28 | Сите педагошки приоритети, refactor, gamification, analytics | ecb10d3–347b02c |
| Фаза Г (Phase D) — сите 4 цели | Scaffold hints, reading mode, math tools, fibonacci levels | d сесија |
| Фаза Е (Phase E) — сите 5 цели | Daily quests, leagues, AI feedback, verified bank, parental portal | е сесија |
| Приоритет 1: Локализација | analytics.*, progress.*, play.* за МК/SQ/TR | 376a9fb |
| Приоритет 2: School entity | SchoolAdminView, SystemAdminView, multi-teacher isolation | 9b4e70d |
| Приоритет 3: PWA / Offline | vite-plugin-pwa, IndexedDB, service worker, OfflineBanner | завршено |
| Приоритет 4.1 — З1 | Македонски контекст во AI (денари, имиња, градови) | 928c46b |
| Приоритет 5.1 — И2 | CSV/PDF export во TeacherAnalyticsView | завршено |
| Приоритет 5.2 — И4 | Национална Библиотека (публикување + увоз на прашања) | b21c110 |
| Generator panel bugs | animationend bubbling, stale timeout, ResultErrorBoundary | 550e9af |
| Итно 0 — Garbled текст | StudentProgressView.tsx ~80 garbled strings → t() + 44 translation keys | 8546a4d |
| А1 — Студентски идентитет | student_identity collection, saveStudentIdentity, auto-restore on mount | f723a86 |
| Б1 — Наставник задава задача | AssignDialog во MaterialsGeneratorView + firestoreService.createAssignment | веќе постоеше |
| Б2 — Ученик гледа задачи | StudentProgressView fetchAssignmentsByStudent + задачи картичка | веќе постоеше |
| Б3 — Наставник следи completion | AssignmentsTab.tsx целосно имплементиран | веќе постоеше |

---

## АКТИВЕН ПЛАН (По Приоритет)

---

### ✅ ИТНО 0 — Поправка на garbled текст во StudentProgressView

**Статус:** ЗАВРШЕНО (commit 8546a4d) — 80+ garbled strings → t() + 44 translation keys per lang (MK/SQ/TR)

---

### 🔴 А1 — Трајност на студентски идентитет (КРИТИЧНО)
**Проблем:** Ученикот е идентификуван само по `studentName` string. Различен браузер = изгубена историја. Garbled `?` = невозможна идентификација за non-МК ученици.
**Решение:**
1. При прво внесување на ime, поврзи го со `auth.currentUser.uid` (анонимен Firebase UID)
2. Зачувај `student_identity` документ: `{ deviceId, name, anonymousUid, createdAt }`
3. При секое следно посетување, lookup по `deviceId` → автоматски pop-populate на ime
4. `quiz_results` и `concept_mastery` додај `studentUid` поред `studentName`

**Нови файлови:** `utils/studentIdentity.ts` (веројатно веќе делумно постои — провери)
**Засегнати:** `views/StudentPlayView.tsx`, `views/StudentProgressView.tsx`, `services/firestoreService.ts`
**Firestore:** нова колекција `student_identity` + нов индекс
**Ефект:** Mastery tracking, gamification и progress стануваат реално употребливи преку уреди.
**Статус:** ЗАВРШЕНО (commit f723a86) — `student_identity` Firestore collection, auto-restore on mount

---

### ✅ Б1 — Наставникот задава задача

**Статус:** ЗАВРШЕНО (веќе постоеше) — `AssignDialog` во MaterialsGeneratorView + `firestoreService.createAssignment`

---

### ✅ Б2 — Ученикот гледа свои задачи

**Статус:** ЗАВРШЕНО (веќе постоеше) — `StudentProgressView` fetchAssignmentsByStudent + задачи картичка

---

### ✅ Б3 — Наставникот следи completion

**Статус:** ЗАВРШЕНО (веќе постоеше) — `AssignmentsTab.tsx` целосно имплементиран (листа + % + expand)

---

### ✅ В2 — Confidence aggregation во Teacher Analytics

**Статус:** ЗАВРШЕНО (веќе постоеше) — avgConfidence пресметан во TeacherAnalyticsView, прикажан во StudentsTab + ConceptsTab + AlertsTab (lowConfidenceStudents card)

---

### ✅ З3 — Онбординг тур за наставници

**Статус:** ЗАВРШЕНО (веќе постоеше) — GlobalTour.tsx + Joyride + 5 tour files (dashboard/generator/library/planner/explore) + useTour + useTourStore hooks

---

### 🟢 А2 — Поедноставување на навигацијата
**Проблем:** 14 аналитички табови, 44 views — когнитивно преоптоварување.
**Решение:**
- `TeacherAnalyticsView`: само 4 табови видливи по default (Преглед, Ученици, Концепти, Внимание)
- Останатите зад „+ Повеќе" копче
- `HomeView`: реструктуирај во 5 главни акции

**Фајлови:** `views/TeacherAnalyticsView.tsx`, `views/HomeView.tsx`
**Статус:** [ ] НЕ ЗАПОЧНАТО

---

### ✅ А3 — Воведување за нови ученици

**Статус:** ЗАВРШЕНО (веќе постоеше) — wizardStep 0/1/null во StudentPlayView, 2-чекор onboarding (features preview → name entry) со t() локализација

---

### ✅ В1 — Draft → Review → Publish workflow

**Статус:** ЗАВРШЕНО (веќе постоеше) — ContentReviewView.tsx со fetchUnapprovedQuestions, approve/reject, CSV export (за admin/school_admin улоги)

---

### 🔵 Г4 — Директорски Dashboard (подобрување)
**Тековно:** `SchoolAdminView` постои но агрегира минимално.
**Решение:**
- Паралелки споредба (која паралелка е понапред по концепти)
- Наставници преглед (кој наставник генерирал повеќе/помалку материјали)
- Trend по недели за целото училиште

**Фајлови:** `views/SchoolAdminView.tsx`, `services/firestoreService.ts`
**Статус:** [ ] НЕ ЗАПОЧНАТО

---

### 🔵 Г3 — RAG со македонски учебници
**Решение:** Firebase Vector Search + uploaded учебнички PDF → AI секогаш се базира на официјален извор.
**Нота:** Ова бара Firebase Blaze план + backend Cloud Function.
**Статус:** [ ] НЕ ЗАПОЧНАТО (бара инфраструктурна одлука)

---

## ТЕХНИЧКИ ДОЛГ (паралелно)

| Проблем | Файл | Итност |
|---------|------|--------|
| `importFromNationalLibrary` — race condition на importCount | `firestoreService.ts` | ВИСОКА |
| `fetchNationalLibrary` — type filter е in-memory, не Firestore query | `firestoreService.ts` | СРЕДНА |
| `firestoreService.ts` 1380 линии — треба split по домени | `firestoreService.ts` | НИСКА |
| Нема composite Firestore индекс за `national_library` | `firestore.indexes.json` | СРЕДНА |

---

## ПРЕПОРАЧАН РЕДОСЛЕД НА ИЗВРШУВАЊЕ

```
✅ Итно 0  → Поправи garbled текст
✅ А1      → Студентски идентитет
✅ Б1-Б3   → Assignment workflow (веќе постоеше)
✅ В2      → Confidence aggregation (веќе постоеше)
✅ З3      → Наставнички тур (веќе постоеше)
✅ А3      → Student onboarding wizard (веќе постоеше)
✅ В1      → Draft/Review workflow (веќе постоеше)
→  А2      → Навигациско поедноставување (4-5 часа)  ← СЛЕДНО
   Г4      → Директорски dashboard (1 ден)
   Г3      → RAG со учебници (>1 недела, бара план)
```

---

> **Правило пред секоја нова сесија:** Провери статусот на AssignmentsTab и ContentReviewView — можно е делумно имплементирани. Не создавај дупликати.
> **Следен commit:** Итно 0 (garbled text) → commit, па А1.
