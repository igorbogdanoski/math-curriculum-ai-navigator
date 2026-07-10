/**
 * Pure, dependency-free JSON parse/recovery — shared between the client
 * (services/gemini/core.json.ts) and the server (api/gemini.ts, api/gemini-stream.ts)
 * so both sides agree on what counts as "the AI actually returned usable JSON."
 * No Firebase/browser imports here on purpose: api/gemini.ts runs in a Vercel
 * serverless (Node) function and cannot pull in client-only modules.
 */

/** Best-effort recovery for a response truncated mid-JSON (hit maxOutputTokens) —
 *  trims a dangling partial string/key and closes any still-open braces/brackets. */
export function recoverTruncatedJson(raw: string): unknown | null {
  let s = raw.trim();
  s = s.replace(/"[^"]*$/, '');
  s = s.replace(/,\s*$/, '').replace(/:\s*$/, '');
  const opens: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') opens.push('}');
    else if (ch === '[') opens.push(']');
    else if (ch === '}' || ch === ']') opens.pop();
  }
  const closing = opens.reverse().join('');
  try { return JSON.parse(s + closing); } catch { return null; }
}

/** True if `raw` parses directly or is recoverable via recoverTruncatedJson —
 *  i.e. whether generateAndParseJSON's client-side retry loop would actually
 *  produce usable output from this text, not just any 200 response. */
export function isUsableJson(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return recoverTruncatedJson(trimmed) !== null;
  }
}
