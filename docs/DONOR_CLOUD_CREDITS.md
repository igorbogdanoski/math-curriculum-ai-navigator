# MisMath AI — Cloud Infrastructure Partnership & Credits Application

**Prepared for:** Alibaba Cloud (Startup / Education program) and other cloud partners
**Date:** 23 July 2026
**Product:** MisMath AI — https://ai.mismath.net
**Companion to:** `DONOR_FINANCIAL_PLAN.md` (master plan)

> Figures marked **[ASSUMPTION]** are planning estimates to be validated by the founder.

---

## 1. One-paragraph pitch

MisMath AI is the first AI copilot for mathematics teachers in North Macedonia, live in production and serving the national curriculum in four languages (MK/SQ/TR/EN). Our core workload is **AI inference at scale** — every test, lesson plan, grading pass, and interactive illustration is a model call — plus a **vector-search (RAG) pipeline** over the national curriculum. As we grow from 250+ launch users toward thousands of teachers across North Macedonia and the Albanian/Turkish-speaking markets, **inference and infrastructure cost is our primary scaling constraint**. Cloud credits and a technical partnership would let us scale cost-efficiently while we build toward revenue break-even.

## 2. Why cloud support is the highest-leverage contribution

Our cost structure (verified in the 23 July 2026 audit) is dominated by AI inference:

| Component | Current provider | Monthly cost | Scaling behavior |
|---|---|---|---|
| **AI inference** | Google Gemini API | €30–100+ | **Grows linearly with active users** — the dominant variable cost |
| Database / auth | Firebase (Blaze) | €15–40 | Grows with reads/writes |
| Hosting / CDN | Vercel Pro | ~€20 | Grows with traffic |
| **Total today** | | **≈ €75–170/mo** | Could reach €500–2,000/mo at thousands of active teachers **[ASSUMPTION]** |

At a €25/year price point per teacher, **inference cost directly determines whether each user is profitable**. Reducing the cost-per-inference (through credits, cheaper models, or efficient infrastructure) is the single biggest lever on unit economics.

## 3. Technical architecture (why we are a good cloud partner)

MisMath is **model-agnostic by design** — a tiered routing layer selects the cheapest capable model per task (lite → flash → pro), and all calls go through a server-side proxy with atomic credit metering, circuit breaker, retry/backoff, and quota guards. This means we can **adopt Alibaba Cloud Model Studio (Qwen / Tongyi models) for cost-efficient inference without re-architecting** — a natural fit for a cloud partnership.

- **Frontend:** React 19 + Vite + TypeScript (strict), Tailwind, PWA; 500+ prerendered SEO pages.
- **Backend:** Vercel serverless functions + Firebase Cloud Functions.
- **Data:** Cloud Firestore (hardened RBAC rules), IndexedDB offline cache.
- **AI layer:** Gemini (current) via a model-agnostic proxy; **real RAG** over curriculum embeddings (`gemini-embedding-2`, cosine similarity, federated ranking); structured-output contracts with retry + multilingual fallback; OCR with Cyrillic support.
- **Quality:** 0 TypeScript errors, 3,081 tests, E2E + AI-eval gates, Sentry, performance budgets.

**Engineering maturity = low partnership risk:** the codebase is production-grade, well-tested, and instrumented — a credible, low-maintenance partner workload.

## 4. What we would use credits / partnership for

| Use | Detail | Indicative value **[ASSUMPTION]** |
|---|---|---|
| **AI inference** | Run generation/grading/extraction on Alibaba Cloud Model Studio (Qwen) for cost-efficient, high-throughput inference; A/B against current models via our existing model-compare tooling | $25,000–35,000 |
| **Vector search / RAG** | Host curriculum + scenario-bank embeddings in a managed vector DB (e.g., AnalyticDB / Elasticsearch / Lindorm) to scale semantic search beyond the current Firestore-based store | $8,000–12,000 |
| **Compute & CDN** | Hosting, object storage (OSS), and CDN for the regional (Balkans + Turkey) audience with low latency | $7,000–10,000 |
| **Observability** | Managed logging/monitoring/APM as usage scales | $3,000–5,000 |
| **Technical partnership** | Architecture reviews, migration support, co-marketing in the education sector | in-kind |
| **Total indicative ask** | | **≈ $50,000 in credits / 12 months + partnership** |

## 5. Scaling trajectory (why credits now, not later)

| Period | Active teachers **[ASSUMPTION]** | Inference profile |
|---|---|---|
| Now (Jul 2026) | 250+ registered, launch phase | Baseline |
| Dec 2026 | ~600 | ~2–3× baseline |
| Jun 2027 | ~1,500 (domestic) | ~5–6× baseline |
| 2027–28 | + Albania/Kosovo/Turkey (SQ/TR) | Order-of-magnitude growth potential |

Credits de-risk the **pre-revenue scaling phase**: we grow usage and prove retention/conversion while infrastructure cost is subsidized, reaching break-even (≈36 paying Pro users domestically) without margin pressure.

## 6. Mutual value for the cloud partner

- **Reference EdTech customer** in the Western Balkans — a market Alibaba Cloud is expanding into.
- **Model Studio / Qwen adoption** in a real, high-volume education workload (generation + grading + RAG), with published case-study potential.
- **Regional reach:** MisMath's MK/SQ/TR/EN footprint aligns with markets of strategic interest.
- **Low-risk workload:** production-grade, tested, instrumented, with a clear path to paid (we become a paying customer post-credits).

## 7. The ask

- **$50,000 in cloud credits over 12 months** (inference, vector search, compute/CDN, observability) — **[ASSUMPTION]** amount to be calibrated to the specific program tier.
- **Technical partnership:** migration/architecture support for Model Studio + managed vector DB; co-marketing in the education sector.
- **Path to paid:** on credit expiry, MisMath converts to a paying cloud customer as revenue scales (domestic break-even ≈36 Pro users; regional upside via SQ/TR).

## 8. Contact

**Igor Bogdanoski** — Founder, MisMath AI · ai.mismath.net · **[ASSUMPTION]** email/phone to be added.

---

*Technical detail: `TECHNICAL_ARCHITECTURE.md`. Full financials: `DONOR_FINANCIAL_PLAN.md`.*
