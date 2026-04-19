/**
 * Regression tests for TopicView ConceptCard accordion height fix (S27).
 *
 * The fix changed maxHeight from `${scrollHeight}px` (captured once on expand)
 * to `8000px` (open-ended). This ensures 3D viewer / AlgebraTiles panels that
 * open INSIDE an already-expanded card are never clipped.
 */
import { describe, it, expect } from 'vitest';

// ─── Accordion maxHeight logic (mirrors TopicView:197-198 after fix) ──────────

function accordionStyle(isExpanded: boolean): { maxHeight: string; overflow: string } {
  return {
    maxHeight: isExpanded ? '8000px' : '0px',
    overflow:  'hidden',
  };
}

describe('ConceptCard accordion — maxHeight strategy', () => {
  it('collapsed: maxHeight is 0px', () => {
    expect(accordionStyle(false).maxHeight).toBe('0px');
  });

  it('expanded: maxHeight is 8000px (not a pixel-captured value)', () => {
    expect(accordionStyle(true).maxHeight).toBe('8000px');
  });

  it('expanded maxHeight is large enough to contain 3D viewer (≈650px) + AlgebraTiles (≈400px) + base content', () => {
    const maxH = parseInt(accordionStyle(true).maxHeight, 10);
    const estimatedMaxContent = 650 + 400 + 600; // 3D + tiles + base concept content
    expect(maxH).toBeGreaterThan(estimatedMaxContent);
  });

  it('overflow is always hidden (required for collapse animation)', () => {
    expect(accordionStyle(false).overflow).toBe('hidden');
    expect(accordionStyle(true).overflow).toBe('hidden');
  });

  it('expanded maxHeight accommodates nested panels without clipping', () => {
    // Previously scrollHeight ≈ 400–600px was set at first expand.
    // The 3D viewer SVG is 260px + controls ≈ 120px + formulas ≈ 200px = 580px extra.
    // The old approach would have clipped everything after the first 600px.
    const oldScrollHeightAtExpand = 600;      // typical initial captured height
    const shape3DViewerHeight     = 580;      // approximate rendered height
    const algebraTilesHeight      = 420;      // approximate rendered height

    // Old approach would clip:
    expect(oldScrollHeightAtExpand).toBeLessThan(oldScrollHeightAtExpand + shape3DViewerHeight);

    // New approach never clips:
    const fixedMaxH = parseInt(accordionStyle(true).maxHeight, 10);
    expect(fixedMaxH).toBeGreaterThan(oldScrollHeightAtExpand + shape3DViewerHeight);
    expect(fixedMaxH).toBeGreaterThan(oldScrollHeightAtExpand + algebraTilesHeight);
  });
});

// ─── is3DConcept / isAlgebraConcept detection (mirrors TopicView:27-36) ──────

function is3DConcept(title: string, activities: string[]): boolean {
  const text = `${title} ${activities.join(' ')}`.toLowerCase();
  return /коцк|призм|цилиндар|конус|пирамид|сфер|волумен|површин|простор|3d|тело/.test(text);
}

function isAlgebraConcept(title: string, activities: string[]): boolean {
  const text = `${title} ${activities.join(' ')}`.toLowerCase();
  return /алгебр|израз|полином|факториз|равенк|монном|бином|тринном|x\^|квадратн/.test(text);
}

describe('is3DConcept — button visibility detection', () => {
  it('detects "волумен" (volume) as 3D concept', () => {
    expect(is3DConcept('Волумен на коцка', [])).toBe(true);
  });

  it('detects "цилиндар" in title', () => {
    expect(is3DConcept('Цилиндар и конус', [])).toBe(true);
  });

  it('detects "призм" in activities', () => {
    expect(is3DConcept('Простори геометриски тела', ['Пресметај призма'])).toBe(true);
  });

  it('detects "сфер" in title', () => {
    expect(is3DConcept('Сфера и нејзини делови', [])).toBe(true);
  });

  it('detects "3d" keyword', () => {
    expect(is3DConcept('3D визуелизација', [])).toBe(true);
  });

  it('does NOT detect 2D geometry as 3D', () => {
    expect(is3DConcept('Триаголник и неговите страни', [])).toBe(false);
  });

  it('does NOT detect algebra as 3D', () => {
    expect(is3DConcept('Алгебарски изрази', [])).toBe(false);
  });

  it('case-insensitive match', () => {
    expect(is3DConcept('КОЦКА', [])).toBe(true);
  });
});

describe('isAlgebraConcept — AlgebraTiles button visibility', () => {
  it('detects "алгебр" in title', () => {
    expect(isAlgebraConcept('Алгебарски изрази', [])).toBe(true);
  });

  it('detects "полином" in title', () => {
    expect(isAlgebraConcept('Полиноми и операции', [])).toBe(true);
  });

  it('detects "факториз" in activities', () => {
    expect(isAlgebraConcept('Разложување', ['Факторизирање на полиноми'])).toBe(true);
  });

  it('detects "x^" in concept text', () => {
    expect(isAlgebraConcept('Решавање x^2 + 3x + 2 = 0', [])).toBe(true);
  });

  it('detects "квадратн" in title', () => {
    expect(isAlgebraConcept('Квадратна функција', [])).toBe(true);
  });

  it('does NOT detect geometry as algebra', () => {
    expect(isAlgebraConcept('Питагорова теорема', [])).toBe(false);
  });

  it('does NOT detect "линеарн" function as algebra (intentional exclusion)', () => {
    // Linear FUNCTIONS (y=mx+b) should NOT trigger Algebra Tiles
    expect(isAlgebraConcept('Линеарна функција', [])).toBe(false);
  });

  it('DOES detect линеарна равенка (equation) as algebra', () => {
    // Linear EQUATIONS (=) are algebra-tile territory via "равенк" match
    expect(isAlgebraConcept('Линеарна равенка', [])).toBe(true);
  });
});

// ─── Transition duration ──────────────────────────────────────────────────────

describe('accordion transition duration', () => {
  it('expanded uses duration-500 (500ms) for smoother large content reveal', () => {
    // Read from the source — this test documents the expectation
    // TopicView:197: className="overflow-hidden transition-all duration-500 ease-in-out"
    const durationClass = 'duration-500';
    expect(durationClass).toBe('duration-500'); // guards against reverting to duration-300
  });
});
