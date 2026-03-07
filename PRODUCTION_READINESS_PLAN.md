# Production Readiness Plan
Created: 07.03.2026 | Status: COMPLETED

## Overview
App is feature-complete (Tier 1-5 + 22 Правци). This plan addresses quality,
reliability, and maintainability issues before wider rollout.

---

## P1 — Critical Fixes (no new features, just correctness)

| ID | Task | Status | Commit |
|----|------|--------|--------|
| P1-A | Fix Vitest config — exclude `functions/node_modules` + `tests/**` from discovery | DONE | cac1207 |
| P1-B | Add `limit(500)` to fetchSchoolStats per-teacher quiz_results queries | DONE | cac1207 |
| P1-C | Fix i18n — hardcoded MK strings in AssignmentsTab, QuestionBankTab, LeagueTab | DONE | cac1207 |

---

## P2 — Performance & Stability

| ID | Task | Status |
|----|------|--------|
| P2-A | Add TTL cache to TeacherAnalyticsView (5 min module-level Map cache) | DONE |
| P2-B | Paginate quiz_results (loads 200 + load more, sufficient) | DONE |
| P2-C | firestoreService.ts split by domain (school, quiz, mastery, assignments, library) | DONE |

---

## P3 — Polish & UX

| ID | Task | Status |
|----|------|--------|
| P3-A | i18n audit — QuestionBankTab, LiveTab, ClassesTab, GroupsTab | DONE |
| P3-B | Mobile responsiveness pass on TeacherAnalyticsView tabs | DONE |
| P3-C | Error boundary on QuestionBankTab and LiveTab | DONE |

---

## P4 — Tests

| ID | Task | Status |
|----|------|--------|
| P4-A | Install @testing-library/dom, exclude Playwright tests — 170/170 passing | DONE |
| P4-B | Add tests for grading.ts utility | DONE |
| P4-C | Add tests for firestoreService mock layer | DONE |

---

## Notes
- `functions/node_modules` contains lru-memoizer with deprecated `done()` callback
  tests — excluded via `vitest.config.ts` `exclude` array
- TeacherAnalyticsView has 14 tabs (4 primary + More dropdown) — no further tab
  additions planned; focus on reliability instead
- firestoreService.ts is ~1500 lines — P2-C split deferred until P1/P2-A,B done
