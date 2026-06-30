/**
 * services/documentParser.ts
 *
 * Shared, reusable document parsing service.
 * Converts an uploaded File into extracted text + embedded images.
 *
 * Supported kinds:
 *   - PDF   → Gemini Vision OCR (extractTextFromDocument)
 *   - DOCX  → mammoth HTML → plain text + embedded images (up to 5)
 *   - TXT   → file.text()
 *   - image → Gemini Vision OCR (extractTextFromImage)
 */

import { toBase64, detectImageMime } from '../views/extractionHubHelpers';

export interface ParsedDocument {
  text: string;
  images: Array<{ mimeType: string; data: string }>;
  /** true if text was > 8000 chars before slice (informational — caller truncates) */
  truncated: boolean;
  /** original text length before any truncation */
  charCount: number;
  kind: 'pdf' | 'docx' | 'txt' | 'image';
}

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Parses an uploaded File into text + images.
 *
 * For PDF/images: calls Gemini OCR (dynamic imports to avoid bundle bloat).
 * For DOCX: uses mammoth to extract text AND embedded images.
 * For TXT: reads directly.
 *
 * NOTE: The function does NOT truncate text — it returns the full text.
 * Truncation is the caller's responsibility; `truncated` is purely informational.
 *
 * @throws Error with a Macedonian message for oversized or unsupported files.
 */
export async function parseUploadedFile(file: File): Promise<ParsedDocument> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Датотеката е поголема од 20 MB.');
  }

  const name = file.name;

  // ── PDF ──────────────────────────────────────────────────────────────────────
  const isPdf = file.type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
  if (isPdf) {
    const ab = await file.arrayBuffer();
    const base64 = toBase64(ab);
    const { extractTextFromDocument } = await import('./gemini/visionContracts');
    const text = await extractTextFromDocument(base64);
    const charCount = text.length;
    return { text, images: [], kind: 'pdf', charCount, truncated: charCount > 8000 };
  }

  // ── DOCX ─────────────────────────────────────────────────────────────────────
  const isDocx =
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.toLowerCase().endsWith('.docx');
  if (isDocx) {
    const ab = await file.arrayBuffer();
    const mammoth = await import('mammoth');

    const images: Array<{ mimeType: string; data: string }> = [];

    // Extract embedded images (up to 5)
    const { value: html } = await mammoth.convertToHtml(
      { arrayBuffer: ab },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          if (images.length < 5) {
            const imgBuffer = await image.read();
            const base64 = toBase64(
              imgBuffer instanceof ArrayBuffer ? imgBuffer : imgBuffer.buffer as ArrayBuffer,
            );
            images.push({ mimeType: image.contentType, data: base64 });
          }
          return { src: '' };
        }),
      },
    );

    // Strip HTML tags to get plain text
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const charCount = text.length;
    return { text, images, kind: 'docx', charCount, truncated: charCount > 8000 };
  }

  // ── TXT ──────────────────────────────────────────────────────────────────────
  const isTxt = file.type === 'text/plain' || name.toLowerCase().endsWith('.txt');
  if (isTxt) {
    const text = await file.text();
    const charCount = text.length;
    return { text, images: [], kind: 'txt', charCount, truncated: charCount > 8000 };
  }

  // ── Image ─────────────────────────────────────────────────────────────────────
  const mimeType = detectImageMime(name, file.type);
  if (mimeType) {
    const ab = await file.arrayBuffer();
    const base64 = toBase64(ab);
    const { extractTextFromImage } = await import('./gemini/visionContracts');
    const text = await extractTextFromImage(base64, mimeType);
    const charCount = text.length;
    return {
      text,
      images: [{ mimeType, data: base64 }],
      kind: 'image',
      charCount,
      truncated: charCount > 8000,
    };
  }

  // ── Unsupported ───────────────────────────────────────────────────────────────
  throw new Error('Поддржани формати: PDF, DOCX, TXT, PNG, JPG, WEBP.');
}
