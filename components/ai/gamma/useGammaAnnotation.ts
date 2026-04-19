/**
 * useGammaAnnotation — canvas annotation state + handlers for Gamma Mode.
 * Handles draw, highlight, laser pointer, undo stack, and canvas resize.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export type AnnotMode = 'draw' | 'highlight' | 'laser' | null;

export interface GammaAnnotationHandlers {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  annotMode: AnnotMode;
  hasAnnotations: boolean;
  laserPos: { x: number; y: number } | null;
  undoCount: number;
  toggleAnnot: (mode: AnnotMode) => void;
  clearCanvas: () => void;
  undoAnnotation: () => void;
  onCanvasMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseUp: () => void;
  onCanvasMouseLeave: () => void;
}

export function useGammaAnnotation(slideIdx: number): GammaAnnotationHandlers {
  const [annotMode, setAnnotMode] = useState<AnnotMode>(null);
  const [hasAnnotations, setHasAnnot] = useState(false);
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const [undoCount, setUndoCount] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const undoStackRef = useRef<ImageData[]>([]);

  // Resize canvas preserving drawings
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w === 0 || h === 0) return;
      const tmp = document.createElement('canvas');
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      const tmpCtx = tmp.getContext('2d');
      if (tmpCtx) tmpCtx.drawImage(canvas, 0, 0);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(tmp, 0, 0);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // Clear canvas on slide change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    setHasAnnot(false);
    setLaserPos(null);
    undoStackRef.current = [];
    setUndoCount(0);
  }, [slideIdx]);

  const toggleAnnot = useCallback((mode: AnnotMode) => {
    setAnnotMode(prev => prev === mode ? null : mode);
    setLaserPos(null);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    setUndoCount(undoStackRef.current.length);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasAnnot(false);
  }, []);

  const undoAnnotation = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || undoStackRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const prev = undoStackRef.current.pop()!;
    setUndoCount(undoStackRef.current.length);
    ctx.putImageData(prev, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    setHasAnnot(data.some(v => v !== 0));
  }, []);

  const onCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (annotMode === 'laser' || !annotMode) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      undoStackRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
      setUndoCount(undoStackRef.current.length);
    }
    const rect = canvas.getBoundingClientRect();
    isDrawingRef.current = true;
    lastPosRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, [annotMode]);

  const onCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (annotMode === 'laser') { setLaserPos({ x, y }); return; }
    if (!isDrawingRef.current || !annotMode) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(x, y);
    ctx.strokeStyle = annotMode === 'highlight' ? 'rgba(250,204,21,0.35)' : '#ef4444';
    ctx.lineWidth = annotMode === 'highlight' ? 22 : 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPosRef.current = { x, y };
    setHasAnnot(true);
  }, [annotMode]);

  const onCanvasMouseUp = useCallback(() => { isDrawingRef.current = false; }, []);
  const onCanvasMouseLeave = useCallback(() => { isDrawingRef.current = false; setLaserPos(null); }, []);

  return {
    canvasRef,
    annotMode,
    hasAnnotations,
    laserPos,
    undoCount,
    toggleAnnot,
    clearCanvas,
    undoAnnotation,
    onCanvasMouseDown,
    onCanvasMouseMove,
    onCanvasMouseUp,
    onCanvasMouseLeave,
  };
}
