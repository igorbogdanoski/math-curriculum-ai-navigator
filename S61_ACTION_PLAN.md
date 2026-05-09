# S61 — Action Plan: Дига Pro (финални тестови, embedded math, per-question контроли)

> Креирано: 08.05.2026 | Влез: S60 завршен (26/26 ✅) + дискусија за Дига како платформа за официјални завршни тестови
> Цел: подигни ја постоечката Дига платформа од "тест-builder" во **производ за официјални завршни испити** во основно + средно (гимназиско + стручно), со целосни наставнички контроли по прашање, embedded математички алатки (GeoGebra/Desmos), нови типови прашања, и врска со нашиот курикулум.

---

## Принципи

1. **Per-question opt-in** — наставникот контролира што е достапно (QR upload, math editor, embedded алатка) за секое прашање одделно.
2. **Никогаш да не се намалат постоечките функционалности** — само адитивни промени; постоечките дига тестови остануваат валидни.
3. **Test-first** за критични flows; еден commit = една единица.
4. **Курикулум-aware** — финалните тестови треба да знаат за концепти/теми/track од нашата taxonomy.
5. **Strict TypeScript** — никаков `as any`, никаков `@ts-ignore`.

---

## Tier A — Per-question наставнички контроли (ден 1–3) **[P0]**

### A1 — Прошири `DuggaQuestion` со нови полиња
- Фајл: `services/firestoreService.dugga.ts`
- Нови полиња (сите опционални за бекф-компат):
  - `allowSolutionUpload?: boolean` — дозволи QR upload на решение (per question)
  - `embedTool?: 'none' | 'geogebra-graphing' | 'geogebra-cas' | 'geogebra-geometry' | 'geogebra-3d' | 'desmos-calc' | 'desmos-graph'`
  - `embedConfig?: { materialId?: string; initialState?: string; height?: number; persistState?: boolean }`
  - `answerInput?: 'text' | 'math' | 'mixed'` — кој уредник за ученикот (default по тип)
  - `linkedConceptIds?: string[]` — врска со курикулумот
  - `studentDrawingMode?: 'none' | 'bar-chart' | 'line-chart' | 'free-draw'` — дозволи цртање како одговор
- AC: tsc clean; постоечки документи не се пробиваат.
- Тест: `__tests__/firestoreServiceDugga.types.test.ts` (тип-чек снапшот).
- Commit: `feat-s61-a1-dugga-question-extended-fields`

### A2 — `DuggaBuilderView`: панел "Алатки и контроли" по прашање
- Фајл: `views/DuggaBuilderView.tsx`
- Под секое прашање со `isOpen(q)` (essay/short_answer/fill_blanks/multi_part/list_items): нов collapsible "🛠 Алатки за ученикот":
  - Toggle: "Дозволи QR качување решение"
  - Dropdown: "Вградена алатка" (none/GeoGebra/Desmos × варијанти)
  - Dropdown: "Уредник за одговор" (text/math/mixed)
  - Multiselect: "Поврзи со концепти" (од нашата curriculum taxonomy)
  - Dropdown: "Дозволи цртање" (none/bar/line/free-draw)
- AC: state се чува во формуларот; updateDuggaTest запишува правилно.
- Тест: `views/duggaBuilder.controls.test.tsx`
- Commit: `feat-s61-a2-builder-per-question-controls`

### A3 — `DuggaPlayerView`: условно рендерирање по флегови
- Фајл: `views/DuggaPlayerView.tsx`
- QR панелот сега се рендерира за **било кој** open-ended тип ако `allowSolutionUpload === true`, не само за essay
- Math editor toggle сега се почитува автоматски од `answerInput` (mixed = toggle, math = always math, text = textarea)
- Под прашањето се рендерира `<EmbeddedMathTool>` ако `embedTool && embedTool !== 'none'`
- Drawing canvas се рендерира ако `studentDrawingMode !== 'none'`
- AC: постоечки тестови не се кршат; сите 16 типови сè уште работат.
- Тест: `views/duggaPlayer.conditional.test.tsx`
- Commit: `feat-s61-a3-player-conditional-tools`

---

## Tier B — Embedded математички алатки (ден 4–6) **[P0]**

### B1 — `<EmbeddedGeoGebra>` компонент
- Фајл: `components/math/EmbeddedGeoGebra.tsx`
- Props: `app: 'graphing' | 'cas' | 'geometry' | '3d'`, `materialId?: string`, `initialState?: string`, `height?: number`, `onState?: (xml: string) => void`
- Користи GeoGebra Apps Embed API (iframe со `geogebra.org/m/<materialId>` или `apps-api.html` за чист app)
- На submit: emit XML state преку postMessage → се персистира во `submission.answers[qId]`
- Test: `components/math/embeddedGeoGebra.test.tsx` (mount + props snapshot)
- Commit: `feat-s61-b1-embedded-geogebra`

### B2 — `<EmbeddedDesmos>` компонент
- Фајл: `components/math/EmbeddedDesmos.tsx`
- Props: `type: 'calc' | 'graph'`, `state?: string`, `height?: number`, `onState?: (s: string) => void`
- Користи Desmos Calculator API (script tag) со state via `getState()`/`setState()`
- Fallback: `https://www.desmos.com/calculator?embed` iframe ако скриптата не се вчита (offline)
- Test: `components/math/embeddedDesmos.test.tsx`
- Commit: `feat-s61-b2-embedded-desmos`

### B3 — `<EmbeddedMathTool>` router компонент
- Фајл: `components/math/EmbeddedMathTool.tsx`
- Прима `embedTool` + `embedConfig` од `DuggaQuestion`, render-ира соодветната алатка, и експортира статус (loaded/error/state)
- Test: `components/math/embeddedMathTool.test.tsx`
- Commit: `feat-s61-b3-embedded-math-tool-router`

---

## Tier C — Нови типови прашања инспирирани од Math is Fun (ден 7–10) **[P1]**

### C1 — `student_chart` — ученикот цртаа дијаграм како одговор
- Reuse `ChartPreview` со editable mode; auto-grade преку `gradeStudentChart()` (споредува податоци + axis labels со tolerance)
- Builder: наставникот внесува "expected dataset" + tolerance %
- Commit: `feat-s61-c1-student-chart-question`

### C2 — `function_match` — drag слајдери за коефициенти
- Reuse `FunctionTransformer`; auto-grade проверува дали финалниот f(x) ≡ target
- Builder: target expression + slider ranges
- Commit: `feat-s61-c2-function-match-question`

### C3 — `unit_circle_pick` — клик на единичен круг
- Нов `<UnitCirclePicker>` компонент; тапиш точка → се споредува со sin/cos на даден агол
- Builder: target агол + tolerance во степени
- Commit: `feat-s61-c3-unit-circle-question`

### C4 — `proof_steps` — drag-ordering со LaTeX чекори
- Combinacija на постоечки `ordering` + `MathInput`; чекорите се math expressions
- Auto-grade: точна пермутација; partial credit за најдолг точен суфикс
- Commit: `feat-s61-c4-proof-steps-question`

### C5 — `geometry_construct` — GeoGebra construction задача (P2)
- Користи `<EmbeddedGeoGebra app="geometry">`; AI-grade преку XML state анализа (Gemini Vision на screenshot како фалбек)
- Commit: `feat-s61-c5-geometry-construct-question`

---

## Tier D — Курикулум-aware Дига (ден 11–13) **[P1]**

### D1 — `duggaAPI.generateFromConcept(conceptId, count, dokDist)`
- Фајл: `services/gemini/dugga.ts`
- Влез: concept ID од нашата taxonomy + број прашања + DoK дистрибуција
- Излез: `DuggaQuestion[]` со `linkedConceptIds` веќе пополнето
- Test: `__tests__/duggaGenerateFromConcept.test.ts` (mock Gemini)
- Commit: `feat-s61-d1-dugga-from-concept`

### D2 — `ConceptDetailView` CTA "Создади дига тест"
- Фајл: `views/ConceptDetailView.tsx`
- Нов копче што отвара `DuggaBuilderView` со `prefilledConceptId`
- Commit: `feat-s61-d2-concept-to-dugga-cta`

### D3 — `DuggaLibraryView` — track + grade филтри
- Фајл: `views/DuggaLibraryView.tsx`
- Чипови: гимназија, стручно-IT, стручно-економија, ..., класа I–IX (основно), I–IV (средно)
- Commit: `feat-s61-d3-library-track-grade-filters`

---

## Tier E — Финален испит mode (ден 14–16) **[P0]**

### E1 — `finalExamMode` поле во `DuggaTest`
- `finalExamMode?: { lockedAt?: Timestamp; allowedTracks?: string[]; durationMin: number; pauseOnHidden: boolean; allowResume: boolean; antiCheat?: boolean }`
- AC: ако `lockedAt` е поставен, тестот е незаменлив (нема updateDuggaTest)
- Commit: `feat-s61-e1-final-exam-mode-field`

### E2 — Player користи `useExamVisibilityPause` (од T2.3) во final mode
- Тајмер пауза на hidden, ⏸ бадж, auto-submit на 0
- Commit: `feat-s61-e2-player-pause-and-timer`

### E3 — Submission seal
- Фајл: `services/firestoreService.dugga.ts`
- При submit во final mode: пресметај SHA-256 на `JSON.stringify(answers)` + `submittedAt` + `studentUid` → `submission.seal`
- Sentry breadcrumb: `dugga.final.submitted` со score + seal
- Test: `utils/duggaSeal.test.ts`
- Commit: `feat-s61-e3-submission-seal`

### E4 — Anti-cheat hooks (P2)
- Detect tab-switch counter; копи/пасте блокада во input; copyрight watermark on print
- Commit: `feat-s61-e4-anti-cheat-hooks`

---

## Tier F — Quality, eval, deploy (ден 17–18) **[P0]**

### F1 — eval gate за `generateFromConcept`
- `eval/dugga-from-concept-golden.json` — 15 концепти × 5 прашања = 75 expected outputs
- Commit: `chore-s61-f1-eval-gate-dugga-from-concept`

### F2 — Playwright spec за Дига finalExamMode
- `tests/dugga-final-exam.spec.ts` — login → builder → lock → student player → pause → submit → seal verify
- Commit: `test-s61-f2-playwright-final-exam`

### F3 — Doc + commit на S60 заглавие со linkback кон S61
- Само сега, не во план; ќе се направи на крај.

---

## Дневен ред (предложен)

| Ден | Tier | Tasks |
|-----|------|-------|
| 1–3 | A | A1, A2, A3 |
| 4–6 | B | B1, B2, B3 |
| 7–10 | C | C1, C2, C3, C4 (C5 буфер) |
| 11–13 | D | D1, D2, D3 |
| 14–16 | E | E1, E2, E3 (E4 буфер) |
| 17–18 | F | F1, F2, deploy gate |

---

## Definition of Done

- [ ] Сите Tier A + B + E ✅ (P0)
- [ ] Минимум 3 нови типови прашања од Tier C ✅
- [ ] Tier D: D1 + D3 ✅
- [ ] Tier F: F1 + F2 green
- [ ] `npm run lint && npm run test && npm run test:e2e && npm run eval:smoke-gate && npm run perf:budget` сите green
- [ ] Production деплој на ai.mismath.net потврден
- [ ] Барем 1 училиште поканет за beta тест на final exam mode

---

## Тракинг

| Task | Статус | Commit | Дата |
|------|--------|--------|------|
| A1 | ✅ | `aaedb30` | 08.05.2026 |
| A2 | ✅ | `3b2a2d0` | 08.05.2026 |
| A3 | ✅ | `34e5a37` | 08.05.2026 |
| B1 | ✅ | `ae57fc9` | 08.05.2026 |
| B2 | ✅ | `ae57fc9` | 08.05.2026 |
| B3 | ✅ | `ae57fc9` | 08.05.2026 |
| C1 | ✅ | `05d9a06` | 09.05.2026 |
| C2 | ✅ | `597ef2b` | 09.05.2026 |
| C3 | ✅ | pending | 09.05.2026 |
| C4 | ⏳ | — | — |
| C5 | 🔵 P2 | — | — |
| D1 | ⏳ | — | — |
| D2 | ⏳ | — | — |
| D3 | ⏳ | — | — |
| E1 | ⏳ | — | — |
| E2 | ⏳ | — | — |
| E3 | ⏳ | — | — |
| E4 | 🔵 P2 | — | — |
| F1 | ⏳ | — | — |
| F2 | ⏳ | — | — |

### Дополнителни задачи (надвор од планот)

| Task | Опис | Статус | Commit | Дата |
|------|------|--------|--------|------|
| OPS-1 | Vercel cost cut: `git.deploymentEnabled.main`, `ignoreCommand` | ✅ | `137ed8b` | 09.05.2026 |
| OPS-2 | `firestore-backup.yml`: bucket auto-create, secret validation, Node 24 opt-in | ✅ | `137ed8b` | 09.05.2026 |

### Тековен статус (resumption point)

- **Завршено:** A1, A2, A3, B1, B2, B3, C1, C2, OPS-1, OPS-2
- **Тековно во работа:** C3 — `unit_circle_pick` question type
- **Следен ред:** C3 → C4 → D1 → D3 → E1 → E2 → E3 → F1 → F2
- **Production:** ai.mismath.net auto-deploy на секој push на `main` (со ignoreCommand за docs/tests)
