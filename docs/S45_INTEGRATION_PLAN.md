# Integration Plan — S45–S48
## Извор: MathDigitizer + MakedoTest + mkd-slidea → Math Curriculum AI Navigator

---

## S45 — MathDigitizer Integration Wave 1 ⚡ АКТИВНА

### S45-A: `verifyUserStep()` — AI верификација чекор-по-чекор
**Извор:** MathDigitizer `gemini.ts → verifyUserStep()`  
**Цел:** Ученикот внесува свој чекор во решавањето → AI го верификува и дава hint ако е грешка  
**Фајлови:** `services/gemini/tutor.ts` + UI во step-by-step solver  
**Статус:** ✅ ЗАВРШЕНО

### S45-B: `generateDifferentiatedTest()` — A/B/C варијанти
**Извор:** MathDigitizer `gemini.ts → generateDifferentiatedTest()`  
**Цел:** Еден prompt → три паралелни тест-варијанти (A=основно, B=средно, C=напредно)  
**Фајлови:** `services/gemini/assessment.ts` + MaterialsGeneratorView toggle  
**Статус:** ✅ ЗАВРШЕНО

### S45-C: `enrichExtractedPedagogy()` — авто Bloom+DOK тагирање
**Извор:** MathDigitizer `gemini.ts → enrichTaskPedagogy()`  
**Цел:** По екстракција → секоја задача добива Bloom ниво, DOK, тема, когнитивни барања  
**Фајлови:** `services/gemini/visionContracts.ts` + ExtractionHub пост-процесинг  
**Статус:** ✅ ЗАВРШЕНО

### S45-D: GeoGebra Viewer компонента
**Извор:** MathDigitizer GeoGebra Viewer  
**Цел:** Embedding GeoGebra calculator/geometry/graphing во DataViz Studio  
**Фајлови:** `components/dataviz/GeoGebraViewer.tsx` + DataVizStudio tab  
**Статус:** ✅ ЗАВРШЕНО

---

## S46 — MakedoTest Print Engine 🖨️

### S46-A: 16 типови прашања
- Multiple choice, True/False, Short answer
- Inline selection `{correct|wrong}` синтакса
- Multi-match linking (повеži колони)
- Interactive tables (пополни табела)
- Open ended, Fill-in-the-blank, Ordering

### S46-B: Print-Ready Layout Engine
- 1-колона и 2-колони layout
- Sub-numbering (3.1, 3.2...)
- Section management со reordering
- Difficulty scoring per прашање

### S46-C: Auto Answer Sheet + ZipGrade
- Авто генерирање одговорна листа (bubble format)
- ZipGrade CSV export за mobile scanning
- QR код по прашање (за дигитални верзии)

### S46-D: QTI XML Export
- IMS QTI 2.1 стандард за интероперабилност
- Увоз во Moodle, Canvas, Google Forms

---

## S47 — mkd-slidea + MathDigitizer Wave 2 📊

### S47-A: Async Homework Mode
**Извор:** mkd-slidea async homework feature  
**Цел:** Live quiz останува отворен 24-48h без присуство на наставник  
**Фајлови:** `services/firestoreService.quiz.ts` + LiveQuizView deadline field

### S47-B: Knowledge Graph Visualizer (D3.js)
**Извор:** MathDigitizer `knowledgeModel.ts` + KGVisualizer  
**Цел:** Визуелен граф на поврзани концепти во ConceptDetailView  
**Фајлови:** `components/dataviz/KnowledgeGraphView.tsx`

### S47-C: Cognitive Telemetry
**Извор:** MathDigitizer CognitiveTelemetryStep  
**Цел:** Траки чекори: timing, hints, attempts по ученик → Teacher Analytics  
**Фајлови:** `services/firestoreService.telemetry.ts` + StudentTelemetryView

---

## S48 — Advanced Integration 🚀

### S48-A: YouTube → Math Tasks (полен pipeline)
**Извор:** MathDigitizer `extractMathTasksFromUrl()`  
**Цел:** Наставник пасти YouTube линк → AI вади задачи + pedagogy metadata  
**Белешка:** ExtractionHub веќе има `fetchYouTubeCaptions` — треба само math-task parsing слој

### S48-B: Kahoot-style Quiz Game
**Извор:** MathDigitizer Kahoot Maker  
**Цел:** Од извлечени задачи → генерирај Gamma (Live Quiz) game  
**Фајлови:** Надоградба на GammaPresenterView

### S48-C: Lesson Plan от Content
**Извор:** MathDigitizer Lesson Plan Generator  
**Цел:** Selektirани задачи → целосен час план со цели, активности, временска рамка

---

## Приоритет и Impact матрица

| Sprint | Функција | Impact | Работа | Нови deps |
|--------|----------|--------|--------|-----------|
| S45-A | verifyUserStep | ★★★★★ | S | - |
| S45-B | A/B/C тест | ★★★★★ | S | - |
| S45-C | enrichPedagogy | ★★★★ | S | - |
| S45-D | GeoGebra | ★★★★ | XS | - |
| S46-A/B | Print layout | ★★★★★ | L | - |
| S46-C | ZipGrade | ★★★★ | M | - |
| S47-A | Async homework | ★★★★ | M | - |
| S47-B | Knowledge Graph | ★★★ | M | d3 |
| S48-A | YouTube extract | ★★★★★ | M | - |
