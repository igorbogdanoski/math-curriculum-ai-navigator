import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Pen, Eraser, Trash2, Grid3X3, AlignJustify, Square } from 'lucide-react';

interface Props {
  className?: string;
}

const STORAGE_KEY = 'math_scratchpad_v1';

export const DigitalScratchpad: React.FC<Props> = ({ className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#1e40af');
  const [isEraser, setIsEraser] = useState(false);
  const [bgType, setBgType] = useState<'none' | 'grid' | 'lines'>('none');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced save to localStorage — 800ms after last stroke
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        // Only save if canvas has visible content (not all transparent pixels)
        localStorage.setItem(STORAGE_KEY, canvas.toDataURL('image/png'));
      } catch { /* storage full — ignore */ }
    }, 800);
  }, []);

  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ctx = canvas.getContext('2d');
      // Save current drawing before resize
      const imgData = ctx?.getImageData(0, 0, canvas.width, canvas.height);

      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;

      if (ctx && imgData) ctx.putImageData(imgData, 0, 0);
    };

    resizeCanvas();

    // Restore saved drawing after canvas is sized
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const img = new Image();
          img.onload = () => ctx.drawImage(img, 0, 0);
          img.src = saved;
        }
      } catch { /* ignore */ }
    }

    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    if ('touches' in e && e.touches.length > 0) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = (e as React.MouseEvent).clientX - rect.left;
      y = (e as React.MouseEvent).clientY - rect.top;
    }
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    setIsDrawing(true);
    const coords = getCoordinates(e.nativeEvent);
    if (!coords || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = isEraser ? 20 : 2;
      ctx.strokeStyle = isEraser ? '#ffffff' : color;
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    if (e.cancelable) e.preventDefault();
    const coords = getCoordinates(e.nativeEvent);
    if (!coords) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      scheduleSave();
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  return (
    <div className={`flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden ${className}`}>
      <div className="flex items-center justify-between p-2 bg-slate-100 border-b border-slate-200">
        {/* Pen / Eraser */}
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsEraser(false)}
            className={`p-1.5 flex items-center justify-center transition-colors ${!isEraser ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Пенкало"
          >
            <Pen className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsEraser(true)}
            className={`p-1.5 flex items-center justify-center transition-colors ${isEraser ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
            title="Бришач"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Background type */}
        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mx-2">
          <button type="button" onClick={() => setBgType('none')} className={`p-1.5 flex items-center justify-center transition-colors ${bgType === 'none' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`} title="Празно"><Square className="w-4 h-4" /></button>
          <button type="button" onClick={() => setBgType('grid')} className={`p-1.5 flex items-center justify-center transition-colors ${bgType === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`} title="Квадратна мрежа"><Grid3X3 className="w-4 h-4" /></button>
          <button type="button" onClick={() => setBgType('lines')} className={`p-1.5 flex items-center justify-center transition-colors ${bgType === 'lines' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`} title="Линии"><AlignJustify className="w-4 h-4" /></button>
        </div>

        {/* Color swatches */}
        {!isEraser && (
          <div className="flex gap-1">
            {['#1e40af', '#b91c1c', '#15803d', '#1f2937'].map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-white ring-2 ring-indigo-500 scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
                title="Боја"
              />
            ))}
          </div>
        )}

        {/* Clear */}
        <button
          type="button"
          onClick={clearCanvas}
          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center"
          title="Исчисти табла"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 min-h-[200px] md:min-h-[300px] w-full bg-white relative cursor-crosshair touch-none"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          className="absolute inset-0 w-full h-full"
        />
        {bgType === 'grid' && (
          <div className="absolute inset-0 pointer-events-none opacity-20 select-none scratchpad-bg-grid" />
        )}
        {bgType === 'lines' && (
          <div className="absolute inset-0 pointer-events-none opacity-20 select-none scratchpad-bg-lines" />
        )}
        {bgType === 'none' && (
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] select-none scratchpad-bg-dots" />
        )}
      </div>
    </div>
  );
};
