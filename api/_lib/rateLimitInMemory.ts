/**
 * SEC-5 — In-memory sliding-window rate-limit fallback.
 *
 * Used when Upstash Redis is not configured (local dev / preview deploy).
 * Per-instance state — best-effort only; production MUST set
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for distributed limits.
 */

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests allowed per identifier within `windowMs`. */
  maxRequests: number;
  /** Function returning current epoch ms (test seam). */
  now?: () => number;
}

/**
 * Pure sliding-window rate-limit check. Mutates the supplied `store` map
 * (caller owns lifetime). Returns `true` when the request is allowed.
 */
export function checkSlidingWindow(
  store: Map<string, number[]>,
  identifier: string,
  options: RateLimitOptions,
): boolean {
  const { windowMs, maxRequests } = options;
  const now = options.now ? options.now() : Date.now();
  const windowStart = now - windowMs;
  const previous = store.get(identifier) ?? [];
  const recent = previous.filter((t) => t > windowStart);
  if (recent.length >= maxRequests) {
    store.set(identifier, recent); // GC stale entries
    return false;
  }
  recent.push(now);
  store.set(identifier, recent);
  return true;
}

/**
 * SEC-5 — Extract the originating client IP from a Vercel/Node request,
 * being careful with `x-forwarded-for` proxy chains (only the FIRST IP is
 * the real client; the rest are proxy hops attacker cannot spoof past CF/Vercel).
 */
export function extractClientIp(headers: Record<string, string | string[] | undefined>, socketIp?: string): string | undefined {
  const xff = headers['x-forwarded-for'];
  const xffStr = Array.isArray(xff) ? xff[0] : xff;
  const firstIp = typeof xffStr === 'string' ? xffStr.split(',')[0]?.trim() : undefined;
  return firstIp || socketIp || undefined;
}
