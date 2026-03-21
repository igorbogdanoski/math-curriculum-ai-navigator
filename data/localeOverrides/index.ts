import { sq } from './sq';
import { tr } from './tr';

const OVERRIDES: Record<string, Record<string, string>> = { sq, tr };

/**
 * Returns the localized title for a given Macedonian title and language code.
 * Falls back to the original Macedonian title if no override exists.
 */
export function getLocalizedTitle(mkTitle: string, lang: string): string {
  return OVERRIDES[lang]?.[mkTitle] ?? mkTitle;
}
