# E1 Runtime Deadlock Error Log

Date: 2026-04-03
Scope: `VIDEO_EXTRACTOR` runtime smoke in mocked E2E environment
Status: Resolved (2026-04-03)

## Symptom
- Flow reaches: URL input -> preview confirmed -> `Generate AI` clicked.
- UI remains in loading state (`AI Асистентот работи...`) and never renders generated scenario.
- This persists even with extended wait (`90s+`) and full test timeout (`120s`).

## Error Signature
- Playwright assertion failure:
  - `expect(getByText(/Видео-сценарио: Питагорова теорема/i)).toBeVisible()`
  - timeout exceeded after generation click.
- Representative screenshot state:
  - right panel shows spinner/loading text, no generated content.

## Reproduction (current diagnostic test)
- Test file: `tests/video-extractor-smoke.spec.ts`
- Scenario:
  1. Authenticate teacher session with mocks
  2. Open generator panel
  3. Select `VIDEO_EXTRACTOR`
  4. Confirm preview via mocked YouTube oEmbed
  5. Click `Generate AI`
  6. Wait for generated scenario title (fails: never appears)

## What has already been tried
- Tour/cookie overlay suppression in test flow.
- Firestore `documents/` GET fallback (404) + `:batchGet` fallback.
- Securetoken override with Firebase-compatible `id_token` payload.
- Mock for `/api/gemini`, `/api/imagen`, and callable `deductCredits`.
- Reduced startup noise via localStorage flags:
  - `auto_ai_suggestions=false`
  - temporary quota flag to avoid background AI hooks.
- Extended time budget (up to 120s total, 90s expectation window).

## Cross-check of external analysis (verified against current diagnostics)
- 1) Firestore listener mismatch (`onSnapshot` waits forever):
  - Status: **Partially plausible, not yet proven as primary blocker**.
  - Evidence: isolated harness and smoke both mock `/api/gemini` with valid `AIGeneratedIdeas`-shape payload, but smoke still stalls in loading.
  - Current note: no direct proof yet that UI waits exclusively on Firestore listener event in this specific path.

- 2) Unresolved Promise / malformed mock payload:
  - Status: **Confirmed as a major risk area**.
  - Evidence: earlier `securetoken` mock shape triggered `auth/internal-error`; after payload corrections, `/api/gemini` returns `200`, but loading can still persist in smoke.
  - Current note: mock payload correctness matters; malformed auth/token responses cause silent-ish runtime loops.

- 3) `deductCredits` blocking generation flow:
  - Status: **Not confirmed as primary blocker**.
  - Evidence: `/api/gemini` request is observed with `200` in failing smoke runs, so flow reaches generation call.
  - Current note: `deductCredits` may still add latency/noise, but it is not the first hard stop.

## New hard evidence from latest runs
- `tests/video-extractor-isolated-harness.spec.ts`: **PASS** (deterministic in current setup).
  - Confirms route entry, preview, generate click, and API-chain activity under isolated conditions.
- `tests/video-extractor-smoke.spec.ts`: **FAIL** persists on scenario render assertion.
  - After `Generate AI`, UI remains in loading state (`AI Асистентот работи...`).
  - Network telemetry in failing smoke shows `/api/gemini` `200`, followed by repeated token-refresh traffic (`securetoken`) while UI never resolves.
- Conclusion from differential behavior:
  - Core generator path can complete in isolation.
  - Deadlock emerges in full smoke composition (mock layering/state interactions), not from a single missing `/api/gemini` response.

## Known relevant fixes already merged
- Generator footer JSX corruption fixed in `views/MaterialsGeneratorView.tsx` (nested button/hydration issue removed).
- E2E automation tour-skip guard added in `hooks/useTour.ts` (`navigator.webdriver`).

## Hypothesis (current)
- Deadlock likely in mocked runtime chain around `generateLessonPlanIdeas` completion path plus auth/token-refresh side effects under full smoke composition.
- Not a pure UI overlay issue and not only slow response.
- Most likely class: **mocked-environment state divergence** (isolated harness green, full smoke red).

## Next Diagnostic Step
- Keep isolated harness as control baseline (`generator-only`) and keep it green.
- Add per-step runtime probes in smoke around generate completion:
  - browser `console` errors,
  - `pageerror` uncaught exceptions,
  - `requestfailed` hooks,
  - lightweight assertion for visible error toast/banner after generate click.
- Narrow smoke mocks to remove overlapping auth/token intercepts and validate final token refresh contract.
- Re-enable smoke gate only after deterministic green pass in full composition.

## Resolution Summary
- Root cause class: blocking async path in mocked runtime composition.
- Key fix in app code:
  - `services/gemini/plans.ts` (`generateLessonPlanIdeas`): cache write changed from blocking `await setDoc(...)` to non-blocking `void setDoc(...).catch(...)`.
  - Impact: UI completion no longer depends on Firestore cache-write completion under mocked auth/token behavior.
- Test hardening updates:
  - `tests/video-extractor-smoke.spec.ts` aligned to deterministic post-save signal (persisted note title) instead of transient toast text.
  - Overlay suppression and generator-direct routing retained.

## Final Verification
- `npx playwright test tests/video-extractor-smoke.spec.ts` -> **PASS**
- `npx playwright test tests/video-extractor-isolated-harness.spec.ts` -> **PASS**
