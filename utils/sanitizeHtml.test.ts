import { describe, expect, it } from 'vitest';
import { sanitizeWorksheetHtml } from './sanitizeHtml';

describe('sanitizeWorksheetHtml', () => {
  it('passes through clean HTML unchanged', () => {
    const clean = '<div class="worksheet"><h1>Recovery</h1><p>Теорија $x^2$</p></div>';
    expect(sanitizeWorksheetHtml(clean)).toBe(clean);
  });

  it('strips <script> tags and their content', () => {
    const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    expect(sanitizeWorksheetHtml(input)).toBe('<p>Hello</p><p>World</p>');
  });

  it('strips multiline <script> blocks', () => {
    const input = '<p>A</p><script>\nconst x = 1;\ndocument.cookie = x;\n</script><p>B</p>';
    expect(sanitizeWorksheetHtml(input)).toBe('<p>A</p><p>B</p>');
  });

  it('strips javascript: hrefs entirely', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeWorksheetHtml(input);
    expect(result).not.toContain('javascript:');
    expect(result).toContain('click');
  });

  it('blocks javascript: with whitespace variants', () => {
    const input = '<a href="javascript :alert(1)">x</a>';
    expect(sanitizeWorksheetHtml(input)).not.toContain('javascript');
  });

  it('strips on* event attributes', () => {
    const input = '<img src="x" onerror="alert(1)">';
    const result = sanitizeWorksheetHtml(input);
    expect(result).not.toContain('onerror');
    expect(result).toContain('src="x"');
  });

  it('strips multiple different event attributes', () => {
    const input = '<div onclick="bad()" onmouseover="bad2()">text</div>';
    const result = sanitizeWorksheetHtml(input);
    expect(result).not.toContain('onclick=');
    expect(result).not.toContain('onmouseover=');
    expect(result).toContain('text');
  });

  it('handles combined attack vectors', () => {
    const input = '<script>steal()</script><a href="javascript:x">click</a><img onerror="y">';
    const result = sanitizeWorksheetHtml(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('onerror=');
  });

  it('preserves worksheet-relevant tags and attributes (table, style, class)', () => {
    const input = '<table class="grid"><tr style="color:red"><td>1</td></tr></table>';
    const result = sanitizeWorksheetHtml(input);
    expect(result).toContain('<table');
    expect(result).toContain('class="grid"');
    expect(result).toContain('style="color:red"');
  });

  it('returns empty string for empty input', () => {
    expect(sanitizeWorksheetHtml('')).toBe('');
  });
});
