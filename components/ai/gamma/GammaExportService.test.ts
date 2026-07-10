import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AIGeneratedPresentation } from '../../../types';

const { pptxSlides } = vi.hoisted(() => ({ pptxSlides: [] as { calls: unknown[][] }[] }));

vi.mock('pptxgenjs', () => {
  class FakeSlide {
    calls: unknown[][] = [];
    background: unknown;
    addShape(...args: unknown[]) { this.calls.push(['addShape', ...args]); }
    addText(...args: unknown[]) { this.calls.push(['addText', ...args]); }
    addImage(...args: unknown[]) { this.calls.push(['addImage', ...args]); }
    addNotes(...args: unknown[]) { this.calls.push(['addNotes', ...args]); }
  }
  class FakePptx {
    layout = '';
    addSlide() {
      const s = new FakeSlide();
      pptxSlides.push(s);
      return s;
    }
    async writeFile() { /* no-op */ }
  }
  return { default: FakePptx };
});

vi.mock('../presentation/presentationMathUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../presentation/presentationMathUtils')>();
  return {
    ...actual,
    renderBulletToImg: vi.fn(async (text: string) => ({ data: `data:image/svg+xml;base64,MOCK_${encodeURIComponent(text)}`, ratio: 0.4 })),
    resolveImgRatio: vi.fn(async (entry: { ratio?: number }) => entry.ratio ?? 0.4),
  };
});

import { exportGammaPPTX, printGammaHandout } from './GammaExportService';

const OPTIONS = { isPro: false, logoUrl: null, schoolName: null };

const basePresentation = (slides: AIGeneratedPresentation['slides']): AIGeneratedPresentation => ({
  title: 'Квадратни равенки',
  topic: 'Квадратни равенки',
  gradeLevel: 8,
  slides,
});

describe('exportGammaPPTX — math-aware export', () => {
  beforeEach(() => {
    pptxSlides.length = 0;
    vi.clearAllMocks();
  });

  it('renders a formula-centered slide as an embedded image, not raw LaTeX text', async () => {
    const data = basePresentation([
      { type: 'formula-centered', title: 'Формула', content: ['$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$'] },
    ]);
    const onSuccess = vi.fn();
    const onError = vi.fn();

    await exportGammaPPTX(data, OPTIONS, onSuccess, onError);

    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
    expect(pptxSlides).toHaveLength(1);

    const calls = pptxSlides[0].calls;
    const imageCalls = calls.filter(c => c[0] === 'addImage');
    expect(imageCalls.length).toBeGreaterThan(0);

    // The raw LaTeX source must never be written as literal PPTX text (the old bug).
    const rawLatexAsText = calls.some(
      c => c[0] === 'addText' && typeof c[1] === 'string' && c[1].includes('\\frac'),
    );
    expect(rawLatexAsText).toBe(false);
  });

  it('leaves plain-text slides (no LaTeX) rendered as normal PPTX text', async () => {
    const data = basePresentation([
      { type: 'content', title: 'Вовед', content: ['Прв факт', 'Втор факт'] },
    ]);

    await exportGammaPPTX(data, OPTIONS, vi.fn(), vi.fn());

    const calls = pptxSlides[0].calls;
    const imageCalls = calls.filter(c => c[0] === 'addImage');
    expect(imageCalls).toHaveLength(0);
    const hasBulletText = calls.some(c => c[0] === 'addText' && typeof c[1] === 'string' && c[1].includes('Прв факт'));
    expect(hasBulletText).toBe(true);
  });
});

describe('printGammaHandout — math-aware handout', () => {
  let writtenHtml: string;

  beforeEach(() => {
    writtenHtml = '';
    vi.clearAllMocks();
    vi.spyOn(window, 'open').mockReturnValue({
      document: {
        write: (html: string) => { writtenHtml = html; },
        close: () => { /* no-op */ },
      },
    } as unknown as Window);
  });

  it('embeds an image for formula content instead of the old "[формула]" placeholder', async () => {
    const data = basePresentation([
      { type: 'content', title: 'Задача', content: ['Реши: $2x + 3 = 7$'] },
    ]);

    await printGammaHandout(data);

    expect(writtenHtml).toContain('<img');
    expect(writtenHtml).not.toContain('[формула]');
  });

  it('does not touch plain-text slides beyond normal HTML rendering', async () => {
    const data = basePresentation([
      { type: 'content', title: 'Вовед', content: ['Прв факт без формула'] },
    ]);

    await printGammaHandout(data);

    expect(writtenHtml).toContain('Прв факт без формула');
    expect(writtenHtml).not.toContain('<img');
  });
});
