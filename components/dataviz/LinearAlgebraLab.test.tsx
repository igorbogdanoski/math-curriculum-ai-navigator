/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LinearAlgebraLab } from './LinearAlgebraLab';
import { LanguageProvider } from '../../i18n/LanguageContext';
import type { Language } from '../../i18n';

// Covers LinearAlgebraLab.tsx directly, plus LinearAlgebraAdvancedLab.tsx (n×n solver, via the
// 'nxn' tab) and LinearAlgebraEigenLab.tsx (via the 'eigen' tab) transitively.
const RAW_KEY_PATTERN = /\bdataviz\.[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+\b/;

function renderLab(lang: Language) {
  localStorage.setItem('preferred_language', lang);
  return render(<LanguageProvider><LinearAlgebraLab /></LanguageProvider>);
}

describe('LinearAlgebraLab i18n smoke test', () => {
  beforeEach(() => { cleanup(); localStorage.clear(); });

  (['mk', 'en'] as Language[]).forEach(lang => {
    it(`renders every non-exercise tab without leaking raw i18n keys (${lang})`, () => {
      renderLab(lang);
      const NON_EXERCISE_TAB_COUNT = 6; // matrices, vectors, transforms, systems, nxn, eigen (exercises tab excluded)
      for (let i = 0; i < NON_EXERCISE_TAB_COUNT; i++) {
        fireEvent.click(screen.getAllByRole('button')[i]);
        expect(document.body.textContent).not.toMatch(RAW_KEY_PATTERN);
      }
    });
  });
});
