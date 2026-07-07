/**
 * sessionStorage handoff bridge for "open Math Editor from another view, then insert the
 * result back" — mirrors the established pattern already used for mindmap_prefill
 * (AIMindMapView), kahoot_gamma_prompt (KahootMakerView), and matura_recovery_prefill
 * (MaturaPracticeView/MaturaPortalView etc.), generalized here since Math Editor is a
 * genuine two-way handoff (a return path in, a LaTeX result out) rather than a one-way prefill.
 */
const RETURN_KEY = 'math_editor_return';
const RESULT_KEY = 'math_editor_result';

/** Called by the ORIGIN view right before navigating to /math-editor. */
export function writeMathEditorReturn(returnPath: string): void {
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ returnPath })); } catch { /* quota/incognito */ }
}

/** Called by MathEditorView on mount to check whether it was opened for an insert-back flow. */
export function readAndClearMathEditorReturn(): string | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(RETURN_KEY);
    return (JSON.parse(raw) as { returnPath: string }).returnPath;
  } catch {
    return null;
  }
}

/** Called by MathEditorView's "Вметни" button right before navigating back. */
export function writeMathEditorResult(latex: string): void {
  try { sessionStorage.setItem(RESULT_KEY, latex); } catch { /* quota/incognito */ }
}

/** Called by the ORIGIN view on mount to pick up the inserted LaTeX, if any. */
export function readAndClearMathEditorResult(): string | null {
  try {
    const val = sessionStorage.getItem(RESULT_KEY);
    if (val === null) return null;
    sessionStorage.removeItem(RESULT_KEY);
    return val;
  } catch {
    return null;
  }
}
