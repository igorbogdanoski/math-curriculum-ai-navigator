# Repository Guidelines

## Project Structure & Module Organization

AI-driven math curriculum platform (React 19 + Vite 6 + TypeScript 5 strict). Flat root-level architecture — no `src/` wrapper. All source layers live directly in the project root.

- **`components/`** — UI components organized by feature domain (`academy/`, `ai/`, `analytics/`, `dashboard/`, etc.)
- **`contexts/`** — React context providers (Auth, Navigation, UI state)
- **`hooks/`** — Custom hooks; `generator/` subdirectory handles AI generation workflows
- **`views/`** — Top-level page/route components
- **`services/`** — Firebase, Gemini API integrations and business logic
- **`api/`** — Vercel Serverless Functions (TypeScript, excluded from root tsconfig)
- **`functions/`** — Firebase Cloud Functions (TypeScript, excluded from root tsconfig)
- **`data/`** — Curriculum data and Matura-specific JSON resources
- **`prompts/`** — Versioned AI prompt registry (track changes with `prompts:check`/`prompts:update`)
- **`eval/`** — AI model evaluation sets and result history; run after prompt or model changes
- **`schemas/`** — Zod validation schemas for AI outputs and data imports
- **`scripts/`** — Node.js automation for data pipelines, AI evaluation, and maintenance
- **`__tests__/`** — Vitest unit tests; **`playwright/`** — E2E tests

Import alias `@/*` maps to the project root (e.g., `@/components/...`).

## Build, Test, and Development Commands

```bash
npm run dev              # Vite dev server
npm run build            # Production build
npm run preview          # Preview production build

npm run test             # Vitest unit tests (single run, verbose)
npm run test:watch       # Vitest watch mode
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:headed  # Playwright with browser visible
npm run test:e2e:ui      # Playwright interactive UI

npm run eval:run              # Run AI evaluation pipelines
npm run eval:smoke-gate       # Gate check: min score 70, fail below
npm run prompts:check         # Verify prompt registry hashes
npm run prompts:update        # Update prompt version hashes
npm run matura:import         # Import Matura curriculum data to Firestore
npm run matura:enrich         # Enrich curriculum data with AI
npm run perf:budget           # Enforce performance budgets
npm run backup:readiness-check  # Check Firestore backup status
```

## Coding Style & Naming Conventions

- **TypeScript 5** strict mode; `noUnusedLocals` and `noUnusedParameters` are off
- **Tailwind CSS 4.x** for all styling
- **Zustand** for global client state; **React Query (@tanstack/react-query v5)** for server/async state
- **Zod** for all schema validation — AI outputs, API responses, data imports
- **Gemini API** (`@google/generative-ai`) for AI features; prompts live in `prompts/`, outputs validated via `schemas/`
- Functional components only; logic extracted into custom hooks under `hooks/`
- Never use `as any` or `@ts-ignore` — both are tracked as quality metrics (target: 0)
- Pre-commit hook: Husky runs `lint-staged`, which runs `npx tsc --noEmit` on changed `.ts/.tsx` files

## Testing Guidelines

- **Unit**: Vitest + `@testing-library/react` — `npm run test`
- **E2E**: Playwright — `npm run test:e2e`
- **AI quality**: `eval/` directory + `npm run eval:run`; run after any prompt or model change
- `npm run eval:smoke-gate` is the CI gate (min score 70)

## Commit Guidelines

Derived from recent history:

- Sprint-scoped features: `feat-s<NN>-<description>` or `S<NN>-B<block>: <description>`
- General features: `feat: <description>`
- Fixes: `fix-s<NN>-<description>`
- Chores/infra: `chore: <description>` or `chore-s<NN>-<description>`
- Docs: `docs-s<NN>-<description>`
- Content/data: `content-<description>`
