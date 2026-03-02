/**
 * Student name validation — extracted from StudentPlayView (П39).
 * No React/Firebase dependencies; fully unit-testable.
 */

/** Max allowed character length for a student name. */
export const STUDENT_NAME_MAX_LENGTH = 80;

/**
 * Unicode-aware regex: letters (any script), combining marks, apostrophe,
 * hyphen, and space. Blocks digits, emoji, and special characters.
 */
export const STUDENT_NAME_REGEX = /^[\p{L}\p{M}'\-\s]+$/u;

export interface NameValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validates a student name string.
 * Trims whitespace before checking length and character set.
 */
export function validateStudentName(name: string): NameValidationResult {
    const trimmed = name.trim();

    if (!trimmed) {
        return { valid: false, error: 'Внесете го вашето име.' };
    }
    if (trimmed.length > STUDENT_NAME_MAX_LENGTH) {
        return { valid: false, error: `Името е предолго (максимум ${STUDENT_NAME_MAX_LENGTH} знаци).` };
    }
    if (!STUDENT_NAME_REGEX.test(trimmed)) {
        return { valid: false, error: 'Името смее да содржи само букви, простор и цртичка.' };
    }

    return { valid: true };
}
