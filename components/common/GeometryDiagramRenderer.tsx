/**
 * GeometryDiagramRenderer — renders AI-generated SVG geometry diagrams inline.
 *
 * Security: strips all script tags, event handlers (on*=), javascript: URIs,
 * and external resource references before rendering.
 *
 * Usage:
 *   <GeometryDiagramRenderer svg={question.svgDiagram} />
 */
import React, { useMemo } from 'react';

interface Props {
  svg: string;
  className?: string;
  /** Caption shown below the diagram */
  caption?: string;
}

/** Sanitise AI-generated SVG — allow only safe geometry markup. */
function sanitizeSvg(raw: string): string {
  return raw
    // Remove script elements
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    // Remove event handlers (onclick, onload, onmouseover, …)
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: URIs
    .replace(/javascript:[^"']*/gi, '')
    // Remove <foreignObject> (could embed HTML)
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    // Remove xlink:href and href pointing to external resources (keep data: images)
    .replace(/\s+(?:xlink:)?href\s*=\s*["'](?!data:image)[^"']*["']/gi, '')
    // Remove <use> with potentially dangerous refs
    .replace(/<use\s[^>]*>/gi, '');
}

/** Ensure the SVG string has a proper <svg> wrapper with a viewBox. */
function normalizeSvg(raw: string): string {
  const sanitized = sanitizeSvg(raw.trim());
  // If it's already a full <svg> element, return as-is
  if (/^<svg[\s>]/i.test(sanitized)) return sanitized;
  // Wrap bare geometry elements in an svg container
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">${sanitized}</svg>`;
}

export const GeometryDiagramRenderer: React.FC<Props> = ({ svg, caption, className = '' }) => {
  const safeSvg = useMemo(() => normalizeSvg(svg), [svg]);

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <div
        className="bg-white border-2 border-indigo-100 rounded-2xl p-3 shadow-sm max-w-[280px] w-full"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: safeSvg }}
        aria-label="Геометриски дијаграм"
      />
      {caption && (
        <p className="text-[11px] text-gray-400 font-medium text-center italic">{caption}</p>
      )}
    </div>
  );
};
