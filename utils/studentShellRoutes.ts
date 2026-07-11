/**
 * P0 (2026-07-12 nav audit) — which hash routes get the lightweight
 * StudentShell instead of the full teacher Sidebar/BottomNavBar shell.
 * Kept in its own dependency-free module so it can be unit-tested without
 * pulling in App.tsx's full (heavy, eagerly-imported) provider/view tree.
 */

// Dashboard/login/SRS (all under '#/student'), tutor, portfolio, the play
// route, and progress. '#/dugga/play' already has its own standalone branch
// in App.tsx and isn't repeated here.
export const STUDENT_SHELL_HASH_PREFIXES = [
  '#/student',
  '#/tutor',
  '#/portfolio',
  '#/play/',
  '#/my-progress',
];

export const isStudentShellRoute = (hash: string): boolean =>
  STUDENT_SHELL_HASH_PREFIXES.some((prefix) => hash.startsWith(prefix));
