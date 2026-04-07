import type { Assignment, SchoolClass } from './firestoreService.types';

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

export function isE2ETeacherMode(): boolean {
  return hasWindow() && Boolean(window.__E2E_TEACHER_MODE__);
}

export function getE2EMockClasses(teacherUid: string): SchoolClass[] | null {
  if (!isE2ETeacherMode()) return null;
  const mockClasses = window.__E2E_MOCK_CLASSES__ ?? [];
  return mockClasses.filter((cls) => !teacherUid || cls.teacherUid === teacherUid);
}

export function recordE2EAssignmentWrite(a: Omit<Assignment, 'id' | 'createdAt'>): string | null {
  if (!isE2ETeacherMode()) return null;
  const writes = window.__E2E_ASSIGNMENT_WRITES__ ?? [];
  writes.push(a);
  window.__E2E_ASSIGNMENT_WRITES__ = writes;
  return `e2e-assignment-${writes.length}`;
}
