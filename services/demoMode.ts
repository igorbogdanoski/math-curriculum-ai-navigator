/**
 * services/demoMode.ts — S41-D2 МОН demo URL shortcut.
 *
 * Activated when the page is loaded with `?demo=mon` (or hash-prefixed
 * `#?demo=mon` / `#/...?demo=mon`). Persists into sessionStorage so the
 * flag survives client-side navigation while remaining tab-scoped.
 *
 * Side-effects controlled by isDemoMode():
 *   • LoginView pre-fills demo credentials and shows a banner.
 *   • AuthContext.register() throws — new account creation is blocked.
 *   • A read-only banner can be rendered (utility flag).
 */

export const DEMO_DOMAIN = 'mon-demo.ai.mismath.net';
export const DEMO_TEACHER_EMAIL = `teacher@${DEMO_DOMAIN}`;
export const DEMO_PASSWORD = 'MonDemo!2026';
const STORAGE_KEY = 'mon-demo-mode';
const QUERY_VALUE = 'mon';
const QUERY_PARAM = 'demo';

function readSearch(href: string): string {
  const qIdx = href.indexOf('?');
  if (qIdx === -1) return '';
  const hashIdx = href.indexOf('#');
  if (hashIdx !== -1 && hashIdx < qIdx) {
    // ?-after-#: strip the hash prefix
    return href.slice(qIdx);
  }
  // Strip trailing #-fragment if any
  const end = hashIdx > qIdx ? hashIdx : href.length;
  return href.slice(qIdx, end);
}

/**
 * Pure URL parser exported for unit testing. Detects `?demo=mon` either in
 * the standard query string or inside the hash fragment.
 */
export function detectDemoFromUrl(href: string): boolean {
  if (!href) return false;
  const candidates: string[] = [];
  const search = readSearch(href);
  if (search) candidates.push(search);
  const hashIdx = href.indexOf('#');
  if (hashIdx !== -1) {
    const hashPart = href.slice(hashIdx + 1);
    const innerQ = hashPart.indexOf('?');
    if (innerQ !== -1) candidates.push(hashPart.slice(innerQ));
  }
  for (const part of candidates) {
    try {
      const params = new URLSearchParams(part.startsWith('?') ? part.slice(1) : part);
      if (params.get(QUERY_PARAM) === QUERY_VALUE) return true;
    } catch {
      // ignore malformed parts
    }
  }
  return false;
}

let cached: boolean | null = null;

function readStorage(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeStorage(active: boolean): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (active) sessionStorage.setItem(STORAGE_KEY, '1');
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Returns true if the current session is in МОН demo mode. */
export function isDemoMode(): boolean {
  if (cached !== null) return cached;
  if (typeof window === 'undefined') {
    cached = false;
    return cached;
  }
  const fromUrl = detectDemoFromUrl(window.location.href);
  if (fromUrl) writeStorage(true);
  cached = fromUrl || readStorage();
  return cached;
}

/** Force-set demo mode (used by tests + manual exit). */
export function setDemoMode(active: boolean): void {
  cached = active;
  writeStorage(active);
}

/** Returns the canonical credentials to surface in the login UI. */
export function getDemoCredentials(): { email: string; password: string } {
  return { email: DEMO_TEACHER_EMAIL, password: DEMO_PASSWORD };
}

/** Test-only — clear cached state so subsequent reads re-evaluate. */
export function _resetDemoModeForTests(): void {
  cached = null;
  writeStorage(false);
}
