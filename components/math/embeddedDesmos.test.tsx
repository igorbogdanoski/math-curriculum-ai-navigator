/**
 * S61-B2 tests for EmbeddedDesmos.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { EmbeddedDesmos, buildDesmosUrl } from './EmbeddedDesmos';

describe('buildDesmosUrl', () => {
  it('returns scientific calc url by default', () => {
    expect(buildDesmosUrl('calc')).toBe('https://www.desmos.com/scientific?embed');
  });
  it('returns blank graph url when no state', () => {
    expect(buildDesmosUrl('graph')).toBe('https://www.desmos.com/calculator?embed');
  });
  it('returns shared graph url when state is provided', () => {
    expect(buildDesmosUrl('graph', 'abcd1234')).toBe(
      'https://www.desmos.com/calculator/abcd1234?embed',
    );
  });
});

describe('EmbeddedDesmos', () => {
  it('renders an iframe with the calc URL by default', () => {
    render(<EmbeddedDesmos type="calc" height={320} />);
    const wrap = screen.getByTestId('embedded-desmos');
    expect(wrap.dataset.type).toBe('calc');
    const iframe = wrap.querySelector('iframe')!;
    expect(iframe.getAttribute('src')).toContain('scientific');
    expect(iframe.getAttribute('height')).toBe('320');
  });

  it('emits onState exactly once on first interaction', () => {
    const onState = vi.fn();
    render(<EmbeddedDesmos type="graph" state="seed" onState={onState} />);
    const iframe = screen.getByTestId('embedded-desmos').querySelector('iframe')!;
    fireEvent.mouseDown(iframe);
    fireEvent.touchStart(iframe);
    expect(onState).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenCalledWith('seed');
  });
});
