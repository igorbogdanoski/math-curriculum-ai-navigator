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

---

## АКТИВЕН ПЛАН (По Приоритет)

---

### 🔴 ИТНО 0 — Поправка на garbled текст во StudentProgressView
**Зошто сега:** Директно ги блокира Albanian и Turkish корисниците. Видливи `?` символи наместо текст.
**Обем:** ~40 garbled стрингови во `views/StudentProgressView.tsx`
**Решение:** Замени секој `>?????<` pattern со `{t('progress.KEY')}` + додај клучевите во `i18n/translations.ts`
**Засегнати области:**
- Report section: наслови на табели, label-и
- Mastery labels: `?? ????????`, `?? ???????????`
- Assignment section: статус label-и
- Print header/footer text

**Фајлови:** `views/StudentProgressView.tsx`, `i18n/translations.ts`
**Проценка:** 2-3 часа
**Статус:** [ ] НЕ ЗАПОЧНАТО

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
**Статус:** [ ] НЕ ЗАПОЧНАТО

---

### 🟠 Б1 — Наставникот задава задача (Assignment Creation)
**Проблем:** Ученикот самостојно одлучува кои квизови ги игра — нема teacher-directed learning. Ова е разликата помеѓу tool vs platform.
**Решение:**
- Копче „Задај на класата" на секој генериран квиз/тест (во `GeneratedAssessment`, `MaterialsGeneratorView`)
- Modal: избор класа/група/индивидуален ученик + deadline датапикер
- Зачувај во Firestore `assignments` колекција (веројатно веќе постои!)
- `AssignmentsTab` веројатно веќе постои — провери статусот

**Провери прво:** `views/analytics/AssignmentsTab.tsx` — дали е имплементирано или само scaffold
**Ефект:** Наставникот контролира учење → системот станува LMS, не само генератор.
**Статус:** [ ] НЕ ЗАПОЧНАТО (провери дали AssignmentsTab е целосен)

---

### 🟠 Б2 — Ученикот гледа свои задачи
**Решение:**
- Картичка „Мои задачи" во `StudentProgressView` (веројатно веќе постои — провери)
- Прикажува: наслов, рок, статус (нерешено/решено/задоцнето)
- Директен линк кон играњето

**Фајлови:** `views/StudentProgressView.tsx`
**Статус:** [ ] НЕ ЗАПОЧНАТО (провери дали делумно постои)

---

### 🟠 Б3 — Наставникот следи completion
**Решение:**
- Во `AssignmentsTab`: листа + % completion по задача
- Кликни → кој ученик завршил/не завршил + просечен резултат

**Фајлови:** `views/analytics/AssignmentsTab.tsx`
**Статус:** [ ] НЕ ЗАПОЧНАТО

---

### 🟡 В2 — Confidence aggregation во Teacher Analytics
**Проблем:** Учениците даваат self-assessment (😟→🤩) по квиз, но наставникот нема aggregated преглед.
**Решение:**
- `StudentsTab`: нова колона „Доверба" (средна confidence emoji по ученик)
- `ConceptsTab`: средна confidence по концепт (покрај avg score)
- `AlertsTab`: нов alert ако средна confidence < 2 за концепт (ученикот не се чувствува сигурен дури и со добар резултат)

**Фајлови:** `views/analytics/StudentsTab.tsx`, `ConceptsTab.tsx`, `AlertsTab.tsx`, `views/analytics/shared.tsx`
**Проценка:** 3-4 часа
**Статус:** [ ] НЕ ЗАПОЧНАТО

---

### 🟡 З3 — Онбординг тур за наставници
**Проблем:** Нов наставник отвора апликација и не знае со што да почне.
**Решение:** Интерактивен тур (tour steps веројатно постојат — провери `tours/`) за:
1. HomeView → „Ова е вашата контролна табла"
2. MaterialsGeneratorView → „Генерирајте материјали за 30 секунди"
3. TeacherAnalyticsView → „Следете напредок на учениците"
**Провери:** `tours/tour-steps.ts`, `tours/planner-tour-steps.ts` — дали постои логика или само stub

**Фајлови:** `contexts/UserPreferencesContext.tsx`, `tours/*.ts`
**Статус:** [ ] НЕ ЗАПОЧНАТО (провери постоечки tours)

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

### 🟢 А3 — Воведување за нови ученици
**Решение:** 3-чекор wizard при прво посетување на StudentPlayView:
1. Внеси ime (валидација: мин 2 зборови)
2. Избери одделение (опционално)
3. Краток preview: „вака изгледа квиз → вака гледаш напредок"

**Фајлови:** Нов `components/student/StudentOnboarding.tsx`, `views/StudentPlayView.tsx`
**Статус:** [ ] НЕ ЗАПОЧНАТО

---

### 🔵 В1 — Draft → Review → Publish workflow
**Проблем:** AI генерира → веднаш достапно за ученик без teacher review.
**Решение:**
- Генерираните материјали добиваат `status: 'draft'` по default
- `ContentReviewView` (веројатно постои) — наставникот прегледува, едитира, публикува
- Само `published` материјали се достапни за ученици

**Провери:** `views/ContentReviewView.tsx` — дали е имплементирано
**Статус:** [ ] НЕ ЗАПОЧНАТО

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
Итно 0  → Поправи garbled текст (2-3 часа)
А1      → Студентски идентитет (1-2 дена) ← КРИТИЧНО
Б1-Б3   → Assignment workflow (2-3 дена) ← ПЛАТФОРМА
В2      → Confidence aggregation (3-4 часа)
З3      → Наставнички тур (2-3 часа)
А2      → Навигациско поедноставување (4-5 часа)
А3      → Student onboarding wizard (3-4 часа)
В1      → Draft/Review workflow (1-2 дена)
Г4      → Директорски dashboard (1 ден)
Г3      → RAG со учебници (>1 недела, бара план)
```

---

> **Правило пред секоја нова сесија:** Провери статусот на AssignmentsTab и ContentReviewView — можно е делумно имплементирани. Не создавај дупликати.
> **Следен commit:** Итно 0 (garbled text) → commit, па А1.
