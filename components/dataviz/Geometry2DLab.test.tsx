/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Geometry2DLab } from './Geometry2DLab';
import { LanguageProvider } from '../../i18n/LanguageContext';
import type { Language } from '../../i18n';

// Covers Geometry2DLab.tsx directly, plus Geometry2DExplorers.tsx (TriangleExplorer via
// 'triangle', QuadraticExplorer via 'quadratic', QuadrilateralsExplorer via 'quads') transitively.
// Geometry2DLab has no exercises tab, so all 7 tabs are exercised.
const RAW_KEY_PATTERN = /\bdataviz\.[a-zA-Z0-9]+(?:\.[a-zA-Z0-9]+)+\b/;

function renderLab(lang: Language) {
  localStorage.setItem('preferred_language', lang);
  return render(<LanguageProvider><Geometry2DLab /></LanguageProvider>);
}

describe('Geometry2DLab i18n smoke test', () => {
  beforeEach(() => { cleanup(); localStorage.clear(); });

  (['mk', 'en'] as Language[]).forEach(lang => {
    it(`renders every tab without leaking raw i18n keys (${lang})`, () => {
      renderLab(lang);
      const TAB_COUNT = 7; // triangle, pythagoras, circle, polygons, quads, quadratic, absvalue
      for (let i = 0; i < TAB_COUNT; i++) {
        fireEvent.click(screen.getAllByRole('button')[i]);
        expect(document.body.textContent).not.toMatch(RAW_KEY_PATTERN);
      }
    });
  });
});
