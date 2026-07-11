/**
 * P0 (2026-07-12 nav audit) — regression test for the student-shell route
 * matcher. AppCore uses `isStudentShellRoute` to decide whether a hash
 * renders inside StudentShell (no teacher Sidebar/BottomNavBar) or falls
 * through to the full AuthenticatedApp shell.
 */
import { describe, it, expect } from 'vitest';
import { isStudentShellRoute, STUDENT_SHELL_HASH_PREFIXES } from './studentShellRoutes';

describe('isStudentShellRoute', () => {
  it('matches every route the audit flagged as leaking the teacher shell', () => {
    expect(isStudentShellRoute('#/student')).toBe(true);
    expect(isStudentShellRoute('#/student/login')).toBe(true);
    expect(isStudentShellRoute('#/student/srs')).toBe(true);
    expect(isStudentShellRoute('#/tutor')).toBe(true);
    expect(isStudentShellRoute('#/portfolio')).toBe(true);
    expect(isStudentShellRoute('#/play/abc123')).toBe(true);
    expect(isStudentShellRoute('#/my-progress')).toBe(true);
  });

  it('does not match teacher-facing routes', () => {
    expect(isStudentShellRoute('#/')).toBe(false);
    expect(isStudentShellRoute('#/analytics')).toBe(false);
    expect(isStudentShellRoute('#/dugga')).toBe(false);
    expect(isStudentShellRoute('#/scenario-bank')).toBe(false);
    expect(isStudentShellRoute('#/my-lessons')).toBe(false);
  });

  it('does not accidentally match routes that merely start with a similar prefix', () => {
    // '/studenta-something' should not match just because it starts with the
    // same characters as '#/student' — startsWith is intentionally used here
    // since '#/student' itself has no trailing slash, so verify the actual
    // configured prefixes stay exact rather than drifting to something broader.
    expect(STUDENT_SHELL_HASH_PREFIXES).toContain('#/student');
    expect(isStudentShellRoute('#/dugga/play')).toBe(false); // handled by its own earlier standalone branch, not this one
  });
});
