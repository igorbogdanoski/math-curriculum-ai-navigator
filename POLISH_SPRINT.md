# Polish Sprint — Math Curriculum AI Navigator
## Цел: Светско ниво. Најдобра EdTech математичка платформа во регионот.
> Создаден: 18 Март 2026 | Сесија 8

---

## Оценка пред Sprint: **8.1 / 10**
## Цел по Sprint: **9.2 / 10**

---

## 🔴 КРИТИЧНО — Веднаш (Ден 1–2)

### P1 — Замена на `alert()` / `window.confirm()` → ConfirmDialog + useNotification
**Статус:** ✅ ЗАВРШЕНО (Сесија 8)

Засегнати фајлови (25 инстанци, 13 фајлови):
- [x] `components/ai/AIGeneratorPanel.tsx` — window.confirm → ConfirmDialog
- [x] `components/ai/InfographicPreviewModal.tsx` — alert → addNotification
- [x] `components/common/MathScratchpad.tsx` — window.confirm → ConfirmDialog
- [x] `views/analytics/ClassesTab.tsx` — alert + window.confirm → notification + dialog
- [x] `views/analytics/GroupsTab.tsx` — window.confirm → ConfirmDialog
- [x] `views/analytics/QuestionBankTab.tsx` — window.confirm → ConfirmDialog
- [x] `views/analytics/StandardsTab.tsx` — alert × 2 → addNotification
- [x] `views/AnnualPlanGalleryView.tsx` — alert × 4 + window.confirm → notification + dialog
- [x] `views/AnnualPlanGeneratorView.tsx` — alert × 2 → addNotification
- [x] `views/CurriculumEditorView.tsx` — window.confirm → ConfirmDialog
- [x] `views/LessonPlanEditorView.tsx` — window.confirm → ConfirmDialog
- [x] `views/SchoolAdminView.tsx` — window.confirm → ConfirmDialog
- [x] `views/SettingsView.tsx` — window.confirm × 2 → ConfirmDialog

### P2 — Debounce на Search Inputs
**Статус:** ✅ ЗАВРШЕНО (Сесија 8)

- [x] `views/ExploreView.tsx` — useMemo/filter debounced
- [x] `components/common/GlobalSearchBar.tsx` — debounce on keystroke

### P3 — Отстранување console.log од production сервиси
**Статус:** ✅ ЗАВРШЕНО (Сесија 8)

- [x] `services/firestoreService.materials.ts` — 4 console.log
- [x] `services/firestoreService.quiz.ts` — 4 console.log (не E2E)

---

## 🟠 ВИСОК ПРИОРИТЕТ — Следна недела (Ден 3–7)

### P4 — aria-labels на icon-only копчиња
**Статус:** ✅ ЗАВРШЕНО (Сесија 8)

### P5 — Form валидација со инлајн грешки
**Статус:** ✅ ЗАВРШЕНО (Сесија 9)

Засегнати форми:
- [x] `views/GradeBookView.tsx` — инлајн грешки (name, testTitle, raw, max) со червена рамка
- [x] `views/AnnualPlanGeneratorView.tsx` — задолжителни полиња со грешки
- [x] `views/SchoolAdminView.tsx` — нема форми (само акциски копчиња)
- [x] `views/SettingsView.tsx` — инлајн грешки за додавање студентски профил

### P6 — i18n за нови компоненти
**Статус:** ✅ ЗАВРШЕНО (Сесија 9)

- [x] `components/generator/SmartStart.tsx` — сите UI стрингови на МК; "Smart Start" е бренд-назив
- [x] `views/WrittenTestReviewView.tsx` — исправено: "Мн. добар" → "Многу добар", "Незад." → "Незадоволителен"
- [x] `components/academy/AcademyDailyHub.tsx` — сите стрингови на МК ✅; додадено aria-label на refresh копчето

---

## 🟡 СРЕДЕН ПРИОРИТЕТ — Следен месец

### P7 — Canvas Colors → Константи
**Статус:** ✅ ЗАВРШЕНО (Сесија 10)

- [x] `views/CurriculumGraphView.tsx` — CANVAS_BG, EDGE_DEFAULT_COLOR, EDGE_GLOBAL_COLOR извлечени; сите canvas бои се именувани константи

### P8 — Optimistic UI Updates
**Статус:** ✅ ЗАВРШЕНО (Сесија 9)

- [x] `views/AnnualPlanGalleryView.tsx` — like: optimistic update + rollback on error; fork: isForking lock + spinner
- [ ] `views/TeacherAnalyticsView.tsx` — announcements optimistic (backlog)

### P9 — Keyboard Shortcuts
**Статус:** ✅ ЗАВРШЕНО (Сесија 9–10)

- [x] Cmd+K → Command Palette (глобален, сите рути + AI акции + концепти)
- [x] Ctrl+S / Cmd+S → Зачувај во `LessonPlanEditorView` + `AnnualPlanGeneratorView`
- [x] Escape → Затвори Command Palette, Confirm Dialog, panels
- [x] Ctrl+G → Отвори AI Generator Panel директно (глобален)
- [x] CommandPalette: focus restoration на затворање (triggerRef); Ctrl+G hint во footer

### P10 — Performance
**Статус:** ✅ ДЕЛУМНО ЗАВРШЕНО (Сесија 10)

- [x] `views/NationalLibraryView.tsx` — cursor-based pagination limit(20) + startAfter; "Прикажи повеќе"
- [ ] `views/TeacherAnalyticsView.tsx` — виртуелизација на долги листи (сложено, ~4h)

---

## 🟢 BACKLOG — По МОН Презентација

### P11 — Undo/Redo во Editors
- [ ] `views/LessonPlanEditorView.tsx`
- [ ] `views/AnnualPlanGeneratorView.tsx`

### P12 — Real-time Presence Indicators
- [ ] SharedPlanView — "X го уредува"
- [ ] Live Sessions — participant count live

### P13 — Bulk Operations во Analytics
- [ ] Мулти-избор ученици → bulk remedial assign
- [ ] Bulk export (повеќе date ranges)

### P14 — Search History
- [ ] `components/common/GlobalSearchBar.tsx` — recent searches (localStorage)
- [ ] `views/ExploreView.tsx` — saved searches

### P15 — Средно образование (чека МОН PDFs)
- [ ] Gymnasium curriculum — полни концепти по PDF
- [ ] ДИМ Матура симулации

---

## Метрики за успех

| Метрика | Пред Sprint | По Sprint |
|---------|-------------|-----------|
| `alert()` инстанци | 14 | 0 |
| `window.confirm()` инстанци | 11 | 0 |
| console.log во сервиси | 8 | 0 |
| Оценка UX Consistency | 6.5/10 | 8.5/10 |
| Вкупна оценка | 8.1/10 | 9.2/10 |

---

## Визија

> „Апликацијата треба да биде толку добра што кога МОН инспектор ја види,
> веднаш ќе праша 'Зошто ова не го имаме во секое училиште?'"

*Последно ажурирање: 21 Март 2026 (Сесија 10 — P7, P8, P9 целосно ✅; P10 делумно ✅; key stability sweep; NationalLibrary pagination)*
