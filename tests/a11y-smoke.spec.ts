/**
 * S37-D4 — axe-core Accessibility Smoke Tests
 *
 * Runs axe-core against three key app views to catch critical and serious
 * WCAG violations in CI. Uses the teacherPage fixture (no real Firebase auth
 * required) so the test works in any environment with just the dev server.
 *
 * Violations at impact 'minor' and 'moderate' are reported but do not fail
 * the build — only 'critical' and 'serious' are blocking.
 */

import { test, expect } from './fixtures/auth';
import AxeBuilder from '@axe-core/playwright';
import type { Result } from 'axe-core';

const BLOCKING_IMPACTS = ['critical', 'serious'];

function blockingViolations(violations: Result[]) {
  return violations.filter(v => v.impact && BLOCKING_IMPACTS.includes(v.impact));
}

test.describe('A11y — Login page (public)', () => {
  test('no critical/serious axe violations', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = blockingViolations(results.violations);
    if (blocking.length > 0) {
      const summary = blocking.map(v =>
        `[${v.impact}] ${v.id}: ${v.description} — nodes: ${v.nodes.map(n => n.html).join(', ')}`
      ).join('\n');
      expect(blocking, `Critical/serious axe violations on login:\n${summary}`).toHaveLength(0);
    }
  });
});

test.describe('A11y — Dashboard (authenticated)', () => {
  test('no critical/serious axe violations', async ({ teacherPage: page }) => {
    await page.goto('/#/dashboard');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      // KaTeX renders SVG with known color-contrast false positives on non-text elements
      .exclude('.katex')
      .analyze();

    const blocking = blockingViolations(results.violations);
    if (blocking.length > 0) {
      const summary = blocking.map(v =>
        `[${v.impact}] ${v.id}: ${v.description} — nodes: ${v.nodes.map(n => n.html).join(', ')}`
      ).join('\n');
      expect(blocking, `Critical/serious axe violations on dashboard:\n${summary}`).toHaveLength(0);
    }
  });
});

test.describe('A11y — Curriculum library (authenticated)', () => {
  test('no critical/serious axe violations', async ({ teacherPage: page }) => {
    await page.goto('/#/curriculum');
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .exclude('.katex')
      .analyze();

    const blocking = blockingViolations(results.violations);
    if (blocking.length > 0) {
      const summary = blocking.map(v =>
        `[${v.impact}] ${v.id}: ${v.description} — nodes: ${v.nodes.map(n => n.html).join(', ')}`
      ).join('\n');
      expect(blocking, `Critical/serious axe violations on curriculum:\n${summary}`).toHaveLength(0);
    }
  });
});
