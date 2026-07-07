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

/**
 * sanitizeKatexHtml — sanitizes KaTeX's rendered HTML output before it is inserted via
 * dangerouslySetInnerHTML (MathRenderer). KaTeX is configured with `trust: true` (needed
 * for \text{}-style macros used throughout this app's math content), which also enables
 * \href/\url/\includegraphics — letting untrusted LaTeX (e.g. forum posts, any other
 * user-authored text rendered as math) embed arbitrary links/images. Sanitizing the
 * output closes that gap without having to disable `trust` and risk breaking legitimate
 * macros elsewhere.
 */
export function sanitizeKatexHtml(raw: string): string {
  if (!raw) return '';
  return DOMPurify.sanitize(raw);
}
