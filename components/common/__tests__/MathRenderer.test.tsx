/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MathRenderer } from '../MathRenderer';

// Mock KaTeX globally
const mockRenderToString = vi.fn((latex: string) => `<span class="katex-mock">${latex}</span>`);

declare global {
  interface Window {
    katex: {
      renderToString: (latex: string, options?: any) => string;
    };
  }
}

describe('MathRenderer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.katex = {
            renderToString: mockRenderToString
        };
    });

    it('renders plain text correctly', () => {
        const { getByText } = render(<MathRenderer text="Ова е обичен текст" />);
        expect(getByText('Ова е обичен текст')).not.toBeNull();
    });

    it('renders inline math with single dollars', () => {
        render(<MathRenderer text="Пресметај $x + 2$" />);
        expect(mockRenderToString).toHaveBeenCalledWith('x + 2', expect.objectContaining({ displayMode: false }));
    });

    it('renders block math with double dollars', () => {
        render(<MathRenderer text="Формула: $$a^2 + b^2 = c^2$$" />);
        expect(mockRenderToString).toHaveBeenCalledWith('a^2 + b^2 = c^2', expect.objectContaining({ displayMode: true }));
    });

    it('fixes missing backslash for common commands like frac and sqrt', () => {
        // Test auto-wrap and backslash recovery for bare commands
        render(<MathRenderer text="Реши го изразот frac{1}{2} и sqrt{9}" />);
        
        // Should be converted to $\frac{1}{2}$ and $\sqrt{9}$ then rendered by KaTeX
        expect(mockRenderToString).toHaveBeenCalledWith('\\frac{1}{2}', expect.objectContaining({ displayMode: false }));
        expect(mockRenderToString).toHaveBeenCalledWith('\\sqrt{9}', expect.objectContaining({ displayMode: false }));
    });

    it('recovers from missing backslash inside dollar signs', () => {
        // Test $frac{1}{2}$ -> $\frac{1}{2}$
        render(<MathRenderer text="Користи $frac{1}{2}$ за дропка." />);
        expect(mockRenderToString).toHaveBeenCalledWith('\\frac{1}{2}', expect.objectContaining({ displayMode: false }));
    });

    it('correctly handles macedonian decimal comma in math', () => {
        render(<MathRenderer text="Вредноста е $x = 3,14$" />);
        expect(mockRenderToString).toHaveBeenCalledWith('x = 3,14', expect.objectContaining({ displayMode: false }));
    });

    it('auto-wraps units in \\text{}', () => {
        render(<MathRenderer text="Растојанието е 11 km" />);
        // 11 km should be wrapped in $11\text{ km}$
        expect(mockRenderToString).toHaveBeenCalledWith('11\\text{ km}', expect.objectContaining({ displayMode: false }));
    });

    it('pulls units inside adjacent math blocks', () => {
        render(<MathRenderer text="Резултатот е $7 + 4 = 11$ km" />);
        // Should become $7 + 4 = 11 \text{ km}$
        expect(mockRenderToString).toHaveBeenCalledWith('7 + 4 = 11 \\text{ km}', expect.objectContaining({ displayMode: false }));
    });

    it('strips stray $ signs inside math blocks', () => {
        render(<MathRenderer text="$$\frac{$1$}{2}$$" />);
        expect(mockRenderToString).toHaveBeenCalledWith('\\frac{1}{2}', expect.objectContaining({ displayMode: true }));
    });
});
