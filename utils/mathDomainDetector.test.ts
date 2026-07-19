import { describe, it, expect } from 'vitest';
import { detectMathDomain, DOMAIN_TOOLS } from './mathDomainDetector';

describe('detectMathDomain', () => {
  // ── Algebra ─────────────────────────────────────────────────────────────────

  it('detects algebra — линеарни равенки', () => {
    expect(detectMathDomain('Линеарни равенки со една непозната')).toBe('algebra');
  });

  it('detects algebra — квадратни равенки', () => {
    expect(detectMathDomain('Квадратни равенки')).toBe('algebra');
  });

  it('detects algebra — полиноми', () => {
    expect(detectMathDomain('Полиноми и факторирање')).toBe('algebra');
  });

  it('detects algebra — системи равенки', () => {
    expect(detectMathDomain('Системи линеарни равенки')).toBe('algebra');
  });

  // ── Geometry ─────────────────────────────────────────────────────────────────

  it('detects geometry — триаголник', () => {
    expect(detectMathDomain('Плоштина на триаголник')).toBe('geometry');
  });

  it('detects geometry — круг', () => {
    expect(detectMathDomain('Кружница и агол во кругот')).toBe('geometry');
  });

  it('detects geometry — 3D тела', () => {
    expect(detectMathDomain('Обем и плоштина на цилиндар и конус')).toBe('geometry');
  });

  it('detects geometry — вектори', () => {
    expect(detectMathDomain('Вектори во рамнина')).toBe('geometry');
  });

  // ── Statistics ───────────────────────────────────────────────────────────────

  it('detects statistics — веројатност', () => {
    expect(detectMathDomain('Веројатност и случајни настани')).toBe('statistics');
  });

  it('detects statistics — статистика', () => {
    expect(detectMathDomain('Статистичка обработка на податоци')).toBe('statistics');
  });

  it('detects statistics — комбинаторика', () => {
    expect(detectMathDomain('Комбинаторика и пермутации')).toBe('statistics');
  });

  // ── Calculus ─────────────────────────────────────────────────────────────────

  it('detects calculus — извод', () => {
    expect(detectMathDomain('Извод на функција')).toBe('calculus');
  });

  it('detects calculus — интеграл', () => {
    expect(detectMathDomain('Определен интеграл')).toBe('calculus');
  });

  // ── Arithmetic ───────────────────────────────────────────────────────────────

  it('detects arithmetic — дропки', () => {
    expect(detectMathDomain('Собирање и одземање на дропки')).toBe('arithmetic');
  });

  it('detects arithmetic — проценти', () => {
    expect(detectMathDomain('Проценти и сразмер')).toBe('arithmetic');
  });

  it('detects arithmetic — прости броеви (number theory, Wave 8.3)', () => {
    expect(detectMathDomain('Прости броеви и делители')).toBe('arithmetic');
  });

  it('detects arithmetic — месна вредност (place value, Wave 8.3)', () => {
    expect(detectMathDomain('Месна вредност на цифрите')).toBe('arithmetic');
  });

  // ── Trigonometry (routed into geometry, Wave 8.3) ────────────────────────────

  it('detects geometry — тригонометрија', () => {
    expect(detectMathDomain('Тригонометриски функции')).toBe('geometry');
  });

  it('detects geometry — синус и косинус', () => {
    expect(detectMathDomain('Синусова и косинусова теорема')).toBe('geometry');
  });

  // ── Edge cases ───────────────────────────────────────────────────────────────

  it('returns other for empty string', () => {
    expect(detectMathDomain('')).toBe('other');
  });

  it('returns other for unrecognized topic', () => {
    expect(detectMathDomain('Наставна единица без клучни зборови')).toBe('other');
  });

  it('picks dominant domain when multiple match', () => {
    // "квадратна функција" — квадрат→algebra, функц→algebra → algebra wins
    expect(detectMathDomain('Квадратна функција и нејзин график')).toBe('algebra');
  });
});

describe('DOMAIN_TOOLS', () => {
  it('has tools for every domain', () => {
    const domains = ['algebra', 'geometry', 'statistics', 'calculus', 'arithmetic', 'other'] as const;
    for (const d of domains) {
      expect(DOMAIN_TOOLS[d].length).toBeGreaterThan(0);
    }
  });

  it('each tool has label, route, and icon', () => {
    for (const tools of Object.values(DOMAIN_TOOLS)) {
      for (const tool of tools) {
        expect(tool.label).toBeTruthy();
        expect(tool.route).toBeTruthy();
        expect(tool.icon).toBeTruthy();
      }
    }
  });

  it('only points at the real /data-viz or /math-tools routes, never the unregistered /geometry-2d or /geometry-3d paths', () => {
    for (const tools of Object.values(DOMAIN_TOOLS)) {
      for (const tool of tools) {
        const isRealRoute = tool.route === '/data-viz'
          || tool.route.startsWith('/data-viz?tab=')
          || tool.route.startsWith('/math-tools?tab=');
        expect(isRealRoute).toBe(true);
      }
    }
  });

  it('routes fractions/trig/numtheory/placevalue to their real dedicated labs (Wave 8.3)', () => {
    const arithmeticRoutes = DOMAIN_TOOLS.arithmetic.map(t => t.route);
    expect(arithmeticRoutes).toContain('/data-viz?tab=fractions');
    expect(arithmeticRoutes).toContain('/data-viz?tab=numtheory');
    expect(arithmeticRoutes).toContain('/data-viz?tab=placevalue');

    const geometryRoutes = DOMAIN_TOOLS.geometry.map(t => t.route);
    expect(geometryRoutes).toContain('/data-viz?tab=trig');
  });
});
