/**
 * SlideSVGRenderer — renders AI-generated SVG illustrations in Gamma Mode slides.
 *
 * Dark-mode variant of GeometryDiagramRenderer:
 * - Transparent/dark background (glass-morphism style)
 * - Same DOMPurify allowlist for security
 * - No light paper background — designed for dark slides
 *
 * Security: DOMPurify strict allowlist, forbids style/script/foreignObject/image.
 */

import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

interface Props {
  svg: string;
  /** Accessible description (the original visualPrompt text) */
  caption?: string;
  className?: string;
}

const ALLOWED_TAGS = [
  'svg', 'g', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'path', 'defs', 'marker', 'title',
  // text excluded intentionally — no Macedonian font rendering issues
];

const ALLOWED_ATTR = [
  'viewBox', 'width', 'height', 'xmlns',
  'cx', 'cy', 'r', 'rx', 'ry',
  'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'points', 'd',
  'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'opacity', 'transform', 'id',
  'markerWidth', 'markerHeight', 'orient', 'refX', 'refY',
  'marker-end', 'marker-start', 'marker-mid',
  'preserveAspectRatio',
];

function sanitizeSvg(raw: string): string {
  const cleaned = DOMPurify.sanitize(raw.trim(), {
    USE_PROFILES: { svg: true },
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ['style', 'script', 'foreignObject', 'image', 'use', 'animate', 'text', 'tspan'],
    FORBID_ATTR: ['style', 'class'],
    FORCE_BODY: false,
  });
  // Ensure proper <svg> wrapper with viewBox
  if (/^<svg[\s>]/i.test(cleaned)) return cleaned;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${cleaned}</svg>`;
}

export const SlideSVGRenderer: React.FC<Props> = ({ svg, caption, className = '' }) => {
  const safeSvg = useMemo(() => sanitizeSvg(svg), [svg]);

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div
        role="img"
        aria-label={caption ? `Илустрација: ${caption}` : 'Математичка илустрација'}
        className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/5 backdrop-blur p-3 shadow-lg overflow-hidden"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeSvg }}
      />
    </div>
  );
};
