# MASTERPLAN S110–S112 — Комплетна Реализација

> Статус: 🟡 ВО ТЕК | Почеток: 2026-07-02 | Стандарди: TSC 0 · Tests ≥1924 · LOC ≤750/file

---

## ПРОГРЕС

| Спринт | Опис | Статус | Commit |
|--------|------|--------|--------|
| A.1 | P2 Cleanup — мртви импорти + unused props | 🔲 | — |
| B.1 | ExtractionHub → scenario_bank миграција | 🔲 | — |
| B.2 | ScenarioBankView — extracted_material таб | 🔲 | — |
| B.3 | Бришење мртви national_library функции | 🔲 | — |
| B.4 | GDPR сервис — отстрани national_library refs | 🔲 | — |
| B.5 | Composite Firestore index + server-side filter | 🔲 | — |
| B.6 | Firestore Rules cleanup | 🔲 | — |
| B.7 | RAG проширување на scenario_bank | 🔲 | — |
| A.2a | Giant splits: ExtractionHubView + TeacherForumView + GeneratedPresentation | 🔲 | — |
| A.2b | Giant splits: SettingsView + MaturaPracticeView + CurriculumGraphView | 🔲 | — |
| A.2c | Giant splits: SystemAdminView + MaturaSimulationView + visionContracts + ChartPreview | 🔲 | — |
| C.1 | TrigonometryLab (trigMath.ts + TrigonometryLab.tsx) | 🔲 | — |
| C.2 | NumberTheoryLab (numberTheoryMath.ts + NumberTheoryLab.tsx) | 🔲 | — |
| C.3 | AI Lesson Execution Mode (3 файлови) | 🔲 | — |
| C.4 | Student AI Portfolio + Parent Report (2 файлови) | 🔲 | — |

Легенда: 🔲 Чека · 🟡 Во тек · ✅ Завршено

---

## ОПЦИЈА A — Технички Cleanup

### A.1 — P2 Наоди од Code Review (30 мин)

**GammaModeSlideBody.tsx** — Отстрани мртви импорти (линии 4, 5, 12):
```
- import type { DokLevel } from '../../types';
- import { DokBadge } from '../common/DokBadge';
- import { generateMathSVG } from '../../services/gemini/svg';
```

**GammaModeSlideBody.tsx** — Отстрани 5 неупотребени props:
- `editMode: boolean` — во interface, destructuring, но никаде во JSX
- `setSlides: Dispatch<...>` — никогаш не се повикува
- `isRegenerating: boolean` — никогаш не се чита
- `setIsRegenerating: Dispatch<...>` — никогаш не се повикува
- `generatingRef: MutableRefObject<Set<number>>` — никогаш не се чита

Ги отстрани и од `<SlideBody />` callот во GammaModeModal.tsx.

**algebraTilesMath.ts:268** — Направи `_uid` приватен:
```ts
// Пред:  export let _uid = 0;
// После: let _uid = 0;
```

Додади trailing newline на крај од GammaModeSlideBody.tsx.

---

### A.2 — Втор Пас Giant File Splits

| Файл | LOC | Нови файлови |
|------|-----|--------------|
| views/ExtractionHubView.tsx | 1761 | ExtractionHubScanPanel.tsx · ExtractionHubWorksheet.tsx · extractionHubUtils.ts |
| views/TeacherForumView.tsx | 1621 | ForumThreadView.tsx · ForumPostEditor.tsx · forumUtils.ts |
| components/ai/GeneratedPresentation.tsx | 1373 | PresentationSlideList.tsx · PresentationControls.tsx · presentationUtils.ts |
| views/SettingsView.tsx | 1348 | settings/ProfileSection.tsx · settings/ClassSection.tsx · settings/SubscriptionSection.tsx · settings/IntegrationSection.tsx |
| views/MaturaPracticeView.tsx | 1326 | MaturaQuestionCard.tsx · MaturaStatsSidebar.tsx · maturaPracticeUtils.ts |
| views/SystemAdminView.tsx | 1297 | admin/AdminUsersTab.tsx · admin/AdminStatsTab.tsx · admin/AdminContentTab.tsx |
| views/MaturaSimulationView.tsx | 1252 | MaturaSimTimer.tsx · MaturaSimExamSheet.tsx · MaturaSimResults.tsx |
| views/CurriculumGraphView.tsx | 1173 | curriculumGraphUtils.ts · CurriculumGraphCanvas.tsx · CurriculumGraphFilters.tsx |
| services/gemini/visionContracts.ts | 999 | visionTypes.ts · visionPrompts.ts · visionParsers.ts |
| components/dataviz/ChartPreview.tsx | 995 | chartMath.ts · ChartRenderers.tsx |

**Правила за splits:**
- `.ts` math utils файлови — нула React imports, чисти функции, testable
- `.tsx` компоненти — ≤ 500 LOC, single responsibility
- Нема промена на логика — само структурна екстракција

---

## ОПЦИЈА B — Национална Банка

### Моментална состојба (веќе завршено ✅):
- `publishMaterialFromGenerator()` постои во firestoreService.scenarioBank.ts:341
- `useGeneratorSave` поврзан со `isPublic`
- `saveKahootToBank` + `saveExtractedToBank` примаат `isPublic`
- ScenarioBankView tabs: lesson_plan, kahoot, generated_material
- `PublishScenarioDialog.tsx` — генеричен, постои

### B.1 — ExtractionHub миграција
**Файл:** views/ExtractionHubView.tsx:845
**Проблем:** Сè уште повикува `saveQuestion(...)` → `saved_questions` колекција.
**Решение:** Замени со `saveExtractedToBank(...)` → `scenario_bank` + отвори `PublishScenarioDialog`.

### B.2 — ScenarioBankView — `extracted_material` таб
**Файл:** views/ScenarioBankView.tsx:595-598
**Проблем:** Нема таб за `extracted_material` (само lesson_plan, kahoot, generated_material).
**Решение:** Додај `{ key: 'extracted_material', label: 'Извлечени', icon: <FileSearch /> }`.

### B.3 — Отстрани мртви national_library функции
**Файл:** services/firestoreService.materials.ts:722-847
**Бришат се (125 LOC):** publishToNationalLibrary, NationalLibraryEntry, fetchNationalLibrary,
getAvgRating, getUserRating, rateNationalLibraryEntry, toggleSaveNationalLibraryEntry,
deleteNationalLibraryEntry, featureNationalLibraryEntry, importFromNationalLibrary

### B.4 — GDPR сервис
**Файл:** services/firestoreService.gdpr.ts:110,160
**Бришат се:** deleteCollectionByField('national_library', ...) + collectByFieldSafe('national_library', ...)

### B.5 — Server-side isPublic филтер
**Файл:** services/firestoreService.scenarioBank.ts:109-133
**Промена:** Замени client-side `.filter(s => s.isPublic)` со `where('isPublic', '==', true)` Firestore constraint.
**Deploy:** firebase deploy --only firestore:indexes

```json
{
  "collectionGroup": "scenario_bank",
  "fields": [
    { "fieldPath": "deleted",     "order": "ASCENDING" },
    { "fieldPath": "isPublic",    "order": "ASCENDING" },
    { "fieldPath": "publishedAt", "order": "DESCENDING" }
  ]
}
```

### B.6 — Firestore Rules cleanup
Отстрани `national_library` rules блок од firestore.rules.

### B.7 — RAG проширување
**Файл:** services/gemini/ragService.ts:118-127
**Додај:** Втор query на `scenario_bank` (isPublic == true, conceptId == target).
Merge + дедупликација → AI ги цитира community-reviewed материјали.

---

## ОПЦИЈА C — Нови Функции

### C.1 — TrigonometryLab

**`components/dataviz/trigMath.ts`** (~80 LOC, чист math):
```ts
export function degToRad(d: number): number
export function radToDeg(r: number): number
export const NOTABLE_ANGLES: { deg: number; rad: string; sin: string; cos: string; tan: string }[]
export function cosineLaw_side(a: number, b: number, C_deg: number): number
export function sineLaw_angle(a: number, A_deg: number, b: number): number | null
export function solveSSS(a: number, b: number, c: number): { A: number; B: number; C: number } | null
export function solveSAS(a: number, C_deg: number, b: number): { c: number; A: number; B: number }
export interface SolvedTriangle { a: number; b: number; c: number; A: number; B: number; C: number }
export function solveSSA(a: number, A_deg: number, b: number): { solutions: 0 | 1 | 2; cases: SolvedTriangle[] }
```

**`components/dataviz/TrigonometryLab.tsx`** (~420 LOC, 3 таба):
- **Таб 1: Единечна кружница** — SVG 400×400, drag point, sin/cos/tan projections, notable angle snap
- **Таб 2: Синусоиден бран** — unit circle + synchronized wave plotter, A/f/φ sliders, animation
- **Таб 3: Решавач на триаголник** — SSS/SAS/ASA/AAS/SSA dropdown, solver, ambiguous case, SVG output

МОН: VIII одд. · IX одд. · Гимназија I-II

### C.2 — NumberTheoryLab

**`components/dataviz/numberTheoryMath.ts`** (~70 LOC):
```ts
export function gcd(a: number, b: number): number
export function lcm(a: number, b: number): number
export function euclideanSteps(a: number, b: number): { a: number; b: number; q: number; r: number; eq: string }[]
export function primeFactors(n: number): number[]
export interface FactorNode { value: number; left?: FactorNode; right?: FactorNode; isPrime: boolean }
export function buildFactorTree(n: number): FactorNode
export function sieve(n: number): boolean[]
export function isPrime(n: number): boolean
export function eulerPhi(n: number): number
export function modPow(a: number, b: number, m: number): number
```

**`components/dataviz/NumberTheoryLab.tsx`** (~330 LOC, 4 таба):
- **Таб 1: НЗД/НСЗ + Евклид** — step-by-step table + SVG staircase diagram
- **Таб 2: Решето на Ератостен** — animated grid 2–500, prime count display
- **Таб 3: Стебло на фактори** — recursive SVG factor tree
- **Таб 4: Модуларна аритметика** — SVG clock face, addition/multiplication tables mod n

МОН: V-VI одд. (НЗД/НСЗ) · VII-VIII одд. (Евклид) · VIII-IX (модуларна)

### C.3 — AI Lesson Execution Mode

**`hooks/useLessonExecution.ts`** (~150 LOC):
- Timer (count-up), auto phase transitions (intro/central/closing)
- AI suggestions per phase (DEFAULT_MODEL, temp=0.7, 1 call/phase)
- Pulse check: генерира 2 прашања → live session → чита резултати
- Auto-save to lesson_executions on endLesson()

**`components/ai/LessonExecutionOverlay.tsx`** (~350 LOC):
- Floating panel (slide-in-from-right, collapsible)
- Phase progress bar (3 сегменти)
- Count-up timer, auto-orange after 40min
- AI совети (collapse/expand, 3 прашања/фаза)
- Пулс Проверка → 60сек → pie chart резултати
- Заврши Час → save + navigate to summary

**`components/ai/LessonExecutionSummary.tsx`** (~100 LOC):
- Time per phase breakdown
- Pulse check results (ако имало)
- "Сочувај Извештај" → scenario_bank

Жично во LessonPlanEditorView.tsx — "Почни Час ▶" копче.

### C.4 — Student AI Portfolio + Parent Report

**`hooks/useStudentPortfolio.ts`** (~90 LOC):
```ts
interface StudentPortfolioReport {
  studentName: string; generatedAt: string; overallScore: number;
  topicScores: { topicId: string; name: string; score: number; attempts: number }[];
  bloomDistribution: Record<DokLevel, number>;
  broGaps: string[]; strengths: string[]; weaknesses: string[];
  recommendedTopics: string[];
  parentLetterMK: string; parentLetterSQ: string;
}
```
- Fetches quiz_results (60 дена) + concept_mastery + SM-2 cards
- Gemini DEFAULT_MODEL, structured JSON response
- `printReport()` — PrintShell.tsx wrap

**`components/analytics/StudentPortfolioReport.tsx`** (~180 LOC, 4 таба):
- **Таб 1: Преглед** — Score badge (A/B/C/D) + AI summary + Bloom radar
- **Таб 2: По Теми** — Horizontal bars per topic (зелено/жолто/црвено)
- **Таб 3: БРО Стандарди** — Top 3 gaps + Top 3 strengths (само primary ≤9 одд)
- **Таб 4: Писмо за Родител** — A2 ниво, МК + АЛ + EN превод, copy button

Жично во StudentProgressView.tsx — "AI Извештај 🤖" per student.

---

## СТАНДАРДИ (важат за секоја сесија)

| Стандард | Правило |
|----------|---------|
| TypeScript | `npx tsc --noEmit` → 0 грешки по секој commit |
| Тестови | `npm test` → 150 files / ≥1924 PASS |
| LOC | Нови `.tsx` ≤ 500 · Нови `.ts` utils ≤ 150 |
| Math utils | Нула React imports, чисти функции, testable без DOM |
| Firestore indexes | Deploy ПРЕД кодот кој ги бара |
| AI повици | DEFAULT_MODEL · useThinking=false за blocking · stream за long-form |
| Security | sanitizePromptInput() на секој user input кон Gemini |
| Нови labs | Lazy import во DataVizStudioView + AcademyLessonView |
| Dead code | 0 мртви импорти · 0 @ts-ignore · 0 неупотребени props |
