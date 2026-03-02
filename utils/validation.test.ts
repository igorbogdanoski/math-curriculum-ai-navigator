import { describe, it, expect } from 'vitest';
import { validateStudentName, STUDENT_NAME_MAX_LENGTH, STUDENT_NAME_REGEX } from './validation';

describe('validateStudentName — student name validation (П39)', () => {
    describe('valid names', () => {
        it('accepts a simple Cyrillic name', () => {
            expect(validateStudentName('Иван').valid).toBe(true);
        });
        it('accepts a Cyrillic first + last name', () => {
            expect(validateStudentName('Марија Петрова').valid).toBe(true);
        });
        it('accepts a Latin name', () => {
            expect(validateStudentName('Ivan').valid).toBe(true);
        });
        it('accepts mixed Cyrillic/Latin scripts (separate words)', () => {
            expect(validateStudentName('Ана Ana').valid).toBe(true);
        });
        it("accepts name with apostrophe (e.g. D'Angelo)", () => {
            expect(validateStudentName("D'Angelo").valid).toBe(true);
        });
        it('accepts a hyphenated name', () => {
            expect(validateStudentName('Анна-Марија').valid).toBe(true);
        });
        it('accepts name with leading/trailing whitespace (trimmed)', () => {
            expect(validateStudentName('  Иван  ').valid).toBe(true);
        });
        it('accepts exactly 80 characters', () => {
            const name = 'А'.repeat(STUDENT_NAME_MAX_LENGTH);
            expect(validateStudentName(name).valid).toBe(true);
        });
    });

    describe('invalid names — empty / whitespace', () => {
        it('rejects empty string', () => {
            const r = validateStudentName('');
            expect(r.valid).toBe(false);
            expect(r.error).toBeDefined();
        });
        it('rejects whitespace-only string', () => {
            expect(validateStudentName('   ').valid).toBe(false);
        });
    });

    describe('invalid names — too long', () => {
        it('rejects name longer than 80 characters', () => {
            const name = 'А'.repeat(STUDENT_NAME_MAX_LENGTH + 1);
            const r = validateStudentName(name);
            expect(r.valid).toBe(false);
            expect(r.error).toContain('80');
        });
    });

    describe('invalid names — illegal characters', () => {
        it('rejects digits', () => {
            expect(validateStudentName('Иван123').valid).toBe(false);
        });
        it('rejects special characters like @', () => {
            expect(validateStudentName('Ivan@gmail').valid).toBe(false);
        });
        it('rejects angle brackets (XSS vector)', () => {
            expect(validateStudentName('<script>').valid).toBe(false);
        });
        it('rejects emoji', () => {
            expect(validateStudentName('Иван😀').valid).toBe(false);
        });
        it('rejects SQL injection patterns', () => {
            expect(validateStudentName("'; DROP TABLE--").valid).toBe(false);
        });
        it('rejects pipe and ampersand', () => {
            expect(validateStudentName('Ivan & Marija').valid).toBe(false);
        });
    });

    describe('error messages', () => {
        it('provides an error message for too-long names', () => {
            const r = validateStudentName('А'.repeat(81));
            expect(typeof r.error).toBe('string');
            expect(r.error!.length).toBeGreaterThan(0);
        });
        it('provides an error message for invalid characters', () => {
            const r = validateStudentName('Иван123');
            expect(typeof r.error).toBe('string');
            expect(r.error!.length).toBeGreaterThan(0);
        });
    });

    describe('STUDENT_NAME_REGEX constant', () => {
        it('is a RegExp with unicode flag', () => {
            expect(STUDENT_NAME_REGEX).toBeInstanceOf(RegExp);
            expect(STUDENT_NAME_REGEX.unicode).toBe(true);
        });
        it('matches pure Cyrillic', () => {
            expect(STUDENT_NAME_REGEX.test('Марија')).toBe(true);
        });
        it('does not match digits', () => {
            expect(STUDENT_NAME_REGEX.test('123')).toBe(false);
        });
    });
});
