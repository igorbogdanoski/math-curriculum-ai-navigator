/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ConicSectionsLab } from './ConicSectionsLab';
import { LanguageProvider } from '../../i18n/LanguageContext';
import type { Language } from '../../i18n';

// Raw, untranslated i18n keys (e.g. "dataviz.conicLab.tabEllipse") must never leak into the
// rendered UI — that's the exact regression class this smoke test exists to catch.
const RAW_KEY_PATTERN = /\bdataviz\.[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+\b/;

function renderLab(lang: Language) {
  localStorage.setItem('preferred_language', lang);
  return render(<LanguageProvider><ConicSectionsLab /></LanguageProvider>);
}

describe('ConicSectionsLab i18n smoke test', () => {
  beforeEach(() => { cleanup(); localStorage.clear(); });

  (['mk', 'en'] as Language[]).forEach(lang => {
    it(`renders every non-exercise tab without leaking raw i18n keys (${lang})`, () => {
      renderLab(lang);
      const tabButtons = screen.getAllByRole('button');
      // Tab bar buttons are rendered first in DOM order, before any tab-content buttons.
      const NON_EXERCISE_TAB_COUNT = 3; // ellipse, hyperbola, parabola (exercises tab excluded — needs QueryClientProvider)
      for (let i = 0; i < NON_EXERCISE_TAB_COUNT; i++) {
        fireEvent.click(screen.getAllByRole('button')[i]);
        expect(document.body.textContent).not.toMatch(RAW_KEY_PATTERN);
      }
      expect(tabButtons.length).toBeGreaterThan(0);
    });
  });
});
