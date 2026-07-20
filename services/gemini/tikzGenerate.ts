/**
 * 2026-07-20 (Wave 19, drifting-snuggling-wave.md). AI TikZ diagram generator — lets a
 * teacher describe a simple illustration in plain language and get back working TikZ source,
 * pre-filled into TikzLab's editor for review/editing before rendering.
 *
 * Modeled directly on services/gemini/svg.ts's generateMathSVG (Gamma Mode's AI illustrations):
 * same "Gemini text-generation, no Imagen" approach, same output-format discipline. The
 * generation constraints below encode two facts discovered the hard way earlier this same day
 * (Wave 16, see data/tikzTemplates.ts's file header): the CDN TeX engine has no Cyrillic
 * font/encoding configured (bare Cyrillic in a `\node{...}` label fails to compile), and only
 * `angles`, `quotes`, `calc`, `intersections` are confirmed working in this TikZJax build.
 */
import { callGeminiProxy, DEFAULT_MODEL, sanitizePromptInput } from './core';
import { AIServiceError } from '../../utils/errors';
import { scanString } from '../../utils/contentModeration';

export interface TikzCurriculumContext {
  topicTitle: string;
  standardCode?: string;
}

// @prompt-start: TIKZ_GENERATE_SYSTEM_PROMPT
const SYSTEM_PROMPT = `You are a TikZ diagram generator for Macedonian math teachers, producing
simple illustrations mainly for primary and early-secondary education (angles, basic shapes,
fraction models, simple geometric constructions) — keep complexity appropriate for that level
unless the teacher's prompt clearly asks for something more advanced.

Strict rules:
1. Return ONLY raw TikZ source, starting with either "\\usetikzlibrary{...}" or
   "\\begin{tikzpicture}" — no markdown fences, no explanation, no surrounding text.
2. The output must contain exactly one "\\begin{tikzpicture}...\\end{tikzpicture}" block.
3. Only use these tikz libraries if needed: angles, quotes, calc, intersections. Do not use
   any other \\usetikzlibrary — they are not confirmed to work in this rendering environment.
4. CRITICAL: every label inside a \\node{...} or "..." quote must be math-mode Latin/Greek
   only (e.g. "$\\alpha$", "$A$", "$5\\,cm$") — NEVER Cyrillic text. The renderer's TeX engine
   has no Cyrillic font configured and will fail to compile on any Cyrillic character.
5. Keep the diagram simple: prefer \\draw, \\node, \\coordinate, \\fill, \\pic — avoid deeply
   nested or highly complex constructions.
6. Mathematically correct: only mark a right angle where the coordinates actually form one,
   only label a value that matches the coordinates drawn.`;
// @prompt-end: TIKZ_GENERATE_SYSTEM_PROMPT

/**
 * Generate TikZ source for a diagram described by a teacher, optionally nudged toward a
 * specific curriculum topic/standard. Throws on failure (moderation block, empty/invalid
 * response) — caller shows an error and leaves the editor's existing content untouched.
 */
export async function generateTikzDiagram(
  prompt: string,
  curriculumContext?: TikzCurriculumContext,
): Promise<string> {
  const safePrompt = sanitizePromptInput(prompt, 500);
  const moderation = scanString(safePrompt);
  if (!moderation.ok) {
    throw new AIServiceError(`Content blocked: ${moderation.reason ?? 'unknown'}`);
  }

  const contextLine = curriculumContext
    ? `\nThis diagram is for the curriculum topic "${sanitizePromptInput(curriculumContext.topicTitle, 200)}"${
        curriculumContext.standardCode ? ` (standard ${curriculumContext.standardCode})` : ''
      } — let that guide the diagram's content, but follow the teacher's description below first.`
    : '';

  const promptText = `Draw a TikZ diagram for this description: "${safePrompt}"${contextLine}
Return ONLY the TikZ source (optionally starting with \\usetikzlibrary, then one
\\begin{tikzpicture}...\\end{tikzpicture} block).`;

  const response = await callGeminiProxy({
    model: DEFAULT_MODEL,
    contents: [{ parts: [{ text: promptText }] }],
    systemInstruction: SYSTEM_PROMPT,
    costKey: 'ILLUSTRATION',
  });

  const raw = response.text?.trim() ?? '';
  const match = raw.match(/(?:\\usetikzlibrary\{[^}]*\}\s*)?\\begin\{tikzpicture\}[\s\S]*\\end\{tikzpicture\}/);
  if (match) return match[0];

  throw new AIServiceError('No valid TikZ code returned');
}
