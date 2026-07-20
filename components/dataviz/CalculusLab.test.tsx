/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CalculusLab } from './CalculusLab';
import { LanguageProvider } from '../../i18n/LanguageContext';
import type { Language } from '../../i18n';

const RAW_KEY_PATTERN = /\bdataviz\.[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+\b/;

function renderLab(lang: Language) {
  localStorage.setItem('preferred_language', lang);
  return render(<LanguageProvider><CalculusLab /></LanguageProvider>);
}

describe('CalculusLab i18n smoke test', () => {
  beforeEach(() => { cleanup(); localStorage.clear(); });

  (['mk', 'en'] as Language[]).forEach(lang => {
    it(`renders every non-exercise tab without leaking raw i18n keys (${lang})`, () => {
      renderLab(lang);
      const NON_EXERCISE_TAB_COUNT = 4; // deriv, riemann, limits, logexp (exercises tab excluded)
      for (let i = 0; i < NON_EXERCISE_TAB_COUNT; i++) {
        fireEvent.click(screen.getAllByRole('button')[i]);
        expect(document.body.textContent).not.toMatch(RAW_KEY_PATTERN);
      }
    });
  });
});
