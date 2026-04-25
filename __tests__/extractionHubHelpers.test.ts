import { describe, expect, it } from 'vitest';
import {
  detectImageMime,
  classifyClipboard,
  isOcrLanguage,
} from '../views/extractionHubHelpers';
import { buildOcrLanguagePromptFragment } from '../services/gemini/visionContracts';

// ─── detectImageMime ──────────────────────────────────────────────────────────

describe('detectImageMime — MIME-type detection', () => {
  it('returns image/png for image/png MIME', () => {
    expect(detectImageMime('file.png', 'image/png')).toBe('image/png');
  });

  it('normalises image/jpg → image/jpeg', () => {
    expect(detectImageMime('file.jpg', 'image/jpg')).toBe('image/jpeg');
  });

  it('returns image/jpeg for image/jpeg MIME', () => {
    expect(detectImageMime('photo.jpeg', 'image/jpeg')).toBe('image/jpeg');
  });

  it('returns image/webp for image/webp MIME', () => {
    expect(detectImageMime('img.webp', 'image/webp')).toBe('image/webp');
  });

  it('falls back to extension when MIME is empty — .png', () => {
    expect(detectImageMime('scan.png', '')).toBe('image/png');
  });

  it('falls back to extension when MIME is empty — .jpg', () => {
    expect(detectImageMime('photo.jpg', '')).toBe('image/jpeg');
  });

  it('falls back to extension when MIME is empty — .jpeg', () => {
    expect(detectImageMime('doc.jpeg', '')).toBe('image/jpeg');
  });

  it('falls back to extension when MIME is empty — .webp', () => {
    expect(detectImageMime('thumb.webp', '')).toBe('image/webp');
  });

  it('returns null for unsupported MIME (application/pdf)', () => {
    expect(detectImageMime('doc.pdf', 'application/pdf')).toBeNull();
  });

  it('returns null for unsupported extension (.txt) with empty MIME', () => {
    expect(detectImageMime('notes.txt', '')).toBeNull();
  });

  it('is case-insensitive for extensions', () => {
    expect(detectImageMime('IMAGE.PNG', '')).toBe('image/png');
    expect(detectImageMime('PHOTO.JPG', '')).toBe('image/jpeg');
  });
});

// ─── classifyClipboard ────────────────────────────────────────────────────────

function makeImageItems(mimeType: string): DataTransferItemList {
  const file = new File(['data'], 'paste.png', { type: mimeType });
  const item = { kind: 'file', type: mimeType, getAsFile: () => file } as unknown as DataTransferItem;
  return [item] as unknown as DataTransferItemList;
}

function makeTextItems(): DataTransferItemList {
  const item = { kind: 'string', type: 'text/plain', getAsFile: () => null } as unknown as DataTransferItem;
  return [item] as unknown as DataTransferItemList;
}

describe('classifyClipboard — paste classification', () => {
  it('returns kind=image for an image/* clipboard item', () => {
    const result = classifyClipboard(makeImageItems('image/png'), null);
    expect(result.kind).toBe('image');
    if (result.kind === 'image') expect(result.mimeType).toBe('image/png');
  });

  it('returns kind=image for image/jpeg clipboard item', () => {
    const result = classifyClipboard(makeImageItems('image/jpeg'), null);
    expect(result.kind).toBe('image');
  });

  it('returns kind=text for pasted text >= 200 chars', () => {
    const longText = 'а'.repeat(200);
    const result = classifyClipboard(makeTextItems(), longText);
    expect(result.kind).toBe('text');
    if (result.kind === 'text') expect(result.text).toBe(longText);
  });

  it('returns kind=ignored for pasted text < 200 chars', () => {
    const shortText = 'Краток текст';
    const result = classifyClipboard(makeTextItems(), shortText);
    expect(result.kind).toBe('ignored');
  });

  it('returns kind=ignored when items is null and text is null', () => {
    expect(classifyClipboard(null, null).kind).toBe('ignored');
  });

  it('returns kind=ignored when items is null and text is short', () => {
    expect(classifyClipboard(null, 'hi').kind).toBe('ignored');
  });

  it('prefers image item over long text when both are present', () => {
    const items = makeImageItems('image/png');
    const longText = 'т'.repeat(300);
    const result = classifyClipboard(items, longText);
    expect(result.kind).toBe('image');
  });

  it('returns kind=text for exactly 200-char text', () => {
    const exactText = 'б'.repeat(200);
    const result = classifyClipboard(null, exactText);
    expect(result.kind).toBe('text');
  });
});

// ─── isOcrLanguage ────────────────────────────────────────────────────────────

describe('isOcrLanguage — type guard', () => {
  it('accepts all valid language codes', () => {
    for (const lang of ['auto', 'mk', 'sr', 'hr', 'ru', 'tr', 'en']) {
      expect(isOcrLanguage(lang)).toBe(true);
    }
  });

  it('rejects unknown string', () => {
    expect(isOcrLanguage('bg')).toBe(false);
    expect(isOcrLanguage('fr')).toBe(false);
    expect(isOcrLanguage('')).toBe(false);
  });

  it('rejects non-string types', () => {
    expect(isOcrLanguage(null)).toBe(false);
    expect(isOcrLanguage(undefined)).toBe(false);
    expect(isOcrLanguage(42)).toBe(false);
  });
});

// ─── buildOcrLanguagePromptFragment ──────────────────────────────────────────

describe('buildOcrLanguagePromptFragment — language prompt builder', () => {
  it('auto mode returns detection instruction without transliteration note', () => {
    const frag = buildOcrLanguagePromptFragment('auto');
    expect(frag).toContain('Detect the source language automatically');
    expect(frag).toContain('Cyrillic');
  });

  it('mk mode references Macedonian and Cyrillic', () => {
    const frag = buildOcrLanguagePromptFragment('mk');
    expect(frag).toContain('Macedonian');
    expect(frag).toContain('Cyrillic');
    expect(frag).toContain('Do NOT transliterate');
  });

  it('tr mode references Turkish and diacritics', () => {
    const frag = buildOcrLanguagePromptFragment('tr');
    expect(frag).toContain('Turkish');
    expect(frag).toContain('diacritics');
  });

  it('hr mode references Croatian', () => {
    const frag = buildOcrLanguagePromptFragment('hr');
    expect(frag).toContain('Croatian');
  });

  it('ru mode references Russian and Cyrillic', () => {
    const frag = buildOcrLanguagePromptFragment('ru');
    expect(frag).toContain('Russian');
    expect(frag).toContain('Cyrillic');
  });

  it('en mode references English and Latin', () => {
    const frag = buildOcrLanguagePromptFragment('en');
    expect(frag).toContain('English');
    expect(frag).toContain('Latin');
  });

  it('undefined defaults to auto behavior', () => {
    const frag = buildOcrLanguagePromptFragment(undefined);
    expect(frag).toContain('Detect the source language automatically');
  });
});
