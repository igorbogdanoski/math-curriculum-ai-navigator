import { describe, it, expect } from 'vitest';
import { __testables } from './PrintableExam';

const { sanitizeSvgDiagram } = __testables;

// Regression test for L6: PrintableExam.tsx previously sanitized svgDiagram with only
// { USE_PROFILES: { svg: true }, FORBID_TAGS: ['script','style'] } — a loose config that
// still allowed foreignObject, image, use, animate, and inline style attributes. This now
// matches GeometryDiagramRenderer.tsx's strict explicit allowlist.

describe('PrintableExam — sanitizeSvgDiagram (strict SVG allowlist)', () => {
  it('keeps allowed geometry elements and vertex-label text', () => {
    const svg = '<svg viewBox="0 0 220 180"><circle cx="10" cy="10" r="5" stroke="#4f46e5" fill="none" /><text x="12" y="12" font-size="12" fill="#1e1b4b">A</text></svg>';
    const result = sanitizeSvgDiagram(svg);
    expect(result).toContain('<circle');
    expect(result).toContain('<text');
    expect(result).toContain('A');
  });

  it('strips foreignObject, image, use, animate, and script tags', () => {
    const svg = '<svg viewBox="0 0 220 180"><foreignObject><div>x</div></foreignObject><image href="x" /><use href="#x" /><animate attributeName="x" /><script>alert(1)</script><circle cx="1" cy="1" r="1" /></svg>';
    const result = sanitizeSvgDiagram(svg);
    expect(result).not.toContain('foreignObject');
    expect(result).not.toContain('<image');
    expect(result).not.toContain('<use');
    expect(result).not.toContain('<animate');
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
    expect(result).toContain('<circle');
  });

  it('strips inline style attributes (blocks @import/CSS-based exfiltration)', () => {
    const svg = '<svg viewBox="0 0 220 180"><circle cx="1" cy="1" r="1" style="background:url(https://evil.example/leak)" /></svg>';
    const result = sanitizeSvgDiagram(svg);
    expect(result).not.toContain('style=');
    expect(result).not.toContain('evil.example');
  });

  it('strips event-handler attributes', () => {
    const svg = '<svg viewBox="0 0 220 180"><circle cx="1" cy="1" r="1" onclick="alert(1)" /></svg>';
    const result = sanitizeSvgDiagram(svg);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert');
  });
});
