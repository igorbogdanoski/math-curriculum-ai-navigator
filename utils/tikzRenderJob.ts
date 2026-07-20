/**
 * 2026-07-20 (Wave 10). Runs one TikZ→SVG compile in a fully isolated, disposable DOM
 * container appended to `stagingRoot`. TikZJax has no promise-based render API (see
 * tikzjaxLoader.ts) — it auto-processes `<script type="text/tikz">` elements in place and
 * replaces them with an `<svg>` on success, or leaves them untouched on failure (confirmed
 * empirically; the library doesn't surface a catchable JS error to the host page).
 *
 * Each call gets its own container so concurrent/overlapping jobs (rapid edits outrunning a
 * slow previous compile) can never read or interfere with each other's DOM — job identity is
 * the container itself, not a returned id. Callers that need to discard stale results (e.g. an
 * older, slower job resolving after a newer one) do that with their own job-counter, since this
 * function is otherwise unaware of "newer"/"older".
 */
import { ensureTikzJaxLoaded } from './tikzjaxLoader';

export interface TikzRenderResult {
  ok: boolean;
  svg?: string;
}

const POLL_INTERVAL_MS = 300;
const DEFAULT_TIMEOUT_MS = 20000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function renderTikzToContainer(
  code: string,
  stagingRoot: HTMLElement,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<TikzRenderResult> {
  await ensureTikzJaxLoaded();

  const container = document.createElement('div');
  stagingRoot.appendChild(container);

  const scriptEl = document.createElement('script');
  scriptEl.setAttribute('type', 'text/tikz');
  scriptEl.textContent = code;
  container.appendChild(scriptEl);

  const deadline = Date.now() + timeoutMs;
  let result: TikzRenderResult = { ok: false };

  while (Date.now() < deadline) {
    const stillPending = container.querySelector('script[type="text/tikz"]') !== null;
    const isLoading = container.querySelector('.tikzjax-loading') !== null;
    if (!stillPending && !isLoading) {
      const svgEl = container.querySelector('svg');
      if (svgEl) {
        result = { ok: true, svg: svgEl.outerHTML };
      }
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  container.remove();
  return result;
}
