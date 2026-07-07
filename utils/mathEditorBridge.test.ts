import { describe, it, expect, beforeEach } from 'vitest';
import {
  writeMathEditorReturn, readAndClearMathEditorReturn,
  writeMathEditorResult, readAndClearMathEditorResult,
} from './mathEditorBridge';

beforeEach(() => sessionStorage.clear());

describe('math editor return-path bridge', () => {
  it('round-trips a return path and clears it after reading', () => {
    writeMathEditorReturn('/dugga/build');
    expect(readAndClearMathEditorReturn()).toBe('/dugga/build');
    expect(readAndClearMathEditorReturn()).toBeNull();
  });

  it('returns null when nothing was written', () => {
    expect(readAndClearMathEditorReturn()).toBeNull();
  });
});

describe('math editor result bridge', () => {
  it('round-trips a LaTeX result and clears it after reading', () => {
    writeMathEditorResult('\\frac{1}{2}');
    expect(readAndClearMathEditorResult()).toBe('\\frac{1}{2}');
    expect(readAndClearMathEditorResult()).toBeNull();
  });

  it('returns null when nothing was written', () => {
    expect(readAndClearMathEditorResult()).toBeNull();
  });
});
