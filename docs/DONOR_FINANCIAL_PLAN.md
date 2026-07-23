# MisMath AI — Donor & Financing Master Plan

**Document type:** Master financing plan (source for the Cloud-Credits, Investment, and Grant variants)
**Date:** 23 July 2026
**Author:** Igor Bogdanoski
**Product:** MisMath AI — https://ai.mismath.net
**Status:** For external distribution (donors, investors, grant bodies, cloud partners)

> **How to read the assumptions:** figures marked **[ASSUMPTION]** are planning estimates to be
> validated by the founder before use. Figures without this tag are taken from the internal
> financial report (1 July 2026) or verified directly in the production codebase (23 July 2026 audit).
> Currency: amounts are shown in EUR/USD for international readers; the operating currency is MKD
> (1 EUR ≈ 61.5 MKD, 1 USD ≈ 57 MKD — approximate).

---

## 1. Executive Summary

**MisMath AI is the first AI platform built specifically for mathematics teachers in North Macedonia** — and, by extension, for the wider Albanian- and Turkish-speaking education markets. It generates curriculum-aligned written tests, quizzes, annual and thematic lesson plans, and interactive illustrations in under two minutes, all mapped to the national **MОН** curriculum and **БРО** standards, and the 45/40-minute class structure used in Macedonian schools.

The platform is **live in production** (ai.mismath.net), supports **four languages** (Macedonian, Albanian, Turkish, English), and — unlike global competitors (IXL, Quizlet, Kahoot) — encodes the specific national curriculum knowledge that those products do not have and cannot easily replicate.

A full technical and product audit completed on **23 July 2026** confirmed an unusually mature engineering base for an early-stage EdTech product: a real vector-search (RAG) content pipeline, tamper-proof server-side exam grading, production-grade billing with atomic credit enforcement, hardened database security rules, **zero TypeScript errors**, **3,081 automated tests**, and search-engine-optimized prerendering of **500+ curriculum pages**.

**The opportunity:** a defensible national beachhead (≈2,500 math teachers in North Macedonia) that expands regionally through the already-shipped Albanian and Turkish localizations, into a category-defining "AI copilot for math teachers" for the Western Balkans and beyond.

**We are seeking** (see §11, detailed in the three companion variants):
- **Cloud infrastructure credits & technical partnership** (e.g., Alibaba Cloud startup program) to scale inference and hosting cost-efficiently;
- **Pre-seed / seed investment** to fund regional expansion and the sales motion toward schools and municipalities;
- **Education / digital-literacy grant funding** to deepen impact measurement and reach under-served schools.

---

## 2. The Problem

- **Teachers spend hours on low-leverage work.** Writing a curriculum-aligned test, building an annual plan, or preparing differentiated exercises takes 1–3 hours per artifact, repeated across classes and years.
- **Generic global tools don't fit.** IXL, Quizlet, Kahoot and similar products are built for Anglophone/US curricula. They have **no mapping to the Macedonian MОН curriculum or БРО standards**, no Macedonian/Albanian/Turkish pedagogical terminology, and no awareness of the local exam (Državen ispit / Matura) format.
- **Equity gap.** Quality test-prep and adaptive-learning resources are concentrated in well-funded urban schools; rural and under-resourced schools lack them.
- **AI literacy gap.** Teachers need guidance on using AI responsibly in the classroom; most have no structured training.

## 3. The Solution

MisMath AI is a teacher-facing web platform (React + Firebase + Google Gemini) that turns the national curriculum into a structured, queryable knowledge base and layers AI generation on top of it:

| Capability | What it does |
|---|---|
| **AI content generation** | Written tests (4 assessment models), quizzes, annual/thematic/weekly plans, lesson plans, flashcards — all curriculum-tagged, in < 2 min |
| **MaturaAI** | 73 real state-exam papers (2016–2026, 3 languages) + a 622-question internal bank with step-by-step AI solutions; practice, simulation, analytics |
| **Digital exam engine** | 4 anti-cheating variants (А/Б/В/Г), live presenter dashboard, AI + manual grading, print/ZipGrade export |
| **Interactive labs (DataViz Studio)** | Probability, calculus, 2D/3D geometry, linear algebra, trigonometry, conic sections, number theory, fractions, TikZ diagram generator, GeoGebra viewer |
| **AI extraction** | Turn a URL / YouTube video / PDF / DOCX / photo into structured, pedagogy-enriched math tasks (OCR with Cyrillic support) |
| **AI grading** | Handwritten test & homework grading from photos (batch up to 30), misconception heatmaps |
| **Live classroom** | Kahoot-style live quizzes, Gamma presentation game, homework assignments |
| **Student side** | Student portal, AI tutor, spaced-repetition (SRS), portfolio, parent portal |
| **Curriculum graph** | Prerequisite knowledge graph, progression across grades, standards coverage analytics |
| **Community** | Scenario bank (shared lesson scenarios), teacher forum, professional-development academy (AI-literacy course) |

**Localization as a moat:** the product ships in **MK / SQ / TR / EN**. The Albanian (SQ) and Turkish (TR) localizations open the adjacent education markets of Albania, Kosovo, and Turkey — a regional expansion path that single-language competitors cannot match without rebuilding the curriculum layer.

## 4. Product & Technical Maturity (audit-verified, 23 July 2026)

This section is the key differentiator for technically-minded donors/partners. A comprehensive audit confirmed the platform is **production-grade, not a prototype**:

- **Real RAG (retrieval-augmented generation):** vector search over curriculum embeddings using `gemini-embedding-2`, cosine similarity with tunable threshold, federated ranking that blends curriculum concepts with the community scenario bank — not a stub.
- **Tamper-proof grading:** open-ended Matura grading runs **server-side** (`api/matura-grade.ts`) with computer-algebra equivalence checking before any LLM fallback; clients cannot forge grades. Database rules deny client writes to the grade cache.
- **Production billing:** Stripe Checkout + webhook + customer portal, with **atomic server-side credit enforcement** (a Firestore transaction reserves and deducts AI credits; a minimum-cost floor prevents cost under-declaration). Subscription mode is fully built and feature-flagged, ready to activate when Stripe recurring billing becomes available in North Macedonia.
- **Hardened security model:** role-based Firestore rules (teacher / school-admin / admin) with defense-in-depth; a documented history of security audits and regression tests; fail-closed default deny.
- **Engineering quality:** **0 TypeScript errors** (strict mode), **3,081 automated tests** across 273 files, E2E (Playwright) + AI-output evaluation gates, performance budgets, Sentry error monitoring, PostHog telemetry (EU-hosted, privacy-conscious defaults).
- **SEO infrastructure:** static prerendering of **500+ curriculum concept pages** and 19 Matura exam pages, sitemap + hreflang, structured data (JSON-LD), strong security headers.
- **Curriculum data depth:** grades 1–13 fully covered including **all vocational tracks** (2-, 3-, and 4-year) and gymnasium electives; 73 real DIM state exams; Olympiad problem archive.

> **Audit-identified improvement areas** (transparency): deeper curriculum *connectivity* for secondary grades (prerequisite graph currently stops at grade 9), a unified results-to-gradebook pipeline across all assessment tools, and AI-model governance consolidation. These are scoped in the product roadmap (Waves 9–19) and are the primary use of product-development funds.

## 5. Market Opportunity

| Segment | Size | Note |
|---|---|---|
| **North Macedonia — math teachers** | ≈2,500 | Primary beachhead; MОН/БРО alignment is the moat |
| **North Macedonia — all subjects (expansion)** | ≈20,000 teachers | Platform generalizes beyond math |
| **Albania / Kosovo (Albanian, SQ)** | ≈30,000+ math teachers **[ASSUMPTION]** | Localization already shipped |
| **Turkey (Turkish, TR)** | ≈100,000+ math teachers **[ASSUMPTION]** | Localization already shipped; large market |
| **Western Balkans (regional)** | ≈150,000+ teachers **[ASSUMPTION]** | Combined addressable teacher base |

**Beachhead strategy:** dominate the small, defensible Macedonian market first (where curriculum knowledge is the barrier to entry), then expand regionally on the already-built SQ/TR localizations.

## 6. Business Model & Pricing

| Plan | Price | Value |
|---|---|---|
| **Free** | €0 | 50 one-time AI credits |
| **Pro Teacher** | **€25 / year** (1,500 MKD) | Unlimited generations, 12 months |
| **School license** | By contract (€300–800 / year / school, up to 20 teachers) **[ASSUMPTION]** | Pro + administration, analytics, curriculum editor |
| **National (MОН) license** | By contract | All teachers nationwide |

- **Unit economics:** infrastructure cost ≈ €0.10/active user/day at typical usage; Pro margin is positive as long as usage stays below ~1 AI call per 1.5 minutes. Free-tier credits cap exposure.
- **Pricing roadmap:** Pro → €33 (2027, after 500 users), €41 (2028, with MОН approval); per-seat school pricing.
- **Recurring billing:** currently one-time annual payment because Stripe subscriptions are not yet available in North Macedonia; the subscription path is built and feature-flagged, ready to switch on.

## 7. Traction & Milestones

| Date | Milestone |
|---|---|
| Apr 2026 | Core platform sprints (exam engine, print engine, YouTube extraction, knowledge graph) — `MASTER_ROADMAP.md` |
| 1 Jul 2026 | Launch webinar — **250+ teachers attended** |
| Jul 2026 | Platform live in production (ai.mismath.net); pricing set at €25/yr |
| 23 Jul 2026 | Full technical/product audit completed — production-grade confirmed |
| Q3–Q4 2026 | Curriculum-connectivity depth (Waves 9–19), regional positioning |

**Current metrics (Jul 2026):** 250+ registered teachers from webinar; 0 paying Pro users at launch (conversion cycle just starting); target 10–20% Free→Pro conversion (EdTech B2C benchmark).

## 8. Financial Projections

Operating cost base (monthly): **≈ €75–170** (Vercel ~€20, Firebase ~€15–40, Gemini AI ~€30–100, domain/SSL ~€10/yr). Scales with active usage.

**Scenario A — Conservative (10% conversion):**
| Period | Pro users | Monthly revenue | Annual revenue |
|---|---|---|---|
| Dec 2026 | 60 | €122 | — |
| Jun 2027 | 150 | €305 | **≈ €3,660** |
| Jun 2028 | 350 | €711 | **≈ €8,540** |

**Scenario B — Moderate (15% conversion + 3 school licenses/yr):**
| Period | Pro users | Schools | Annual revenue |
|---|---|---|---|
| 2026/27 | 200 | 3 | **≈ €5,900** |
| 2027/28 | 500 | 8 | **≈ €14,800** |
| 2028/29 | 1,000 | 15 | **≈ €29,300** |

**Scenario C — Optimistic (MОН national partnership):** ≈2,500 teachers × €16/yr (state discount) = **≈ €40,700 / year**, plus regional (SQ/TR) upside not included here.

> These are the **domestic** numbers from the internal report. **Regional expansion (Albania/Kosovo/Turkey) is additional upside** and is the core thesis for investment-scale returns. **[ASSUMPTION]** regional conversion and pricing to be modeled per market.

**Break-even:** ≈36 Pro users at current pricing — reachable within months of an active sales motion.

## 9. Competitive Advantage (the moat)

| Platform | Market | Price/yr | MОН/БРО alignment | MK/SQ/TR |
|---|---|---|---|---|
| **MisMath AI** | MK + regional | €25 | ✅ Full | ✅ 4 languages |
| IXL | Global | ~€120 | ❌ | ❌ |
| Quizlet Teacher | Global | ~€50 | ❌ | ❌ |
| Kahoot Pro | Global | ~€36 | ❌ | ❌ |
| Local competitors | MK | — | None direct | — |

**Defensibility:** the MОН/БРО curriculum knowledge base (grades 1–13 + vocational, 73 real state exams, standards mapping) is the barrier. Global competitors cannot replicate it without a dedicated local effort; local competitors lack the AI engineering depth (RAG, tamper-proof grading, extraction pipeline).

## 10. Use of Funds

| Category | 12-month estimate | Purpose |
|---|---|---|
| **AI inference & cloud infrastructure** | €3,000–12,000 (or in-kind credits) | Gemini API + hosting as usage scales; primary target for cloud-credit support |
| **Product development (Waves 9–19)** | €15,000–30,000 **[ASSUMPTION]** | Curriculum connectivity depth, unified gradebook, secondary-graph, model governance |
| **Sales & marketing** | €5,000–10,000 | Teacher webinars, municipality/school outreach, regional (SQ/TR) launch |
| **Legal / company registration** | €1,000–2,500 | DOOEL registration for school invoicing, contracts |
| **Impact measurement** | €3,000–6,000 **[ASSUMPTION]** | Learning-outcome studies for grant reporting |

## 11. The Ask (three variants — detailed in companion documents)

| Variant | Instrument | Indicative ask **[ASSUMPTION]** | Primary use |
|---|---|---|---|
| **Cloud Credits** (`DONOR_CLOUD_CREDITS.md`) | In-kind cloud credits + technical partnership | **$50,000 in credits / 12 mo** | Inference & hosting cost efficiency at scale |
| **Investment** (`DONOR_INVESTMENT.md`) | Pre-seed/seed equity | **€100,000–250,000** | Regional expansion (SQ/TR), sales, product |
| **Grant** (`DONOR_GRANT.md`) | Education / digital-literacy grant | **€30,000–75,000** | Impact measurement, under-served schools, AI-literacy |

## 12. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| AI cost growth outpaces revenue | Per-user credit caps, server-side atomic enforcement, model tiering (cheap models for simple tasks), cloud-credit support |
| Stripe subscriptions unavailable in MK | One-time annual billing now; subscription path built & feature-flagged for activation |
| Slow B2C conversion | B2B/B2G motion (schools, municipalities, MОН) as the primary revenue path |
| Curriculum drift (parallel data representations) | Roadmap item to unify curriculum data by ID (Wave 9+) |
| Single-market concentration | SQ/TR localizations already shipped → regional diversification |
| Key-person dependency | Documented architecture, 3,081-test safety net, roadmap in `docs/` **[ASSUMPTION]** team expansion planned |

## 13. Team

- **Igor Bogdanoski** — Founder & product/engineering lead. Built the full platform (frontend, AI pipelines, curriculum data, security, billing). **[ASSUMPTION]** additional team/roles to be detailed for investors.

## 14. Appendix — Key Assumptions to Validate

1. Funding ask amounts (cloud $50k credits; investment €100–250k; grant €30–75k).
2. Regional market sizes (Albania/Kosovo/Turkey teacher counts) and per-market pricing/conversion.
3. School-license price band (€300–800/yr).
4. Product-development and impact-measurement budget lines.
5. Team composition beyond the founder.
6. Current live traction (registered/active/paying users) — update from production analytics before sending.

---

*Companion documents: `DONOR_CLOUD_CREDITS.md`, `DONOR_INVESTMENT.md`, `DONOR_GRANT.md`, `TECHNICAL_ARCHITECTURE.md`.*
*Source data: `docs/FINANCIAL_REPORT_2026.md` (internal, 1 Jul 2026) + production codebase audit (23 Jul 2026).*
