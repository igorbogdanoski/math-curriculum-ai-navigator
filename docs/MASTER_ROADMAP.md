# Master Roadmap — Math Curriculum AI Navigator
## Целосен план кон највисокото ниво

---

## ✅ ЗАВРШЕНО

### S44 (25.04.2026)
- MathInput JSX декларација, as-any cleanup, perf matura/secondary lazy load
- Dead code: useSecondaryCurriculum.ts deleted
- **Total initial load savings: ~470 kB gzip**

### S45 (25.04.2026) — MathDigitizer Integration Wave 1
- **S45-A** `verifyUserStep()` → tutor.ts + StepByStepSolver.tsx (AI верификација чекор-по-чекор)
- **S45-B** `generateABCTest()` → assessment.ts + useVariantGenerate.ts (паралелни A/B/C, 3× побрзо)
- **S45-C** `enrichExtractedPedagogy()` → visionContracts.ts + ExtractionHub (Bloom+DOK badges)
- **S45-D** `GeoGebraViewer` → components/dataviz/ + DataVizStudioView нов таб
- **TSC: 0 грешки**

### S46 (25.04.2026) — Central Exam Mode 🏛️

- `services/firestoreService.exam.ts` — CRUD + real-time listeners, variant round-robin assignment
- `services/firestoreService.types.ts` — ExamSession, ExamResponse, ExamVariantKey types
- `services/gemini/assessment.ts` — `generateExamVariants()` (4 parallel) + `gradeExamResponses()` (AI)
- `views/ExamBuilderView.tsx` — AI генерира 4 варијанти А/Б/В/Г паралелно, preview, save/start
- `views/ExamPlayerView.tsx` — студент: fullscreen, countdown, auto-submit, localStorage backup
- `views/ExamPresenterView.tsx` — real-time dashboard: Joined/Solving/Submitted, start/end controls
- `views/ExamResultsView.tsx` — AI auto-grading per question, per-student detail, PDF print
- `components/exam/ExamTimer.tsx` — countdown со warning/danger states, auto-submit callback
- `components/exam/ExamVariantPlayer.tsx` — рендерира MC/short/essay/calculation прашања
- Routes: `/exam/build`, `/exam/play`, `/exam/presenter/:id`, `/exam/results/:id`
- **TSC: 0 грешки**

### S48 (25.04.2026) — YouTube → Math Tasks 📺

- `services/gemini/youtubeExtraction.ts` — `extractMathTasksFromUrl(url, options?)` standalone reusable service
- `ExtractionHubView.tsx` — нов "YouTube" таб покрај "Веб URL" и "Документ"
- YouTube UI: URL input, time-range picker (Почеток/Крај упфронт), јазик на транскрипт (mk/sq/tr/en/sr), video preview card, manual transcript fallback
- Extraction pipeline: `fetchYouTubeCaptions` → `applyTimeRange` → `chunkAndExtractTasks` → `enrichExtractedPedagogy` (автоматски)
- **TSC: 0 грешки**

### S47b (25.04.2026) — MakedoTest Print Engine 🖨️

- `utils/printExam.ts` — `parseInlineSelection()` (`{correct|wrong}` parser), `buildZipGradeCSV()`, `downloadCSV()`, `extractMCAnswer()`
- `components/exam/PrintableExam.tsx` — сите 16 типови прашања, 1/2 колони, CSS @media print, клуч на одговори mode
- `components/exam/AnswerSheet.tsx` — ZipGrade-compatible bubble sheet + писмен дел
- `views/PrintExamView.tsx` — контролна лента: варијанта, колони, клуч, лист за одговори, ZipGrade CSV export, печати
- Routes: `/exam/print/:id`, `/exam/print`
- "Печати испит" копче во ExamBuilderView + ExamPresenterView
- **TSC: 0 грешки**

### S49 (25.04.2026) — Konva Canvas + Knowledge Graph 🎨

- **S49-A** `components/solver/DrawingCanvas.tsx` — Konva-based цртање (молив/гума/бои/дебелина/undo/PNG export)
  - Интегрирано во `StepByStepSolver` — "Цртај / работи на хартија" toggle
  - `npm install konva@10.2.5 react-konva@19.2.3`
  - `vendor-konva` chunk во vite.config.ts
- **S49-B** `components/dataviz/KnowledgeGraphView.tsx` — D3 force graph
  - Nodes: концепти со боја по одделение; Edges: priorKnowledgeIds + chain.futures
  - Улоги: focal (виолетов) / prior (жолт) / future (зелен) / sibling (сив)
  - Zoom +/−, PNG export, кликабилни јазли → navigate
  - `KnowledgeGraphSection` collapsed блок во `ConceptDetailView`
  - `npm install d3-force@3.0.0` + `@types/d3-force`; `vendor-d3` chunk веќе постоеше
- **TSC: 0 грешки**

### S47-partial (25.04.2026) — mkd-slidea Async Homework Mode
- `homeworkMode` + `homeworkDeadline` во LiveSession type
- `createLiveSession()` прима опционален deadline
- `getLiveSessionByCode()` проверува future deadline
- `HostLiveQuizView` — toggle + рок-selector (12h/24h/48h/72h/7дена)

---

## 🔄 СЛЕДНО — По редослед

### S46 — Central Exam Mode 🏛️ `MEGA`
**Извор:** zbir-2026 + testovi + Dugga concept
**Impact:** Единствениот нативен дигитален испит за МК училишта

#### Firestore структура
```
exam_sessions/{id}
  title, gradeLevel, subject
  variants: { A:[questions], B:[questions], V:[questions], G:[questions] }
  duration (секунди), joinCode (6 цифри)
  status: 'draft' | 'waiting' | 'active' | 'ended'
  createdBy (uid), createdAt, startedAt, endsAt
  totalPoints

exam_sessions/{id}/responses/{studentId}
  studentName, variantKey (A/B/V/G)
  answers: { q0: "text", q1: "option_b", ... }
  photoUrls: { q2: "data:image/jpeg;base64,..." }
  status: 'joined' | 'solving' | 'submitted'
  submittedAt, timeRemainingOnSubmit
  score, maxScore, aiFeedback, gradedAt
```

#### Компоненти
| Фајл | Кој | Опис |
|---|---|---|
| `services/firestoreService.exam.ts` | — | CRUD + real-time listeners |
| `views/ExamBuilderView.tsx` | Наставник | AI генерира 4 варијанти (А/Б/В/Г), поени, траење |
| `views/ExamPlayerView.tsx` | Ученик | Fullscreen, countdown, auto-submit, фото upload |
| `views/ExamPresenterView.tsx` | Наставник | Real-time dashboard: Joined/Решава/Предал |
| `views/ExamResultsView.tsx` | Наставник | AI градинг + PDF + е-дневник export |
| `components/exam/ExamTimer.tsx` | — | Countdown компонента со auto-submit |
| `components/exam/ExamVariantPlayer.tsx` | — | Рендерира прашања по варијанта |

#### Клучни карактеристики
- **4 варијанти А/Б/В/Г** — anti-cheating (testovi pattern)
- **Countdown timer** со auto-submit на истек (zbir-2026 pattern)
- **Фото upload** за рачни решенија (zbir-2026 pattern)
- **Offline resilience** — localStorage backup ако интернет падне
- **Browser focus mode** — fullscreen prompt, beforeunload warning
- **AI auto-grading** — дигитални одговори автоматски, фото со teacher review
- **PDF извештај** per-student + класен резиме

---

### S47b — MakedoTest Print Engine 🖨️
**Извор:** MakedoTest (igorbogdanoski/MakedoTest)
**Impact:** Формален испит на хартија со 16 типови прашања

#### Компоненти
- `components/exam/PrintableExam.tsx` — 16 типови прашања
- `components/exam/AnswerSheet.tsx` — bubble format за ZipGrade
- Inline selection `{correct|wrong}` синтакса парсер
- 1/2 колони print layout, sub-numbering (3.1, 3.2...)
- **ZipGrade CSV export** за mobile scanning
- Поврзан со ExamBuilder — "Print верзија" копче

#### 16 типови прашања
1. Multiple Choice (A/B/C/D)
2. True/False
3. Short Answer
4. Fill-in-the-blank
5. Inline Selection `{correct|wrong}`
6. Multi-match (поврзи колони)
7. Ordering (подреди)
8. Essay / Open-ended
9. Fill-in table
10. Calculation (покажи работа)
11. Graph/Draw
12. Label diagram
13. Proof steps
14. Word problem
15. Data interpretation
16. Sub-numbered (3.1, 3.2...)

---

### S48 — YouTube → Math Tasks 📺
**Извор:** MathDigitizer `extractMathTasksFromUrl()`
**Impact:** Единствен МК YouTube → задачи pipeline

#### Имплементација
- `npm install youtube-transcript` или YouTube Data API
- `services/gemini/youtubeExtraction.ts` — `extractMathTasksFromUrl(url, lang?)`
- ExtractionHub: нов Input Mode "YouTube" покрај URL/Document/Image
- Transcript → `chunkAndExtractTasks` → `enrichExtractedPedagogy` (автоматски)
- Time-range selector (наставникот избира мин-макс на видеото)

---

---

### S50 — Kahoot Maker + SRS + Cognitive Telemetry 🎮
**Извор:** MathDigitizer KahootMakerView + srsAlgorithm.ts + StudentTelemetryView

#### S50-A: Kahoot Maker
- Extracted задачи → GammaPresenter Live Quiz со Kahoot-style UI
- Timer per прашање (10/20/30 сек)
- Live leaderboard во real-time
- Конфети на победник

#### S50-B: SRS Algorithm Upgrade
- `utils/srsAlgorithm.ts` — SM-2 spaced repetition
- Врз `firestoreService.spacedRep.ts` (веќе постои)
- Паметен scheduler — "Утре повтори X, за 3 дена Y"
- Приказ во Academy View

#### S50-C: Cognitive Telemetry
- Траки per-step: time_spent_ms, hints_used, attempts
- `services/firestoreService.telemetry.ts`
- `views/StudentTelemetryView.tsx` — per-student learning pattern
- Во Teacher Analytics — кои чекори им тешко на учениците

---

### S51 — LTI 1.3 + Google Classroom 🏫
- iframe embed за Google Classroom / MS Teams
- LTI 1.3 basic (student identity passthrough)
- e-дневник XML export (МОН формат)
- SSO со Google Classroom

---

### S52 — Olympic Training + Proof Assistant 🏆
- Олимпијадна банка (278 задачи од `olympiad-math-archive`)
- Formal proof step verifier
- IRT (Item Response Theory) — бара 1000+ одговори per прашање
- Adaptive difficulty per student performance

---

## Приоритет матрица

| Sprint | Функција | Impact | Сложеност | Зависности |
|--------|----------|--------|-----------|------------|
| **S46** | Central Exam Mode | ★★★★★ | XL | — |
| **S47b** | MakedoTest Print | ★★★★★ | L | S46 |
| **S48** | YouTube Extract | ★★★★★ | M | — |
| **S49-A** | Konva Canvas | ★★★ | M | konva |
| **S49-B** | Knowledge Graph | ★★★ | M | d3 (имаме) |
| **S50-A** | Kahoot Maker | ★★★★ | M | S48 |
| **S50-B** | SRS Upgrade | ★★★ | S | — |
| **S50-C** | Telemetry | ★★★ | M | — |
| **S51** | LTI+Classroom | ★★★★ | XL | backend |
| **S52** | Olympic+IRT | ★★★ | XL | data |

---

## Визуелен редослед

```
✅ S45 + S47-partial (DONE)
         │
         ▼
    S46 Central Exam ──────────────────────────┐
         │                                     │
         ▼                                     ▼
    S47b Print Engine              Испит на хартија
         │
         ▼
    S48 YouTube Extract ──► S50-A Kahoot Maker
         │
         ▼
    S49-A Konva Canvas
    S49-B Knowledge Graph
    S50-B SRS Upgrade
    S50-C Telemetry
         │
         ▼
    S51 LTI + Classroom
         │
         ▼
    S52 Olympic + IRT
```

---

*Последно ажурирање: 25.04.2026*
*Состојба: S45+S47-partial завршени, S46 следно*
