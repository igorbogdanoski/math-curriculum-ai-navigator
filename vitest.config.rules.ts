/**
 * SEC-2 — Vitest config dedicated to Firestore rules-coverage tests.
 * Run with: `npm run test:rules` (requires the Firestore emulator + the
 * `@firebase/rules-unit-testing` devDep + `FIRESTORE_EMULATOR_HOST` env).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['tests/rules/**/*.test.ts'],
        testTimeout: 30000,
    },
});
