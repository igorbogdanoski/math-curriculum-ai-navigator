/**
 * S61-B1 tests for EmbeddedGeoGebra.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import {
  EmbeddedGeoGebra,
  buildGeoGebraUrl,
} from './EmbeddedGeoGebra';

describe('buildGeoGebraUrl', () => {
  it('builds public-app url when no materialId', () => {
    expect(buildGeoGebraUrl('graphing')).toBe('https://www.geogebra.org/graphing?lang=mk');
    expect(buildGeoGebraUrl('cas', undefined, 'en')).toBe('https://www.geogebra.org/cas?lang=en');
    expect(buildGeoGebraUrl('3d')).toContain('/3d?');
  });
  it('builds material share url when materialId is provided', () => {
    const url = buildGeoGebraUrl('graphing', 'abc123');
    expect(url).toBe('https://www.geogebra.org/m/abc123?embed=1&lang=mk');
  });
  it('url-encodes a tricky materialId', () => {
    const url = buildGeoGebraUrl('graphing', 'a/b c');
    expect(url).toContain('a%2Fb%20c');
  });
});

describe('EmbeddedGeoGebra', () => {
  it('renders an iframe with the correct app URL and height', () => {
    render(<EmbeddedGeoGebra app="graphing" height={300} />);
    const wrap = screen.getByTestId('embedded-geogebra');
    expect(wrap.dataset.app).toBe('graphing');
    const iframe = wrap.querySelector('iframe')!;
    expect(iframe.getAttribute('src')).toContain('/graphing?');
    expect(iframe.getAttribute('height')).toBe('300');
  });

  it('emits onState the first time the student interacts', () => {
    const onState = vi.fn();
    render(<EmbeddedGeoGebra app="cas" onState={onState} initialState="<xml/>" />);
    const iframe = screen.getByTestId('embedded-geogebra').querySelector('iframe')!;
    fireEvent.mouseDown(iframe);
    fireEvent.mouseDown(iframe);
    expect(onState).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenCalledWith('<xml/>');
  });
});
