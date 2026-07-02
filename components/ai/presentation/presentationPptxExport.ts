import { logger } from '../../../utils/logger';
import type { AIGeneratedPresentation, PresentationSlide } from '../../../types';
import { HAS_MATH, renderBulletToImg, resolveImgRatio, getPptxgen } from './presentationMathUtils';

type Theme = 'modern' | 'classic' | 'dark' | 'creative';

const THEMES: Record<Theme, { bg: string; title: string; body: string; line: string }> = {
  modern:   { bg: 'FFFFFF', title: '0D47A1', body: '333333', line: 'BBDEFB' },
  classic:  { bg: 'F5F5F5', title: '1A1A1A', body: '222222', line: 'CCCCCC' },
  dark:     { bg: '1A237E', title: 'FFFFFF', body: 'E0E0E0', line: '3949AB' },
  creative: { bg: 'FFF9C4', title: 'E65100', body: '424242', line: 'FFE082' },
};

export async function downloadPresentationPPTX({
  data,
  theme,
  visuals,
  setIsExportingPptx,
  setPptxProgress,
  addNotification,
}: {
  data: AIGeneratedPresentation;
  theme: Theme;
  visuals: Record<number, { loading: boolean; url?: string }>;
  setIsExportingPptx: (v: boolean) => void;
  setPptxProgress: (v: number) => void;
  addNotification: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}): Promise<void> {
  setIsExportingPptx(true);
  setPptxProgress(0);
  addNotification('Генерирам PPTX — формулите се рендерираат…', 'info');
  try {
    const PptxGen = await getPptxgen();
    const pptx = new PptxGen();
    pptx.layout = 'LAYOUT_16x9';
    const SLIDE_W = 10;
    const colors = THEMES[theme];

    const MAX_BULLETS_PER_SLIDE = 5;
    const SPLITTABLE = new Set(['content', 'summary', 'comparison', 'proof']);
    const normalizedSlides: PresentationSlide[] = data.slides.flatMap(slide => {
      if (!SPLITTABLE.has(slide.type ?? 'content') || slide.content.length <= MAX_BULLETS_PER_SLIDE) return [slide];
      const chunks: PresentationSlide[] = [];
      for (let i = 0; i < slide.content.length; i += MAX_BULLETS_PER_SLIDE) {
        chunks.push({ ...slide, content: slide.content.slice(i, i + MAX_BULLETS_PER_SLIDE) });
      }
      return chunks;
    });

    type MathKey = string;
    const mathJobs = new Map<MathKey, { text: string; color: string }>();
    for (const slide of normalizedSlides) {
      if (slide.type === 'formula-centered' && slide.content[0] && HAS_MATH.test(slide.content[0])) {
        const k = `${slide.content[0]}::${colors.title}`;
        if (!mathJobs.has(k)) mathJobs.set(k, { text: slide.content[0], color: colors.title });
      }
      if (slide.type === 'step-by-step') {
        for (const s of slide.content) {
          if (HAS_MATH.test(s)) { const k = `${s}::${colors.body}`; if (!mathJobs.has(k)) mathJobs.set(k, { text: s, color: colors.body }); }
        }
      }
      if (slide.type === 'proof') {
        for (const s of slide.content) {
          if (HAS_MATH.test(s)) { const k = `${s}::${colors.body}`; if (!mathJobs.has(k)) mathJobs.set(k, { text: s, color: colors.body }); }
        }
      } else if (slide.type !== 'title' && slide.type !== 'formula-centered' && slide.type !== 'step-by-step') {
        for (const b of [...slide.content, ...(slide.rightContent ?? [])]) {
          if (HAS_MATH.test(b)) { const k = `• ${b}::${colors.body}`; if (!mathJobs.has(k)) mathJobs.set(k, { text: `• ${b}`, color: colors.body }); }
        }
      }
    }

    const mathImgMap = new Map<MathKey, { data: string; ratio?: number }>();
    await Promise.all(
      Array.from(mathJobs.entries()).map(async ([k, { text, color }]) => {
        try { mathImgMap.set(k, await renderBulletToImg(text, color)); } catch { /* key absent = fallback to text */ }
      }),
    );

    for (let idx = 0; idx < normalizedSlides.length; idx++) {
      const slide: PresentationSlide = normalizedSlides[idx];
      const slideVisual = visuals[idx];
      const pptSlide = pptx.addSlide();
      pptSlide.background = { color: colors.bg };
      setPptxProgress(Math.round(((idx + 1) / normalizedSlides.length) * 100));

      if (slide.type === 'title') {
        pptSlide.addText(slide.title, { x: 0.5, y: 1.4, w: SLIDE_W - 1, h: 1.6, fontSize: 44, bold: true, color: colors.title, align: 'center', fontFace: 'Arial' });
        pptSlide.addText(data.topic, { x: 0.5, y: 3.2, w: SLIDE_W - 1, h: 0.6, fontSize: 24, color: colors.body, align: 'center' });
      } else if (slide.type === 'formula-centered') {
        pptSlide.addText(slide.title, { x: 0.4, y: 0.25, w: SLIDE_W - 0.8, h: 0.75, fontSize: 28, bold: true, color: colors.title, fontFace: 'Arial' });
        pptSlide.addShape('line', { x: 0.4, y: 1.05, w: SLIDE_W - 0.8, h: 0, line: { color: colors.line, width: 1.5 } });
        const [mainFormula, ...notes] = slide.content;
        if (mainFormula) {
          const boxX = 1.0, boxY = 1.3, boxW = SLIDE_W - 2, boxH = 1.8;
          pptSlide.addShape('roundRect', { x: boxX, y: boxY, w: boxW, h: boxH, fill: { color: theme === 'dark' ? '1a1a5e' : 'EEF2FF' }, line: { color: colors.line, width: 2 } });
          if (HAS_MATH.test(mainFormula)) {
            const entry = mathImgMap.get(`${mainFormula}::${colors.title}`);
            let formulaAdded = false;
            if (entry) {
              try {
                const ratio = await resolveImgRatio(entry);
                const imgW = Math.min(boxW - 0.4, 6.5);
                const imgH = Math.min(imgW * ratio, boxH - 0.2);
                pptSlide.addImage({ data: entry.data, x: boxX + (boxW - imgW) / 2, y: boxY + (boxH - imgH) / 2, w: imgW, h: imgH });
                formulaAdded = true;
              } catch { /* fall through */ }
            }
            if (!formulaAdded) {
              pptSlide.addText(mainFormula, { x: boxX, y: boxY + 0.4, w: boxW, h: boxH - 0.8, fontSize: 22, bold: true, color: colors.title, align: 'center', fontFace: 'Arial' });
            }
          } else {
            pptSlide.addText(mainFormula, { x: boxX, y: boxY + 0.4, w: boxW, h: boxH - 0.8, fontSize: 22, bold: true, color: colors.title, align: 'center', fontFace: 'Arial' });
          }
        }
        let noteY = 3.3;
        for (const note of notes) {
          pptSlide.addText(`• ${note}`, { x: 1.0, y: noteY, w: SLIDE_W - 2, h: 0.42, fontSize: 14, color: colors.body, fontFace: 'Arial' });
          noteY += 0.44;
          if (noteY > 5.0) break;
        }
      } else if (slide.type === 'step-by-step') {
        pptSlide.addText(slide.title, { x: 0.4, y: 0.25, w: SLIDE_W - 0.8, h: 0.75, fontSize: 28, bold: true, color: colors.title, fontFace: 'Arial' });
        pptSlide.addShape('line', { x: 0.4, y: 1.05, w: SLIDE_W - 0.8, h: 0, line: { color: colors.line, width: 1.5 } });
        const stepColors = ['0D47A1', '1565C0', '1976D2', '1E88E5', '2196F3', '42A5F5', '64B5F6', '90CAF9'];
        let stepY = 1.15;
        const stepH = 0.55;
        for (let si = 0; si < slide.content.length; si++) {
          const stepText = slide.content[si];
          const badgeColor = stepColors[si % stepColors.length];
          pptSlide.addShape('ellipse', { x: 0.4, y: stepY + 0.04, w: 0.38, h: 0.38, fill: { color: badgeColor } });
          pptSlide.addText(`${si + 1}`, { x: 0.4, y: stepY + 0.04, w: 0.38, h: 0.38, fontSize: 13, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
          if (HAS_MATH.test(stepText)) {
            const entry = mathImgMap.get(`${stepText}::${colors.body}`);
            let stepAdded = false;
            if (entry) {
              try {
                const ratio = await resolveImgRatio(entry);
                const imgW = Math.min(SLIDE_W - 1.2, 7.5);
                const imgH = Math.min(imgW * ratio, stepH + 0.1);
                pptSlide.addImage({ data: entry.data, x: 0.9, y: stepY, w: imgW, h: imgH });
                stepY += imgH + 0.1;
                stepAdded = true;
              } catch { /* fall through */ }
            }
            if (!stepAdded) { pptSlide.addText(stepText, { x: 0.9, y: stepY, w: SLIDE_W - 1.3, h: stepH, fontSize: 15, color: colors.body, fontFace: 'Arial' }); stepY += stepH; }
          } else { pptSlide.addText(stepText, { x: 0.9, y: stepY, w: SLIDE_W - 1.3, h: stepH, fontSize: 15, color: colors.body, fontFace: 'Arial' }); stepY += stepH; }
          if (stepY > 5.0) break;
        }
        const progressW = (SLIDE_W - 0.8) * Math.min(slide.content.length, 8) / 8;
        pptSlide.addShape('rect', { x: 0.4, y: 5.1, w: SLIDE_W - 0.8, h: 0.06, fill: { color: colors.line } });
        pptSlide.addShape('rect', { x: 0.4, y: 5.1, w: progressW, h: 0.06, fill: { color: colors.title } });
      } else if (slide.type === 'proof') {
        pptSlide.addText(slide.title, { x: 0.4, y: 0.25, w: SLIDE_W - 0.8, h: 0.75, fontSize: 28, bold: true, color: colors.title, fontFace: 'Arial' });
        pptSlide.addShape('line', { x: 0.4, y: 1.05, w: SLIDE_W - 0.8, h: 0, line: { color: colors.line, width: 1.5 } });
        const stepColors = ['0D47A1', '1565C0', '1976D2', '1E88E5', '2196F3', '42A5F5'];
        let proofY = 1.15;
        const proofH = 0.52;
        for (let si = 0; si < slide.content.length; si++) {
          const stepText = slide.content[si];
          pptSlide.addShape('ellipse', { x: 0.4, y: proofY + 0.07, w: 0.35, h: 0.35, fill: { color: stepColors[si % stepColors.length] } });
          pptSlide.addText(`${si + 1}`, { x: 0.4, y: proofY + 0.07, w: 0.35, h: 0.35, fontSize: 12, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' });
          const entry = HAS_MATH.test(stepText) ? mathImgMap.get(`${stepText}::${colors.body}`) : undefined;
          let added = false;
          if (entry) {
            try {
              const ratio = await resolveImgRatio(entry);
              const imgW = Math.min(SLIDE_W - 1.2, 7.5);
              const imgH = Math.min(imgW * ratio, proofH + 0.1);
              pptSlide.addImage({ data: entry.data, x: 0.9, y: proofY, w: imgW, h: imgH });
              proofY += imgH + 0.1; added = true;
            } catch { /* fall through */ }
          }
          if (!added) { pptSlide.addText(stepText, { x: 0.9, y: proofY, w: SLIDE_W - 1.3, h: proofH, fontSize: 15, color: colors.body, fontFace: 'Arial' }); proofY += proofH; }
          if (proofY > 4.8) break;
        }
        pptSlide.addText('Q.E.D.  □', { x: SLIDE_W - 2.0, y: 5.0, w: 1.6, h: 0.35, fontSize: 14, bold: true, color: colors.title, align: 'right', fontFace: 'Arial' });
      } else if (slide.type === 'comparison') {
        pptSlide.addText(slide.title, { x: 0.4, y: 0.25, w: SLIDE_W - 0.8, h: 0.75, fontSize: 28, bold: true, color: colors.title, fontFace: 'Arial' });
        pptSlide.addShape('line', { x: 0.4, y: 1.05, w: SLIDE_W - 0.8, h: 0, line: { color: colors.line, width: 1.5 } });
        const colW = (SLIDE_W - 1.0) / 2 - 0.1;
        const leftX = 0.4, rightX = leftX + colW + 0.4;
        pptSlide.addShape('rect', { x: leftX, y: 1.1, w: colW, h: 0.38, fill: { color: colors.line } });
        pptSlide.addText(slide.content[0] ?? '', { x: leftX, y: 1.1, w: colW, h: 0.38, fontSize: 13, bold: true, color: colors.title, align: 'center', valign: 'middle' });
        pptSlide.addShape('rect', { x: rightX, y: 1.1, w: colW, h: 0.38, fill: { color: colors.line } });
        pptSlide.addText((slide.rightContent ?? [])[0] ?? '', { x: rightX, y: 1.1, w: colW, h: 0.38, fontSize: 13, bold: true, color: colors.title, align: 'center', valign: 'middle' });
        pptSlide.addText('VS', { x: leftX + colW + 0.05, y: 2.2, w: 0.3, h: 0.4, fontSize: 12, bold: true, color: colors.line, align: 'center' });
        const leftItems  = slide.content.slice(1);
        const rightItems = (slide.rightContent ?? []).slice(1);
        const maxRows = Math.max(leftItems.length, rightItems.length);
        let rowY = 1.55;
        for (let ri = 0; ri < maxRows && rowY < 5.0; ri++) {
          if (leftItems[ri])  pptSlide.addText(`• ${leftItems[ri]}`,  { x: leftX,  y: rowY, w: colW, h: 0.42, fontSize: 14, color: colors.body, fontFace: 'Arial' });
          if (rightItems[ri]) pptSlide.addText(`• ${rightItems[ri]}`, { x: rightX, y: rowY, w: colW, h: 0.42, fontSize: 14, color: colors.body, fontFace: 'Arial' });
          rowY += 0.44;
        }
      } else {
        pptSlide.addText(slide.title, { x: 0.4, y: 0.25, w: SLIDE_W - 0.8, h: 0.75, fontSize: 28, bold: true, color: colors.title, fontFace: 'Arial' });
        pptSlide.addShape('line', { x: 0.4, y: 1.05, w: SLIDE_W - 0.8, h: 0, line: { color: colors.line, width: 1.5 } });
        const hasAiImage = !!slideVisual?.url;
        const contentX   = 0.4;
        const contentW   = hasAiImage ? SLIDE_W * 0.55 : SLIDE_W - 0.8;
        let   curY       = 1.2;
        const lineH      = 0.52;
        const maxImgW    = contentW - 0.1;
        for (const bullet of slide.content) {
          if (HAS_MATH.test(bullet)) {
            const entry = mathImgMap.get(`• ${bullet}::${colors.body}`);
            let bulletAdded = false;
            if (entry) {
              try {
                const ratio = await resolveImgRatio(entry);
                const imgW  = Math.min(maxImgW, SLIDE_W * 0.7);
                const imgH  = Math.min(imgW * ratio, 1.2);
                pptSlide.addImage({ data: entry.data, x: contentX, y: curY, w: imgW, h: imgH });
                curY += imgH + 0.08;
                bulletAdded = true;
              } catch { /* fall through */ }
            }
            if (!bulletAdded) { pptSlide.addText(`• ${bullet}`, { x: contentX, y: curY, w: contentW, h: lineH, fontSize: 16, color: colors.body }); curY += lineH; }
          } else { pptSlide.addText(`• ${bullet}`, { x: contentX, y: curY, w: contentW, h: lineH, fontSize: 16, color: colors.body, fontFace: 'Arial' }); curY += lineH; }
          if (curY > 5.1) break;
        }
        if (hasAiImage) {
          pptSlide.addImage({ data: slideVisual!.url!, x: SLIDE_W * 0.57, y: 1.15, w: SLIDE_W * 0.38, h: SLIDE_W * 0.38 });
        }
      }

      pptSlide.addText('Генерирано со Math Navigator AI', { x: 0.4, y: 5.25, w: SLIDE_W - 0.8, h: 0.28, fontSize: 9, color: 'AAAAAA', align: 'right' });
      pptSlide.addNotes([`Слајд ${idx + 1}/${data.slides.length}: ${slide.title}`, `Тема: ${data.topic} | Генерирано со Math Navigator AI`].join('\n'));
    }

    const safeTitle = data.title.replace(/\s+/g, '_').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 80) || 'prezentacija';
    await pptx.writeFile({ fileName: `${safeTitle}.pptx` });
    addNotification('PPTX успешно генериран! ✅', 'success');
  } catch (err) {
    logger.error('PPTX export error:', err);
    addNotification('Грешка при генерирање на PPTX.', 'error');
  } finally {
    setIsExportingPptx(false);
  }
}
