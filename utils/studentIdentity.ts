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

/**
 * Враќа постоечкиот deviceId за овој уред, или создава нов UUID v4
 * и го зачувува во localStorage. Безбеден за private/incognito (fallback 'anon').
 */
export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    // Private browsing or localStorage disabled — return stable fallback
    return 'anon';
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
