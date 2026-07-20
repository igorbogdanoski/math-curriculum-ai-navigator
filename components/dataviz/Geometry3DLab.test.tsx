/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Geometry3DLab } from './Geometry3DLab';
import { LanguageProvider } from '../../i18n/LanguageContext';
import type { Language } from '../../i18n';

// Covers Geometry3DLab.tsx directly, plus geometry3dPanels.tsx (NetsExplorer via 'nets',
// CrossSections via 'cross') and geometry3dSolidPanels.tsx (PrismPyramidCalculator via
// 'prispyram', RoundSolidsPanel via 'rounded') transitively.
const RAW_KEY_PATTERN = /\bdataviz\.[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+\b/;

function renderLab(lang: Language) {
  localStorage.setItem('preferred_language', lang);
  return render(<LanguageProvider><Geometry3DLab /></LanguageProvider>);
}

describe('Geometry3DLab i18n smoke test', () => {
  beforeEach(() => { cleanup(); localStorage.clear(); });

  (['mk', 'en'] as Language[]).forEach(lang => {
    it(`renders every non-exercise tab without leaking raw i18n keys (${lang})`, () => {
      renderLab(lang);
      const NON_EXERCISE_TAB_COUNT = 6; // explorer, plans, nets, cross, prispyram, rounded (exercises tab excluded)
      for (let i = 0; i < NON_EXERCISE_TAB_COUNT; i++) {
        fireEvent.click(screen.getAllByRole('button')[i]);
        expect(document.body.textContent).not.toMatch(RAW_KEY_PATTERN);
      }
    });
  });
});
