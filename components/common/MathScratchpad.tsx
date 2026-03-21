import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Undo2, Redo2, Eraser, PenTool, Trash2, Grid3X3, X, Download, LayoutList, Square } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

interface Point {
    x: number;
    y: number;
    pressure?: number;
}

interface Stroke {
    id: string;
    points: Point[];
    color: string;
    width: number;
    mode: 'draw' | 'erase';
}

type PaperStyle = 'grid' | 'lines' | 'blank';

interface MathScratchpadProps {
    isOpen: boolean;
    onClose: () => void;
}

const COLORS = [
    { id: 'graphite', hex: '#334155', name: 'Графит' },
    { id: 'blue-pen', hex: '#2563eb', name: 'Пенкало' },
    { id: 'red-pen', hex: '#dc2626', name: 'Црвено' },
    { id: 'green-marker', hex: '#16a34a', name: 'Зелено' }
];

const PEN_WIDTHS = [2, 4, 6];
const ERASER_WIDTH = 25;

export const MathScratchpad: React.FC<MathScratchpadProps> = ({ isOpen, onClose }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // State
    const [isDrawing, setIsDrawing] = useState(false);
    const [mode, setMode] = useState<'draw' | 'erase'>('draw');
    const [color, setColor] = useState(COLORS[0].hex);
    const [lineWidth, setLineWidth] = useState(PEN_WIDTHS[0]);
    const [paperStyle, setPaperStyle] = useState<PaperStyle>('grid');

    // History (Undo/Redo)
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [redoStack, setRedoStack] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Dynamic resize handler to keep quality crisp
    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        // Save current content before resize
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        if (tempCtx) {
            tempCtx.drawImage(canvas, 0, 0);
        }

        // Setup pixel ratio for retina displays
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;

        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.scale(dpr, dpr);
            // Restore context settings
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }
        
        // Redraw triggers automatically due to state change usually, 
        // but we explicitly call a redraw of all history
        redrawAll();
    }, [strokes, currentStroke]);

    useEffect(() => {
        if (!isOpen) return;

        // Intial resize
        const timeout = setTimeout(resizeCanvas, 50); // slight delay for DOM to settle
        window.addEventListener('resize', resizeCanvas);
        
        return () => {
            clearTimeout(timeout);
            window.removeEventListener('resize', resizeCanvas);
        };
    }, [isOpen, resizeCanvas]);

    // Render logic (Bezier curve smoothing)
    const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
        if (stroke.points.length === 0) return;
        
        ctx.beginPath();
        ctx.strokeStyle = stroke.mode === 'erase' ? '#ffffff' : stroke.color;
        ctx.lineWidth = stroke.mode === 'erase' ? ERASER_WIDTH : stroke.width;
        
        if (stroke.mode === 'erase') {
            ctx.globalCompositeOperation = 'destination-out'; // This effectively makes drawing transparent
        } else {
            ctx.globalCompositeOperation = 'source-over';
        }

        const pts = stroke.points;
        ctx.moveTo(pts[0].x, pts[0].y);

        if (pts.length < 3) {
            // Point or short line
            ctx.lineTo(pts[0].x + 0.1, pts[0].y + 0.1);
        } else {
            // Draw smooth curves through the points
            for (let i = 1; i < pts.length - 1; i++) {
                const midX = (pts[i].x + pts[i + 1].x) / 2;
                const midY = (pts[i].y + pts[i + 1].y) / 2;
                ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
            }
            // Line to the exact last point
            ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        }
        
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over'; // Reset
    };

    const redrawAll = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        
        // Draw history
        strokes.forEach(s => drawStroke(ctx, s));
        
        // Draw active
        if (currentStroke) {
            drawStroke(ctx, currentStroke);
        }
    }, [strokes, currentStroke]);

    // Redraw whenever strokes change
    useEffect(() => {
        redrawAll();
    }, [strokes, currentStroke, redrawAll]);

    // Pointer Event Handlers
    const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
        const rect = canvasRef.current!.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            pressure: e.pressure
        };
    };

    const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return; // Only left click logic
        e.preventDefault();
        
        const point = getCoordinates(e);
        const newStroke: Stroke = {
            id: Date.now().toString(),
            points: [point],
            color,
            width: lineWidth,
            mode
        };
        
        setIsDrawing(true);
        setCurrentStroke(newStroke);
        // Wipe redo stack on new action
        if (redoStack.length > 0) setRedoStack([]);
        
        // Capture pointer events even if moving out of canvas quickly
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !currentStroke) return;
        e.preventDefault();

        const point = getCoordinates(e);
        
        // Use functional state update to prevent rendering bottleneck lag
        setCurrentStroke(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                points: [...prev.points, point]
            };
        });
    };

    const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !currentStroke) return;
        e.preventDefault();

        setIsDrawing(false);
        setStrokes(prev => [...prev, currentStroke]);
        setCurrentStroke(null);
        
        e.currentTarget.releasePointerCapture(e.pointerId);
    };

    // Actions
    const handleUndo = () => {
        if (strokes.length === 0) return;
        const lastStroke = strokes[strokes.length - 1];
        setStrokes(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, lastStroke]);
    };

    const handleRedo = () => {
        if (redoStack.length === 0) return;
        const redoStroke = redoStack[redoStack.length - 1];
        setRedoStack(prev => prev.slice(0, -1));
        setStrokes(prev => [...prev, redoStroke]);
    };

    const clearCanvas = () => {
        setShowClearConfirm(true);
    };

    const downloadCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Composite over white background (or grid visually)
        const compositeCanvas = document.createElement('canvas');
        compositeCanvas.width = canvas.width;
        compositeCanvas.height = canvas.height;
        const ctx = compositeCanvas.getContext('2d');
        if(ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(canvas, 0, 0);
            
            const link = document.createElement('a');
            link.download = `math-scratchpad-${Date.now()}.png`;
            link.href = compositeCanvas.toDataURL('image/png');
            link.click();
        }
    };

    if (!isOpen) return null;

    // Background selection styles
    const getBgStyle = () => {
        if (paperStyle === 'grid') {
            return {
                backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px), linear-gradient(90deg, #e2e8f0 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                backgroundColor: 'white'
            };
        } else if (paperStyle === 'lines') {
            return {
                backgroundImage: 'linear-gradient(#e2e8f0 1px, transparent 1px)',
                backgroundSize: '100% 30px',
                backgroundColor: 'white'
            };
        }
        return { backgroundColor: 'white' };
    };

    return (
        <div className="flex flex-col bg-white border border-gray-200 shadow-xl rounded-2xl overflow-hidden h-full max-h-[85vh] md:max-h-full animate-in fade-in slide-in-from-right-4 duration-300">
            
            {/* Toolbar */}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex flex-wrap gap-3 justify-between items-center select-none touch-none">
                
                {/* Left controls */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                    <button type="button" aria-label="Врати назад" onClick={handleUndo} disabled={strokes.length === 0} className={`p-2 rounded-lg transition-colors ${strokes.length === 0 ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-100'}`} title="Врати НАЗАД">
                        <Undo2 className="w-5 h-5" />
                    </button>
                    <button type="button" aria-label="Повтори" onClick={handleRedo} disabled={redoStack.length === 0} className={`p-2 rounded-lg transition-colors ${redoStack.length === 0 ? 'text-gray-300' : 'text-gray-700 hover:bg-gray-100'}`} title="Повтори (Redo)">
                        <Redo2 className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-gray-200 mx-1"></div>
                    <button type="button" aria-label="Избриши сè" onClick={clearCanvas} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Избриши СЕ">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>

                {/* Drawing Tools */}
                <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                    <button
                        type="button"
                        aria-label="Режим на цртање"
                        onClick={() => setMode('draw')}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${mode === 'draw' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                        title="Цртај"
                    >
                        <PenTool className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        aria-label="Режим на бришење"
                        onClick={() => setMode('erase')}
                        className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${mode === 'erase' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
                        title="Бриши"
                    >
                        <Eraser className="w-5 h-5" />
                    </button>

                    <div className="w-px h-6 bg-gray-200 mx-1"></div>
                    
                    {/* Colors */}
                    <div className={`flex gap-1 transition-opacity ${mode === 'erase' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                        {COLORS.map(c => (
                            <button
                                key={c.id}
                                type="button"
                                aria-label={`Боја: ${c.name}`}
                                onClick={() => setColor(c.hex)}
                                className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c.hex ? 'scale-110 border-gray-800' : 'border-transparent'}`}
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                            />
                        ))}
                    </div>
                </div>

                {/* Paper Types & End Controls */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                    <button type="button" aria-label="Квадратчиња" onClick={() => setPaperStyle('grid')} className={`p-2 rounded-lg ${paperStyle === 'grid' ? 'bg-gray-200' : 'hover:bg-gray-100'} text-gray-600`} title="Квадратчиња">
                        <Grid3X3 className="w-5 h-5" />
                    </button>
                    <button type="button" aria-label="Линии" onClick={() => setPaperStyle('lines')} className={`p-2 rounded-lg ${paperStyle === 'lines' ? 'bg-gray-200' : 'hover:bg-gray-100'} text-gray-600`} title="Линии">
                        <LayoutList className="w-5 h-5" />
                    </button>
                    <button type="button" aria-label="Чисто" onClick={() => setPaperStyle('blank')} className={`p-2 rounded-lg ${paperStyle === 'blank' ? 'bg-gray-200' : 'hover:bg-gray-100'} text-gray-600`} title="Чисто">
                        <Square className="w-5 h-5 text-gray-400" fill="currentColor"/>
                    </button>

                    <div className="w-px h-6 bg-gray-200 mx-1"></div>

                    <button type="button" aria-label="Зачувај како слика" onClick={downloadCanvas} className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Зачувај како Слика">
                        <Download className="w-5 h-5" />
                    </button>
                    <button type="button" aria-label="Затвори работна табла" onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg ml-1" title="Затвори Работна Табла">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Canvas Container */}
            <div 
                ref={containerRef} 
                className="w-full relative touch-none cursor-crosshair overflow-hidden flex-1 min-h-[400px] md:min-h-[500px]"
                style={getBgStyle()}
            >
                {/* Pointer events bound to canvas for universal device support */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 block touch-none"
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerOut={stopDrawing}
                    onPointerCancel={stopDrawing}
                />
            </div>
            
            {/* Status Footer */}
            <div className="bg-gray-50 text-xs text-gray-400 py-1.5 px-4 flex justify-between border-t border-gray-200">
                <span>Touch, Stylus & Mouse Supported</span>
                <span>History: {strokes.length} strokes</span>
            </div>

            {showClearConfirm && (
                <ConfirmDialog
                    title="Избриши ја таблата?"
                    message="Дали сте сигурни дека сакате да ја избришете целата табла? Сите цртежи ќе се изгубат."
                    variant="danger"
                    confirmLabel="Да, избриши"
                    onConfirm={() => { setShowClearConfirm(false); setStrokes([]); setRedoStack([]); }}
                    onCancel={() => setShowClearConfirm(false)}
                />
            )}
        </div>
    );
};
