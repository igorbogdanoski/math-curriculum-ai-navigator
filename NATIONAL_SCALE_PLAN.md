# Национален План за Скалирање — Math Curriculum AI Navigator

> Документ создаден: 05.03.2026
> Основа: Експертска анализа по завршување на Фаза Е
> Цел: Трансформација на прототип → национален EdTech производ за сите училишта во Македонија

---

## Статус по Фаза Е

| Домен | Статус |
|---|---|
| Наставни програми (БРО / МОН) | ✅ Официјални документи, важечки за сите училишта |
| AI генерирање на материјали | ✅ Gemini 2.5 Flash, квота-свесен |
| Гемификација (XP, стрикови, лиги) | ✅ Celосно имплементирано |
| Наставничка аналитика (11 табови) | ✅ Детална |
| Родителски портал | ✅ Неделен преглед |
| Пристапност (дислексија, контраст) | ✅ CSS глобален |
| Верифицирана банка на прашања | ✅ |
| Мултинаставник / изолација на класа | ✅ |
| Идентитет на ученик | ⚠️ Само по ime (localStorage string) — КРИТИЧНО |
| Офлајн поддршка | ❌ Нема Service Worker |
| Мобилна оптимизација | ⚠️ Делумна |
| Училиште / Директор | ❌ Нема |
| Малцинствени јазици (АЛБ/ТУР) | ❌ Нема |

---

## Фаза Ж: Институционална Готовност

**Приоритет: КРИТИЧНО — блокира национален deploy**

### Ж1: Стабилен Идентитет на Ученик (Device Token) 🔴 [СЛЕДНО]
**Проблем**: `studentName` е единствен клуч — судири при исти имиња, загуба при промена на уред.
**Решение**: UUID `deviceId` генериран при прв посет, зачуван во localStorage.

- [x] `utils/studentIdentity.ts` — `getOrCreateDeviceId()` + `getDeviceId()` со `crypto.randomUUID()`
- [x] `deviceId?` поле на `QuizResult`, `ConceptMastery`, `StudentGamification` интерфејси
- [x] `saveQuizResult` / `updateConceptMastery` / `updateStudentGamification` → вклучуваат `deviceId`
- [x] `fetchQuizResultsByStudentName(name, deviceId?)` / `fetchMasteryByStudent(name, deviceId?)` → deviceId query прво, fallback на studentName
- [x] `fetchStudentGamification(name, teacherUid?, deviceId?)` → тројна fallback верига
- [x] `StudentPlayView` → `getOrCreateDeviceId()` при секоја сесија
- [x] `StudentProgressView` → `getDeviceId()` (само кога student ги гледа своите, не parent view)
- [x] `firestore.indexes.json` → нови индекси за `deviceId` queries
- [x] Backward compat: стари записи без deviceId продолжуваат да работат

### Ж2: Ентитет Училиште + Директорски Портал 🟠
**Проблем**: Нема организациска хиерархија — директорот нема преглед.
- [ ] `School` интерфејс: id, name, city, teacherUids[], adminUid
- [ ] `SchoolAdminView` — агрегирана аналитика по наставник (просечни резултати, активни ученици)
- [ ] `firestoreService.fetchSchoolStats(schoolId)` — агрегација
- [ ] `firestore.rules` — schoolAdmin може да чита, не пишува
- [ ] Регистрација на наставник → поврзување со училиште

### Ж3: Офлајн-прва Архитектура (Service Worker) 🟠
**Проблем**: На 3G / без интернет — апликацијата е бескорисна.
- [ ] `vite-plugin-pwa` или рачен Service Worker
- [ ] Cache: наставни програми (curriculum docs), генерирани квизови (cached_ai_materials)
- [ ] `IndexedDB` за offline quiz play → синк при reconnect
- [ ] Offline banner („Работите офлајн — резултатите ќе се синкронизираат")
- [ ] `manifest.json` → Install as PWA prompt

---

## Фаза З: Содржинска Вредност

**Приоритет: ВИСОК — го определува квалитетот на производот**

### З1: Преглед на Содржина со Предметни Наставници 🟡
- [ ] Export на сите AI-генерирани прашања по концепт → Excel/CSV за рецензија
- [ ] `ContentReviewView` (само за admin) — листа на материјали, status: draft/reviewed/approved
- [ ] `isApproved?: boolean` на `CachedMaterial` во Firestore
- [ ] Approved материјали → приоритет во генерирање

### З2: Македонски Примери по Концепт
- [ ] За секој концепт: 1-3 реални примери со македонски контекст (денари, килограми, km...)
- [ ] `Concept.contextExamples?: string[]` во типовите
- [ ] AI prompt enrichment: вклучи contextExamples во prompt за поприродни прашања

### З3: Наставничка Онбординг Патека
- [ ] `TourStep` систем за нови наставници (3-5 чекори)
- [ ] Видео/GIF водичи за: генерирање материјали, аналитика, live сесии
- [ ] `onboardingCompleted` во user preferences

---

## Фаза И: Диференцијатори

**Приоритет: СРЕДЕН — конкурентска предност**

### И1: Мобилна / Таблет Оптимизација ✅
- [x] Audit на сите views на 375px (iPhone SE) — fix overflow/truncation
- [x] `InteractiveQuizPlayer` → touch-friendly (поголеми копчиња ≥44px)
- [x] `StudentProgressView` на мобилен → collapsed cards, scroll-friendly
- [x] Тест на iOS Safari + Android Chrome

### И2: МОН Интеграција — Оценки (1-5) Извоз
- [ ] Export на резултати во формат компатибилен со е-Дневник
- [ ] PDF извештај по ученик со МК оценка (1-5) и концепти
- [ ] QR код линк за родители → директно до PDF

### И3: Јазици на Малцинства (АЛБ / ТУР) 🟢
- [ ] `i18n` систем: `mk` (default) + `sq` (Албански) + `tr` (Турски)
- [ ] Превод на UI strings (не на AI генерирање — тоа останува МК за сега)
- [ ] Копче за избор на јазик во HeaderView

### И4: Национална Библиотека на Содржина
- [ ] Верификуваните прашања → видливи за сите наставници (не само сопственикот)
- [ ] `isPublic?: boolean` на `SavedQuestion`
- [ ] `fetchPublicQuestions(conceptId)` — глобална банка
- [ ] Систем за оценување на јавни прашања (thumbs up/down)

---

## Приоритетен Редослед за Имплементација

```
Ж1 → Ж2 → И1 → З3 → Ж3 → З1 → З2 → И2 → И3 → И4
```

**Ж1 е блокер за сè друго** — без стабилен идентитет, сите следни фази градат на нестабилна основа.

---

## Технички Долг (да се адресира паралелно)

- `ACHIEVEMENTS` константата е во `firestoreService.ts` → треба во `utils/achievements.ts`
- `calcFibonacciLevel` е повикана на повеќе места — доколку се промени формулата, треба refactor
- Нема unit тестови за `gamification.ts`, `dailyQuests.ts`, `grading.ts`
- `TeacherAnalyticsView` сè уште е 400+ линии — разгледај дополнително splitting
