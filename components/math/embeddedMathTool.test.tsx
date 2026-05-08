/**
 * S61-B3 tests for the EmbeddedMathTool router.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmbeddedMathTool } from './EmbeddedMathTool';
import type { DuggaEmbedTool } from '../../services/firestoreService.dugga';

describe('EmbeddedMathTool', () => {
  it('renders nothing when tool is undefined or none', () => {
    const { container, rerender } = render(<EmbeddedMathTool tool={undefined} />);
    expect(container.firstChild).toBeNull();
    rerender(<EmbeddedMathTool tool="none" />);
    expect(container.firstChild).toBeNull();
  });

  it('routes geogebra-* variants to EmbeddedGeoGebra', () => {
    const variants: DuggaEmbedTool[] = [
      'geogebra-graphing', 'geogebra-cas', 'geogebra-geometry', 'geogebra-3d',
    ];
    for (const tool of variants) {
      const { unmount } = render(<EmbeddedMathTool tool={tool} />);
      const wrap = screen.getByTestId('embedded-geogebra');
      const expectedApp = tool.replace('geogebra-', '');
      expect(wrap.dataset.app).toBe(expectedApp);
      unmount();
    }
  });

  it('routes desmos-calc and desmos-graph to EmbeddedDesmos', () => {
    const { unmount } = render(<EmbeddedMathTool tool="desmos-calc" />);
    expect(screen.getByTestId('embedded-desmos').dataset.type).toBe('calc');
    unmount();
    render(<EmbeddedMathTool tool="desmos-graph" config={{ materialId: 'g123' }} />);
    const wrap = screen.getByTestId('embedded-desmos');
    expect(wrap.dataset.type).toBe('graph');
    expect(wrap.dataset.state).toBe('g123');
  });

  it('forwards config.height to the underlying iframe', () => {
    render(<EmbeddedMathTool tool="geogebra-graphing" config={{ height: 555 }} />);
    const iframe = screen.getByTestId('embedded-geogebra').querySelector('iframe')!;
    expect(iframe.getAttribute('height')).toBe('555');
  });
});
