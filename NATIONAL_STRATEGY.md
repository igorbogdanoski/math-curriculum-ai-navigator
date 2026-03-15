# Национална Стратегија — Math Curriculum AI Navigator
## Математика | Основно образование 1–9 одделение

> Создадено: 15 Март 2026
> Последно ажурирање: 15 Март 2026 (Сесија 2)
> Статус: 🟢 Активна имплементација — Фаза С ЗАВРШЕНА
> Визија: Најдобра дигитална педагошка платформа за македонскиот образовен систем

---

## ВРЕМЕНСКА ЛИНИЈА

```
ФАЗА С ✅   ФАЗА И      ФАЗА П      ФАЗА О      ФАЗА Н
Темели   →  Институц. → Педагог.  → Офлајн   → Национал.
ЗАВРШЕНА    Мес. 2       Мес. 3      Мес. 4     Мес. 5+
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

## ФАЗА И — ИНСТИТУЦИОНАЛНА СТРУКТУРА *(Месец 2)* 🔵 СЛЕДНА

### И1 — School Entity (Прва класа)
**Статус:** ⬜ Не започнато

- `schools/{id}` колекција: `{ name, municipality, address, adminUids[], teacherUids[], tier, createdAt }`
- School Admin dashboard: управување со наставници и класови
- Наставник се приклучува кон училиште со **код**
- Статистики на ниво на училиште (агрегирани, анонимни)
- Школска библиотека — споделени материјали само во рамки на установата

### И2 — Class Management Upgrade
**Статус:** ⬜ Не започнато (основата постои: `classes` колекција)

- Наставникот генерира **код за приклучување** (6 знаци)
- Ученикот внесува код при прв квиз → автоматски линкуван кон класот
- Class-level analytics: просек по поглавје, споредба меѓу класови
- Assignments per class со deadline + нотификации

### И3 — Teacher Collaboration (Споделена Библиотека)
**Статус:** ⬜ Не започнато (National Library постои, треба надградба)

- Rating систем (1-5 ⭐) за споделени материјали
- Филтри: по одделение, по тема, по тип на материјал, по оценка
- „Испратено од колега" badge + автор профил
- Fork функција: земи туѓ материјал → прилагоди → зачувај свој

---

## ФАЗА П — ПЕДАГОШКИ НАДОПОЛНУВАЊА *(Месец 3)*

### П-А — Parent Portal
**Статус:** ⬜ Не започнато

- Родителски акаунт (Google Sign-In) линкуван кон еден или повеќе ученици
- Read-only view: напредок, постигнувања, надоаѓачки квизови
- Неделен автоматски email извештај (Cloud Functions)
- Мобилно-оптимизиран (родителите гледаат на телефон, не на компјутер)

### П-Б — Misconception → Ремедијација (TeacherAnalyticsView)
**Статус:** ⬜ Не започнато

- „Ремедијација" копче во TeacherAnalyticsView до секоја misconception
- AI генерира таргетирана мини-лекција со worked example
- Испраќање директно до засегнатите ученици

### П-В — Официјален МОН Curriculum Mapping
**Статус:** ⬜ Не започнато

- Линкување на секој концепт кон официјалните МОН наставни програми
- Dashboard „Покриеност на наставната програма" по одделение
- PDF потврда за покриеност на стандарди

### П-Г — IEP Поддршка
**Статус:** ⬜ Не започнато

- Флаг „ученик со посебни потреби" (само наставникот гледа)
- Поедноставен UI: поголем текст, визуелни помагала, без тајмер
- IEP прогрес извештај (PDF)

### П-Д — Teacher Mentorship
**Статус:** ⬜ Не започнато

- Senior наставник → ментор (доброволно)
- Споделување на подготовки со структурирани коментари
- Mentorat XP за старешините

---

## ФАЗА О — OFFLINE + RELIABILITY *(Месец 4)*

### О1 — Full PWA Offline Mode (надградба на С4)
**Статус:** 🟡 Делумно (С4 го покрива offline sync, потребен pre-cache на квизови)

- Pre-cache на доделени квизови кога наставникот ги испрати
- AI функции gracefully деградираат offline
- Push нотификации: „Нов квиз од наставникот" (firebase-messaging-sw.js постои)

### О2 — E2E Тестови (Playwright)
**Статус:** ⬜ Не започнато

Критични патеки:
1. Наставник регистрација → генерирање квиз → испраќање на ученик
2. Ученик play → резултат → XP → achievement unlock
3. Ученик → студентски акаунт → нов уред → податоците се враќаат
4. Наставник Analytics → Load More → сите резултати видливи

### О3 — Performance Optimization
**Статус:** ⬜ Не започнато

- Firestore composite indexes за бавни queries
- Imagen генерирани слики → Firebase Storage (наместо base64)
- Bundle size audit + additional code splitting

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
- [ ] >80% E2E test pass rate (Playwright — О2)

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
                              И1 ⬜  →  И2 ⬜  →  И3 ⬜
                                          ↓
                              П-Б ⬜ →  П-А ⬜  →  П-В ⬜  →  П-Г ⬜
                                          ↓
                              О1 🟡  →  О2 ⬜  →  О3 ⬜
                                          ↓
                              Н1 ⬜  →  Н2 ⬜  →  Н3 ⬜  →  Н4 ⬜
```

**Следна: И1 — School Entity**

---

*Создадено: 15 Март 2026*
*Последно ажурирање: 15 Март 2026 (по завршување на Фаза С)*
*Следно ревидирање: По завршување на Фаза И*
