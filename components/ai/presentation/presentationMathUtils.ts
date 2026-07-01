/**
 * LaTeX-to-image utilities for PPTX export in GeneratedPresentation.
 * Extracted from GeneratedPresentation.tsx to reduce file size.
 */

// ─── Lazy loaders ─────────────────────────────────────────────────────────────

const HAS_MATH = /\$[\s\S]+?\$/;

let html2canvasLoader: Promise<typeof import('html2canvas')> | null = null;
let pptxgenLoader: Promise<typeof import('pptxgenjs')> | null = null;

export const getHtml2Canvas = async () => {
  if (!html2canvasLoader) html2canvasLoader = import('html2canvas');
  const mod = await html2canvasLoader;
  return mod.default;
};

export const getPptxgen = async () => {
  if (!pptxgenLoader) pptxgenLoader = import('pptxgenjs');
  const mod = await pptxgenLoader;
  return mod.default;
};

// ─── Math rendering ───────────────────────────────────────────────────────────

/** Returns true if the entire string is a single $...$ or $$...$$ expression */
export const isPureMathExpr = (text: string): boolean => {
  const t = text.trim();
  return /^\$\$[\s\S]+\$\$$/.test(t) || /^\$[^$\n]+\$$/.test(t);
};

/** Renders a pure-math expression to an SVG data-URI (KaTeX, no html2canvas).
 *  Returns { uri, ratio: height/width } or null on failure. */
const renderPureMathToSvg = (text: string): { uri: string; ratio: number } | null => {
  const katex = window.katex;
  if (!katex) return null;
  try {
    const t = text.trim();
    const ddMatch = t.match(/^\$\$([\s\S]+)\$\$$/);
    const sdMatch = t.match(/^\$([^$\n]+)\$$/);
    const latex = (ddMatch?.[1] ?? sdMatch?.[1] ?? t).trim();
    const svgHtml = katex.renderToString(latex, {
      output: 'svg', throwOnError: false, displayMode: !!ddMatch,
    });
    // viewBox="minX minY W H" — last two values give aspect ratio
    const vb = svgHtml.match(/viewBox="([\d\-.]+)\s+([\d\-.]+)\s+([\d.]+)\s+([\d.]+)"/);
    const ratio = vb ? parseFloat(vb[4]) / parseFloat(vb[3]) : 0.25;
    // encodeURIComponent → Uint8Array → btoa avoids deprecated unescape()
    const encoded = new TextEncoder().encode(`<?xml version="1.0" encoding="UTF-8"?>${svgHtml}`);
    const uri = `data:image/svg+xml;base64,${btoa(String.fromCharCode(...encoded))}`;
    return { uri, ratio };
  } catch { return null; }
};

/** Renders a bullet text (may contain $...$ / $$...$$) to an image data-URI.
 *  Pure math → KaTeX SVG (fast, scalable).
 *  Mixed text+math → html2canvas PNG fallback. */
export const renderBulletToImg = async (
  text: string, hexColor: string
): Promise<{ data: string; ratio?: number }> => {
  if (isPureMathExpr(text)) {
    const svg = renderPureMathToSvg(text);
    if (svg) return { data: svg.uri, ratio: svg.ratio };
  }
  // Mixed content fallback → html2canvas PNG
  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed', 'top:-9999px', 'left:-9999px',
    'background:#ffffff', 'padding:8px 16px',
    'font-size:32px', 'font-family:Arial,Helvetica,sans-serif',
    `color:#${hexColor}`, 'max-width:420px',
    'line-height:1.5', 'white-space:pre-wrap',
  ].join(';');
  const katex = window.katex;
  const toHtml = (src: string): string => {
    if (!katex) return src;
    return src
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) =>
        katex.renderToString(f, { throwOnError: false, displayMode: true, output: 'html' as const }))
      .replace(/\$([^$\n]+?)\$/g, (_, f) =>
        katex.renderToString(f, { throwOnError: false, displayMode: false, output: 'html' as const }));
  };
  container.innerHTML = toHtml(text);
  document.body.appendChild(container);
  try {
    const html2canvas = await getHtml2Canvas();
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', logging: false });
    return { data: canvas.toDataURL('image/png', 1.0) };
  } finally {
    document.body.removeChild(container);
  }
};

/** Resolves height/width ratio: uses pre-computed ratio for SVG, or loads PNG in DOM. */
export const resolveImgRatio = async (entry: { data: string; ratio?: number }): Promise<number> => {
  if (entry.ratio !== undefined) return entry.ratio;
  const img = new Image();
  await Promise.race([
    new Promise<void>(res => { img.onload = () => res(); img.onerror = () => res(); img.src = entry.data; }),
    new Promise<void>(res => setTimeout(res, 5000)),
  ]);
  if (!img.naturalWidth) throw new Error('no dimensions');
  return img.naturalHeight / img.naturalWidth;
};

export { HAS_MATH };
