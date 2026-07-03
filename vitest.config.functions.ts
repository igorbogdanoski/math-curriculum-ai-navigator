/**
 * Vitest config dedicated to Cloud Functions unit tests (functions/src/*.test.ts).
 * Run with: `npm run test:functions`.
 *
 * functions/src/index.ts calls admin.initializeApp() at module load time and wraps
 * every export in functions.https.onCall(...)/functions.firestore.document(...).onWrite(...).
 * Tests mock 'firebase-admin' and 'firebase-functions/v1' so onCall/onWrite/onCreate
 * are identity functions returning the inner handler directly — no live emulator needed.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['functions/src/**/*.test.ts'],
        testTimeout: 15000,
    },
});
