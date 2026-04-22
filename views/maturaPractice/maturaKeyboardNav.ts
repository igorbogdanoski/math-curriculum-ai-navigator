/**
 * S37-D3 — Pure helpers for keyboard-first MC navigation in MaturaPractice.
 *
 * Extracted for unit-testing without mounting the React component.
 */

export type MCKeyAction =
  | { type: 'select'; choice: string }
  | { type: 'cycle'; direction: 'up' | 'down' }
  | { type: 'submit-focused' }
  | { type: 'noop' };

const DIRECT_MAP: Readonly<Record<string, string>> = {
  'А':'А','Б':'Б','В':'В','Г':'Г',
  'A':'А','B':'Б','C':'В','D':'Г',
  '1':'А','2':'Б','3':'В','4':'Г',
};

/** Resolve a KeyboardEvent.key (or upper-cased) into an MC action. */
export function resolveMCKey(rawKey: string, availableChoices: readonly string[]): MCKeyAction {
  if (!rawKey) return { type: 'noop' };
  const k = rawKey.toUpperCase();
  const direct = DIRECT_MAP[k];
  if (direct && availableChoices.includes(direct)) {
    return { type: 'select', choice: direct };
  }
  if (rawKey === 'ArrowDown') return { type: 'cycle', direction: 'down' };
  if (rawKey === 'ArrowUp')   return { type: 'cycle', direction: 'up' };
  if (rawKey === 'Enter')     return { type: 'submit-focused' };
  return { type: 'noop' };
}

/** Compute the next focused-choice index, wrapping around. */
export function nextFocusedIdx(
  currentIdx: number,
  direction: 'up' | 'down',
  total: number,
): number {
  if (total <= 0) return 0;
  const step = direction === 'down' ? 1 : -1;
  return (currentIdx + step + total) % total;
}
