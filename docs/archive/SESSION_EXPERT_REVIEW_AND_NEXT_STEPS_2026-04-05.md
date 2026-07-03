Da # Session Expert Review and Next Steps (2026-04-05)

## 1) Executive summary

Current state is strong on product velocity and feature depth for Matura flows:
- M5 analytics + recovery loop + deltas + 7-day missions are implemented.
- Recovery share/export is implemented (txt/pdf/public links), including signed-link flow.
- SLO dashboard UX is hardened against auth/server failure loops.

Main remaining blocker is infra-level, not frontend code:
- `/api/slo-summary` can still fail with `PERMISSION_DENIED` when server service account cannot read Firestore `users/{uid}` in the target Firebase project.

Conclusion:
- App-level stability: good.
- Ops/backend configuration for SLO: needs correction before calling SLO fully production-ready.

---

## 2) Console errors triage

### A) `Permissions policy violation: unload is not allowed`
Observed in scripts like `content.*.js` and `Grammarly-check.js`.

Assessment:
- Mostly extension/content-script noise (external injection), not core app runtime.
- In-app unload-adjacent usage was reduced by switching from `beforeunload` to `pagehide` in collaboration cleanup flow.

Action:
- Treat as low-priority noise unless seen in first-party bundles.

### B) `/api/slo-summary` status 500
Current banner example indicates:
- `Firebase token verification failed — ... PERMISSION_DENIED: Missing or insufficient permissions.`

Assessment:
- Token arrives correctly, but server-side Firebase Admin access path is denied.
- This is usually one of:
  1. service account from wrong project,
  2. missing IAM role for Firestore read,
  3. mismatch between Auth project and Admin credentials,
  4. user profile doc/role path inaccessible due IAM or project mismatch.

Action (must-fix):
1. Verify Vercel env `FIREBASE_SERVICE_ACCOUNT` (or base64 variant) belongs to same project as client auth.
2. Grant Firestore read capability to service account (minimum suitable IAM role).
3. Confirm `users/{uid}` exists and has `role: admin` for active admin user.
4. Re-test `/api/slo-summary` and confirm CI + Sentry panels populate.

---

## 3) What was hardened this session

- SLO API error classification improved (401 vs 500 semantics).
- SLO dashboard retries once with forced token refresh, then blocks noisy loops.
- SLO auto-refresh now pauses on persistent server 500 until manual retry.
- Collaboration lifecycle uses `pagehide` instead of `beforeunload`.
- Recovery sharing upgraded with signed token issue/verify endpoints and legacy fallback.

---

## 4) Matura Simulation scaling plan (60+ exams)

Problem:
- Current simulation selection renders all exams as equal-priority cards.
- At 60+ exams this will become visually crowded and slower for decision making.

### Recommended design (P1)

1. Add exam catalog controls (top toolbar)
- Search by title/year/session/language.
- Filter chips: `year`, `session`, `language`, `track`.
- Sort: `Newest`, `Oldest`, `Most attempted`, `Best match`.

2. Grouped display instead of flat grid
- Default grouping: Year -> Session.
- Collapsible groups with count badges.

3. Progressive loading
- Pagination (e.g. 12 cards/page) or infinite load.
- Keep initial render fast and predictable.

4. Smart defaults
- Section: `Continue where you left off` (saved progress cards).
- Section: `Recommended for you` (based on weak topics from M5).
- Section: `Recent attempts`.

5. Visual declutter
- Compact card mode toggle for dense catalogs.
- Show secondary metadata only on hover/expand.

### Recommended technical changes

- New hook: `useMaturaExamCatalog` with query state:
  - `search`, `filters`, `sort`, `page`, `pageSize`.
- Memoized selectors for filtered/sorted exams.
- Keep current `ExamCard` but add compact variant.

Acceptance criteria:
- With 60+ exams, first interaction (search/filter) under 150ms on typical laptop.
- User can find target exam in <= 3 interactions.

---

## 5) Raise Matura Simulation to higher level

### P1 upgrades

1. Exam blueprint mode
- Show difficulty mix, DoK distribution, topic coverage before start.
- Let user pick simulation strategy: full official vs targeted blueprint.

2. Intelligent pacing coach during exam
- Time checkpoints by section (soft alerts).
- Detect risk of over-time per remaining questions.

3. Better post-exam diagnostics
- Gap matrix: Topic x DoK x Error type.
- Link each weak cell to recovery action.

4. Attempt comparatives
- Compare latest vs previous 3 attempts on same exam family.
- Show delta trend and confidence band.

### P2 upgrades

5. Alternate form generation
- Generate equivalent-form simulation from library constraints.
- Keep official-like structure while varying item mix.

6. Exam readiness score
- Composite score from consistency, time discipline, and mastery spread.

---

## 6) Raise Adaptive Practice to higher level

### P1 upgrades

1. Adaptive item selection engine
- Input signals: correctness, response time, confidence/self-check quality, recency.
- Output: next-question policy balancing remediation and challenge.

2. Mastery state per concept
- Maintain mastery score [0..1] with confidence.
- Move from static weak-list to probabilistic mastery tracking.

3. Session objective modes
- `Recover weak concept`, `Speed and accuracy`, `DoK-3 push`, `Pre-exam warmup`.

4. Spaced repetition integration
- Re-schedule weak concepts with forgetting-curve intervals.

### P2 upgrades

5. Adaptive hints policy
- Graduated hints by struggle index, with minimal answer leakage.

6. Personal learning velocity
- Estimate expected gain per 10-minute session and optimize queue.

Acceptance criteria:
- Measurable lift in recovery conversion (weak concept -> stable >=70%) after 7-day cycle.
- Lower dropout from practice sessions via shorter, objective-driven runs.

---

## 7) Recommended next sprint breakdown

### Sprint A (immediate)
1. Fix SLO infra IAM mismatch (ops task).
2. Implement Simulation Catalog toolbar (search/filter/sort).
3. Add grouped-by-year/session exam list with pagination.

### Sprint B
1. Add `Recommended exams` fed by M5 weak concepts.
2. Add post-simulation gap matrix and direct recovery CTA.

### Sprint C
1. Implement adaptive selector for practice queue.
2. Add mastery-state model and spaced repetition scheduler.

---

## 8) Session close readiness

Can we close this session now?
- Yes, from coding perspective we can close after this handoff.

What still needs follow-up before claiming full operational readiness?
- SLO backend permission fix in deployment environment.
- Optional: lightweight SLO diagnostics endpoint for one-click admin troubleshooting.

Suggested immediate owner actions:
1. Ops: verify Firebase service-account IAM and project alignment.
2. Product/Eng: approve Simulation Catalog UX scope for Sprint A.
3. Eng: start Adaptive selector foundation after catalog work.
