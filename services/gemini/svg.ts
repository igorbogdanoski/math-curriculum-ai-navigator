/**
 * AI SVG illustration generator for Gamma Mode slides.
 *
 * Generates clean, text-free SVG math diagrams that render perfectly
 * on a dark presentation background. Uses Gemini text generation —
 * no Imagen needed, no credit cost for basic illustrations.
 *
 * Key constraint: NO <text> elements — avoids Macedonian font issues.
 */

import { callGeminiProxy, DEFAULT_MODEL } from './core';

const SYSTEM_PROMPT = `You are a mathematical SVG diagram generator for educational presentations.
Generate MINIMAL, CLEAN SVG code for math illustrations.

Strict rules:
1. Return ONLY raw SVG code, starting with <svg — no markdown, no explanation
2. Use viewBox="0 0 400 300" — no fixed width/height on the root svg element
3. DARK MODE: background is transparent, use light colors:
   - Axes, main lines: stroke="#e2e8f0" (light gray-white)
   - Primary curve/shape: stroke="#93c5fd" (light blue)
   - Secondary elements: stroke="#fbbf24" (amber) or stroke="#5eead4" (teal)
   - Fills: fill="none" or fill="rgba(255,255,255,0.04)"
4. NO text elements whatsoever — no <text>, no <tspan>
5. Use <defs> with <marker> for arrowheads on axes if needed
6. Keep stroke-width between 1.5 and 2.5
7. Max 50 SVG elements — stay minimal
8. Include only safe tags: svg, g, circle, ellipse, rect, line, polyline, polygon, path, defs, marker`;

/**
 * Generate a dark-mode SVG illustration for a presentation slide.
 * Returns raw SVG string (already safe for sanitization by SlideSVGRenderer).
 * Throws on failure — caller should catch and show fallback.
 */
export async function generateMathSVG(visualPrompt: string): Promise<string> {
  const prompt = `Draw an SVG math diagram for this context: "${visualPrompt}"
Rules: no text labels, dark-mode friendly (light strokes on transparent), viewBox="0 0 400 300".
Return ONLY the SVG code.`;

  const response = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ parts: [{ text: prompt }] }],
    systemInstruction: SYSTEM_PROMPT,
  });

  const raw = response.text?.trim() ?? '';

  // Extract SVG block even if model wraps in markdown
  const svgMatch = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (svgMatch) return svgMatch[0];
  if (raw.startsWith('<svg')) return raw;

  throw new Error('No valid SVG returned');
}
