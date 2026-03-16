/**
 * utils/pdfDownload.ts
 *
 * Shared utility for direct PDF download (no browser print dialog).
 * Uses html2canvas to capture a DOM element → jsPDF for A4 PDF output.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   await downloadAsPdf(ref.current, 'filename');
 */

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10;

export async function downloadAsPdf(
  element: HTMLElement,
  filename: string,
  onProgress?: (msg: string) => void,
): Promise<void> {
  onProgress?.('Се генерира PDF…');

  // Render element to canvas at 2× for sharpness
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const imgW = canvas.width;
  const imgH = canvas.height;

  // Content width on A4 (mm)
  const contentW = A4_WIDTH_MM - 2 * MARGIN_MM;
  const contentH = (imgH / imgW) * contentW;

  const pdf = new jsPDF({
    orientation: contentH > A4_HEIGHT_MM - 2 * MARGIN_MM ? 'portrait' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // If the content is taller than one page, split across pages
  const pageContentH = A4_HEIGHT_MM - 2 * MARGIN_MM;
  const totalPages = Math.ceil(contentH / pageContentH);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    // Source Y position in the image (in pixels)
    const srcY = Math.round((page * pageContentH * imgW) / contentW);
    const srcH = Math.round((pageContentH * imgW) / contentW);

    // Create a temporary canvas for this page slice
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = imgW;
    pageCanvas.height = Math.min(srcH, imgH - srcY);

    const ctx = pageCanvas.getContext('2d');
    if (!ctx) continue;

    const sourceImg = new Image();
    await new Promise<void>((resolve) => {
      sourceImg.onload = () => {
        ctx.drawImage(sourceImg, 0, srcY, imgW, pageCanvas.height, 0, 0, imgW, pageCanvas.height);
        resolve();
      };
      sourceImg.src = imgData;
    });

    const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.92);
    const pageRenderedH = (pageCanvas.height / imgW) * contentW;

    pdf.addImage(pageImgData, 'JPEG', MARGIN_MM, MARGIN_MM, contentW, pageRenderedH);
  }

  pdf.save(`${filename}.pdf`);
  onProgress?.('PDF зачуван ✅');
}
