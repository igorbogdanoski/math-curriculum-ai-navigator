# S50 — Kahoot Maker + SRS Upgrade + Cognitive Telemetry
## Имплементациски план

---

## Завршени технички долгови (пред S50)

| Проблем | Фикс |
|---------|------|
| KnowledgeGraphView hardcoded 680px | `ResizeObserver` во `KnowledgeGraphSection` ✅ |
| ExamPlayerView backup по submit/expired | Backup се чисти кога teacher го завршува испитот (`updated?.status === 'ended'`) ✅ |

---

## S50-A — Kahoot Maker 🎮

**Извор:** MathDigitizer KahootMakerView  
**Impact:** Наставникот за 2 кликови прави live Kahoot игра од извлечени задачи  
**Зависности:** ExtractionHub (tasks sessionStorage), HostLiveQuizView (session create)

### Нови фајлови
- `views/KahootMakerView.tsx` — конфигурација + save + launch
  - Чита `kahoot_tasks` од sessionStorage (JSON на EnrichedWebTask[])
  - Листа прашања со checkbox selection
  - Избор на timer per question (10/20/30/60 сек)
  - "Зачувај и стартувај" → `saveCachedQuiz()` → `createLiveSession()` → navigate `/live/host`
  - Route: `/kahoot/make`

### Изменети фајлови
- `views/ExtractionHubView.tsx` — додај "🎮 Kahoot" копче во post-extraction panel
  - Serialize tasks → sessionStorage `kahoot_tasks` → navigate `/kahoot/make`
- `views/GammaStudentView.tsx` — додај per-question countdown timer
  - Чита `timerPerQuestion` од LiveSession
  - Визуелен progress bar + Warning при последните 5 секунди
- `views/GammaPresenterView.tsx` — подобрен real-time leaderboard
  - Сортирани по score, топ-3 со медали 🥇🥈🥉
  - Confetti при завршување (`canvas-confetti` или CSS animation)
- `services/firestoreService.types.ts` — додај `timerPerQuestion?: number` во `LiveSession`
- `services/firestoreService.live.ts` — `createLiveSession()` прима `timerPerQuestion`
- `App.tsx` — route `/kahoot/make`
- `components/Sidebar.tsx` — Kahoot Maker nav item

---

## S50-B — SRS Algorithm Upgrade 🧠

**Извор:** постоечки `utils/spacedRepetition.ts` + `firestoreService.spacedRep.ts`  
**Impact:** Паметен scheduler — "Утре повтори X, за 3 дена Y" во Academy View  
**Зависности:** Firestore auth UID, curriculum `getConceptDetails()`

### Нови фајлови
- `utils/srsScheduler.ts` — `buildReviewSchedule(records, concepts)` → groups by urgency
  - `{ today: SRSItem[], tomorrow: SRSItem[], thisWeek: SRSItem[], later: SRSItem[] }`
  - `SRSItem = { conceptId, conceptTitle, gradeLevel, nextReviewLabel, interval, easeFactor }`
- `components/academy/SRSReviewPanel.tsx` — нов таб/секција во AcademyView
  - "Концепти за повторување" — групирани по денес/утре/оваа недела
  - "Повтори сега" копче → navigate `/concept/:id`
  - Badge со бројот на due концепти

### Изменети фајлови
- `views/AcademyView.tsx` — додај `SRSReviewPanel` секција
- `services/firestoreService.spacedRep.ts` — нема промена (веќе готово)

---

## S50-C — Cognitive Telemetry 📊

**Извор:** MathDigitizer CognitiveTelemetryStep  
**Impact:** Наставникот гледа кои чекори им тешко на учениците  
**Зависности:** StepByStepSolver, firebaseUser.uid

### Нови фајлови
- `services/firestoreService.telemetry.ts` — fire-and-forget event logging
  - Collection: `cognitive_telemetry`
  - `logStepEvent(event: StepEvent)` — non-blocking
  - `fetchStudentTelemetry(teacherUid, conceptId)` → aggregated per-step stats
  - Types: `StepEvent { studentId, conceptId, stepIndex, timeSpentMs, hintsUsed, attempts, correct }`
- `views/StudentTelemetryView.tsx` — teacher analytics view
  - Route: `/analytics/telemetry`
  - Per-concept heatmap: кои чекори имаат повеќе hints/retry
  - Per-student detail: time spent, attempts distribution
  - Filter by concept / grade

### Изменети фајлови
- `components/StepByStepSolver.tsx` — додај timing + hint + attempt tracking
  - `stepStartTime` ref — reset при секој `nextStep()`
  - `hintsUsedCount` per step state
  - `attemptsCount` per step state
  - On `nextStep()` или `handleVerify(correct)` → `firestoreService.logStepEvent()`
- `App.tsx` — route `/analytics/telemetry`
- `components/Sidebar.tsx` — link во Teacher Analytics section
- `views/TeacherAnalyticsView.tsx` — додај link кон StudentTelemetryView

---

## Редослед на имплементација

```
Fix bugs (KnowledgeGraph width + ExamPlayer backup) ✅
        │
        ▼
   S50-C: Cognitive Telemetry (мала, нема UI зависности)
        │
        ▼
   S50-B: SRS Upgrade (builds on existing spacedRep)
        │
        ▼
   S50-A: Kahoot Maker (most complex, needs Live Quiz changes)
        │
        ▼
   TSC: 0 грешки
   Tests: +unit tests за srsScheduler
   Commit + Push
```

---

## Приоритет матрица

| Sprint | Impact | Сложеност | Зависности |
|--------|--------|-----------|------------|
| S50-C Telemetry | ★★★★ | S | StepByStepSolver |
| S50-B SRS | ★★★★ | M | spacedRep (постои) |
| S50-A Kahoot | ★★★★★ | M | ExtractionHub + LiveSession |

---

*Создадено: 26.04.2026*
