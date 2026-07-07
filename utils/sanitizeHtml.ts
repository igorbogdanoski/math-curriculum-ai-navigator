import DOMPurify from 'dompurify';

/**
 * sanitizeWorksheetHtml — sanitizes AI-generated worksheet HTML before it is
 * inserted via dangerouslySetInnerHTML or innerHTML (RecoveryWorksheetModal).
 *
 * Guards against prompt-injection scenarios where Gemini could be tricked
 * into returning HTML with script tags or event handlers.
 */
export function sanitizeWorksheetHtml(raw: string): string {
  if (!raw) return '';
  return DOMPurify.sanitize(raw);
}
