/**
 * 2026-07-20 (Wave 10). Lazy-loads @rod2ik/tikzjax from a pinned jsDelivr CDN URL — never
 * bundled into our own build (see feedback_manualchunks.md discipline), and never fetched
 * until TikzLab actually mounts. Pinned version (not @latest) for cache stability: jsDelivr
 * serves versioned URLs with immutable far-future caching, so a returning visitor never
 * re-downloads it once cached, matching what a self-hosted `Cache-Control: immutable` setup
 * would achieve — without us having to vendor and update ~7MB of WASM/font/TeX-package assets.
 *
 * TikZJax's own integration model is DOM-based, not a promise-returning JS API: it auto-scans
 * for `<script type="text/tikz">` elements (both present at load time AND inserted afterward —
 * confirmed empirically, since this isn't documented) and replaces each with an inline `<svg>`.
 * TikzLab.tsx drives it by inserting one such script per render into an isolated container and
 * polling that container for the result — see the job-isolation comment there for why.
 */

const TIKZJAX_VERSION = '1.2.0';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@${TIKZJAX_VERSION}/dist`;

declare global {
  interface Window {
    TikzJaxOptions?: {
      renderTimeout?: number;
      maxRetries?: number;
      restartWorkerOnFail?: boolean;
      workerPool?: {
        enabled?: boolean;
        maxWorkers?: number;
        reserveCpuCores?: number;
        useDeviceMemory?: boolean;
        initializationRetries?: number;
      };
    };
  }
}

let loadPromise: Promise<void> | null = null;

export function ensureTikzJaxLoaded(): Promise<void> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    // Must be set before tikzjax.min.js executes, since it reads this synchronously on load.
    window.TikzJaxOptions = {
      renderTimeout: 30000,
      maxRetries: 1,
      restartWorkerOnFail: true,
      workerPool: {
        enabled: true,
        maxWorkers: 3,
        reserveCpuCores: 1,
        useDeviceMemory: true,
        initializationRetries: 1,
      },
    };

    if (!document.querySelector('link[data-tikzjax-fonts]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${CDN_BASE}/fonts.min.css`;
      link.setAttribute('data-tikzjax-fonts', 'true');
      document.head.appendChild(link);
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-tikzjax-core]');
    if (existing) {
      // Already injected by an earlier mount (e.g. tab switched away and back) — the script
      // itself only ever runs once regardless, so just resolve.
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `${CDN_BASE}/tikzjax.min.js`;
    script.defer = true;
    script.setAttribute('data-tikzjax-core', 'true');
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null; // allow a retry on the next mount
      reject(new Error('Failed to load TikZJax from CDN'));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
