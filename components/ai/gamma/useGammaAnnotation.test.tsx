/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useGammaAnnotation } from './useGammaAnnotation';
import type { GammaAnnotationStroke } from '../../../services/gammaLiveService';

function TestHarness({ slideIdx, mode, onStrokeComplete, onClear }: {
  slideIdx: number;
  mode: 'draw' | 'highlight' | 'laser' | null;
  onStrokeComplete?: (s: GammaAnnotationStroke) => void;
  onClear?: () => void;
}) {
  const { canvasRef, toggleAnnot, clearCanvas, onCanvasMouseDown, onCanvasMouseMove, onCanvasMouseUp, onCanvasMouseLeave } =
    useGammaAnnotation(slideIdx, onStrokeComplete, onClear);
  React.useEffect(() => { toggleAnnot(mode); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <canvas
        data-testid="canvas"
        ref={canvasRef}
        onMouseDown={onCanvasMouseDown}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={onCanvasMouseLeave}
      />
      <button type="button" onClick={clearCanvas}>Избриши</button>
    </div>
  );
}

describe('useGammaAnnotation — stroke recording for live sync (F1)', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, toJSON: () => {},
    } as DOMRect);

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(0) })),
      putImageData: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      lineCap: 'round',
      lineJoin: 'round',
      strokeStyle: '#ef4444',
      lineWidth: 3,
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
  });

  it('emits a completed draw stroke with points normalized 0-1 against the canvas box', () => {
    const onStrokeComplete = vi.fn();
    render(<TestHarness slideIdx={0} mode="draw" onStrokeComplete={onStrokeComplete} />);
    const canvas = screen.getByTestId('canvas');

    fireEvent.mouseDown(canvas, { clientX: 20, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 50 });
    fireEvent.mouseUp(canvas);

    expect(onStrokeComplete).toHaveBeenCalledWith({
      mode: 'draw',
      points: [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }],
      color: '#ef4444',
      width: 3,
    });
  });

  it('emits a highlight stroke with the highlight color/width', () => {
    const onStrokeComplete = vi.fn();
    render(<TestHarness slideIdx={0} mode="highlight" onStrokeComplete={onStrokeComplete} />);
    const canvas = screen.getByTestId('canvas');

    fireEvent.mouseDown(canvas, { clientX: 0, clientY: 0 });
    fireEvent.mouseMove(canvas, { clientX: 200, clientY: 100 });
    fireEvent.mouseUp(canvas);

    expect(onStrokeComplete).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'highlight',
      color: 'rgba(250,204,21,0.35)',
      width: 22,
    }));
  });

  it('does not emit a stroke for a plain click with no drag (only one point)', () => {
    const onStrokeComplete = vi.fn();
    render(<TestHarness slideIdx={0} mode="draw" onStrokeComplete={onStrokeComplete} />);
    const canvas = screen.getByTestId('canvas');

    fireEvent.mouseDown(canvas, { clientX: 20, clientY: 10 });
    fireEvent.mouseUp(canvas);

    expect(onStrokeComplete).not.toHaveBeenCalled();
  });

  it('never records laser-pointer movement as a stroke', () => {
    const onStrokeComplete = vi.fn();
    render(<TestHarness slideIdx={0} mode="laser" onStrokeComplete={onStrokeComplete} />);
    const canvas = screen.getByTestId('canvas');

    fireEvent.mouseDown(canvas, { clientX: 20, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 50 });
    fireEvent.mouseUp(canvas);

    expect(onStrokeComplete).not.toHaveBeenCalled();
  });

  it('finishes (and emits) an in-progress stroke on mouse leave, same as mouse up', () => {
    const onStrokeComplete = vi.fn();
    render(<TestHarness slideIdx={0} mode="draw" onStrokeComplete={onStrokeComplete} />);
    const canvas = screen.getByTestId('canvas');

    fireEvent.mouseDown(canvas, { clientX: 20, clientY: 10 });
    fireEvent.mouseMove(canvas, { clientX: 100, clientY: 50 });
    fireEvent.mouseLeave(canvas);

    expect(onStrokeComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onClear when the canvas is cleared', () => {
    const onClear = vi.fn();
    render(<TestHarness slideIdx={0} mode="draw" onClear={onClear} />);

    fireEvent.click(screen.getByText('Избриши'));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
