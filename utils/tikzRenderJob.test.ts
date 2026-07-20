/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./tikzjaxLoader', () => ({
  ensureTikzJaxLoaded: vi.fn().mockResolvedValue(undefined),
}));

import { renderTikzToContainer } from './tikzRenderJob';

describe('renderTikzToContainer', () => {
  let stagingRoot: HTMLDivElement;

  beforeEach(() => {
    stagingRoot = document.createElement('div');
    document.body.appendChild(stagingRoot);
  });

  it('resolves ok:true with the svg once the script tag is replaced', async () => {
    const promise = renderTikzToContainer('\\begin{tikzpicture}\\end{tikzpicture}', stagingRoot, 5000);

    // Simulate TikZJax's own DOM mutation: replace the <script type="text/tikz"> with an <svg>.
    await new Promise(r => setTimeout(r, 50));
    const scriptEl = stagingRoot.querySelector('script[type="text/tikz"]');
    expect(scriptEl).not.toBeNull();
    scriptEl!.outerHTML = '<svg><path d="M0,0" /></svg>';

    const result = await promise;
    expect(result.ok).toBe(true);
    expect(result.svg).toContain('<svg>');
  });

  it('resolves ok:false when the timeout elapses with the script tag still unprocessed', async () => {
    const result = await renderTikzToContainer('\\ThisCommandDoesNotExist', stagingRoot, 400);
    expect(result.ok).toBe(false);
    expect(result.svg).toBeUndefined();
  });

  it('cleans up its own container from stagingRoot after resolving, success or not', async () => {
    expect(stagingRoot.children.length).toBe(0);
    const promise = renderTikzToContainer('\\begin{tikzpicture}\\end{tikzpicture}', stagingRoot, 5000);
    await new Promise(r => setTimeout(r, 50));
    expect(stagingRoot.children.length).toBe(1); // the job's own container, mid-flight

    const scriptEl = stagingRoot.querySelector('script[type="text/tikz"]')!;
    scriptEl.outerHTML = '<svg><path d="M0,0" /></svg>';
    await promise;

    expect(stagingRoot.children.length).toBe(0);
  });

  it('never lets two concurrent jobs read or interfere with each other\'s DOM', async () => {
    // Job A is slow (never resolves within the window we check); Job B is fast.
    const jobA = renderTikzToContainer('\\SlowDiagram', stagingRoot, 5000);
    const jobB = renderTikzToContainer('\\FastDiagram', stagingRoot, 5000);

    await new Promise(r => setTimeout(r, 50));
    // Two independent containers should exist, each with its own pending script tag.
    expect(stagingRoot.children.length).toBe(2);
    const scripts = stagingRoot.querySelectorAll('script[type="text/tikz"]');
    expect(scripts.length).toBe(2);
    expect(scripts[0].textContent).toBe('\\SlowDiagram');
    expect(scripts[1].textContent).toBe('\\FastDiagram');

    // Only resolve Job B's container.
    scripts[1].outerHTML = '<svg><path d="B" /></svg>';
    const resultB = await jobB;
    expect(resultB.ok).toBe(true);
    expect(resultB.svg).toContain('B');

    // Job A's container is untouched and still pending — resolve it too, to let the test end cleanly.
    const remainingScript = stagingRoot.querySelector('script[type="text/tikz"]');
    expect(remainingScript?.textContent).toBe('\\SlowDiagram');
    remainingScript!.outerHTML = '<svg><path d="A" /></svg>';
    const resultA = await jobA;
    expect(resultA.svg).toContain('A');
  });
});
