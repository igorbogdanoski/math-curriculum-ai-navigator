/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { DrawingCanvas, type DrawingCanvasRef } from './DrawingCanvas';

// react-konva renders onto a real <canvas> via its own reconciler, which jsdom can't
// meaningfully drive — mock it to a plain DOM tree and capture the Stage's mouse handlers
// so tests can invoke them directly with Konva-shaped fake events, matching the same
// "mock the incompatible dependency, exercise your own logic directly" approach already
// used elsewhere in this session (InteractiveQuizPlayer, GeoGebra/Desmos panels).
type KonvaHandler = (e: unknown) => void;
let capturedHandlers: { onMouseDown?: KonvaHandler; onMouseMove?: KonvaHandler; onMouseUp?: KonvaHandler } = {};
const mockToDataURL = vi.fn(() => 'data:image/png;base64,MOCKDATA');

vi.mock('react-konva', () => ({
  Stage: React.forwardRef((props: Record<string, unknown>, ref: React.Ref<{ toDataURL: () => string }>) => {
    capturedHandlers = {
      onMouseDown: props.onMouseDown as KonvaHandler,
      onMouseMove: props.onMouseMove as KonvaHandler,
      onMouseUp: props.onMouseUp as KonvaHandler,
    };
    React.useImperativeHandle(ref, () => ({ toDataURL: mockToDataURL }));
    return <div data-testid="konva-stage">{props.children as React.ReactNode}</div>;
  }),
  Layer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Line: () => null,
}));

function fakeKonvaEvent(x: number, y: number) {
  return { target: { getStage: () => ({ getPointerPosition: () => ({ x, y }) }) } };
}

function drawOneStroke() {
  act(() => { capturedHandlers.onMouseDown?.(fakeKonvaEvent(10, 10)); });
  act(() => { capturedHandlers.onMouseMove?.(fakeKonvaEvent(50, 50)); });
  act(() => { capturedHandlers.onMouseUp?.(undefined); });
}

describe('DrawingCanvas — ref API and onStrokeEnd (live-coaching integration points)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedHandlers = {};
    mockToDataURL.mockReturnValue('data:image/png;base64,MOCKDATA');
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
  });

  it('hasWork() is false before any drawing', () => {
    const ref = React.createRef<DrawingCanvasRef>();
    render(<DrawingCanvas ref={ref} />);
    expect(ref.current?.hasWork()).toBe(false);
  });

  it('hasWork() is true after a completed stroke', () => {
    const ref = React.createRef<DrawingCanvasRef>();
    render(<DrawingCanvas ref={ref} />);
    drawOneStroke();
    expect(ref.current?.hasWork()).toBe(true);
  });

  it('clear() wipes the canvas — hasWork() goes back to false', () => {
    const ref = React.createRef<DrawingCanvasRef>();
    render(<DrawingCanvas ref={ref} />);
    drawOneStroke();
    expect(ref.current?.hasWork()).toBe(true);

    act(() => { ref.current?.clear(); });
    expect(ref.current?.hasWork()).toBe(false);
  });

  it('getSnapshot() returns the base64 payload with the data-URL prefix stripped', () => {
    const ref = React.createRef<DrawingCanvasRef>();
    render(<DrawingCanvas ref={ref} />);
    drawOneStroke();
    expect(ref.current?.getSnapshot()).toBe('MOCKDATA');
  });

  it('getSnapshot() returns null when the stage has no data to export', () => {
    mockToDataURL.mockReturnValue('');
    const ref = React.createRef<DrawingCanvasRef>();
    render(<DrawingCanvas ref={ref} />);
    expect(ref.current?.getSnapshot()).toBeNull();
  });

  it('fires onStrokeEnd once per completed stroke', () => {
    const onStrokeEnd = vi.fn();
    render(<DrawingCanvas onStrokeEnd={onStrokeEnd} />);
    drawOneStroke();
    expect(onStrokeEnd).toHaveBeenCalledTimes(1);
  });

  it('does not fire onStrokeEnd on mouse-up without a preceding mouse-down (no active stroke)', () => {
    const onStrokeEnd = vi.fn();
    render(<DrawingCanvas onStrokeEnd={onStrokeEnd} />);
    act(() => { capturedHandlers.onMouseUp?.(undefined); });
    expect(onStrokeEnd).not.toHaveBeenCalled();
  });

  it('fires onStrokeEnd once per stroke across multiple strokes', () => {
    const onStrokeEnd = vi.fn();
    render(<DrawingCanvas onStrokeEnd={onStrokeEnd} />);
    drawOneStroke();
    drawOneStroke();
    expect(onStrokeEnd).toHaveBeenCalledTimes(2);
  });

  it('works with no onStrokeEnd prop at all (fully optional, existing usage unaffected)', () => {
    expect(() => {
      render(<DrawingCanvas />);
      drawOneStroke();
    }).not.toThrow();
  });
});
