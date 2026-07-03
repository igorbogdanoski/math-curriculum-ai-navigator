# Педагошка ревизија и план за развој — S27+
**Датум:** 18 Април 2026  
**Baseline:** TSC 0, 678/678 unit tests, S26 завршена (П23–П30 ✅)  
**Цел:** Секој модул да биде вистински бисер — нешто што секој наставник би сакал во секојдневната работа.

---

## ДЕЛ 1 — ТЕМЕЛНА РЕВИЗИЈА НА АПЛИКАЦИЈАТА

### 1.1 Структура

| Метрика | Вредност |
|---|---|
| Views (страни) | 70+ |
| Components | 153+ (19 поддиректориуми) |
| Custom Hooks | 47 |
| Services | 60+ |
| Unit Tests | 678/678 ✅ |
| Јазици | МК / АЛ / ТР / EN |
| Deployment | Vercel + Firebase |
| AI модел | gemini-2.5-flash (default) |

---

### 1.2 Статус по модул

#### ✅ ЗАВРШЕНИ МОДУЛИ

| Модул | Главни фајлови | Опис |
|---|---|---|
| **Student Quiz + Play** | `StudentPlayView.tsx`, `InteractiveQuizPlayer.tsx` | Интерактивно решавање, автоматска оценка, offline fallback |
| **Gamification Engine** | `utils/gamification.ts`, `StudentGamificationDisplay.tsx` | XP, streaks, 13 achievements, 9 Avatar нивоа, Fibonacci leveling |
| **Spaced Repetition (SM-2)** | `firestoreService.spacedRep.ts`, `AcademySpacedRep.tsx` | SM-2 алгоритам, due-for-review tracking |
| **Adaptive Difficulty (ZPD)** | `useAdaptiveDifficulty.ts`, `firestoreService.adaptiveDifficulty.ts` | ZPD класификација, easy/medium/hard targeting по ученик |
| **Matura Library (M2)** | `MaturaLibraryView.tsx`, `firestoreService.matura.ts` | 78+ испити (2016–2024), MK/AL/TR, AI оценување Part 2+3 |
| **Matura Practice (M3)** | `MaturaPracticeView.tsx` | Адаптивна практика по тема+DoK, shuffle, scoring |
| **Lesson Plan Editor** | `LessonPlanEditorView.tsx`, `PedagogicalDashboard.tsx` | AI педагошка анализа, Bloom alignment, PDF export |
| **Lesson Plan Library** | `LessonPlanLibraryView.tsx` | CRUD, search/filter, sharing |
| **Materials Generator** | `MaterialsGeneratorView.tsx`, `GenerationContextForm.tsx` | Multi-modal AI генерирање (worksheets, slides, infographics, flashcards) |
| **Content Library** | `ContentLibraryView.tsx` | Search, filter, export, sharing |
| **Teacher Analytics** | `TeacherAnalyticsView.tsx` (15 tabs) | KPI, trends, per-student, standards coverage, ZPD, assignments |
| **Test Generator** | `TestGeneratorView.tsx` | Bloom/DoK sliders, AI-generated тестови, PDF |
| **Live Sessions (Host+Student)** | `HostLiveQuizView.tsx`, `StudentLiveView.tsx` | Real-time quiz, QR join, scoreboard |
| **Parent Portal** | `ParentPortalView.tsx` | Weekly summary, shareable link |
| **Annual Plan Generator** | `AnnualPlanGeneratorView.tsx` | AI curriculum planning, Bloom distribution, PDF |
| **Curriculum Explorer** | `ExploreView.tsx`, `ConceptDetailView.tsx`, `TopicView.tsx` | 450+ концепти, вертикална прогресија |
| **OCR + Smart Grader** | `AIVisionGraderView.tsx`, `SmartOCRView.tsx` | PDF/DOCX/слики, Gemini Vision |
| **Flashcard Player** | `FlashcardPlayerView.tsx` | Interactive study mode |
| **AlgebraTiles + Shape3D** | `AlgebraTilesCanvas.tsx`, `Shape3DViewer.tsx` | SVG math visuals, shareable URLs |
| **Forum (basic)** | `TeacherForumView.tsx`, `firestoreService.forum.ts` | CRUD threads/replies, unread tracking |
| **Recovery Worksheets** | `RecoveryWorksheetView.tsx` | Concept-targeted remediation sheets |
| **Matura Import** | `MaturaImportView.tsx` | PDF OCR → Firestore pipeline |
| **Extraction Hub** | `ExtractionHubView.tsx` | Vision contracts за OCR/grading |
| **Gamification tracking** | `firestoreService.quiz.ts` | XP calc, mastery thresholds, achievement unlock |

#### 🟡 ДЕЛУМНО ИМПЛЕМЕНТИРАНИ МОДУЛИ

| Модул | Главни фајлови | Недостатоци |
|---|---|---|
| **Matura Simulation (M1)** | `MaturaSimulationView.tsx` | Нема strict time-out enforcement, real-time clock |
| **Matura Portal (K1)** | `MaturaPortalView.tsx` | Stub — нема readiness score, нема 12-неделен план |
| **Matura Analytics** | `MaturaAnalyticsView.tsx` | Нема national benchmark споредба |
| **Academy** | `AcademyView.tsx`, `AcademyLessonView.tsx` | Структура постои, многу подмодули се stub |
| **Student Tutor (AI)** | `StudentTutorView.tsx` | Chat постои, нема context awareness од quiz history |
| **Student Portfolio** | `StudentPortfolioView.tsx` | Нема file uploads, basic структура |
| **Live Display (Projector)** | `LiveDisplayView.tsx` | Без анимации, basic real-time |
| **Grade Book** | `GradeBookView.tsx` | Нема AI feedback интеграција |
| **Curriculum Editor** | `CurriculumEditorView.tsx` | Нема version history, нема visual diff |
| **Curriculum Graph** | `CurriculumGraphView.tsx` | Граф рендерирање без drag-to-edit |
| **Coverage Analyzer** | `CoverageAnalyzerView.tsx` | Нема temporal analysis |
| **DataViz Studio** | `DataVizStudioView.tsx` | Basic charts, без advanced filters |
| **Planner (weekly)** | `PlannerView.tsx` | Без calendar UI, без drag-drop |
| **Annual Plan Gallery** | `AnnualPlanGalleryView.tsx` | Basic listing |
| **Learning Style Profile** | `useLearningStyleProfile.ts` | Partial — нема UI за display |
| **Mastery Predictions** | `useMasteryPredictions.ts` | Partial — без timeline visualization |
| **Matura Readiness Path** | `useMaturaReadinessPath.ts` | Partial — без week-by-week schedule |
| **Daily Brief** | `useDailyBrief.ts` | Partial — без morning push |
| **Forum moderation** | — | Нема moderation, нема AI tagging |
| **Material Feedback** | `firestoreService.materialFeedback.ts` | Логика постои, без full UI |
| **National Benchmark** | `firestoreService.nationalBenchmark.ts` | Stub |
| **Push Notifications** | `pushService.ts` | Partial — нема parent/student push |

#### 🔴 STUB МОДУЛИ (основа постои, без имплементација)

| Модул | Фајл | Забелешка |
|---|---|---|
| **Voice Input** | `useVoice.ts` | Моќно за accessibility, мултизадачност |
| **Collaborative Planning** | `useCollabPlan.ts` | Real-time co-editing на lesson plans |
| **RAG Search** | `ragService.ts` | Semantic search низ curriculum + materials |
| **SLO Dashboard** | `SLODashboardView.tsx` | Student Learning Outcome tracking |
| **System Admin** | `SystemAdminView.tsx` | Internal monitoring |

---

### 1.3 Педагошки hooks — преглед

| Hook | Статус | Функција |
|---|---|---|
| `useAdaptiveDifficulty` | ✅ | ZPD препораки по концепт |
| `useMatura` | ✅ | Exam list + question fetching |
| `useMaturaMissions` | 🟡 | Mission-based practice tracking |
| `useMaturaStats` | 🟡 | Performance tracking per topic |
| `useMaturaReadinessPath` | 🟡 | Week-by-week prep schedule — partial |
| `useMaturaCurriculumAlignment` | 🟡 | Curriculum ↔ matura mapping |
| `useLearningStyleProfile` | 🟡 | Visual/auditory/kinesthetic preference |
| `useMasteryPredictions` | 🟡 | Predict mastery timeline |
| `usePersonalizedRecommendations` | 🟡 | Content recommendations |
| `useProactiveSuggestions` | 🟡 | AI proactive nudges |
| `useDailyBrief` | 🟡 | Morning teacher briefing |
| `useCollabPlan` | 🔴 | Real-time collaborative planning |
| `useVoice` | 🔴 | Voice input/output |

---

### 1.4 Data coverage

- **Primary (1–9):** 450+ концепти, 45+ теми, 200+ национални стандарди
- **Secondary:** Гимназија (4ч), Стручно 4-год, Стручно 3-год, Стручно 2-год, Изборни
- **Матура:** 78+ JSON испити (2016–2024), június+август+март, MK/AL/TR, internal bank 378 прашања
- **Academy:** Педагошки модели, специјализации, content tree

---

## ДЕЛ 2 — 5 ПРИОРИТЕТНИ ОБЛАСТИ ЗА „БИСЕР" КВАЛИТЕТ

### 🥇 БИСЕР 1 — Персонализирано водство во моментот на учење

**Проблем денес:**  
Ученикот прави quiz, добива score — крај. Нема AI hint кога греши, нема „зошто", нема чекор-по-чекор водство.

**Визија на бисерот:**  
- Кога ученик одговара погрешно → мал AI hint panel (Сократов стил, не дава одговорот директно)
- По завршен quiz → персонализиран AI feedback по слаби концепти
- „Следно учи ова" — конкретна препорака за следна задача
- Директно назначување Recovery материјал од Analytics со 1 клик

**Клучни фајлови:**
- `components/ai/InteractiveQuizPlayer.tsx`
- `components/student/QuizResultPanel.tsx`
- `services/gemini/assessment.ts`
- `components/analytics/AssignRemedialModal.tsx`
- `views/RecoveryWorksheetView.tsx`

**Очекуван импакт:** Висок — ова е она што го разликува AI туторот од обичен quiz app

---

### 🥇 БИСЕР 2 — Matura Портал со персонализиран 12-неделен план

**Проблем денес:**  
`MaturaPortalView` е stub. Учениците имаат испити и практика, но без „до матурата имаш 67 дена, еве твојот личен план".

**Визија на бисерот:**  
- Countdown до матурата (дни)
- Readiness score по тема (Алгебра 78%, Геометрија 52%...)
- Auto-generated week-by-week план: „Оваа недела фокус: Тригонометрија, Дел II"
- Daily missions кои се следат со прогрес бар
- Препорака: „Ако учиш 45 мин/ден, спремен/а си до X датум"

**Клучни фајлови:**
- `views/MaturaPortalView.tsx`
- `hooks/useMaturaReadinessPath.ts`
- `hooks/useMaturaStats.ts`
- `hooks/useMaturaMissions.ts`
- `services/firestoreService.matura.ts`

**Очекуван импакт:** Многу висок — конкретна вредност за матурантите и нивните наставници

---

### 🥇 БИСЕР 3 — Наставнички AI Assistant за диференцирана настава

**Проблем денес:**  
Lesson plan editor е завршен, но наставникот сè пополнува рачно. Нема smart differentiation по ученичка група.

**Визија на бисерот:**  
- По внесување на план → AI препорача: „За слабите додај ова, за напредните — ова"
- Differentiation presets: Ниво А (remedial) / Ниво Б (standard) / Ниво В (gifted)
- Weekly morning brief: „Оваа недела покрии X, имаш 3 часа, еве предлог распоред"
- Smart шаблони по предметна област + DoK ниво

**Клучни фајлови:**
- `views/LessonPlanEditorView.tsx`
- `components/generator/GenerationContextForm.tsx`
- `components/lesson-plan-editor/PedagogicalDashboard.tsx`
- `hooks/useDailyBrief.ts`
- `hooks/useLearningStyleProfile.ts`

**Очекуван импакт:** Висок — заштедува часови наставничко планирање

---

### 🥇 БИСЕР 4 — Recovery → Analytics → Action (затворен циклус)

**Проблем денес:**  
Наставникот гледа во analytics дека Марко слабо владее геометрија. Мора да оди во посебен дел за да му генерира worksheet. Нема поврзаност.

**Визија на бисерот:**  
- Analytics `StudentsTab` → слаби концепти → копче „Назначи recovery" → генерира и испраќа
- Следење: Дали Марко го направи? Со колку %?
- Dashboard алерт: „3 ученика со < 50% на Геометрија — назначи recovery?"
- Parent notification: „Марко добил нова вежба за Геометрија"

**Клучни фајлови:**
- `components/analytics/` (StudentsTab, AlertsTab, AssignRemedialModal)
- `views/RecoveryWorksheetView.tsx`
- `services/firestoreService.materials.ts`
- `hooks/useTeacherAnalytics.ts`

**Очекуван импакт:** Висок — ова го затвора педагошкиот циклус (идентификација → интервенција → следење)

---

### 🥇 БИСЕР 5 — Gamification со „Wow моменти" + социјален елемент

**Проблем денес:**  
XP и badges се следат совршено, но нема визуелен „wow moment" при освојување. Нема споредба со класата.

**Визија на бисерот:**  
- Achievement unlock: confetti анимација + специјален екран + звук
- Level-up celebration со персонализирана порака
- Класна Weekly Leaderboard автоматски
- „Ученик на неделата" автоматски по XP
- Родителот добива: „Вашето дете освои badge Питагора! 🏆"
- Streak рекорд со flame анимација

**Клучни фајлови:**
- `components/student/StudentGamificationDisplay.tsx`
- `utils/gamification.ts`
- `views/ParentPortalView.tsx`
- `services/pushService.ts`

**Очекуван импакт:** Среден-висок — мотивација и задржување на учениците

---

## ДЕЛ 3 — ПЛАН ПО СПРИНТОВИ

### Sprint S27 — „Персонализирано учење во реално време" (приоритет 1+2)

```
S27-А: AI Hints + Quiz Feedback + Recovery Integration
├── A1: Сократски AI hint panel во InteractiveQuizPlayer (wrong answer → hint)
├── A2: PersonalizedResultFeedback — AI feedback по слаби концепти во QuizResultPanel
├── A3: „Следно учи ова" препорака по quiz
└── A4: „Назначи Recovery" директна акција во Analytics StudentsTab → AssignRemedialModal

S27-Б: Matura Portal — Персонализиран план
├── B1: MaturaPortalView — countdown + readiness score по тема
├── B2: useMaturaReadinessPath — week-by-week schedule генерирање
├── B3: Daily/Weekly missions со прогрес tracking
└── B4: „Спремен до X" проекција врз основа на тековен темпо
```

**Естимација:** 5–7 работни дена  
**Метрики за успех:** TSC 0, тестови зелени, функционален demo со наставник

---

### Sprint S28 — „Диференцирана настава + Затворен циклус" (приоритет 3+4)

```
S28-А: Differentiation Assistant во Lesson Plan Editor
├── A1: AI differentiation suggestions post-plan (Level A/B/C)
├── A2: Differentiation presets во GenerationContextForm
├── A3: Weekly morning brief (useDailyBrief → UI)
└── A4: Smart шаблони по DoK + предметна област

S28-Б: Recovery Analytics Loop
├── B1: AlertsTab — автоматски alert за < 50% по концепт
├── B2: AssignRemedialModal — 1-click генерирање + assignment
├── B3: Следење: дали ученикот го завршил worksheetот
└── B4: Parent notification по назначување recovery
```

**Естимација:** 6–8 работни дена

---

### Sprint S29 — „Gamification + Social + Live enhancements" (приоритет 5)

```
S29-А: Gamification Wow Moments
├── A1: Achievement unlock анимација (confetti + звук)
├── A2: Level-up celebration screen
├── A3: Streak flame анимација + рекорд
└── A4: Weekly classroom leaderboard

S29-Б: Live Session Analytics
├── B1: Per-question answer analysis во HostLiveQuizView (real-time)
├── B2: Live display со графови (не само scoreboard)
├── B3: Post-session insight report за наставникот
└── B4: Export session results → Analytics

S29-В: Forum + Community
├── C1: AI tagging на forum posts по тема/концепт
├── C2: „Trending resources" sidebar
└── C3: Moderation basic (flag, hide)
```

**Естимација:** 7–9 работни дена

---

### Sprint S30 — „Academy + Voice + Long-term" (R&D)

```
S30-А: Academy полнење со содржина
├── A1: Педагошки модели — детална содржина (5 модели)
├── A2: Daily learning paths со AI-driven sequencing
└── A3: Сертификати + proof-of-completion

S30-Б: Voice + Accessibility
├── B1: useVoice — основна имплементација (Web Speech API)
├── B2: Quiz со гласовни одговори
└── B3: Teacher dictation за план внесување

S30-В: RAG Semantic Search
├── C1: ragService — embed curriculum + materials
├── C2: GlobalSearchBar со semantic results
└── C3: „Слично на ова" препораки во ContentLibrary
```

**Естимација:** 10–14 работни дена

---

## ДЕЛ 4 — ТЕХНИЧКИ ДОЛГ И ЗДРАВЈЕ

### Јачини
- ✅ TypeScript со 0 TSC грешки
- ✅ 678/678 unit tests
- ✅ Offline-first (IndexedDB fallback)
- ✅ Error boundaries + Sentry
- ✅ CSP headers, cost guard, perf budgets
- ✅ PWA installable
- ✅ i18n (MK/AL/TR/EN)
- ✅ Firestore rules со catch-all `if false`

### Слабости / Технички долг

| Проблем | Приоритет | Решение |
|---|---|---|
| Нема prompt caching за Gemini | Среден | `cachedContent` API → 75% cost reduction |
| Нема real-time collaborative editing | Низок | Yjs + Firestore sync |
| Многу Analytics tabs без целосни податоци | Среден | Приоритизирај кои 5 tabs се критични |
| `nationalBenchmark` е stub | Низок | Бара национални податоци |
| `useVoice` е stub | Низок | Web Speech API |
| `ragService` е stub | Низок | Bара embedding setup |
| Matura question sets 1–8 недостасуваат (~185 прашања) | Среден | Import во следна итерација |

---

## ДЕЛ 5 — VISION STATEMENT

> **Целта:** Апликацијата да биде **најдобрата EdTech математичка платформа во регионот и глобално** — не само алатка за тестирање, туку **вистински AI педагошки партнер** за секој наставник и ученик.

**Три столба:**
1. **Персонализирано** — секој ученик добива точно она што му треба, кога му треба
2. **Акционабилно** — наставникот секогаш знае точно што да направи следно
3. **Мотивирачко** — учењето е возбудливо, напредокот е видлив, успехот е прославен

---

*Фајл создаден: 2026-04-18 | Верзија: 1.0 | Следна ревизија: по S27*
