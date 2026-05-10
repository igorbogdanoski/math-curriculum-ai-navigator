# S62 — Универзални интерактивни функции, n×n линеарна алгебра и проширена Академија

> Претходен спринт: [./S61_ACTION_PLAN.md](./S61_ACTION_PLAN.md) (Дига Pro, 22/22 ✅)
> Поврзано: [./S60_ACTION_PLAN.md](./S60_ACTION_PLAN.md)

## Визија

Подигни го `DataVizStudio` и `Academy` на светско ниво за интерактивни математички алатки:

1. **Слајдери за СЕКОЈА елементарна функција** (не само квадратна) — `y = a·f(b·x + c) + d` за полиномни, експоненцијални, логаритамски, тригонометриски, рационални и кусоврзни функции, со жива визуелизација и формула рендерирана во KaTeX/MathJax.
2. **Логаритамска и експоненцијална функција** во `CalculusLab` — изведба, тангента, асимптоти, релација `log_b ↔ b^x`, апликации во веројатност (entropy/log-likelihood, log-normal).
3. **n×n матрици и детерминанти** во `LinearAlgebraLab` — димензија 2..6, со повеќе методи за решавање:
   - Гаусова елиминација (со чекор-по-чекор траг),
   - Кофакторно развивање (Лапласова експанзија),
   - Крамерово правило (со визуелна замена на колони),
   - LU декомпозиција,
   - Инверзна матрица преку adj(A)/det(A).
4. **Проширена Академија** — нови лекции, мастери-патишта и SRS картички за сите нови алатки.

Без компромиси — секој дел е тестиран, типизиран и интегриран во навигацијата + повикан од `MaturaTutorChat` (canned actions).

---

## Сегашна состојба (discovery)

- `./components/math/functionTransformerHelpers.ts` — `BASE_FUNCTIONS` поддржува `sin/cos/tan/log(=ln)/sq/sqrt/abs/cube`. Недостасуваат: `log_b` со варијабилна основа, `exp` (`a^x`, `e^x`), `1/x` (рационална), `x^n` (полиномна со параметар `n`), `piecewise`.
- `./components/math/FunctionTransformer.tsx` — фиксни SLIDER_RANGES, без избор на основа за лог/експ.
- `./components/dataviz/FunctionGrapher.tsx` — генерален графер со безбеден evaluator; нема прикачени слајдери.
- `./components/dataviz/LinearAlgebraLab.tsx` — рачно напишани `det2/det3/inv2/mul2/add2/transpose2`, без n×n генерализација, без чекори за елиминација, без Крамер/LU.
- `./components/dataviz/CalculusLab.tsx` — постои; треба `log/exp` поглавје со изведба и тангенти.
- `./views/AcademyView.tsx` + `./components/academy/*` — има 6 компоненти; треба нови лекции за `function-sliders`, `linear-algebra-methods`, `log-exp-calculus`.

---

## Задачи

### A. Универзални слајдери за функции

| ID | Опис | Фајлови | Тестови |
|----|------|---------|---------|
| **A1** | Прошири `BASE_FUNCTIONS` со `expBase` (b^x), `logBase` (log_b x), `recip` (1/x), `polyN` (x^n со цело n∈[2..6]), `piecewise` (parameterised pieces) | `components/math/functionTransformerHelpers.ts` | `__tests__/functionTransformerHelpers.universal.test.ts` |
| **A2** | Додај `extraParams` slot во `TransformParams` (за `n` polynomial degree, `b` log/exp base) и пренеси низ `applyTransform/sampleCurve/formatFormula` | исти | покриено од A1 |
| **A3** | `FunctionTransformer.tsx` — динамички слајдери врз основа на `extraParams`; KaTeX рендер на формула | `components/math/FunctionTransformer.tsx` | `__tests__/functionTransformerUniversal.test.tsx` |
| **A4** | Поврзи `FunctionTransformer` во `DataVizStudioView` под `fn` tab — нов sub-tab "Слајдери за функции" | `views/DataVizStudioView.tsx` | smoke-only |

### B. Logarithm / Exponential во CalculusLab

| ID | Опис | Фајлови | Тестови |
|----|------|---------|---------|
| **B1** | Нов `LogExpLab` sub-component со живи слајдери (`a, b, base`) — log/exp паралелен приказ + асимптоти + точка на тангента | `components/dataviz/CalculusLab.tsx`, нова `components/dataviz/LogExpLab.tsx` | `__tests__/logExpLab.test.tsx` |
| **B2** | Изведба `d/dx[log_b x] = 1/(x·ln b)`, `d/dx[b^x] = b^x · ln b` — приказ во KaTeX, нумеричка проверка | исти | покриено |
| **B3** | „Verojatnost“ presets (entropy, log-likelihood, log-normal) — линкови во `ProbabilityLab` | `components/dataviz/ProbabilityLab.tsx` | snapshot |

### C. n×n LinearAlgebraLab

| ID | Опис | Фајлови | Тестови |
|----|------|---------|---------|
| **C1** | Generic `Mat = number[][]` алгебра: `mul`, `add`, `sub`, `transpose`, `identity`, `scalar`, `submatrix` | нова `utils/matrixOps.ts` | `__tests__/matrixOps.test.ts` |
| **C2** | `gaussElim(M, b?) → { U, L, steps, det, rank }` со забележани row-ops | `utils/matrixOps.ts` | покриено |
| **C3** | `cramer(A, b)` со per-column замена + `determinantCofactor(A)` (rekurзивно) | `utils/matrixOps.ts` | покриено |
| **C4** | `inverseAdjugate(A)` + `luDecompose(A)` | `utils/matrixOps.ts` | покриено |
| **C5** | `LinearAlgebraLab` UI: dimension picker 2..6, метод-избирач (Gauss/Cramer/Cofactor/LU/Adj), step-by-step rendering | `components/dataviz/LinearAlgebraLab.tsx` | `__tests__/linearAlgebraLab.test.tsx` |
| **C6** | „Систем равенки“ tab — внеси A и b, одбери метод, прикажи решение со чекори | исти | покриено |

### D. Academy expansion

| ID | Опис | Фајлови | Тестови |
|----|------|---------|---------|
| **D1** | Нови лекции: `function-sliders`, `log-exp-calculus`, `matrix-methods` во ACADEMY_CONTENT | `data/academy/content.ts` | snapshot |
| **D2** | Поврзи лекциите со `AcademyLessonView` embeds (FunctionTransformer, LogExpLab, LinearAlgebraLab) | `views/AcademyLessonView.tsx` | smoke |
| **D3** | SRS картички за нови концепти (10 cards × 3 модули) | `data/academy/srs-deck.ts` | покриено од D1 |

### E. Tutor + Дига интеграции

| ID | Опис | Фајлови | Тестови |
|----|------|---------|---------|
| **E1** | `MaturaTutorChat` canned action „Покажи слајдер за <fn>“ — отвора FunctionTransformer со пресет | `components/ai/MaturaTutorChat.tsx` | smoke |
| **E2** | Дига `function_match` — поддржи `extraParams.base` за логаритамска функција | `services/firestoreService.dugga.ts`, `utils/duggaScoring.ts` | tests update |

### F. Quality gates

| ID | Опис | Фајлови | Тестови |
|----|------|---------|---------|
| **F1** | `npm run test` зелено за сите нови тестови (~+45 cases) | — | — |
| **F2** | `npx tsc --noEmit` без грешки | — | — |
| **F3** | `npm run eval:smoke-gate` ≥ 70 | — | — |

---

## Тракинг

| Task | Статус | Commit | Дата |
|------|--------|--------|------|
| A1 | ⏳ | — | — |
| A2 | ⏳ | — | — |
| A3 | ⏳ | — | — |
| A4 | ⏳ | — | — |
| B1 | ⏳ | — | — |
| B2 | ⏳ | — | — |
| B3 | ⏳ | — | — |
| C1 | ⏳ | — | — |
| C2 | ⏳ | — | — |
| C3 | ⏳ | — | — |
| C4 | ⏳ | — | — |
| C5 | ⏳ | — | — |
| C6 | ⏳ | — | — |
| D1 | ⏳ | — | — |
| D2 | ⏳ | — | — |
| D3 | ⏳ | — | — |
| E1 | ⏳ | — | — |
| E2 | ⏳ | — | — |
| F1 | ⏳ | — | — |
| F2 | ⏳ | — | — |
| F3 | ⏳ | — | — |

### Резерва (ако дозволи време)

- Конусни пресеци (елипса, хипербола, парабола) со слајдери `a, b, c, h, k, θ`
- Анимирано поместување (translation/rotation) на графици преку `requestAnimationFrame`
- Resolver за неравенки со shaded region на 2D-graph
- Eigenvalue/eigenvector визуелизатор за 2×2/3×3 матрици
- Polynomial root finder (Durand-Kerner) интегриран во FunctionGrapher
