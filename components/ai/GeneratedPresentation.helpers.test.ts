import { describe, it, expect } from 'vitest';
import { isPureMathExpr } from './GeneratedPresentation';

describe('GeneratedPresentation — isPureMathExpr', () => {
  it('detects single-dollar math expressions', () => {
    expect(isPureMathExpr('$x^2 + 1$')).toBe(true);
    expect(isPureMathExpr('  $a+b$  ')).toBe(true);
  });
  it('detects double-dollar block expressions', () => {
    expect(isPureMathExpr('$$\\int_0^1 x dx$$')).toBe(true);
    expect(isPureMathExpr('$$\nx + y\n$$')).toBe(true);
  });
  it('rejects mixed text + math', () => {
    expect(isPureMathExpr('Solve $x+1=0$ for x')).toBe(false);
    expect(isPureMathExpr('hello world')).toBe(false);
  });
  it('rejects empty / no-math strings', () => {
    expect(isPureMathExpr('')).toBe(false);
    expect(isPureMathExpr('$$')).toBe(false);
  });
  it('rejects single-dollar across newline (not pure single)', () => {
    expect(isPureMathExpr('$line1\nline2$')).toBe(false);
  });
});
