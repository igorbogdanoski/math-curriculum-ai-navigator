# Pedagogical + RAG Vision Execution Plan (Homework/Test Review)

> Date: 2026-04-08  
> Status: ACTIVE (execution starts now)  
> Scope: homework OCR grading, written test grading, extraction-to-knowledge pipeline, scan archiving

---

## 1. North Star

Build a pedagogy-first AI assessment stack that is:
- instructionally rigorous and detailed,
- curriculum-grounded through RAG,
- evidence-preserving (every scanned artifact can be saved and reused),
- production-safe and cost-aware,
- measurable with quality KPIs.

Guiding principle:
Technology, theory, and pedagogy jointly drive product evolution.

---

## 2. Non-Negotiable Requirements

1. Homework and test grading must be pedagogically complete:
- clear strengths,
- exact misconceptions,
- step-by-step corrections,
- actionable next-step recommendation.

2. Grading and feedback must be RAG-compatible with existing curriculum objects:
- conceptIds,
- topic linkage,
- grade-level alignment,
- source-citation readiness.

3. Every scanned submission must be archivable:
- image/PDF source,
- OCR/extracted text,
- grading output,
- confidence/quality metadata,
- teacher override and audit trail.

4. Current quality baseline must not regress.

---

## 3. Execution Tracks

### Track A: Pedagogical Grading Engine

Goal:
Separate task intents and enforce structured, reliable outputs.

A1. Split vision tasks into dedicated flows
- `homework_feedback` (pedagogical narrative)
- `test_grading` (rubric-like per-question scoring)
- `content_extraction` (books/magazines/tasks/theory extraction)

A2. Strict output schemas
- Add JSON schemas for each task.
- Validate responses; retry/fallback on invalid output.
- No silent empty results.

A3. Pedagogical depth profile
- Standard / Detailed modes must change prompt strategy and output granularity.
- Add explicit fields for misconception category, hint sequence, and remediation exercise.

Deliverable:
Deterministic, schema-validated grading contracts for all vision paths.

---

### Track B: Curriculum RAG Alignment

Goal:
Ground feedback in curriculum and make outputs traceable.

B1. Retrieval context builder
- Pull grade/topic/concept context from existing curriculum graph.
- Add relevant examples/templates for answer evaluation.

B2. RAG-linked output metadata
- Persist `conceptIds`, `topicId`, `gradeLevel`, and evidence spans.
- Add source-grounding metadata for each major feedback statement.

B3. Teacher-visible grounding
- Show why a feedback item was generated (curriculum anchor and extracted evidence).

Deliverable:
Every major grading claim can be traced to curriculum + extracted student evidence.

---

### Track C: Scan Archive and Learning Dataset

Goal:
Treat each scan as reusable learning evidence.

C1. Submission artifact model
- Save original scan reference,
- extracted text,
- normalized task segmentation,
- grading output and quality score,
- review history (teacher corrections).

C2. Storage policy
- Introduce retention and privacy policy per role/school.
- Tag records for future model quality analysis.

C3. Dataset enrichment loop
- Teacher corrections become supervised improvement signals.
- Track disagreement between AI and teacher for calibration.

Deliverable:
A growing, structured evidence base for continuous model/prompt improvement.

---

### Track D: Reliability, Security, Cost

Goal:
Harden extraction and grading endpoints for sustained production operation.

D1. Endpoint hardening
- auth + rate limits for extraction and grading API paths,
- strict timeout guards,
- fail-fast behavior,
- abuse protection.

D2. SSRF/network hardening
- Expand private network blocks and enforce URL resolution checks.

D3. Observability
- Request id, model/path selected, schema-validation pass/fail,
- extraction mode, fallback path, quality score,
- error taxonomy dashboard.

Deliverable:
Predictable, observable, budget-safe behavior under real load.

---

## 4. Quality Gates (must stay green)

- `npx tsc --noEmit` PASS
- `npm run build` PASS
- relevant Vitest/RTL suites PASS
- no regression in existing acceptance tests
- roadmap evidence updated in same session for each completed milestone

---

## 5. KPI Targets

1. Structured output validity: >99%
2. OCR/extraction factual error rate on gold set: <5%
3. AI vs teacher grading agreement (weighted kappa): >0.80
4. Median latency:
- homework feedback <8s
- test grading per script <10s
- extraction request <10s
5. Production stability:
- no unhandled endpoint failures,
- controlled fallback behavior,
- monthly cost inside defined budget guardrails.

---

## 6. Phased Delivery Plan

### Phase 0 (Kickoff: now, 1-2 days)

- Freeze spec for 3 task contracts (`homework_feedback`, `test_grading`, `content_extraction`).
- Add explicit acceptance criteria for pedagogical detail and RAG metadata.
- Define artifact schema for scan archive.

Definition of done:
- reviewed contracts in repo docs,
- implementation backlog with owners and priorities.

### Phase 1 (Core hardening: 3-5 days)

- Implement schema validation + retry/fallback for grading/extraction responses.
- Remove silent failure path in test review flow.
- Wire analysis depth to real prompt behavior.

Definition of done:
- invalid JSON and edge cases covered by tests,
- UI shows explicit error state with recovery guidance.

### Phase 2 (RAG integration: 5-7 days)

- Inject curriculum retrieval context into grading flows.
- Persist concept/topic linkage for every result.
- Surface grounding/evidence chips in UI.

Definition of done:
- sampled outputs show consistent curriculum-grounded feedback.

### Phase 3 (Archive + calibration: 1-2 weeks)

- Persist complete scan artifacts with metadata and review history.
- Build first disagreement/calibration report (AI vs teacher).
- Add retention/privacy controls.

Definition of done:
- end-to-end artifact persistence confirmed,
- first calibration dashboard view available.

---

## 7. Immediate Start Backlog (execute first)

P0.1 Contract docs and schema templates for three vision tasks  
P0.2 Remove grading silent-failure path and enforce explicit fallback UI  
P0.3 Connect analysis depth setting to prompt strategy  
P0.4 Add scan artifact persistence plan and storage schema draft  
P0.5 Add endpoint hardening checklist (auth/rate-limit/timeout/SSRF expansion)

---

## 8. Critical Files Expected to Change First

- `services/geminiService.real.ts`
- `views/AIVisionGraderView.tsx`
- `views/WrittenTestReviewView.tsx`
- `hooks/useGeneratorActions.ts`
- `api/webpage-extract.ts`
- `api/youtube-captions.ts`
- `types.ts`
- new artifact storage/repository files (to be introduced in implementation phase)

---

## 9. Governance

- No high-impact rollout without evidence and rollback note.
- Each milestone requires test proof and roadmap evidence entry.
- Pedagogy quality is a release gate, not a post-release task.
