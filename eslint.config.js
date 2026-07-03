import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  {
    // A config object whose ONLY key is `ignores` is treated by ESLint flat config as a
    // *global* ignore (applies before any other config) — must stay standalone, not
    // merged with linterOptions/rules/etc., or it silently degrades to a per-config scope.
    ignores: [
      'dist/**',
      'node_modules/**',
      'functions/lib/**',
      'functions/node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/**',
      // Dead one-off root scripts (unparseable or referenced by no npm script — see the
      // 2026-07-03 audit's root-hygiene finding, tracked for cleanup/deletion separately;
      // not worth lint-fixing code that's slated to be removed).
      'add_plan.cjs', 'patch_core.cjs', 'patch_parent.cjs', 'updateUI.cjs', 'verify.cjs',
      'verify2.cjs', 'generateDB.js', 'check_models.cjs', 'listGeminiModels.cjs',
      'listGeminiModels.js', 'patch_ass.cjs',
      'scripts/translate_studentprogress.cjs', 'scripts/update_approved.cjs',
      'scripts/update_offline_fs.cjs', 'scripts/take-screenshots.mjs',
      'scripts/fix_tutor_import.cjs', 'scripts/patch_views_tour.cjs', 'scripts/update_rag.cjs',
    ],
  },
  {
    // Many files carry stray `eslint-disable` comments referencing rules from plugins
    // that were never actually installed in this project (@definitelytyped/*,
    // posthog-js/*, unicorn/*, ts/* — likely pasted in from unrelated tooling/training
    // data rather than a real prior config). Reporting them as unresolvable would
    // produce hundreds of false "Definition for rule not found" errors on day one of
    // adopting ESLint here; that's noise to clean up separately, not a real defect.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node, ...globals.es2021 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',

      // The existing tsconfig already runs with noUnusedLocals/noUnusedParameters off —
      // match that lenience here rather than introducing a brand-new hard gate on day one.
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // 234 pre-existing `: any` usages across the codebase (per the 2026-07-03 audit) —
      // banning this now would block every future commit that touches those files.
      // Left as a warning so it's visible without being a hard adoption blocker; tighten
      // to 'error' once the existing hotspots (services/gemini/core.proxy.ts etc.) are cleaned up.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      // `condition && doThing()` as a standalone statement is an established pattern in
      // this codebase's event handlers/effects — not a real "unused expression" bug.
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      // `declare global { namespace JSX { ... } }` in types.ts is the only correct way to
      // augment the global JSX namespace (e.g. for the custom <math-field> element) — there
      // is no ES2015-module equivalent for that specific declaration-merging case.
      '@typescript-eslint/no-namespace': 'off',
      // Sanitization regexes intentionally match control chars (\x00-\x1f) to strip them
      // before embedding text in Office Open XML (PPTX/DOCX chokes on raw control chars) —
      // see components/ai/gamma/GammaExportService.ts, presentationPptxExport.ts,
      // services/gemini/core.utils.ts. Not a ReDoS/injection risk, just flagged by the
      // rule's blanket heuristic.
      'no-control-regex': 'off',
    },
  },
  {
    files: ['functions/src/**/*.ts', 'scripts/**/*.{ts,mjs,cjs,js}', '*.config.{ts,js,mjs}', 'api/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Playwright fixture files declare `async ({ page }, use) => ...` where `use` is
    // Playwright's fixture-provisioning callback — react-hooks' name-based heuristic
    // mistakes it for React's use() hook. This directory has no React components.
    files: ['tests/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    // Legacy one-off Node/CommonJS scripts (mostly ad-hoc patch/*.cjs migration
    // scripts scattered at the repo root and under scripts/ — see the 2026-07-03
    // audit's root-hygiene finding). Not app code: allow require()/CommonJS globals
    // here rather than pretending these are ES modules running in a browser.
    files: ['**/*.cjs', '*.js', '*.mjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
