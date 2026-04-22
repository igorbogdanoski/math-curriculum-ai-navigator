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

// ── Handout PDF (Г10) ─────────────────────────────────────────────────────────
function stripLatex(text: string): string {
  return text.replace(/\$\$?[^$]+\$\$?/g, '[формула]').replace(/\\[a-zA-Z]+\{[^}]*\}/g, '').trim();
}

function blankLines(n: number): string {
  return Array.from({ length: n }, () => '<div class="blank-line"></div>').join('');
}

export function printGammaHandout(data: AIGeneratedPresentation, options?: Pick<GammaExportOptions, 'isPro' | 'schoolName' | 'logoUrl'>): void {
  const brandText = options?.isPro && options.schoolName ? options.schoolName : 'ai.mismath.net';
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;

  const slidesHtml = data.slides.map((slide, i) => {
    let body = '';

    if (slide.type === 'formula-centered') {
      const formula = stripLatex(slide.content[0] ?? slide.title ?? '');
      body = `
        <div class="formula-box">${formula}</div>
        <p class="notes-label">Белешки:</p>
        ${blankLines(4)}
        ${slide.content.slice(1).map(l => `<p class="note-item">• ${stripLatex(l)}</p>`).join('')}
      `;
    } else if (slide.type === 'task' || slide.type === 'example') {
      const isTask = slide.type === 'task';
      body = `
        <div class="task-box ${isTask ? 'task' : 'example'}">
          <span class="task-label">${isTask ? '📝 Задача' : '💡 Пример'}</span>
          <p>${stripLatex(slide.content[0] ?? '')}</p>
        </div>
        <p class="notes-label">${isTask ? 'Решение:' : 'Забелешки:'}</p>
        ${blankLines(isTask ? 8 : 4)}
      `;
    } else if (slide.type === 'step-by-step' || slide.type === 'proof') {
      body = `<ol class="steps">${slide.content.map(s => `<li>${stripLatex(s)}</li>`).join('')}</ol>
        <p class="notes-label">Белешки:</p>${blankLines(3)}`;
    } else if (slide.type === 'summary') {
      body = `<ul class="summary-list">${slide.content.map(l => `<li>${stripLatex(l)}</li>`).join('')}</ul>
        <div class="qr-hint">🔗 ai.mismath.net</div>`;
    } else {
      body = `<ul class="content-list">${slide.content.map(l => `<li>${stripLatex(l)}</li>`).join('')}</ul>`;
    }

    return `
      <div class="slide-page">
        <div class="slide-header">
          <span class="slide-num">${i + 1}</span>
          <span class="slide-title">${stripLatex(slide.title ?? '')}</span>
        </div>
        <div class="slide-body">${body}</div>
      </div>
    `;
  }).join('');

  win.document.write(`<!DOCTYPE html><html lang="mk"><head>
  <meta charset="utf-8">
  <title>Handout — ${data.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; }
    .slide-page { page-break-after: always; padding: 18mm 18mm 14mm; min-height: 140mm; }
    .slide-page:last-child { page-break-after: avoid; }
    .slide-header { display: flex; align-items: center; gap: 10px; border-bottom: 2px solid #4f46e5; padding-bottom: 6px; margin-bottom: 14px; }
    .slide-num { background: #4f46e5; color: #fff; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; flex-shrink: 0; }
    .slide-title { font-size: 16px; font-weight: 900; color: #1e1b4b; }
    .formula-box { background: #f5f3ff; border: 2px solid #c4b5fd; border-radius: 10px; padding: 14px 20px; font-size: 18px; font-weight: 700; text-align: center; margin-bottom: 14px; color: #1e1b4b; }
    .task-box { border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; }
    .task-box.task { background: #fffbeb; border: 1.5px solid #f59e0b; }
    .task-box.example { background: #f0fdf4; border: 1.5px solid #22c55e; }
    .task-label { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; display: block; margin-bottom: 6px; color: #78716c; }
    .notes-label { font-size: 11px; font-weight: 700; color: #6b7280; margin: 10px 0 6px; text-transform: uppercase; letter-spacing: .04em; }
    .blank-line { border-bottom: 1px solid #d1d5db; margin-bottom: 16px; }
    .note-item { color: #4b5563; font-size: 12px; margin-top: 4px; }
    ol.steps { padding-left: 22px; }
    ol.steps li { margin-bottom: 8px; line-height: 1.5; }
    ul.summary-list, ul.content-list { padding-left: 18px; }
    ul.summary-list li, ul.content-list li { margin-bottom: 8px; line-height: 1.5; }
    .qr-hint { margin-top: 16px; font-size: 11px; color: #9ca3af; text-align: right; }
    .slide-body { line-height: 1.6; }
    @media print {
      body { font-size: 12px; }
      .slide-page { padding: 12mm 14mm 10mm; }
    }
  </style>
</head><body>
  <div style="text-align:center;padding:12px 0 20px;border-bottom:3px solid #4f46e5;margin-bottom:4px">
    ${options?.isPro && options.logoUrl ? `<img src="${options.logoUrl}" alt="лого" style="height:36px;object-fit:contain;margin:0 auto 8px;display:block" />` : ''}
    <h1 style="font-size:20px;color:#1e1b4b;font-weight:900">${data.title}</h1>
    <p style="font-size:12px;color:#6b7280;margin-top:4px">${data.topic} · ${data.gradeLevel}. одделение · ${brandText}</p>
  </div>
  ${slidesHtml}
  <script>window.onload = () => { window.print(); }<\/script>
</body></html>`);
  win.document.close();
}
