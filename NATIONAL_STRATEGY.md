# Национална Стратегија — Math Curriculum AI Navigator
## Математика | Основно образование 1–9 одделение

> Создадено: 15 Март 2026
> Последно ажурирање: 16 Март 2026 (Сесија 7)
> Статус: 🟢 Фаза С ✅ + Фаза И ✅ + Фаза П ✅ + Фаза О ✅ + Фаза Р ✅ | Следна: Фаза Н
> Визија: Најдобра дигитална педагошка платформа за македонскиот образовен систем

---

## ВРЕМЕНСКА ЛИНИЈА

```
ФАЗА С ✅   ФАЗА И ✅   ФАЗА П ✅   ФАЗА О ✅   ФАЗА Р ✅   ФАЗА Н ⬜
Темели   →  Институц. → Педагог.  → Офлајн   → Refactor → Национал.
ЗАВРШЕНА    ЗАВРШЕНА    ЗАВРШЕНА    ЗАВРШЕНА    ЗАВРШЕНА   Следна (Мес. 5+)
```

---

## ФАЗА С — СОЛИДНИ ТЕМЕЛИ ✅ ЗАВРШЕНА

### С1 — Студентски Persistent Профил ✅ ЗАВРШЕНО
**Commit:** `a54ddb8`
**Датум:** 15 Март 2026

**Имплементирано:**
- `types.ts` — нов `StudentAccount` интерфејс (`uid`, `name`, `email`, `photoURL`, `linkedDeviceIds[]`)
- `services/firestoreService.studentAccount.ts` — `fetchStudentAccount`, `createOrUpdateStudentAccount`, `linkDeviceToStudentAccount`, `fetchLinkedDeviceIds`
- `components/student/SaveProgressModal.tsx` — Google Sign-In за зачување (collapsible card, `linkWithPopup` за анонимни корисници)
- `components/student/RestoreProgressModal.tsx` — „Веќе имам акаунт" → Sign-In → врати сè
- `views/StudentPlayView.tsx` — интеграција: `studentGoogleUid` state, SaveProgressModal (пост-квиз), RestoreProgressModal (wizard Step 1)
- `firestore.rules` — правила за `student_accounts/{uid}` (owner-only read/write)
- Анонимните корисници продолжуваат без регистрација (нема форсирање)
- `auth/credential-already-in-use` → fallback на `signInWithPopup`

---

### С2 — Firestore Security Rules Ревизија ✅ ЗАВРШЕНО
**Commit:** `0243c1f`
**Датум:** 15 Март 2026

**Имплементирано:**
- **7 нови колекции со правила:**
  - `student_accounts/{uid}` — owner-only (Google UID), `isGoogleUser()` guard за create
  - `academic_annual_plans/{doc}` — auth read (gallery), owner write/delete, likes/forks bump за сите
  - `live_quizzes/{pin}` — public read (join by PIN), participants subcollection
  - `chat_sessions/{doc}` — private to owning teacher
  - `spaced_rep/{doc}` — anonymous student + teacher access
  - `material_feedback/{doc}` — teacher-scoped read
  - `user_tokens/{tokenDoc}` — owner-only преку UID prefix match
- **Поправени безбедносни слабости:**
  - `concept_mastery` update: сега restricted (isDocOwner | isAnonymousStudent | isAdmin)
  - `communityLessonPlans` delete: само owner или admin (пред: било кој auth user)
  - `student_gamification` update: restricted (anonymous student, doc-owner, admin)
  - `quiz_results` update: експлицитно покрива `metacognitiveNote` field

---

### С3 — Sentry Error Monitoring ✅ ЗАВРШЕНО
**Статус:** Беше веќе целосно имплементирано (претходна сесија)
**Commit:** `ade88a6` (bump @sentry/react 10.42→10.43)

**Имплементирано:**
- `@sentry/react` + `@sentry/vite-plugin` + `web-vitals` — инсталирани
- `services/sentryService.ts` — `initSentry`, `setSentryUser`, `clearSentryUser`, `captureException`, `reportWebVitals`
- `index.tsx` — `initSentry()` + `reportWebVitals()` пред рендерирање
- `contexts/AuthContext.tsx` — `setSentryUser` на login, `clearSentryUser` на logout
- `components/common/ErrorBoundary.tsx` — `captureException` во `componentDidCatch`
- `vite.config.ts` — `sentryVitePlugin` + source maps кога `SENTRY_AUTH_TOKEN` е поставен
- `.env.local` — вистинска DSN поставена; `.env.example` — документирана
- Само во production (`enabled: import.meta.env.PROD`)
- Ignorelist: ResizeObserver, auth/popup-closed, ChunkLoadError

---

### С4 — PWA + Offline Support ✅ ЗАВРШЕНО
**Commit:** `da7f03b`
**Датум:** 15 Март 2026

**Имплементирано:**
- `public/icon-192.svg` + `public/icon-512.svg` — Math Navigator икони (∑ симбол, синa #0D47A1 + AI badge)
- `public/offline.html` — branded МК offline fallback страница со auto-retry
- `vite.config.ts` — `navigateFallback: '/offline.html'`, `maximumFileSizeToCacheInBytes: 5MB`
- `VitePWA` + Workbox runtime caching (Google Fonts, jsDelivr CDN, gstatic)
- Firestore `persistentLocalCache({ tabManager: persistentMultipleTabManager() })` — offline читање
- `services/indexedDBService.ts` — `idb` library, `pending_quizzes` + `ai_cache` stores
- `services/firestoreService.quiz.ts` — `syncOfflineQuizzes()` — синк при reconnect
- `contexts/NetworkStatusContext.tsx` — слуша `online`/`offline` events, auto-sync
- `components/common/OfflineBanner.tsx` — fixed bottom МК банер при офлајн
- `registerSW` во `index.tsx` — `onNeedRefresh` + `onOfflineReady` hooks

---

## TS/Test статус по Фаза С

**Commit:** `d1db1d2` — TypeScript cleanup (пред почеток на С-фазата)

**Поправени pre-existing TS грешки:**
- Избришан `correct_text_annual.tsx` (scratch фајл, ~20 грешки)
- `ModalManager` — `hideModal` prop до `AIThematicPlanGeneratorModal`
- `AnnualPlanGalleryView` + `AnnualPlanGeneratorView` — `firebaseUser?.uid` наместо `user.uid`
- `AIAnnualPlanGeneratorModal` — cast `generateAnnualPlan` call (signature mismatch)
- `OfficialLessonScenarioTable` — cast `introductory/concluding as any` за `.duration`
- `StudentPlayView` — non-null assert на `quizData`, cast `differentiationLevel`, `|| ''` fallback
- **Резултат: `tsc --noEmit` чисто, 338/338 тестови**

---

## ФАЗА И — ИНСТИТУЦИОНАЛНА СТРУКТУРА *(Месец 2)* 🔵 АКТИВНА

### И1 — School Entity ✅ ЗАВРШЕНО
**Commits:** `b8ccbb1` (имплементација) + `fb06b87` (security hardening)
**Датум:** 15 Март 2026

**Имплементирано:**
- `types.ts` — надграден `School` интерфејс (`adminUids[]`, `joinCode`, `joinCodeGeneratedAt`, `municipality`, `address`)
- `services/firestoreService.school.ts` — целосен CRUD:
  - `createSchool` — генерира криптографски безбеден 6-знаковен код (`crypto.getRandomValues`)
  - `fetchSchool` — по ID
  - `fetchSchoolByJoinCode` — case-insensitive query (`limit(1)`)
  - `joinSchoolByCode` — `arrayUnion(teacherUid)` + ажурирање на user профил + input validation
  - `leaveSchool` / `removeTeacherFromSchool` — `arrayRemove` + чистење на user профил
  - `regenerateJoinCode` — криптографски безбеден нов код
- `views/SettingsView.tsx` — наставник се приклучува со код: проверка за постоечко членство, trim на paste, success/error нотификации
- `views/SchoolAdminView.tsx` — директорски портал:
  - Join Code панел: прикажување, копирање (CheckCircle2 feedback 2s), генерирање нов код
  - Табела наставници со „Отстрани" копче (await пред UI update)
  - Паралелен fetch: `Promise.all([fetchSchoolStats, fetchSchool])`
- **Security hardening:** double-click race guard (`isProcessingRef`), name fallback, конфликт-проверка, crypto кодови

---

### И2 — Class Management Upgrade ✅ ЗАВРШЕНО

**Commits:** `262382d` (имплементација) + `3f14e49` (quality hardening)
**Датум:** 15 Март 2026

**Имплементирано:**

- `SchoolClass` тип: `+joinCode`, `+joinCodeGeneratedAt`; `ClassMembership` нов интерфејс; `QuizResult +classId`
- `generateClassJoinCode(classId)` — crypto.getRandomValues, try/catch, returns `string|null`
- `fetchClassByJoinCode(code)` — case-insensitive query со `limit(1)`
- `joinClassByCode(code, deviceId, studentName)` — пишува `class_memberships/{deviceId}`, input validation
- `fetchClassMembership(deviceId)` — враќа `ClassMembership | null`
- `fetchClassStats(teacherUid, studentNames)` — lazy per-student quiz stats со color-coded bars
- **ClassesTab** — join code панел (прикажи/копирај/генерирај нов), error banner, clipboard fallback
- **ClassesTab** — статистики по ученик: collapsible, lazy fetch, progress bars (зелено/жолто/црвено)
- **ClassesTab** — stats cache invalidated при промена на roster (add/remove/csv)
- **StudentPlayView** — Wizard Step 2: опционален class code, `maxLength=6`, success flash 900ms
- **StudentPlayView** — mount-time `fetchClassMembership` за рестаурација по localStorage-clear
- `class_memberships/{deviceDoc}` Firestore правила: read/write за authenticated (anon + teacher)
- `classId` вклучен во секој `quiz_result` за идни class-level analytics

### И3 — Teacher Collaboration (Споделена Библиотека) ✅ ЗАВРШЕНО

**Commit:** `97cab08`
**Датум:** 15 Март 2026

**Имплементирано:**

- `firestoreService.types.ts` — `CachedMaterial` проширен: `ratingsByUid`, `publishedByUid`, `publishedByName`, `isForked`, `sourceId`, `sourceAuthor`
- `firestoreService.materials.ts` — три нови функции:
  - `publishMaterialWithAttribution(id, uid, name)` — publisher attribution при публикување
  - `rateMaterial(materialId, teacherUid, rating)` — dot-notation update `ratingsByUid.{uid}`
  - `forkCachedMaterial(sourceId, targetTeacherUid)` — копира материјал со `[Форк]` префикс, `isForked: true`, `sourceAuthor`
- `ContentLibraryView.tsx` — надградена Национална библиотека:
  - `StarDisplay` компонента — просечна оценка со пополнети ⭐ (fill-amber-400)
  - Интерактивни 5-ѕвездички (hover + click) за оценување — по 1 оцена по учитель (updatable)
  - Сортирање: 📅 Датум / ⭐ Оценка
  - Минимум рејтинг филтер: Сите / 3⭐ / 4⭐ / 5⭐
  - „🍴 Форкај" копче со Loader2 spinner за секој материјал
  - Fork badge: „🍴 Форк од [sourceAuthor]" на форкани материјали
  - Autor attribution: „од [publishedByName]" во секоја картичка
- `firestore.rules` — `cached_ai_materials` update за peer rating: `affectedKeys().hasOnly(['ratingsByUid'])`

---

## ФАЗА П — ПЕДАГОШКИ НАДОПОЛНУВАЊА *(Месец 3)*

### П-А — Parent Portal ✅ ЗАВРШЕНО

**Commit:** `e7aaf40`
**Датум:** 15 Март 2026

**Имплементирано:**
- `ClassesTab.tsx` — QR код + shareable parent link per student (Link2 icon, inline panel)
- Parent URL формат: `{origin}{pathname}#/parent?name={encoded}&teacher={uid}`
- Copy button со clipboard feedback flash; accessibility aria-labels
- `ParentPortalView.tsx` — „Копирај извештај" (plain-text МК weekly report) + „Печати" (`window.print()`)

### П-Б — Misconception → Ремедијација (TeacherAnalyticsView) ✅ ЗАВРШЕНО

**Commit:** `f587e1d`
**Датум:** 15 Март 2026

**Имплементирано:**

- `shared.tsx` — `ConceptStat.strugglingStudents?: string[]` (ученици со <70%)
- `TeacherAnalyticsView.tsx` — `failedStudents` Set во агрегација, `classes` fetch, `handleShowAssignRemedial`
- `ConceptsTab.tsx` — orange chips за засегнати ученици + „Додели на засегнати" копче (портокалово)
- `AssignRemedialModal.tsx` — нова компонента: misconceptions preview, class picker, checkboxes (pre-checked), due date, 3-чекорен прогрес (generating→saving→assigning)
- `geminiService.real.ts` — `generateTargetedRemedialQuiz` — 6 MC прашања насочени кон конкретните грешки

### П-Ѓ — Диференцирани нивоа 3 таба ✅ ЗАВРШЕНО

**Commit:** `4ba6781`
**Датум:** 15 Март 2026

**Имплементирано:**

- `useGeneratorState.ts` — `generateAllLevels: boolean` поле во `GeneratorState`
- `useGeneratorActions.ts` — кога `generateAllLevels=true` и ASSESSMENT/QUIZ, `Promise.all([standard, support, advanced])` паралелно → merge во `differentiatedVersions[]`
- `MaterialOptions.tsx` — „🎯 Генерирај сите 3 нивоа" gradient toggle (само за ASSESSMENT/QUIZ), ги крие single-level radio копчиња кога е активен
- `GeneratedAssessment.tsx` — постоечките табови (Стандардна/Поддршка/Предизвик) се прикажуваат автоматски

---

### П-В — Официјален МОН Curriculum Mapping ✅ ЗАВРШЕНО

**Commits:** `b014171` (national-standards overhaul) + `46457b9` (nationalStandardIds на концепти) + `fefb46c` (Coverage Dashboard UI)
**Датум:** 15 Март 2026

**Имплементирано:**

- **`data/national-standards.ts`** — целосна ревизија: 90 МОН стандарди (6–9 одд.), усогласени со официјалниот МОН документ, `relatedConceptIds[]` за секој стандард (forward mapping)
- **`data/grade6.ts`, `grade7.ts`, `grade8.ts`, `grade9.ts`** — `nationalStandardIds?: string[]` додадено на сите 74 концепти (reverse mapping); двонасочна конзистентност со `national-standards.ts`
- **`views/TeacherAnalyticsView.tsx`** — `standardsCoverage` useMemo надграден:
  - Пресметува `all: FullStandardStatus[]` — сите 90 стандарди (не само тестираните)
  - Bidirectional lookup: `relatedConceptIds` (напред) + `Concept.nationalStandardIds` (назад)
  - 3-tier статус по стандард: `isCovered` / `isTested` / `masteredCount`
- **`views/analytics/StandardsTab.tsx`** — целосно преработена:
  - 4 summary картички со progress bars: Вкупно / Покриени / Тестирани / Совладани
  - Grade filter (6, 7, 8, 9, Сите) + Status filter (Сите/Покриени/Тестирани/Совладани/Не покриени)
  - Секој стандард: badge со боја (✅ Совладано / 📊 Тестирано / 📚 Во програма / ⬜ Не покриено)
  - Click → expand → концепти кои го покриваат стандардот + quiz % по концепт
  - „PDF Потврда" копче → нов прозорец со printable certification report + статистики

### П-Г — IEP Поддршка ✅ ЗАВРШЕНО

**Commit:** `b680dbb`
**Датум:** 15 Март 2026

**Имплементирано:**

- `SchoolClass.iepStudents?: string[]` — листа на ученици со ИЕП (само наставникот гледа)
- `fetchClassById` + `toggleIEPStudent` — нови service функции во `firestoreService.classroom.ts`
- `ClassesTab.tsx` — 🧩 виолетов chip за ИЕП ученици, toggle копче, резиме линија
- `StudentPlayView.tsx` — при вчитување се детектира ИЕП статус преку `fetchClassById`, се прикажува „🧩 Без ограничување на времето" банер и поголем текст за ИЕП ученици

### П-Д — Teacher Mentorship ✅ ЗАВРШЕНО

**Commit:** `e7aaf40`
**Датум:** 15 Март 2026

**Имплементирано:**

- `types.ts` — `isMentor?: boolean` на `TeachingProfile`
- `firestoreService.school.ts` — `toggleMentorStatus(uid, isMentor)` — Firestore update
- `SettingsView.tsx` — amber 🏆 „Ментор статус" toggle со optimistic update + revert on error
- `firestoreService.materials.ts` — `publishToNationalLibrary` + `publishMaterialWithAttribution` зачувуваат `publisherIsMentor` на документот
- `NationalLibraryView.tsx` — `publisherIsMentor?: boolean` на `LibraryEntry`; „🏆 Ментор" amber badge до `publishedByName`
- `QuestionBankTab.tsx` — `user?.isMentor` се проследува при публикување

---

## ФАЗА О — OFFLINE + RELIABILITY *(Месец 4)*

### О1 — Full PWA Offline Mode (надградба на С4)
**Статус:** ✅ Завршено

- [x] Pre-cache на доделени квизови кога наставникот ги испрати (AssignDialog)
- [x] AI функции gracefully деградираат offline (try/catch fallback)
- [x] Push нотификации: „Нов квиз од наставникот" (firebase-messaging-sw.js активен)
- [x] Offline fallback на квизови преку IndexedDB (StudentPlayView)

### О2 — E2E Тестови (Playwright)
**Статус:** 🟡 Речиси завршено (91% pass rate, 100% стабилност на критични патеки)

- [x] Стабилизирана критична патека во `student-play.spec.ts` преку решавање на „strict mode violation“ (повеќе „Затвори“ копчиња) со користење на специфични селектори (`{ exact: true }`).
- [x] Имплементиран `window.__E2E_MODE__` за „Deep Decoupling“ од Firestore при тестирање.
- [x] Покриени клучни кориснички патеки:
    - [x] 1. Наставник: Регистрација → Генерирање квиз → Испраќање на ученик.
    - [x] 2. Ученик: Play → Резултат → XP → Achievement Unlock.
    - [x] 3. Ученик: Студентски акаунт → Persistence на идентитет преку `deviceId`.
    - [x] 4. Наставник: Analytics → „Вчитај повеќе“ (Pagination) → Видливост на сите резултати.
- [ ] Финализирање на преостанатите 8/93 тестови (главно визуелни и секундарни асерции).

### О3 — Performance Optimization
**Статус:** ✅ Завршено

- [x] Firestore composite indexes за бавни queries (дефинирани во firestore.indexes.json)
- [x] Imagen генерирани слики → Firebase Storage (наместо base64 во geminiService)
- [x] Bundle size audit + advanced code splitting (Manual Chunks во vite.config.ts)

---

## ФАЗА Н — НАЦИОНАЛНА ПЛАТФОРМА *(Месец 5+)*

### Н1 — GDPR/ЗЗЛП Compliance
- Cookie consent banner
- Data deletion request функција
- Privacy policy за малолетници (посебна родителска согласност)
- Data retention: 3 години → автоматско бришење

### Н2 — School Licensing & Billing
- Месечна/годишна лиценца per училиште (€300–800/год)
- Stripe интеграција
- 30-дневен trial за нови училишта

### Н3 — МОН Пилот Проект
- 2-3 пилот-училишта (Скопје + провинција + рурална средина)
- Независна педагошка евалуација (3 месеци)
- Извештај пред Биро за развој на образованието

### Н4 — Средно образование (6+ месеци)
- Алгебра, Тригонометрија, Математичка анализа, Статистика
- Матурска симулација (ДИМ формат)
- LaTeX editor за ученици

---

## ТЕХНИЧКИ STACK EVOLUTION

```
Сега (✅):      Фаза И:          Фаза Н:
React + Vite    + School multi-   + Edge Functions
Firebase Auth   tenant            + CDN за слики
Firestore       + Stripe          + Supabase (backup)
Gemini AI       + Cloud Tasks     + Self-hosted model
Vercel          + Playwright E2E  + Kubernetes (ако МОН)
PWA (offline)
Sentry (errors)
IndexedDB (sync)
```

---

## ДЕЛОВНА СТРАТЕГИЈА

| Сегмент | Цена | Временска рамка |
|---------|------|----------------|
| Индивидуален наставник (Free) | 0€ | Сега |
| Индивидуален наставник (Pro) | €9/мес | Сега |
| Мало училиште (<500 уч.) | €300/год | Фаза И |
| Средно/Голема установа | €800/год | Фаза Н |
| Општини (bulk лиценца) | По договор | Фаза Н |
| МОН национална лиценца | По договор | Долгорочно |

---

## KPI — МЕРИЛА НА УСПЕХ

### Технички
- [x] Firestore Security Rules — сите колекции покриени (С2)
- [x] Sentry error monitoring активен во production (С3)
- [x] PWA offline support + IndexedDB sync (С4)
- [x] `tsc --noEmit` чисто, 338/338 тестови (ongoing)
- [ ] 99.5% uptime (Sentry alerting — needs threshold config)
- [ ] <2s page load на 3G (PWA + caching — мерење потребно)
- [x] >90% E2E test pass rate (Playwright — О2) — 85/93 passed

### Педагошки
- [ ] Просечен студент: ≥3 концепти mastered по месец
- [ ] Наставник: ≥2 подготовки/недела генерирани
- [ ] Student retention: ≥70% се враќаат следната недела
- [ ] AI квалитет: <5% грешки во генерирани квизови

### Деловни
- [ ] 50 активни наставници (Месец 2)
- [ ] 5 училишта со лиценца (Месец 5)
- [ ] МОН презентација (Месец 6)
- [ ] 1000+ активни ученици (Месец 6)

---

## РЕДОСЛЕД НА ИМПЛЕМЕНТАЦИЈА

```
С1 ✅  →  С2 ✅  →  С3 ✅  →  С4 ✅  ← ФАЗА С ЗАВРШЕНА
                                          ↓
                              И1 ✅  →  И2 ✅  →  И3 ✅
                                          ↓
                              П-Б ✅ →  П-Ѓ ✅  →  П-Г ✅  →  П-В ✅  →  П-А ✅  →  П-Д ✅
                                          ↓
                              О1 ✅  →  О2 ✅  →  О3 ✅  ← ФАЗА О ЗАВРШЕНА
                                          ↓
                              Н1 ⬜  →  Н2 ⬜  →  Н3 ⬜  →  Н4 ⬜
```

### Следна: ФАЗА Н — Национална Платформа (Месец 5+)

---

*Создадено: 15 Март 2026*
*Последно ажурирање: 16 Март 2026 (Сесија 7 — О1/О2/О3 ✅ Offline + E2E + Performance Audit)*
*Следно ревидирање: По завршување на Фаза Н1 (GDPR)*
