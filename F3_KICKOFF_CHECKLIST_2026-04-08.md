# F3 Kickoff Checklist — 08.04.2026

Фаза: F3 Bundle strategy и code-splitting оптимизација
Статус: IN_PROGRESS

## Baseline Snapshot (08.04.2026)

1. Build: PASS (`npm run build`)
2. Perf budget: FAIL (`npm run perf:budget`)
3. Key fail: total assets = 10557.50 kB > 10000 kB budget
4. Largest JS chunk: 1515.78 kB (`dist/assets/vendor-Bkp9SWam.js`)
5. Main app chunk: 1239.98 kB (`dist/assets/index-BGbrFP-D.js`)
6. Evidence logs: `outputs/f3-kickoff-2026-04-08/build.log`, `outputs/f3-kickoff-2026-04-08/perf-budget.log`

## Ordered Execution (1 -> 2)

1. Step 1 (analysis-first):
- Map top contributors to total assets and initial-route critical path.
- Identify modules that can be deferred, split, or isolated into route-level chunks.
- Create a shortlist of top 5 high-impact refactor targets.

2. Step 2 (implementation-first wave):
- Apply focused chunking/lazy-loading changes for top targets.
- Re-run `npm run build` + `npm run perf:budget`.
- Record delta against baseline and decide if second optimization wave is needed.

## Step 1 Analysis Findings (08.04.2026)

Top bundle contributors from baseline output:
1. `dist/assets/vendor-Bkp9SWam.js` = 1515.78 kB
2. `dist/assets/index-BGbrFP-D.js` = 1239.98 kB
3. `dist/assets/vendor-pdf-D-PBYwG7.js` = 862.07 kB
4. `dist/assets/vendor-mathlive-DRnje_OS.js` = 816.48 kB
5. `dist/assets/vendor-firebase-Beqd78n2.js` = 778.81 kB

Prioritized optimization shortlist (Wave 1):
1. Move heavy export dependencies behind on-demand imports in presentation flow (`components/ai/GeneratedPresentation.tsx`: `pptxgenjs`, `html2canvas`).
2. Isolate screenshot/PDF capture paths into dedicated async utilities (`utils/pdfDownload.ts`, `views/DataVizStudioView.tsx`, `components/dataviz/AIStatsAssistant.tsx`).
3. Audit and reduce initial route coupling in app shell/providers (`App.tsx` + global providers) for `index-*` chunk pressure.
4. Ensure math parser usage is on-demand where possible (`utils/mathEvaluator.ts` currently statically imports `mathjs`).
5. Review Firestore service split warnings and remove static+dynamic mixed imports for same modules where possible.

## Acceptance Criteria

1. Perf budget passes without waivers.
2. Largest chunk target <= 1300 kB.
3. Main app chunk target <= 1000 kB.
4. No functional regressions in smoke and auth-guard critical checks.

## Step 2 Wave-1 Outcome (08.04.2026)

Applied change:
1. `components/ai/GeneratedPresentation.tsx`: `pptxgenjs` и `html2canvas` префрлени на on-demand import loaders.

Measured result:
1. Build: PASS (`outputs/f3-kickoff-2026-04-08/build-wave1.log`)
2. Perf budget: FAIL (`outputs/f3-kickoff-2026-04-08/perf-budget-wave1.log`)
3. Total assets after wave-1: 10557.74 kB (budget 10000 kB)
4. Largest chunk и main chunk практично непроменети (vendor ~1515.78 kB, index ~1239.98 kB)

Next wave focus (Wave-2):
1. Firestore/gemini split warning cleanup (елиминирање static+dynamic мешање за исти модули).
2. Initial app-shell pressure reduction (поместување non-critical providers/features од старт-up path).
3. Math stack review (`mathjs`, `mathlive`) за реално намалување на вкупни asset-и, не само прераспределба.
