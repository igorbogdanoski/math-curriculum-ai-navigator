import { logger } from '../../../utils/logger';
import { AIGeneratedPresentation } from '../../../types';

export interface GammaExportOptions {
  isPro: boolean;
  logoUrl: string | null;
  schoolName: string | null;
}

export async function exportGammaPPTX(
  data: AIGeneratedPresentation,
  options: GammaExportOptions,
  onSuccess: (msg: string) => void,
  onError: (msg: string) => void,
): Promise<void> {
  const { isPro, logoUrl, schoolName } = options;

  try {
    const { default: pptxgen } = await import('pptxgenjs');
    const pptx = new pptxgen();
    pptx.layout = 'LAYOUT_16x9';
    const W = 10; // inches

    // Dark Gamma theme
    const BG    = '0F172A';
    const TITLE = 'A5B4FC';
    const BODY  = 'CBD5E1';
    const LINE  = '3730A3';
    const ACCT  = '818CF8';

    const footerText = isPro && schoolName ? schoolName : 'ai.mismath.net';

    for (let i = 0; i < data.slides.length; i++) {
      const slide = data.slides[i];
      const pptSlide = pptx.addSlide();
      pptSlide.background = { color: BG };

      // ── Header bar ──
      pptSlide.addShape('rect', { x: 0, y: 0, w: W, h: 0.55, fill: { color: '1E1B4B' } });
      pptSlide.addText(slide.title ?? '', {
        x: 0.3, y: 0.05, w: W - 2, h: 0.45,
        fontSize: 14, bold: true, color: TITLE, fontFace: 'Arial',
      });
      pptSlide.addText(`${i + 1} / ${data.slides.length}`, {
        x: W - 1.5, y: 0.05, w: 1.2, h: 0.45,
        fontSize: 11, color: '6366F1', align: 'right', fontFace: 'Arial',
      });

      const contentY = 0.75;
      const contentH = 4.35;
      const lineH    = 0.44;

      if (slide.type === 'title') {
        pptSlide.addText(slide.title ?? '', {
          x: 0.5, y: 1.5, w: W - 1, h: 1.4,
          fontSize: 40, bold: true, color: TITLE, align: 'center', fontFace: 'Arial',
        });
        if (slide.content.length > 0) {
          pptSlide.addText(slide.content.join('\n'), {
            x: 0.5, y: 3.1, w: W - 1, h: 1.2,
            fontSize: 18, color: BODY, align: 'center', fontFace: 'Arial',
          });
        }
        pptSlide.addText(`${data.topic} · ${data.gradeLevel}. одделение`, {
          x: 0.5, y: 4.4, w: W - 1, h: 0.4,
          fontSize: 12, color: ACCT, align: 'center', fontFace: 'Arial',
        });

      } else if (slide.type === 'formula-centered') {
        pptSlide.addShape('roundRect', {
          x: 1.0, y: contentY + 0.4, w: W - 2, h: 1.6,
          fill: { color: '1E1B4B' }, line: { color: LINE, width: 2 },
        });
        pptSlide.addText(slide.content[0] ?? slide.title ?? '', {
          x: 1.0, y: contentY + 0.6, w: W - 2, h: 1.2,
          fontSize: 24, bold: true, color: TITLE, align: 'center', fontFace: 'Courier New',
        });
        let noteY = contentY + 2.3;
        for (const note of slide.content.slice(1)) {
          pptSlide.addText(`• ${note}`, { x: 1.0, y: noteY, w: W - 2, h: lineH, fontSize: 14, color: BODY, fontFace: 'Arial' });
          noteY += lineH;
          if (noteY > contentY + contentH) break;
        }

      } else if (slide.type === 'step-by-step' || slide.type === 'proof') {
        let curY = contentY;
        slide.content.forEach((step, si) => {
          pptSlide.addShape('roundRect', {
            x: 0.4, y: curY, w: 0.5, h: 0.36,
            fill: { color: si === 0 ? '4F46E5' : '1E1B4B' }, line: { color: LINE, width: 1 },
          });
          pptSlide.addText(String(si + 1), { x: 0.4, y: curY + 0.02, w: 0.5, h: 0.32, fontSize: 11, bold: true, color: 'FFFFFF', align: 'center' });
          pptSlide.addText(step, { x: 1.1, y: curY, w: W - 1.5, h: lineH, fontSize: 14, color: BODY, fontFace: 'Arial' });
          curY += lineH + 0.04;
          if (curY > contentY + contentH) return;
        });

      } else if (slide.type === 'task' || slide.type === 'example') {
        const isTask   = slide.type === 'task';
        const boxColor = isTask ? '451A03' : '052E16';
        const lblColor = isTask ? 'FCD34D' : '6EE7B7';
        pptSlide.addShape('roundRect', {
          x: 0.5, y: contentY, w: W - 1, h: 2.2,
          fill: { color: boxColor }, line: { color: isTask ? '92400E' : '065F46', width: 1.5 },
        });
        pptSlide.addText(isTask ? '📝 Задача' : '💡 Пример', {
          x: 0.8, y: contentY + 0.15, w: 3, h: 0.35, fontSize: 11, bold: true, color: lblColor,
        });
        pptSlide.addText(slide.content[0] ?? '', {
          x: 0.8, y: contentY + 0.55, w: W - 1.6, h: 1.5, fontSize: 15, color: '#E2E8F0', fontFace: 'Arial', wrap: true,
        });
        if (slide.solution && slide.solution.length > 0) {
          let solY = contentY + 2.45;
          pptSlide.addText('Решение:', { x: 0.5, y: solY, w: 2, h: 0.32, fontSize: 11, bold: true, color: '6EE7B7' });
          solY += 0.34;
          for (const sol of slide.solution) {
            pptSlide.addText(`• ${sol}`, { x: 0.5, y: solY, w: W - 1, h: lineH, fontSize: 13, color: BODY, fontFace: 'Arial' });
            solY += lineH;
            if (solY > 5.1) break;
          }
        }

      } else {
        let curY = contentY;
        for (const line of slide.content) {
          pptSlide.addShape('ellipse', { x: 0.4, y: curY + 0.14, w: 0.12, h: 0.12, fill: { color: ACCT } });
          pptSlide.addText(line, { x: 0.65, y: curY, w: W - 1.1, h: lineH, fontSize: 15, color: BODY, fontFace: 'Arial' });
          curY += lineH + 0.04;
          if (curY > contentY + contentH) break;
        }
      }

      pptSlide.addNotes([
        `Слајд ${i + 1}/${data.slides.length}: ${slide.title ?? ''}`,
        slide.speakerNotes ?? '',
        `Тема: ${data.topic} | Генерирано со Math Navigator AI (Gamma Mode)`,
      ].filter(Boolean).join('\n'));

      pptSlide.addShape('line', { x: 0, y: 5.38, w: W, h: 0, line: { color: LINE, width: 0.75 } });
      if (isPro && logoUrl) {
        try { pptSlide.addImage({ path: logoUrl, x: 0.2, y: 5.41, w: 0.6, h: 0.18 }); } catch { /* ignore */ }
      }
      pptSlide.addText(footerText, {
        x: isPro && logoUrl ? 0.9 : 0.3, y: 5.41, w: W - 1, h: 0.2,
        fontSize: 8, color: isPro ? ACCT : '475569', fontFace: 'Arial', italic: !isPro,
      });
      pptSlide.addText(`${data.topic} · ${data.gradeLevel}. одд.`, {
        x: W - 3.5, y: 5.41, w: 3.2, h: 0.2, fontSize: 8, color: '475569', align: 'right',
      });
    }

    const safeTitle = data.title.replace(/\s+/g, '_').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 80) || 'gamma';
    await pptx.writeFile({ fileName: `${safeTitle}_gamma.pptx` });
    onSuccess('PPTX успешно зачуван! ✅');
  } catch (err) {
    logger.error('[Gamma PPTX]', err);
    onError('Грешка при генерирање на PPTX.');
  }
}
