/**
 * GeometryDiagramRenderer — renders AI-generated SVG geometry diagrams inline.
 *
 * Security: uses DOMPurify (industry standard) with a strict allowlist of SVG
 * geometry elements and attributes. Blocks <style>, @import, data: URIs in
 * attributes, <foreignObject>, event handlers, and all external references.
 *
 * Usage:
 *   <GeometryDiagramRenderer svg={question.svgDiagram} />
 */
import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface Props {
  svg: string;
  className?: string;
  /** Accessible description for screen readers */
  caption?: string;
}

// Allowlist: only safe geometry SVG elements and attributes
const ALLOWED_TAGS = [
  'svg', 'g', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'path', 'text', 'tspan', 'defs', 'marker', 'title',
];
const ALLOWED_ATTR = [
  'viewBox', 'width', 'height', 'xmlns',
  'cx', 'cy', 'r', 'rx', 'ry',
  'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'points', 'd',
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'opacity', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
  'transform', 'id', 'class',
  'markerWidth', 'markerHeight', 'orient', 'refX', 'refY',
  'marker-end', 'marker-start',
];

function sanitizeSvg(raw: string): string {
  const cleaned = DOMPurify.sanitize(raw.trim(), {
    USE_PROFILES: { svg: true },
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Block <style> blocks entirely — no @import, no data exfiltration via CSS
    FORBID_TAGS: ['style', 'script', 'foreignObject', 'image', 'use', 'animate'],
    FORBID_ATTR: ['style'],
    FORCE_BODY: false,
  });
  // Ensure proper <svg> wrapper with viewBox
  if (/^<svg[\s>]/i.test(cleaned)) return cleaned;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 180" width="220" height="180">${cleaned}</svg>`;
}

/** Extract human-readable text from SVG for screen reader description */
function extractSvgDescription(svg: string): string {
  const labels: string[] = [];
  const textMatches = svg.matchAll(/<text[^>]*>([^<]+)<\/text>/gi);
  for (const m of textMatches) {
    const t = m[1].trim();
    if (t) labels.push(t);
  }
  if (labels.length > 0) return `Геометриски дијаграм со елементи: ${labels.join(', ')}`;
  return 'Геометриски дијаграм';
}

export const GeometryDiagramRenderer: React.FC<Props> = ({ svg, caption, className = '' }) => {
  const safeSvg = useMemo(() => sanitizeSvg(svg), [svg]);
  const ariaLabel = useMemo(() => caption || extractSvgDescription(svg), [svg, caption]);

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div
        role="img"
        aria-label={ariaLabel}
        className="bg-white border-2 border-indigo-100 rounded-2xl p-3 shadow-sm max-w-[280px] w-full"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeSvg }}
      />
      {caption && (
        <p className="text-[11px] text-gray-400 font-medium text-center italic">{caption}</p>
      )}
    </div>
  );
};
