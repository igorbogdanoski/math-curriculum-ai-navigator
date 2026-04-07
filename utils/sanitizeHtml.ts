/**
 * sanitizeWorksheetHtml — strips dangerous patterns from AI-generated HTML.
 *
 * Guards against prompt-injection scenarios where Gemini could be tricked
 * into returning HTML with script tags or event handlers.
 * Not DOMPurify — intentionally lightweight (teacher-only, no user input path).
 */
export function sanitizeWorksheetHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/\bon\w+\s*=/gi, 'data-blocked=');
}
