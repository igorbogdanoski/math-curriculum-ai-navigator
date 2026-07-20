/**
 * scripts/spike-test-tikz-templates.ts — Wave 16.2 (drifting-snuggling-wave.md).
 *
 * Formalizes the manual Playwright-spike-test workflow used throughout Wave 10/16 template
 * authoring: loads every template in data/tikzTemplates.ts through a real browser + the real
 * CDN-hosted @rod2ik/tikzjax runtime, and confirms each one actually compiles to real SVG
 * content — not just "looks like valid TikZ." A hand-written template that "looks correct"
 * has repeatedly turned out not to compile (missing \usetikzlibrary, a typo'd coordinate,
 * wrong library support) — this is the same check done manually per-template before, now
 * repeatable for a whole batch at once.
 *
 * Run manually: `npm run tikz:test-templates`. NOT wired into CI/build — needs real network
 * access to jsDelivr and a real browser, both unsuitable for every CI run or build.
 */
import { chromium } from '@playwright/test';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { tikzTemplates } from '../data/tikzTemplates';
import { TIKZJAX_VERSION } from '../utils/tikzjaxLoader';

const CDN_BASE = `https://cdn.jsdelivr.net/npm/@rod2ik/tikzjax@${TIKZJAX_VERSION}/dist`;
const PER_TEMPLATE_TIMEOUT_MS = 30000;
const POLL_INTERVAL_MS = 400;

function buildHtml(): string {
  const containers = tikzTemplates
    .map(tpl => `<div class="box" id="${tpl.id}"><h3>${tpl.id}</h3><script type="text/tikz">\n${tpl.code}\n</script></div>`)
    .join('\n');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<script>
window.TikzJaxOptions = {
  renderTimeout: 30000,
  maxRetries: 1,
  restartWorkerOnFail: true,
  workerPool: { enabled: true, maxWorkers: 4, reserveCpuCores: 1, useDeviceMemory: true, initializationRetries: 1 }
};
</script>
<link rel="stylesheet" href="${CDN_BASE}/fonts.min.css">
<script src="${CDN_BASE}/tikzjax.min.js" defer></script>
<style>body{background:#fff} .box{border:1px solid #ccc;margin:10px;padding:10px;display:inline-block}</style>
</head>
<body>
${containers}
</body>
</html>`;
}

async function startServer(html: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
  await new Promise<void>(resolve => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://localhost:${port}/`,
    close: () => new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve()))),
  };
}

async function main() {
  if (tikzTemplates.length === 0) {
    console.log('No templates in data/tikzTemplates.ts — nothing to test.');
    return;
  }

  const html = buildHtml();
  const { url, close } = await startServer(html);
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const results: { id: string; ok: boolean }[] = [];

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });

    for (const tpl of tikzTemplates) {
      const deadline = Date.now() + PER_TEMPLATE_TIMEOUT_MS;
      let ok = false;
      while (Date.now() < deadline) {
        const stillPending = await page.locator(`#${tpl.id} script[type="text/tikz"]`).count();
        const isLoading = await page.locator(`#${tpl.id} .tikzjax-loading`).count();
        if (stillPending === 0 && isLoading === 0) {
          const hasDrawContent = await page.locator(`#${tpl.id} svg path, #${tpl.id} svg g[stroke]`).count();
          ok = hasDrawContent > 0;
          break;
        }
        await page.waitForTimeout(POLL_INTERVAL_MS);
      }
      results.push({ id: tpl.id, ok });
      console.log(`${ok ? '✓' : '✗'} ${tpl.id}`);
    }
  } finally {
    await browser.close();
    await close();
  }

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} templates compiled successfully.`);
  if (failed.length > 0) {
    console.error(`FAILED: ${failed.map(f => f.id).join(', ')}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
