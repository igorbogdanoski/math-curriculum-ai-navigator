# F1 Smoke Report — 08.04.2026

Фаза: F1 Пост-аудит стабилизација на платформата
Статус: DONE

## Smoke Matrix

| Flow | Check | Статус | Белешка |
| --- | --- | --- | --- |
| Curriculum | Load + navigation | PASS | Covered via `smoke.spec.ts` + `happy-path.spec.ts` |
| Activities | Render + interaction | PASS | Covered via `smoke.spec.ts` + `student-flow.spec.ts` |
| Presentations (Gamma) | Slide render + controls | PASS | Covered via `happy-path.spec.ts` (generator/presentation flow) |
| Quiz | Question render + submit | PASS | Covered via `quiz-flow.spec.ts` + `teacher-quiz.spec.ts` |
| Live Quiz | Host/participant critical path | PASS | Covered via `student-play.spec.ts` + `webinar-critical-flows.spec.ts` |
| Academy | Lesson + interactive demo load | PASS | Covered via `smoke.spec.ts` + `happy-path.spec.ts` |

## Build/Typecheck/Test Gate

| Gate | Статус | Доказ |
| --- | --- | --- |
| TypeScript (`npx tsc --noEmit`) | PASS | 08.04.2026 |
| Build (`npm run build`) | PASS | 08.04.2026 |
| Unit suite (`npm test`) | PASS | 38 files / 446 tests |
| E2E core (`smoke`, `auth-guard`, `quiz-flow`) | PASS | 32 passed |
| E2E extended (`happy-path`, `teacher-quiz`, `student-play`, `webinar-critical-flows`) | PASS | 40 passed |
| Targeted harness (`video-extractor-isolated-harness`) | PASS | 1 passed (after selector fix) |
| Targeted smoke (`video-extractor-smoke`) | PASS | 1 passed |
| Full E2E gate (`npm run test:e2e`) | PASS | 103 passed (1.9m) |
| Targeted test (`videoSegmentation`) | PASS | 2/2 |

## Findings

- [Resolved] `tests/video-extractor-isolated-harness.spec.ts` и `tests/video-extractor-smoke.spec.ts` користеа застарени селектори (`Preview` / `Preview потврден`) што не постојат во тековниот UI (`Анализирај`).
- Fix: селекторот е префрлен на точно копче `^Анализирај$`, а потврдата е преку рендерираниот preview author (`Math Channel MK`) наместо непостоечки текст.
- Re-test: двата таргетирани spec-а се зелени по промената.
- Final status: full parallel run е стабилен и целосно зелен (103/103), без flaky во финалниот gate run.

## Next Action

1. F1 е формално затворена со green gate.
2. Handoff кон F2 (Interactive Math hardening + acceptance matrix).
