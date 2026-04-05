/**
 * E4 — Vertex AI Controlled Spike: Shadow Mode
 *
 * Architecture:
 *   1. Production Gemini call always completes normally.
 *   2. If `vertex_ai_shadow_enabled` = true, a parallel fire-and-forget call
 *      is made to /api/vertex-shadow (the Vertex proxy endpoint).
 *   3. The Vertex response is NEVER used for production output — only metrics
 *      are captured and stored in a rolling localStorage log (max 50 entries).
 *   4. Settings > AI Features shows a compare report (quality/latency/cost/failure-rate).
 *
 * Production safety guarantee:
 *   - Any error in the shadow path is silently swallowed.
 *   - If /api/vertex-shadow returns 404/501 (endpoint not yet deployed), the
 *     entry is recorded as `not_configured` — not as a failure.
 *   - AbortSignal.timeout(30_000) prevents long-hanging shadow calls.
 */

export const VERTEX_SHADOW_KEY = 'vertex_ai_shadow_enabled';
const VERTEX_SHADOW_LOG_KEY = 'vertex_ai_shadow_log';
const MAX_LOG_ENTRIES = 50;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShadowLogEntry {
  /** Unix timestamp (ms) of the Gemini call start. Used as unique key. */
  ts: number;
  /** Model used for the Gemini production call. */
  model: string;
  /** Observed Gemini round-trip latency in ms. */
  geminiLatencyMs: number;
  /** Vertex shadow round-trip latency in ms, or null while pending. */
  vertexLatencyMs: number | null;
  /** Shadow call outcome. */
  vertexStatus: 'pending' | 'ok' | 'error' | 'not_configured';
  /** Error message snippet if status = 'error'. */
  error?: string;
}

export interface ShadowCompareReport {
  /** Number of completed (non-pending) log entries included in the report. */
  sampleSize: number;
  /** Average Gemini latency across sample. */
  geminiAvgLatencyMs: number;
  /** Average Vertex latency for successful calls, or null if no successes. */
  vertexAvgLatencyMs: number | null;
  /** Fraction of shadow calls that returned HTTP 2xx. */
  vertexSuccessRate: number;
  /** Fraction where /api/vertex-shadow returned 404/501 (stub not deployed). */
  vertexNotConfiguredRate: number;
  /** Fraction of shadow calls that resulted in network/HTTP errors. */
  vertexErrorRate: number;
  /** Estimated relative cost indicator. 1.0 = same as Gemini. null = unknown. */
  vertexRelativeCost: number | null;
}

// ─── Feature-flag helpers ─────────────────────────────────────────────────────

export function isVertexShadowEnabled(): boolean {
  try { return localStorage.getItem(VERTEX_SHADOW_KEY) === 'true'; } catch { return false; }
}

export function setVertexShadowEnabled(enabled: boolean): void {
  try { localStorage.setItem(VERTEX_SHADOW_KEY, String(enabled)); } catch { /* ignore */ }
}

// ─── Log helpers ──────────────────────────────────────────────────────────────

export function getShadowLog(): ShadowLogEntry[] {
  try {
    const raw = localStorage.getItem(VERTEX_SHADOW_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ShadowLogEntry[];
  } catch { return []; }
}

export function clearShadowLog(): void {
  try { localStorage.removeItem(VERTEX_SHADOW_LOG_KEY); } catch { /* ignore */ }
}

function appendShadowEntry(entry: ShadowLogEntry): void {
  try {
    const log = getShadowLog();
    log.push(entry);
    if (log.length > MAX_LOG_ENTRIES) log.splice(0, log.length - MAX_LOG_ENTRIES);
    localStorage.setItem(VERTEX_SHADOW_LOG_KEY, JSON.stringify(log));
  } catch { /* ignore */ }
}

function updateShadowEntry(ts: number, updates: Partial<ShadowLogEntry>): void {
  try {
    const log = getShadowLog();
    const idx = log.findIndex(e => e.ts === ts);
    if (idx >= 0) log[idx] = { ...log[idx], ...updates };
    localStorage.setItem(VERTEX_SHADOW_LOG_KEY, JSON.stringify(log));
  } catch { /* ignore */ }
}

// ─── Compare report aggregation ───────────────────────────────────────────────

export function getShadowCompareReport(): ShadowCompareReport {
  const log = getShadowLog().filter(e => e.vertexStatus !== 'pending');
  if (log.length === 0) {
    return {
      sampleSize: 0,
      geminiAvgLatencyMs: 0,
      vertexAvgLatencyMs: null,
      vertexSuccessRate: 0,
      vertexNotConfiguredRate: 0,
      vertexErrorRate: 0,
      vertexRelativeCost: null,
    };
  }

  const geminiLatencies = log.map(e => e.geminiLatencyMs);
  const successEntries  = log.filter(e => e.vertexStatus === 'ok');
  const notConfigured   = log.filter(e => e.vertexStatus === 'not_configured');
  const errorEntries    = log.filter(e => e.vertexStatus === 'error');
  const vertexLatencies = successEntries
    .filter(e => e.vertexLatencyMs !== null)
    .map(e => e.vertexLatencyMs as number);

  const geminiAvg  = Math.round(geminiLatencies.reduce((a, b) => a + b, 0) / log.length);
  const vertexAvg  = vertexLatencies.length > 0
    ? Math.round(vertexLatencies.reduce((a, b) => a + b, 0) / vertexLatencies.length)
    : null;

  // Relative cost estimate: Vertex AI gemini-* models priced ~10% higher than developer API.
  // This is a rough heuristic for the spike report; actual billing requires server-side data.
  const vertexRelativeCost = successEntries.length > 0 ? 1.10 : null;

  // Configured calls = calls where the endpoint was reachable (excludes not_configured stubs).
  // Error rate and success rate are computed only against configured calls so that
  // a 501 stub response (not_configured) does not inflate the error ratio.
  const configuredCalls = log.filter(e => e.vertexStatus !== 'not_configured');
  const configuredCount = configuredCalls.length;

  return {
    sampleSize: log.length,
    geminiAvgLatencyMs: geminiAvg,
    vertexAvgLatencyMs: vertexAvg,
    vertexSuccessRate: configuredCount > 0 ? successEntries.length / configuredCount : 0,
    vertexNotConfiguredRate: notConfigured.length / log.length,
    vertexErrorRate: configuredCount > 0 ? errorEntries.length / configuredCount : 0,
    vertexRelativeCost,
  };
}

// ─── Shadow call executor ─────────────────────────────────────────────────────

/**
 * Fire-and-forget shadow call to the Vertex AI proxy.
 * NEVER throws — all errors are silently swallowed.
 *
 * @param model         The production model that was used.
 * @param contents      Normalised request contents (already normalised by callGeminiProxy).
 * @param geminiLatencyMs  Observed latency of the completed Gemini call.
 * @param token         Firebase auth token from the same request context.
 */
export async function runVertexShadow(
  model: string,
  contents: unknown,
  geminiLatencyMs: number,
  token: string,
): Promise<void> {
  const ts = Date.now();
  appendShadowEntry({
    ts,
    model,
    geminiLatencyMs,
    vertexLatencyMs: null,
    vertexStatus: 'pending',
  });

  const start = performance.now();
  try {
    const response = await fetch('/api/vertex-shadow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ model, contents }),
      signal: AbortSignal.timeout(30_000),
    });

    const vertexLatencyMs = Math.round(performance.now() - start);

    if (response.status === 404 || response.status === 501) {
      // Vertex proxy not yet deployed — expected during spike phase
      updateShadowEntry(ts, { vertexLatencyMs, vertexStatus: 'not_configured' });
      return;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => `HTTP ${response.status}`);
      updateShadowEntry(ts, {
        vertexLatencyMs,
        vertexStatus: 'error',
        error: errText.slice(0, 200),
      });
      return;
    }

    updateShadowEntry(ts, { vertexLatencyMs, vertexStatus: 'ok' });
  } catch (err: unknown) {
    const vertexLatencyMs = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    updateShadowEntry(ts, {
      vertexLatencyMs,
      vertexStatus: 'error',
      error: message.slice(0, 200),
    });
  }
}
