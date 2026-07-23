# MisMath AI — Technical Architecture

**Audience:** technical partners, investors performing due diligence, cloud providers, future engineers
**Date:** 23 July 2026 (verified by full-codebase audit)
**Product:** MisMath AI — https://ai.mismath.net

This document describes the architecture of MisMath AI as verified by a comprehensive read-only
audit on 23 July 2026. Claims below are grounded in the actual codebase, not marketing.

---

## 1. System overview

MisMath AI is an AI-powered curriculum platform for mathematics teachers. At a high level:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Frontend — React 19 + Vite 6 + TypeScript 5 (strict) + Tailwind 4    │
│  Hash-router SPA, lazy-loaded views, PWA, offline cache (IndexedDB)   │
└───────────────┬───────────────────────────────┬───────────────────────┘
                │                               │
        ┌───────▼────────┐              ┌───────▼─────────────┐
        │  Firebase       │              │  Vercel Serverless  │
        │  - Firestore    │              │  Functions (api/)   │
        │  - Auth         │              │  - AI proxy + metering│
        │  - Cloud Funcs  │              │  - Stripe billing   │
        │  - FCM push     │              │  - Grading (tamper- │
        └───────┬────────┘              │    proof), OG, SLO  │
                │                        └───────┬─────────────┘
                │                                │
        ┌───────▼────────────────────────────────▼─────────────┐
        │  AI layer — Google Gemini (model-agnostic, tiered)     │
        │  generation · vision/OCR · embeddings (RAG) · Imagen   │
        └────────────────────────────────────────────────────────┘
```

- **Frontend:** React 19, Vite 6, TypeScript 5 strict mode, Tailwind CSS 4. State via **Zustand** (client) + **@tanstack/react-query v5** (server/async). Schema validation with **Zod**.
- **Backend:** Vercel serverless functions (`api/`) for AI proxying, billing, and secure operations; Firebase Cloud Functions (`functions/`) for triggers and indexing.
- **Data:** Cloud Firestore (primary store) + IndexedDB (offline cache, `idb`).
- **AI:** Google Gemini via `@google/generative-ai`, behind a model-agnostic, tiered proxy.

## 2. Frontend architecture

- **Flat root structure** (no `src/` wrapper): `components/` (by feature domain), `views/` (route components), `contexts/`, `hooks/`, `services/`, `store/` (Zustand), `utils/`, `data/` (curriculum), `i18n/`.
- **Routing:** a custom hash-based router (`hooks/useRouter`) with ~90 routes. Views are **lazy-loaded** via a `safeLazy` wrapper that detects chunk-load failures after a deploy and shows a "new version available" refresh banner instead of crashing.
- **Provider tree:** ~18 React contexts (Auth, Navigation, UI, Planner, Planning, Curriculum, UserPreferences, GeneratorPanel, NetworkStatus, AcademyProgress, Notification, Modal, LastVisited, Language/i18n, etc.).
- **Internationalization:** 4 languages (MK/SQ/TR/EN) via `i18n/translations.*.ts` (~864 keys/language), browser-language detection, RTL support implemented (no RTL locale shipped yet).
- **Accessibility:** dyslexic-font toggle (OpenDyslexic), high-contrast mode, skip-link, applied at startup.
- **PWA & offline:** service worker, offline banner, IndexedDB caching of curriculum/materials.

## 3. Backend & serverless functions (`api/`)

Key Vercel functions (TypeScript):
- **`gemini.ts` / `gemini-stream.ts`** — the AI proxy. The server holds the API key; the client never sees it. Enforces **atomic credit metering** (see §6) and normalizes model names to safe defaults.
- **`matura-grade.ts`** — server-side, tamper-proof open-question grading (see §6).
- **`stripe-checkout.ts` / `stripe-webhook.ts` / `stripe-portal.ts`** — Stripe billing (see §7).
- **`slo-summary.ts`** — reliability/SLO aggregation for the admin dashboard.
- **`imagen.ts`** — image generation (model fallback ladder).
- **`webpage-extract.ts`** — web/YouTube/document extraction.
- **`create-school.ts`** — server-side school-admin promotion (Firebase Admin SDK).
- **`api/_lib/`** — shared utilities: `aiCredits.ts` (atomic credit transactions), `costTracker.ts`, `sharedUtils.ts` (model allowlist), `sloTracker.ts`.

Firebase Cloud Functions (`functions/src/index.ts`) handle Firestore triggers, embedding indexing, and Dugga submission verification.

## 4. Data layer (Firestore)

Collections (selected; full schema in `schemas/firestoreSchemas.ts` and `services/firestoreService.*.ts`):

| Collection | Purpose |
|---|---|
| `users/{uid}` | Teacher profile, role, tier, credits, preferences |
| `schools/{schoolId}` + subcollections | School accounts, school-admin scoping |
| `academic_annual_plans` | Annual plans (`topicId` hints, AI best-effort) |
| `weekly_plans` | Weekly plans (`{uid}_{annualPlanId}_w{week}`) |
| `users/{uid}/lessonPlans` | Lesson plans (`topicId`, `conceptIds`) |
| `scenario_bank` | Community shared scenarios (the active content hub) |
| `cached_ai_materials` | Saved AI-generated materials (content library) |
| `matura_exams` / `matura_questions` | Matura bank (with local JSON fallback) |
| `exam_sessions/{id}/responses` | Digital exam sessions & responses |
| `dugga_submissions` | Dugga test submissions (+ tamper-evident seal) |
| `grade_books` | Gradebook (3 grading models) |
| `quiz_results` / `concept_mastery` / `student_gamification` | Student results & mastery |
| `live_sessions` / `live_gamma` | Live classroom & Gamma game state |
| `forum_threads` / `forum_replies` | Teacher forum |
| `concept_embeddings` | Curriculum vectors for RAG |
| `cognitive_telemetry` | Step-level learning telemetry (admin-read) |
| `student_teacher_link` | Device→teacher linkage for rules |

**Offline:** curriculum and materials are cached in IndexedDB; the Matura bank ships as bundled JSON (`data/matura/raw/*.json`, 73 exams) loaded via `import.meta.glob` as an offline/local fallback.

## 5. AI stack

### 5.1 Model tiering (model-agnostic by design)
Central constants (`services/gemini/core.constants.ts`):
- `LITE` = `gemini-3.1-flash-lite-preview`, `DEFAULT` = `gemini-3.5-flash`, `PRO` = `gemini-3-pro-preview`, `ULTIMATE` = `gemini-3.1-pro-preview`, `IMAGEN` = `gemini-3.1-flash-image`, `EMBEDDING` = `gemini-embedding-2`.
- A tier→model router (`core.proxy.ts`) maps the user's subscription tier to a model (Pro/Unlimited→Ultimate, Standard→Pro, else→Default).
- **Model-agnostic:** all calls flow through one proxy, so swapping/adding providers (e.g., a cloud partner's models) requires no re-architecture. An in-app **AI Model Compare** tool A/B-tests models.

### 5.2 RAG (real vector search)
`services/ragService.ts`: vector search over `concept_embeddings` using `gemini-embedding-2` (768-dim, task-typed), cosine similarity with a tunable threshold (default 0.7), **federated ranking** that reserves slots for community scenario-bank hits with grade filtering, session caching, and a latency ring buffer (p50/p95). Indexing pipelines: `scripts/index-curriculum-embeddings.ts`, `backfill-scenario-embeddings.ts`, and a Cloud Function. (Feature-flagged; the always-on path is a deterministic curriculum-context builder over official MОН/БРО data.)

### 5.3 Structured output & extraction
- `generateAndParseJSON` (`core.json.ts`) validates AI output against optional Zod schemas and can recover truncated JSON.
- **Vision/extraction contracts** (`visionContracts.ts`): 4 structured contracts (homework feedback, test grading, content extraction, smart OCR), each with a type guard, a 2-attempt retry that injects a stricter prompt on failure, and a graceful multilingual fallback (MK/EN/SQ/TR). OCR supports Cyrillic (recall-evaluated by `scripts/eval-ocr-cyrillic.mjs`).
- **Extraction Hub:** multi-source (URL/YouTube/Vimeo captions, PDF/DOCX, image OCR) → chunking + dedup → pedagogy enrichment (Bloom/DoK badges) → save to scenario bank.

### 5.4 Prompt & schema governance
- A versioned **prompt registry** (`prompts/prompt-registry.json`) with SHA-256 hashing (`prompts:check`/`prompts:update`) tracks core prompts.
- Zod schemas for AI outputs live in `utils/schemas.ts`; Firestore document shapes in `schemas/firestoreSchemas.ts`.
- **Known gap (roadmap):** registry covers a minority of prompts; some AI outputs pass without Zod validation. Closing this is a roadmap item.

### 5.5 AI quality evaluation
`eval/` holds golden sets and scoring; `eval:smoke-gate` (min score 70) is the CI gate. **Known gap:** the smoke-gate scores only a subset of the golden set; expanding coverage is a roadmap item.

## 6. Security model

Defense-in-depth; the **server and Firestore rules are the real boundary** (client gates are UX only).

- **RBAC (Firestore rules):** helpers `isAdmin()`, `isSchoolAdmin(schoolId)`, `isOwner()`, `isAnonymousStudent()`. The `users` collection forces self-create to `role=teacher`, `tier=Free`, capped credits; self-update **cannot** touch `role/tier/isPremium/aiCreditsBalance` — only `isAdmin()` can, so **there is no client privilege-escalation path**. A fail-closed catch-all deny ends the ruleset.
- **Tamper-proof grading:** open-ended Matura grading is **server-side** (`api/matura-grade.ts`) because the grade-cache key is a deterministic hash a client could otherwise precompute to forge a "correct" grade. Uses computer-algebra equivalence checking (`verifyExpressionEquivalence`) before any LLM fallback; rules deny client writes to the grade cache.
- **Atomic credit enforcement:** `api/_lib/aiCredits.ts` reserves and deducts AI credits in a **Firestore transaction** with a minimum-cost floor (prevents pairing an expensive model with an under-declared cost) and refunds on failure. This fixed a prior bug where deduction depended on the client remembering to call.
- **Dugga anti-cheat:** tamper-evident submission seal (`utils/duggaSubmissionSeal.ts`, verified by `functions/src/duggaVerification.ts`), watermarking, final-exam mode.
- **Privacy:** PostHog telemetry is EU-hosted with session recording/autocapture disabled and role-based sampling; a Privacy Impact Assessment exists (`docs/MON_PRIVACY_IMPACT_ASSESSMENT.md`).
- **Recent fix (23 Jul 2026):** the `scenario_bank` read rule now enforces `isPublic==true || author || admin` server-side (previously the `isPublic` filter was client-side only — a private-draft leak).

## 7. Billing (Stripe)

- **Real, production-grade** (not stubbed): `stripe-checkout.ts` verifies the Firebase ID token server-side and creates a Stripe Checkout Session; `stripe-webhook.ts` verifies the signature and upgrades the user on `checkout.session.completed`; `stripe-portal.ts` provides billing history.
- **Subscription mode is built but feature-flagged off** (`STRIPE_SUBSCRIPTIONS_ENABLED`) because Stripe recurring billing is not yet available in North Macedonia — one-time annual payment is active; webhook handlers for `invoice.paid`/`subscription.deleted` are ready to activate.
- **Tiers:** Free / Pro / Unlimited / School. Client tier checks are UX; the **server transaction is authoritative**.

## 8. Curriculum data model

- **Grades 1–13 + all vocational tracks.** Primary/lower-secondary (1–9) in `data/grade1.ts`…`grade9.ts`; secondary (10–13) in `data/secondary/` — gymnasium, gymnasium electives, vocational 4-/3-/2-year. Secondary loads lazily when a user sets `secondaryTrack` (or is admin).
- **Official dataset:** `data/official/grade*Official.ts` (MОН/БРО 2025 subtopics), currently reconciled with the main curriculum by title (roadmap: unify by ID).
- **Standards:** real `nationalStandardIds` (III-A codes) for grades 6–9; grades 1–5 and secondary synthesize standards at runtime (roadmap: formalize secondary standards).
- **Matura bank:** 73 real DIM state exams (2016–2026, mk/al/tr, gymnasium + vocational4) + a 622-question internal bank with AI solutions; questions carry `conceptIds` linking to the curriculum.
- **Known gap (roadmap, highest priority):** secondary concepts have **no prerequisite graph** (`priorKnowledgeIds` stops at grade 9 → no 9→10 bridge) and **empty standards**, so curriculum graphs render secondary as isolated nodes.

## 9. Feature modules

| Domain | Key views/services | Notes |
|---|---|---|
| **Planning** | Annual/Weekly/Lesson planners, `PlanningContext` | Annual→weekly keyed by ID; downstream is title-matched (roadmap: ID-based) |
| **Assessment** | Test generator, Digital exam, Dugga (~28 question types), Gradebook, Written-test review | Results persist per-tool; only quiz feeds the gradebook (roadmap: unified bus) |
| **Matura** | Portal/Library/Practice/Simulation/Analytics/Import | Tamper-proof server grading |
| **Live** | Live quiz, Kahoot maker, Gamma | Firestore realtime; Gamma uses host-private answer subdoc |
| **Student** | Dashboard, AI tutor, SRS, portfolio, homework, parent portal | deviceId/uid scoped; rules enforce privacy |
| **Labs** | DataViz Studio (probability, calculus, geometry 2D/3D, linear algebra, trig, conics, number theory, fractions, TikZ, GeoGebra) | Client-side visualizations |
| **Community** | Scenario bank, forum, PD academy, AI code of conduct | Forum realtime + moderation |
| **Analytics** | Teacher analytics (18 tabs), DataViz, telemetry | Teacher-scoped |
| **Admin** | System admin, School admin, SLO dashboard, Usage | RBAC-gated |

## 10. Observability & quality

- **Testing:** Vitest (3,081 tests / 273 files), Playwright E2E, Firestore-rules unit tests, AI eval gates. **0 TypeScript errors** (strict).
- **Error monitoring:** Sentry (`@sentry/react`/`node`) with incident-summary tooling.
- **Telemetry:** PostHog (EU), privacy-conscious defaults; Web Vitals (LCP/CLS/INP/FCP/TTFB) tracked in the admin **SLO dashboard** alongside AI latency/availability and CI quality-gate pass rate.
- **Performance:** code-splitting/manual chunks (heavy libs like Konva, CodeMirror, TikZ WASM lazy-loaded, never in the main bundle), performance budgets (`perf:budget`), Lighthouse CI.

## 11. Deployment & SEO

- **Hosting:** Vercel (frontend + serverless functions) + Firebase (Firestore/Auth/Functions/FCM).
- **SEO:** `scripts/generate-seo-pages.ts` runs on every build, prerendering **500+ curriculum concept pages** + 19 Matura exam pages with per-page title/description/canonical/OG/JSON-LD, plus `sitemap.xml` + hreflang and strong security headers (CSP, HSTS, X-Frame-Options DENY). `react-helmet-async` handles per-route titles in-app.
- **OG image:** generated via `scripts/generate-og-image.mjs` (satori → resvg → PNG) into `public/og-image.png`.

## 12. Known improvement areas (transparency, from the 23 Jul 2026 audit)

1. **Curriculum connectivity depth** — secondary prerequisite graph (9→10 bridge) + secondary standards; ID-based planner chain; unify parallel curriculum datasets. *(Roadmap Waves 9–19.)*
2. **Unified results → gradebook bus** — currently only quiz results import into the gradebook; exam/Dugga/Matura/written-test results are siloed.
3. **AI model governance** — consolidate ~50 hardcoded model strings onto the central constants; remove deprecated models from the allowlist; align eval models with production.
4. **Prompt/schema coverage** — extend the prompt registry and require Zod validation on all AI outputs.
5. **Digital-exam hardening** — persist photo solutions, deterministic MC grading, remove `as any`.

These are scoped and prioritized in the product roadmap and are the primary target of product-development funding.

---

*See also: `DONOR_FINANCIAL_PLAN.md`, `docs/MASTER_ROADMAP.md`, `docs/MON_PRIVACY_IMPACT_ASSESSMENT.md`, `docs/AI1_VECTOR_RAG_PLAN.md`, `docs/VISION_RAG_CONTRACTS_V1.md`.*
