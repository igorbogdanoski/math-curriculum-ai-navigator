import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import type Konva from 'konva';
import { Pencil, Eraser, Trash2, Undo2, Download } from 'lucide-react';

type Tool = 'pencil' | 'eraser';

interface DrawLine {
  tool: Tool;
  points: number[];
  color: string;
  width: number;
}

const PALETTE = ['#1e293b', '#ef4444', '#3b82f6', '#16a34a', '#f59e0b', '#a855f7'];
const WIDTHS = [2, 4, 8, 16];

export interface DrawingCanvasProps {
  height?: number;
}

export const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ height = 320 }) => {
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#1e293b');
  const [lineWidth, setLineWidth] = useState(4);
  const [lines, setLines] = useState<DrawLine[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [stageWidth, setStageWidth] = useState(400);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Track container width so canvas stays responsive
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setStageWidth(Math.floor(w));
    });
    ro.observe(el);
    setStageWidth(Math.floor(el.clientWidth || 400));
    return () => ro.disconnect();
  }, []);

  // Undo history held in refs to avoid stale-closure issues inside Konva callbacks
  const snapshotsRef = useRef<DrawLine[][]>([[]]);
  const snapIdxRef = useRef(0);
  const drawing = useRef(false);
  const stageRef = useRef<Konva.Stage | null>(null);

  const getPos = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) =>
    e.target.getStage()?.getPointerPosition() ?? null;

  const onDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      const pos = getPos(e);
      if (!pos) return;
      drawing.current = true;
      setLines(prev => [
        ...prev,
        { tool, points: [pos.x, pos.y], color, width: lineWidth },
      ]);
    },
    [tool, color, lineWidth],
  );

  const onMove = useCallback((e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!drawing.current) return;
    const pos = getPos(e);
    if (!pos) return;
    setLines(prev => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last) return prev;
      next[next.length - 1] = { ...last, points: [...last.points, pos.x, pos.y] };
      return next;
    });
  }, []);

  const onUp = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    setLines(current => {
      const trimmed = snapshotsRef.current.slice(0, snapIdxRef.current + 1);
      const newSnaps = [...trimmed, [...current]];
      snapshotsRef.current = newSnaps;
      snapIdxRef.current = newSnaps.length - 1;
      setCanUndo(snapIdxRef.current > 0);
      return current;
    });
  }, []);

  const undo = () => {
    if (snapIdxRef.current <= 0) return;
    snapIdxRef.current -= 1;
    const snap = snapshotsRef.current[snapIdxRef.current] ?? [];
    setLines([...snap]);
    setCanUndo(snapIdxRef.current > 0);
  };

  const clear = () => {
    setLines([]);
    snapshotsRef.current = [[]];
    snapIdxRef.current = 0;
    setCanUndo(false);
  };

  const exportPng = () => {
    const uri = stageRef.current?.toDataURL({ pixelRatio: 2 });
    if (!uri) return;
    const a = document.createElement('a');
    a.href = uri;
    a.download = 'drawing.png';
    a.click();
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white overflow-hidden shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 bg-indigo-50 border-b border-indigo-100">
        <button
          type="button"
          title="Молив"
          onClick={() => setTool('pencil')}
          className={`p-1.5 rounded-lg transition-colors ${tool === 'pencil' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Гума"
          onClick={() => setTool('eraser')}
          className={`p-1.5 rounded-lg transition-colors ${tool === 'eraser' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <Eraser className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-indigo-200 mx-0.5" />

        {PALETTE.map(c => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => { setColor(c); setTool('pencil'); }}
            className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 flex-shrink-0"
            style={{
              background: c,
              borderColor: color === c ? '#6366f1' : 'transparent',
              boxShadow: color === c ? '0 0 0 1px #6366f1' : undefined,
            }}
          />
        ))}

        <div className="w-px h-5 bg-indigo-200 mx-0.5" />

        {WIDTHS.map(w => (
          <button
            key={w}
            type="button"
            title={`Дебелина ${w}`}
            onClick={() => setLineWidth(w)}
            className={`flex items-center justify-center w-7 h-7 rounded-lg transition-colors ${lineWidth === w ? 'bg-indigo-100' : 'hover:bg-gray-100'}`}
          >
            <div
              className="rounded-full bg-gray-700"
              style={{ width: Math.min(w * 1.8, 16), height: Math.min(w * 1.8, 16) }}
            />
          </button>
        ))}

        <div className="w-px h-5 bg-indigo-200 mx-0.5" />

        <button
          type="button"
          title="Врати (Undo)"
          onClick={undo}
          disabled={!canUndo}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Исчисти сè"
          onClick={clear}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Превземи PNG"
          onClick={exportPng}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas — ref used by ResizeObserver for responsive width */}
      <div ref={containerRef} className="w-full" style={{ touchAction: 'none', cursor: 'crosshair' }}>
        <Stage
          ref={stageRef}
          width={stageWidth}
          height={height}
          onMouseDown={onDown}
          onMouseMove={onMove}
          onMouseUp={onUp}
          onTouchStart={onDown}
          onTouchMove={onMove}
          onTouchEnd={onUp}
          style={{ display: 'block', background: '#ffffff' }}
        >
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={line.tool === 'eraser' ? '#ffffff' : line.color}
                strokeWidth={line.tool === 'eraser' ? line.width * 5 : line.width}
                tension={0.4}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
};
