/**
 * Ж1 — Стабилен идентитет на ученик преку device-bound UUID.
 *
 * Наместо само `studentName` (кој може да се судри кај исти имиња),
 * секој уред добива уникатен `deviceId` кој трае во localStorage.
 * Новите записи (quiz_results, concept_mastery, student_gamification)
 * го вклучуваат `deviceId` за точно поврзување без судири.
 * Стари записи без `deviceId` продолжуваат да работат (backward compat).
 */

const DEVICE_ID_KEY = 'student_device_id';

// Used only when localStorage is unavailable (private/incognito browsing). A single
// hardcoded literal here would collide every such student under the same teacher onto
// one shared class_memberships/quiz_results/student_gamification identity — this is
// generated once per page load instead, so concurrent private-browsing students don't
// see each other's homework/history (it won't survive a reload, which is an inherent
// limitation of private browsing, not something a fallback string can fix either way).
let sessionFallbackId: string | null = null;

/**
 * Враќа постоечкиот deviceId за овој уред, или создава нов UUID v4
 * и го зачувува во localStorage. Безбеден за private/incognito (случаен fallback по сесија).
 */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    if (!sessionFallbackId) sessionFallbackId = `anon_${crypto.randomUUID()}`;
    return sessionFallbackId;
  }
}

/**
 * Читај го deviceId само доколку постои (без создавање).
 * Корисно во read-only контекст (ParentPortalView).
 */
export function getDeviceId(): string | null {
  try {
    return localStorage.getItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

const STUDENT_NAME_KEY = 'studentName';

/** Reads the cached student name (set at login/name-confirm), or null if none/unavailable. */
export function getCachedStudentName(): string | null {
  try {
    return localStorage.getItem(STUDENT_NAME_KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Per-student-on-this-device key for `class_memberships`/similar collections —
 * without this, two different students sharing one device/browser (deviceId is
 * device-bound, not person-bound) would collide on the same doc and the second to
 * join would silently overwrite the first's class/homework. Falls back to a generic
 * slug when no name is available (matches the old single-profile-per-device shape).
 */
export function membershipKey(deviceId: string, studentName?: string | null): string {
  const slug = (studentName ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return `${deviceId}__${slug || 'student'}`;
}
