import React, { useState, useRef, useEffect } from 'react';
import type { MMNode } from '../../services/gemini/mindmap';
import {
    ASPECT, clampVbWidth, getBranchColor, wrapLabel,
    type Positions, type ViewBox,
} from '../../utils/mindMapLayout';

interface CanvasProps {
    nodes: MMNode[];
    positions: Positions;
    onDrag: (id: string, x: number, y: number) => void;
    onEditRequest: (id: string, label: string) => void;
    onDeleteRequest: (id: string) => void;
    onAddChild: (parentId: string) => void;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
    viewBox: ViewBox;
    setViewBox: React.Dispatch<React.SetStateAction<ViewBox>>;
}

/** Distance between two touch points, for pinch-zoom. */
function touchDistance(a: React.Touch, b: React.Touch): number {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export const MindMapCanvas: React.FC<CanvasProps> = ({
    nodes, positions, onDrag, onEditRequest, onDeleteRequest, onAddChild, selectedId, setSelectedId, viewBox, setViewBox,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const draggingRef = useRef<{ id: string; startMouseX: number; startMouseY: number; startNodeX: number; startNodeY: number } | null>(null);
    const panRef = useRef<{ startClientX: number; startClientY: number; startViewBox: ViewBox } | null>(null);
    const pinchRef = useRef<{ startDistance: number; startViewBox: ViewBox } | null>(null);
    const [isPanning, setIsPanning] = useState(false);

    const getSVGPoint = (clientX: number, clientY: number): { x: number; y: number } => {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };
        const rect = svg.getBoundingClientRect();
        const scaleX = viewBox.w / rect.width;
        const scaleY = viewBox.h / rect.height;
        return { x: viewBox.x + (clientX - rect.left) * scaleX, y: viewBox.y + (clientY - rect.top) * scaleY };
    };

    /** Zooms so the given screen point stays fixed under the cursor/fingers. */
    const zoomAtClientPoint = (clientX: number, clientY: number, factor: number) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        setViewBox(prev => {
            const ratioX = (clientX - rect.left) / rect.width;
            const ratioY = (clientY - rect.top) / rect.height;
            const pointX = prev.x + ratioX * prev.w;
            const pointY = prev.y + ratioY * prev.h;
            const newW = clampVbWidth(prev.w * factor);
            const newH = newW * ASPECT;
            return { x: pointX - ratioX * newW, y: pointY - ratioY * newH, w: newW, h: newH };
        });
    };

    // Native (non-passive) wheel listener — React's onWheel prop can't reliably
    // preventDefault() the page scroll since React treats wheel listeners as passive.
    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            zoomAtClientPoint(e.clientX, e.clientY, e.deltaY > 0 ? 1.15 : 1 / 1.15);
        };
        svg.addEventListener('wheel', onWheel, { passive: false });
        return () => svg.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedId(id);
        const pt = getSVGPoint(e.clientX, e.clientY);
        const np = positions[id] ?? { x: 0, y: 0 };
        draggingRef.current = { id, startMouseX: pt.x, startMouseY: pt.y, startNodeX: np.x, startNodeY: np.y };
    };

    /** Mousedown on the canvas background itself (node handlers stop propagation, so this never fires for node drags) starts a pan. */
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        panRef.current = { startClientX: e.clientX, startClientY: e.clientY, startViewBox: viewBox };
        setIsPanning(true);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (draggingRef.current) {
            const { id, startMouseX, startMouseY, startNodeX, startNodeY } = draggingRef.current;
            const pt = getSVGPoint(e.clientX, e.clientY);
            onDrag(id, startNodeX + (pt.x - startMouseX), startNodeY + (pt.y - startMouseY));
            return;
        }
        if (panRef.current) {
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const { startClientX, startClientY, startViewBox } = panRef.current;
            const dx = (e.clientX - startClientX) * (startViewBox.w / rect.width);
            const dy = (e.clientY - startClientY) * (startViewBox.h / rect.height);
            setViewBox({ ...startViewBox, x: startViewBox.x - dx, y: startViewBox.y - dy });
        }
    };

    const handleMouseUp = () => { draggingRef.current = null; panRef.current = null; setIsPanning(false); };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            draggingRef.current = null;
            pinchRef.current = { startDistance: touchDistance(e.touches[0], e.touches[1]), startViewBox: viewBox };
        } else if (e.touches.length === 1 && !draggingRef.current) {
            panRef.current = { startClientX: e.touches[0].clientX, startClientY: e.touches[0].clientY, startViewBox: viewBox };
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (pinchRef.current && e.touches.length === 2) {
            e.preventDefault();
            const { startDistance, startViewBox } = pinchRef.current;
            const newDistance = touchDistance(e.touches[0], e.touches[1]);
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const ratioX = (midX - rect.left) / rect.width;
            const ratioY = (midY - rect.top) / rect.height;
            const pointX = startViewBox.x + ratioX * startViewBox.w;
            const pointY = startViewBox.y + ratioY * startViewBox.h;
            const newW = clampVbWidth(startViewBox.w * (startDistance / newDistance));
            const newH = newW * ASPECT;
            setViewBox({ x: pointX - ratioX * newW, y: pointY - ratioY * newH, w: newW, h: newH });
            return;
        }
        if (panRef.current && e.touches.length === 1) {
            const svg = svgRef.current;
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const { startClientX, startClientY, startViewBox } = panRef.current;
            const dx = (e.touches[0].clientX - startClientX) * (startViewBox.w / rect.width);
            const dy = (e.touches[0].clientY - startClientY) * (startViewBox.h / rect.height);
            setViewBox({ ...startViewBox, x: startViewBox.x - dx, y: startViewBox.y - dy });
        }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (e.touches.length < 2) pinchRef.current = null;
        if (e.touches.length < 1) panRef.current = null;
    };

    const nodeRadius = (node: MMNode) => node.level === 0 ? 52 : node.level === 1 ? 40 : 32;

    return (
        <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className="w-full h-full select-none"
            style={{ cursor: isPanning ? 'grabbing' : 'grab', touchAction: 'none' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => setSelectedId(null)}
        >
            {/* ── Edges ── */}
            {nodes.filter(n => n.parentId).map(n => {
                const from = positions[n.parentId!];
                const to = positions[n.id];
                if (!from || !to) return null;
                const color = getBranchColor(nodes, n.id);
                const mx = (from.x + to.x) / 2;
                const my = (from.y + to.y) / 2;
                return (
                    <path
                        key={`edge-${n.id}`}
                        d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
                        stroke={color}
                        strokeWidth={n.level === 1 ? 2.5 : 1.8}
                        fill="none"
                        opacity={0.5}
                    />
                );
            })}

            {/* ── Nodes ── */}
            {nodes.map(n => {
                const pos = positions[n.id];
                if (!pos) return null;
                const r = nodeRadius(n);
                const color = getBranchColor(nodes, n.id);
                const isSelected = selectedId === n.id;
                const lines = wrapLabel(`${n.emoji ?? ''} ${n.label}`.trim(), n.level === 0 ? 20 : n.level === 1 ? 16 : 18);
                const lineH = n.level === 0 ? 14 : 12;

                return (
                    <g
                        key={n.id}
                        style={{ cursor: 'grab' }}
                        onMouseDown={e => handleMouseDown(e, n.id)}
                        onDoubleClick={e => { e.stopPropagation(); onEditRequest(n.id, n.label); }}
                        onClick={e => { e.stopPropagation(); setSelectedId(n.id); }}
                    >
                        {/* Shadow */}
                        <ellipse cx={pos.x + 2} cy={pos.y + 3} rx={r} ry={r * 0.65} fill="rgba(0,0,0,0.08)" />
                        {/* Main circle */}
                        <ellipse
                            cx={pos.x} cy={pos.y}
                            rx={r} ry={r * 0.65}
                            fill={n.level === 0 ? color : n.level === 1 ? color : `${color}22`}
                            stroke={color}
                            strokeWidth={isSelected ? 3 : n.level === 0 ? 0 : 1.5}
                            strokeDasharray={isSelected ? '4 2' : 'none'}
                        />
                        {/* Label */}
                        {lines.map((line, li) => (
                            <text
                                key={li}
                                x={pos.x}
                                y={pos.y + (li - (lines.length - 1) / 2) * lineH}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={n.level === 0 ? 12 : n.level === 1 ? 10 : 9}
                                fontWeight={n.level === 0 ? '700' : n.level === 1 ? '600' : '400'}
                                fill={n.level === 2 ? color : '#fff'}
                                style={{ pointerEvents: 'none' }}
                            >
                                {line}
                            </text>
                        ))}

                        {/* Actions when selected */}
                        {isSelected && n.level < 2 && (
                            <g onClick={e => { e.stopPropagation(); onAddChild(n.id); }}>
                                <circle cx={pos.x + r + 10} cy={pos.y} r={9} fill="#10b981" opacity={0.9} style={{ cursor: 'pointer' }} />
                                <text x={pos.x + r + 10} y={pos.y} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="#fff" style={{ pointerEvents: 'none' }}>+</text>
                            </g>
                        )}
                        {isSelected && n.level > 0 && (
                            <g onClick={e => { e.stopPropagation(); onDeleteRequest(n.id); }}>
                                <circle cx={pos.x - r - 10} cy={pos.y} r={9} fill="#ef4444" opacity={0.9} style={{ cursor: 'pointer' }} />
                                <text x={pos.x - r - 10} y={pos.y} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#fff" style={{ pointerEvents: 'none' }}>✕</text>
                            </g>
                        )}
                    </g>
                );
            })}
        </svg>
    );
};
