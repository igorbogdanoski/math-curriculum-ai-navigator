/**
 * utils/contentModeration.ts — Lightweight, dependency-free content safety layer.
 *
 * Used before writing user/AI generated content to public-readable Firestore collections
 * (e.g. cached_ai_materials, national_library) and before rendering AI illustrations.
 *
 * Checks:
 * - Profanity / hate speech token list (MK + EN) — substring match on normalized text
 * - PII leakage (emails, phone numbers, long digit sequences)
 * - Size cap (prevents DoS via oversized payloads)
 *
 * This is a BEST-EFFORT safety net, not a replacement for server-side moderation.
 * The goal is to catch obvious violations cheaply before storage and flag content
 * for review by teachers/admins.
 */

/** Maximum serialized payload size accepted for library writes (bytes). */
export const MAX_MATERIAL_BYTES = 512 * 1024; // 512 KB

/**
 * Lowercased token fragments that block a write when matched as substrings.
 * Keep intentionally small — this is a last-resort filter, not a lexicon.
 * Project policy: no profanity in teacher-facing or student-facing materials.
 */
const BLOCKED_SUBSTRINGS = Object.freeze([
  // EN
  'fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot',
  // MK (cyrillic and latin transliterations)
  'ебам', 'ебана', 'курац', 'пичка', 'кучка', 'копиле',
  'ebam', 'kurac', 'pichka', 'kuchka',
]);

const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/;
const PHONE_RE = /(?:\+?\d[\s-]?){9,}\d/; // 10+ digits, optionally grouped by spaces/hyphens
const LONG_DIGIT_RE = /\b\d{11,}\b/; // likely ID / card numbers

export interface ModerationResult {
  ok: boolean;
  reason?: 'profanity' | 'pii' | 'oversized' | 'empty';
  details?: string;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFKC');
}

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 6) return; // guard against pathologically deep nesting
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out, depth + 1);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectStrings(v, out, depth + 1);
    }
  }
}

/**
 * Quick profanity/PII scan of any string content (e.g. a title).
 * Returns ok:true if the text looks safe.
 */
export function scanString(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { ok: false, reason: 'empty', details: 'Content is empty' };
  }
  const norm = normalize(text);
  for (const bad of BLOCKED_SUBSTRINGS) {
    if (norm.includes(bad)) {
      return { ok: false, reason: 'profanity', details: `Blocked token: ${bad}` };
    }
  }
  if (EMAIL_RE.test(text)) {
    return { ok: false, reason: 'pii', details: 'Contains email address' };
  }
  if (PHONE_RE.test(text)) {
    return { ok: false, reason: 'pii', details: 'Contains phone-like number' };
  }
  if (LONG_DIGIT_RE.test(text)) {
    return { ok: false, reason: 'pii', details: 'Contains long numeric identifier' };
  }
  return { ok: true };
}

/**
 * Deep moderation scan of an arbitrary JSON-serializable material
 * (title + nested content fields). Combines:
 *   - size cap
 *   - profanity/PII scan on every string leaf
 */
export function moderateMaterial(material: {
  title: string;
  content: unknown;
}): ModerationResult {
  // 1) Size cap — cheap deterministic check first
  let serializedBytes = 0;
  try {
    serializedBytes = new TextEncoder().encode(
      JSON.stringify({ title: material.title, content: material.content }),
    ).length;
  } catch {
    return { ok: false, reason: 'oversized', details: 'Content is not JSON-serializable' };
  }
  if (serializedBytes > MAX_MATERIAL_BYTES) {
    return {
      ok: false,
      reason: 'oversized',
      details: `Material is ${(serializedBytes / 1024).toFixed(0)} kB, max ${MAX_MATERIAL_BYTES / 1024} kB`,
    };
  }

  // 2) Title scan
  const titleScan = scanString(material.title);
  if (!titleScan.ok) return titleScan;

  // 3) Walk content string leaves
  const strings: string[] = [];
  collectStrings(material.content, strings);
  for (const s of strings) {
    if (s.length > 20000) continue; // skip huge data URLs / b64 payloads — not text
    const scan = scanString(s);
    if (!scan.ok && scan.reason !== 'empty') {
      return scan;
    }
  }

  return { ok: true };
}
