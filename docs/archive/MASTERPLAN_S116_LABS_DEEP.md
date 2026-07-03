# MASTERPLAN S116 — Длабоко продлабочување на AI Лаборатории

> Статус: 🔲 ПЛАНИРАНО | Верзија: 1.0 · 2026-07-02
> Цел: Секоја лабораторија = вистинско вежбалиште, поврзано со прогрес системот
> Стандарди: TSC 0 · LOC ≤750/file · Tests ≥1924

---

## АУДИТ — ТЕКОВНА СОСТОЈБА

| Лабораторија | LOC | Табови/Режими | Вежбај режим? | Firestore? |
|---|---|---|---|---|
| TrigonometryLab | 471 + 197 math | circle / wave / identity | ❌ | ❌ |
| NumberTheoryLab | 590 + 118 math | primes / gcd / modular / sequences | ❌ | ❌ |
| PlaceValueLab | 586 + 101 math | Прикажи / **Вежбај** / Состави | ✅ локален | ❌ |
| ProbabilityLab | 660 + 510 panels + 141 math | дрво на веројатности | ❌ | ❌ |
| Geometry3DLab | **917** + 300 math | explorer / plans / nets / cross / prispyram | ❌ | ❌ |
| LinearAlgebraLab | **906** + 371 eigen | matrices / vectors / transforms / systems / nxn / eigen | ❌ | ❌ |
| CalculusLab | 432 | deriv / riemann / limits / logexp | ❌ | ❌ |
| SecondaryStatsLab | 653 | normal / regression / bayes / montecarlo / chisq | ❌ | ❌ |
| ConicSectionsLab | 428 | ? | ❌ | ❌ |
| LogExpLab | 355 | logexp / prob | ❌ | ❌ |
| AlgebraTilesCanvas | **828** | ? | partial | ❌ |
| InequalitySolver (math/) | 292 | — | ❌ | ❌ |
| ProbabilitySimulator (math/) | 295 | — | ❌ | ❌ |
| FunctionTransformer (math/) | 241 | — | ❌ | ❌ |

**Клучен наод:** Ниедна лабораторија не зачувува резултати. Само PlaceValueLab
има локален Вежбај режим. Сите се чисти визуелизации — откачени од прогрес системот.

**Технички долг (≥750 LOC):** Geometry3DLab (917), LinearAlgebraLab (906), AlgebraTilesCanvas (828)

---

## АРХИТЕКТУРА — `useLabSession` HOOK

### Зошто `quiz_results`, не нова колекција

`quiz_results` е веќе индексиран, читан од `useStudentProgress`, прикажан во
`StudentPortfolioView` и `StudentProgressView`. Ако зачуваме лаб сесии таму,
автоматски ги добиваме: portfolio prikaz, streak, XP (gamification), class insights.
Нема нова колекција, нема нов UI — само нова `quizType: 'lab'` вредност.

### `types/labTypes.ts` (~40 LOC) — споделени типови

```typescript
export interface LabExercise {
  id: string;
  question: string;                        // "Кое е sin(30°)?"
  type: 'multiple_choice' | 'numeric' | 'fill_blank' | 'ordering';
  options?: string[];                      // само за multiple_choice
  correctAnswer: string;                   // нормализирана вредност
  hint: string;                            // прв hint — не го открива одговорот
  explanation: string;                     // прикажува SE по одговорот
  difficulty: 1 | 2 | 3;                  // 1=основно, 2=средно, 3=напредно
  curriculumRef: string;                   // "МОН VII одд." / "Гимн. I год."
}

export interface LabSessionResult {
  labId: string;
  labTitle: string;
  totalExercises: number;
  correctAnswers: number;
  hintsUsed: number;
  durationSeconds: number;
  percentage: number;
}
```

### `hooks/useLabSession.ts` (~130 LOC)

```typescript
export function useLabSession(labId: string, labTitle: string) {
  const [exercises, setExercises]   = useState<LabExercise[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [submitted, setSubmitted]   = useState(false);
  const [correct, setCorrect]       = useState<boolean | null>(null);
  const [hintsUsed, setHintsUsed]   = useState(0);
  const [score, setScore]           = useState(0);
  const [startedAt]                 = useState(() => Date.now());
  const [sessionDone, setSessionDone] = useState(false);
  const [saving, setSaving]         = useState(false);

  const currentEx = exercises[currentIdx] ?? null;

  const loadExercises = (exs: LabExercise[]) => {
    setExercises(exs); setCurrentIdx(0);
    setScore(0); setHintsUsed(0); setSessionDone(false);
    setSubmitted(false); setCorrect(null); setUserAnswer('');
  };

  const submitAnswer = () => { /* normalize + compare + setCorrect + setScore */ };
  const useHint = () => { setHintsUsed(h => h + 1); };
  const nextExercise = () => { /* advance or setSessionDone(true) */ };

  const saveSession = async (studentName: string) => {
    if (!studentName.trim() || saving) return;
    setSaving(true);
    const pct = Math.round((score / exercises.length) * 100);
    const { firestoreService } = await import('../services/firestoreService');
    await firestoreService.saveQuizResult({
      quizId:    `lab_${labId}_${Date.now()}`,
      quizTitle: `Лабораторија: ${labTitle}`,
      quizType:  'lab',
      conceptId: labId,
      studentName,
      score,
      totalPoints:  exercises.length,
      percentage:   pct,
      hintsUsed,
      durationSeconds: Math.round((Date.now() - startedAt) / 1000),
    });
    setSaving(false);
  };

  return {
    exercises, currentIdx, currentEx, userAnswer, setUserAnswer,
    submitted, correct, hintsUsed, score, sessionDone, saving,
    loadExercises, submitAnswer, useHint, nextExercise, saveSession,
  };
}
```

### `components/labs/LabExercisePanel.tsx` (~200 LOC) — универзален UI

Стандарден panel кој го употребуваат СИТЕ лаборатории за нивниот Вежбај таб.
Прима: `session` (od useLabSession) + `onLoadExercises` callback.

```
┌─────────────────────────────────────────────────────────────┐
│  Вежбај · 3/5  ██████░░░░  60%          [Hint] [Прескокни] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🎯 Прашање 3 од 5  (средно ниво · МОН IX одд.)            │
│                                                             │
│  Кое е sin(150°)?                                           │
│                                                             │
│  ○  1/2     ○  √3/2     ○  -1/2     ○  -√3/2              │
│                                                             │
│                        [Провери]                            │
│                                                             │
│  ─── Hint: ─────────────────────────────────────────────── │
│  150° е во II квадрант. sin е позитивен таму.               │
└─────────────────────────────────────────────────────────────┘
```

По завршување:
```
┌─────────────────────────────────────────────────────────────┐
│  🏆 Завршено! Резултат: 4/5 (80%)                           │
│  Hints употребени: 2                                        │
│                                                             │
│  Твое ime: [______________]   [Зачувај резултат]            │
│                                                             │
│  [Пробај пак]  [Нов сет]                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## ФАЗА TD — ТЕХНИЧКИ ДОЛГ (прва, пред лаб работата)

### TD.1 — Geometry3DLab.tsx: 917 → ~400 LOC

```
components/dataviz/Geometry3DLab.tsx              917 → ~400  (orchestrator + tab UI)
components/dataviz/geometry3dRenderers.tsx              → ~350  (SVGNetRenderer, CrossSectionRenderer, ProjectionRenderer)
components/dataviz/geometry3dMath.ts                    → 300   (веќе постои)
```

Граница: рендерерите (SVG/canvas компоненти за мрежи, пресеци, проекции) →
`geometry3dRenderers.tsx`. Главниот файл останува само orchestrator + tab switcher.

### TD.2 — LinearAlgebraLab.tsx: 906 → ~450 LOC

```
components/dataviz/LinearAlgebraLab.tsx          906 → ~450  (orchestrator + Matrices + Vectors tabs)
components/dataviz/linearAlgebraAdvanced.tsx          → ~380  (Transforms + NxN + Eigen tabs)
components/dataviz/linearAlgebraMath.ts               → NEW   (exercise generators — видете L2.1)
```

### TD.3 — AlgebraTilesCanvas.tsx: 828 → ~400 LOC

```
components/math/AlgebraTilesCanvas.tsx           828 → ~400  (canvas + drag logic)
components/math/algebraTilesExercises.tsx              → ~350  (exercise sets + scoring)
components/math/algebraTilesMath.ts                    → постои
```

---

## ФАЗА L0 — ОСНОВА (~370 LOC, 2 файла)

| Файл | LOC | Опис |
|------|-----|------|
| `types/labTypes.ts` | 40 | LabExercise, LabSessionResult interfaces |
| `hooks/useLabSession.ts` | 130 | Universal session hook → quiz_results |
| `components/labs/LabExercisePanel.tsx` | 200 | Universal exercise UI panel |

Commit: `feat(labs-L0): useLabSession hook + LabExercisePanel universal UI`

---

## ФАЗА L1 — ОСНОВНИ ЛАБИ (I–VI одд.)

### L1.1 — PlaceValueLab продлабочување

**Тековно:** Вежбај (локален, не зачувува)
**Цел:** Поврзи со `useLabSession` + додај 2 нови типа задачи

**Нови вежби во `placeValueMath.ts`:**
```typescript
// Собирање со пренос (carrying)
export function generateCarryExercise(grade: GradeRange): LabExercise
// Споредување броеви
export function generateCompareExercise(grade: GradeRange): LabExercise
// Уреди ги броевите (ordering)
export function generateOrderExercise(grade: GradeRange): LabExercise
```

**Вежбај таб — ново:**
```
Тип 1: Погоди го бројот (постоечко) → поврзи со useLabSession
Тип 2: Собери со пренос (ново) — SVG анимација на пренос меѓу колони
Тип 3: Спореди <, >, = (ново) — со Dienes блокови визуелно
```

Commit: `feat(labs-L1a): PlaceValueLab — connect to useLabSession + carry/compare exercises`

---

### L1.2 — NumberTheoryLab: Вежбај таб (нов, 5-ти таб)

**Нови функции во `numberTheoryMath.ts`:**
```typescript
export interface NumTheoryExercise extends LabExercise {}

export function generatePrimeExercise(difficulty: 1|2|3): NumTheoryExercise
// Тип: "Дали е 91 прост број? a)Да б)Не"  → со факторизација во objаснување

export function generateGcdExercise(difficulty: 1|2|3): NumTheoryExercise
// Тип: "ГЗД(24, 36) = ?" → numeric + чекор-по-чекор Евклид во explanation

export function generateModularExercise(difficulty: 1|2|3): NumTheoryExercise
// Тип: "7 × 5 ≡ ? (mod 11)" → multiple_choice

export function generateSequenceExercise(difficulty: 1|2|3): NumTheoryExercise
// Тип: "Следниот член на 1,1,2,3,5,? е" → numeric (Fibonacci/arithmetic/geometric)

export function generateMixedSet(n: number, difficulty: 1|2|3): NumTheoryExercise[]
// 5 или 10 мешани прашања
```

**Вежбај таб UI:**
- Избор на тежина (Основно/Средно/Напредно)
- 5 прашања → резултат → `useLabSession.saveSession()`
- По погрешен одговор: прикажи ја чекор-по-чекор логиката (Евклид за GCD итн.)

Commit: `feat(labs-L1b): NumberTheoryLab — Вежбај tab with 4 exercise types`

---

### L1.3 — TrigonometryLab: Вежбај таб (4-ти таб)

**Нови функции во `trigMath.ts`:**
```typescript
export function generateUnitCircleExercise(difficulty: 1|2|3): LabExercise
// "sin(120°) = ?" → multiple_choice од специјалните агли
// difficulty 1: само 0°/30°/45°/60°/90°
// difficulty 2: сите квадранти
// difficulty 3: вредности на tan, arcsin

export function generateIdentityExercise(difficulty: 1|2|3): LabExercise
// "Пополни: sin²x + __ = 1" → fill_blank
// difficulty 3: "Докажи дека tan²x + 1 = sec²x — следниот чекор е?"

export function generateAmplitudePeriodExercise(): LabExercise
// "За f(x)=3sin(2x), амплитудата е __ и периодата е __"
// numeric (две полиња)

export function generateTrigSet(n: number, difficulty: 1|2|3): LabExercise[]
```

**Вежбај таб:**
- SVG Unit Circle прикажан паралелно со прашањето → визуелен контекст
- Кога ќе одговориш погрешно → Unit Circle го покажува точниот агол со анимација
- Hint = точката на кружницата (без вредноста)

Commit: `feat(labs-L1c): TrigonometryLab — Вежбај tab with unit circle feedback`

---

## ФАЗА L2 — СРЕДНИ ЛАБИ (VII–XII одд.)

### L2.1 — CalculusLab: Вежбај таб (5-ти таб)

**Нов файл `components/dataviz/calculusMath.ts`:**
```typescript
// Правила за изводи — MC прашања
export function generateDerivativeExercise(difficulty: 1|2|3): LabExercise
// diff 1: d/dx(x³) = ? → power rule
// diff 2: d/dx(sin(x)·x²) = ? → product rule
// diff 3: d/dx(sin(x²)) = ? → chain rule

// Риман суми — нумерички
export function generateRiemannExercise(): LabExercise
// "∫₀² x dx приближно со 4 правоаголници = ?"

// Граници
export function generateLimitExercise(difficulty: 1|2|3): LabExercise
// "lim_{x→2} (x²-4)/(x-2) = ?"

export function generateCalculusSet(n: number, tab: CalcTab): LabExercise[]
```

**Вежбај таб:**
- Избор по тема (Изводи/Риман/Граници)
- За изводи: паралелно прикажан граф на f(x) и f'(x)
- За погрешен одговор: прикажи го правилото кое важи

Commit: `feat(labs-L2a): CalculusLab — Вежбај tab with derivatives/Riemann/limits`

---

### L2.2 — ProbabilityLab: Интеграција со ProbabilitySimulator + Вежбај

**Тековно:** `ProbabilityLab.tsx` и `ProbabilitySimulator.tsx` постојат одделно
**Проблем:** Нема врска меѓу нив и нема exercise режим

**Нови вежби во `probabilityMath.ts`:**
```typescript
export function generateBasicProbExercise(difficulty: 1|2|3): LabExercise
// "Фрлаш 2 коцки. Веројатноста за збир = 7 е?"
// → multiple_choice (1/6, 1/4, 1/36, 7/36)

export function generateConditionalExercise(): LabExercise
// "P(A|B) = P(A∩B)/P(B). Ако P(A∩B)=0.3 и P(B)=0.6, P(A|B)=?"

export function generateTreeExercise(): LabExercise
// Дадено дрво на веројатности → пресметај P(крај-јазол)

export function generateSimulationQuestion(results: number[]): LabExercise
// Поврзано со симулаторот: "Фрливте монета 100 пати. Теоретски P(глава)=0.5.
// Вашиот резултат беше 47%. Дали тоа е очекувано?"
```

**Интеграција:** ProbabilitySimulator се вградува во ProbabilityLab
(наместо да е одделна компонента само во `components/math/`).
"Прикажи симулатор" копче отвора симулаторот inline, резултатот
се нуди за анализа преку generateSimulationQuestion.

Commit: `feat(labs-L2b): ProbabilityLab — integrate simulator + Вежбај exercises`

---

### L2.3 — LinearAlgebraLab: Вежбај таб (после TD.2 split)

**Нов файл `components/dataviz/linearAlgebraMath.ts`:**
```typescript
export function generateMatrixMultiplyExercise(size: 2|3): LabExercise
// 2×2: "A·B = ?" → numeric grid (4 полиња)
// 3×3: само det(A) = ?

export function generateDeterminantExercise(difficulty: 1|2|3): LabExercise
export function generateSystemExercise(vars: 2|3): LabExercise
// "Реши: 2x+y=5, x-y=1" → x=?, y=?

export function generateEigenExercise(): LabExercise
// "За A=[[3,1],[0,2]], сопствените вредности се?"

export function generateLinAlgSet(n: number, topic: LinAlgTab): LabExercise[]
```

**Вежбај таб:** Паралелен приказ на матрицата + прашањето. По погрешен
одговор: прикажи го чекор-по-чекор методот (Gauss eliminација итн.)

Commit: `feat(labs-L2c): LinearAlgebraLab — Вежбај tab with matrix/system exercises`

---

## ФАЗА L3 — НАПРЕДНИ ЛАБИ (гимназија)

### L3.1 — SecondaryStatsLab: Вежбај таб

**Нов файл `components/dataviz/statsExerciseMath.ts`:**
```typescript
export function generateNormalDistExercise(): LabExercise
// "Ако X~N(100,15), P(X<115) = ?" → Z-table lookup вежба

export function generateRegressionExercise(): LabExercise
// Даден scatter plot со 4 точки → "Нагибот на регресионата линија е?"

export function generateBayesExercise(): LabExercise
// Класичен: болест/тест проблем со конкретни бројки

export function generateChiSquareExercise(): LabExercise
// "χ² статистиката за оваа табела е?" → numeric
```

Commit: `feat(labs-L3a): SecondaryStatsLab — Вежбај tab with 4 stat exercise types`

---

### L3.2 — LogExpLab: Вежбај таб

**Нови вежби во постоечки `LogExpLab.tsx` (или нов `logExpMath.ts`):**
```typescript
export function generateLogExercise(difficulty: 1|2|3): LabExercise
// diff 1: "log₂(8) = ?" → numeric (3)
// diff 2: "log₃(x) = 4, x = ?" → numeric (81)
// diff 3: "log₂(x) + log₂(x-2) = 3, x = ?" → numeric

export function generateExpExercise(difficulty: 1|2|3): LabExercise
// "2^x = 32, x = ?" / "e^x = 7, x ≈ ?"
```

Commit: `feat(labs-L3b): LogExpLab — Вежбај tab with log/exp exercises`

---

### L3.3 — ConicSectionsLab: Вежбај таб

```typescript
export function generateConicExercise(type: 'circle'|'ellipse'|'parabola'|'hyperbola'): LabExercise
// "За x²/9 + y²/4 = 1, полу-оска a = ?" → numeric (3)
// "Центарот на x² + y² - 4x + 6y = 3 е?" → MC [(-2,3), (2,-3), ...]
```

Commit: `feat(labs-L3c): ConicSectionsLab — Вежбај tab with conic equations`

---

## ФАЗА L4 — ПОВРЗУВАЊЕ СО СИСТЕМОТ

### L4.1 — StudentPortfolioReport: Лаб активности секција

Додај нова секција во `components/portfolio/StudentPortfolioReport.tsx`:
```
📐 Лабораториски активности (последни 30 дена)
   Тригонометрија: 3 сесии · 87% просек
   Теорија на броеви: 5 сесии · 72% просек
   Месна вредност: 2 сесии · 95% просек
```

Извор: `quiz_results` каде `quizType === 'lab'` — без нова Firestore колекција.

### L4.2 — ClassInsightsBanner: Лаб инсајти

Ако наставникот има `quiz_results` со `quizType: 'lab'` за темата,
ClassInsightsBanner прикажува и:
```
📐 Лаб активности за оваа тема: 47 сесии · 74% просек
   Препорака: Учениците имаат тешкотии со единичната кружница →
   [Стартувај TrigonometryLab → Вежбај таб]
```

---

## РЕВИДИРАН РЕДОСЛЕД (2026-07-02)

> Клучна промена: S113 ClassInsightsBanner ПРЕД L1-L3 (затвора кругот).
> S115A (QR+PIN) паралелно со L1 — 2 недели, не 10.
> Без S113 лабораториите зачувуваат во вакуум; со него секоја сесија → препорака за следниот час.

```
TD — ТЕХНИЧКИ ДОЛГ (денес):
  TD.1  Geometry3DLab split 917→296 LOC            ✅ ГОТОВО
  TD.2  LinearAlgebraLab split 906→~450 LOC         🔲
  TD.3  AlgebraTilesCanvas split 828→~400 LOC       🔲

Commit: refactor(td): split LinearAlgebraLab + AlgebraTilesCanvas

L0 — ОСНОВА (ден 1):
  types/labTypes.ts                                  ~40 LOC
  hooks/useLabSession.ts                             ~130 LOC
  components/labs/LabExercisePanel.tsx               ~200 LOC

Commit: feat(labs-L0): useLabSession + LabExercisePanel — foundation

S113 — ЗАТВОРИ ГО КРУГОТ (ден 2) ← НОВО МЕСТО:
  hooks/useClassInsights.ts                          ~100 LOC
  components/classroom/ClassInsightsBanner.tsx        ~150 LOC
  Жичено во: LessonPlanEditorView + ScenarioBankView

Commit: feat(s113): ClassInsightsBanner — loop closed (labs → teacher insight)

S115A — QR+PIN ПРИСТАП (ден 3-5, паралелно со L1) ← НОВО:
  utils/studentPin.ts  — generatePin(teacherUid, className)
  StudentAccessPage.tsx — URL ?class=VII-A&pin=7834
  Жичено во: StudentProgressView → "Сподели пристап" копче

Commit: feat(s115a): QR+PIN student access — no auth needed

L1 — ОСНОВНИ ЛАБИ (ден 3-6):
  placeValueMath.ts + PlaceValueLab Вежбај connect   ~120 LOC
  numberTheoryMath.ts + NumberTheoryLab Вежбај tab   ~200 LOC
  trigMath.ts + TrigonometryLab Вежбај tab           ~200 LOC

Commit: feat(labs-L1): PlaceValue + NumTheory + Trig — Вежбај tabs → quiz_results

L2 — СРЕДНИ ЛАБИ (ден 7-10):
  calculusMath.ts (нов) + CalculusLab Вежбај         ~200 LOC
  probabilityMath.ts + ProbabilityLab simulator      ~200 LOC
  linearAlgebraMath.ts + LinearAlgebraLab Вежбај     ~200 LOC

Commit: feat(labs-L2): Calculus + Probability + LinAlg — Вежбај tabs

L3 — НАПРЕДНИ ЛАБИ (ден 11-13):
  statsExerciseMath.ts + SecondaryStatsLab Вежбај    ~200 LOC
  LogExpLab exercises                                 ~150 LOC
  ConicSectionsLab exercises                          ~150 LOC

Commit: feat(labs-L3): Stats + LogExp + Conics — Вежбај tabs

L4 — ПОВРЗУВАЊЕ (ден 14):
  StudentPortfolioReport: lab activities section      ~60 LOC
  (ClassInsightsBanner веќе е направена во S113)

Commit: feat(labs-L4): StudentPortfolioReport — lab sessions section
```

### Цена на S115 (ревидирана)
```
Тековно (450 наставници):      ~$1-3/месец
+ S115A QR/PIN:                 $0 extra (нема нова auth)
+ S115B ученички auth (11k):   +$8-15/месец
+ S115C родители:               +$5-10/месец
Вкупно со сè:                  ~$15-30/месец  (НЕ $50-150)
```
S115B/C се оправдани кај 1000+ наставници и кога постои budget.

---

## ТЕХНИЧКИ ОДЛУКИ

### Normализација на одговори

Нумерички одговори: `Math.abs(parseFloat(user) - parseFloat(correct)) < 0.01`
MC одговори: `user.trim().toLowerCase() === correct.trim().toLowerCase()`
Fill-blank: нормализирај markdown (√3/2 == "sqrt(3)/2" == "0.866")
→ `normalizeLabAnswer(user, correct): boolean` функција во `labTypes.ts`

### Student name за зачувување

`localStorage.getItem('studentName')` — постоечки pattern.
Ако нема → прикажи "Внеси го своето ime" поле (исто како StudentPortfolioView).
Не е потребен auth — consistent со постоечкиот систем.

### Hint систем

Секоја вежба има 1 hint. Употребата на hint се брои (влијае на bonus XP).
Хинтот НЕ го открива одговорот — само насочува (квадрант, правило, метод).

### Тежина адаптација

Ако ученикот одговори точно на 3 по ред → нуди "Зголеми тежина?".
Ако погреши 2 по ред → нуди "Намали тежина?".
Имплементирано во `useLabSession` — само UI промпт, не автоматски.

---

> Документот се ажурира по секој завршен commit.
> Следна сесија: Почни со TD.1-TD.3 (техничкиот долг), потоа L0.
