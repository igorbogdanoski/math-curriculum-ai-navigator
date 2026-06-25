import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { useNotification } from '../contexts/NotificationContext';
import { generateMindMap, MMNode } from '../services/gemini/mindmap';

// ── Constants ─────────────────────────────────────────────────────────────────

const SVG_W = 1000;
const SVG_H = 660;
const CX = SVG_W / 2;
const CY = SVG_H / 2;
const R1 = 185;   // level-1 radius from center
const R2 = 145;   // level-2 radius from parent

const BRANCH_COLORS = [
    '#4f46e5', '#0891b2', '#059669', '#d97706',
    '#dc2626', '#7c3aed', '#db2777', '#0d9488',
];

// ── Layout ────────────────────────────────────────────────────────────────────

type Positions = Record<string, { x: number; y: number }>;

function buildLayout(nodes: MMNode[]): Positions {
    const pos: Positions = {};
    const root = nodes.find(n => n.level === 0);
    if (!root) return pos;
    pos[root.id] = { x: CX, y: CY };

    const lvl1 = nodes.filter(n => n.level === 1);
    lvl1.forEach((n, i) => {
        const angle = (i / lvl1.length) * Math.PI * 2 - Math.PI / 2;
        pos[n.id] = { x: CX + Math.cos(angle) * R1, y: CY + Math.sin(angle) * R1 * 0.85 };
    });

    const lvl2 = nodes.filter(n => n.level === 2);
    const byParent = new Map<string, MMNode[]>();
    for (const n of lvl2) {
        if (!n.parentId) continue;
        if (!byParent.has(n.parentId)) byParent.set(n.parentId, []);
        byParent.get(n.parentId)!.push(n);
    }
    for (const [pid, children] of byParent) {
        const pp = pos[pid];
        if (!pp) continue;
        const toCenter = Math.atan2(pp.y - CY, pp.x - CX);
        children.forEach((n, i) => {
            const spread = children.length > 1 ? 0.45 : 0;
            const angle = toCenter + (i - (children.length - 1) / 2) * spread;
            pos[n.id] = {
                x: pp.x + Math.cos(angle) * R2,
                y: pp.y + Math.sin(angle) * R2 * 0.85,
            };
        });
    }
    return pos;
}

// ── Text wrap helper ──────────────────────────────────────────────────────────

function wrapLabel(label: string, maxChars = 18): string[] {
    if (label.length <= maxChars) return [label];
    const words = label.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
        if ((cur + ' ' + w).trim().length > maxChars && cur) {
            lines.push(cur);
            cur = w;
        } else {
            cur = cur ? cur + ' ' + w : w;
        }
    }
    if (cur) lines.push(cur);
    return lines;
}

// ── Branch color helper ───────────────────────────────────────────────────────

function getBranchColor(nodes: MMNode[], nodeId: string): string {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return '#6b7280';
    if (node.level === 0) return '#1e1b4b';
    const root = nodes.find(n => n.level === 0);
    if (node.level === 1) {
        const lvl1 = nodes.filter(n => n.level === 1 && n.parentId === root?.id);
        const idx = lvl1.findIndex(n => n.id === nodeId);
        return BRANCH_COLORS[idx % BRANCH_COLORS.length];
    }
    // Level 2: same color as parent branch
    const parent = nodes.find(n => n.id === node.parentId);
    if (!parent) return '#6b7280';
    return getBranchColor(nodes, parent.id);
}

// ── SVG Canvas ────────────────────────────────────────────────────────────────

interface CanvasProps {
    nodes: MMNode[];
    positions: Positions;
    onDrag: (id: string, x: number, y: number) => void;
    onEditRequest: (id: string, label: string) => void;
    onDeleteRequest: (id: string) => void;
    onAddChild: (parentId: string) => void;
    selectedId: string | null;
    setSelectedId: (id: string | null) => void;
}

const MindMapCanvas: React.FC<CanvasProps> = ({
    nodes, positions, onDrag, onEditRequest, onDeleteRequest, onAddChild, selectedId, setSelectedId,
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const draggingRef = useRef<{ id: string; startMouseX: number; startMouseY: number; startNodeX: number; startNodeY: number } | null>(null);

    const getSVGPoint = (e: React.MouseEvent): { x: number; y: number } => {
        const svg = svgRef.current;
        if (!svg) return { x: 0, y: 0 };
        const rect = svg.getBoundingClientRect();
        const scaleX = SVG_W / rect.width;
        const scaleY = SVG_H / rect.height;
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    const handleMouseDown = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedId(id);
        const pt = getSVGPoint(e);
        const np = positions[id] ?? { x: 0, y: 0 };
        draggingRef.current = { id, startMouseX: pt.x, startMouseY: pt.y, startNodeX: np.x, startNodeY: np.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!draggingRef.current) return;
        const { id, startMouseX, startMouseY, startNodeX, startNodeY } = draggingRef.current;
        const pt = getSVGPoint(e);
        onDrag(id, startNodeX + (pt.x - startMouseX), startNodeY + (pt.y - startMouseY));
    };

    const handleMouseUp = () => { draggingRef.current = null; };

    const nodeRadius = (node: MMNode) => node.level === 0 ? 52 : node.level === 1 ? 40 : 32;

    return (
        <svg
            ref={svgRef}
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-full select-none cursor-default"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
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

// ── Main View ─────────────────────────────────────────────────────────────────

export const AIMindMapView: React.FC = () => {
    const { addNotification } = useNotification();
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({ contentRef: printRef });

    const [topic, setTopic] = useState('');
    const [grade, setGrade] = useState(8);
    const [isGenerating, setIsGenerating] = useState(false);
    const [nodes, setNodes] = useState<MMNode[]>([]);
    const [positions, setPositions] = useState<Positions>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editState, setEditState] = useState<{ id: string; value: string } | null>(null);

    // Load prefill from sessionStorage (other views can set 'mindmap_prefill')
    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('mindmap_prefill');
            if (raw) {
                const { topic: t, grade: g } = JSON.parse(raw);
                if (t) setTopic(t);
                if (g) setGrade(g);
                sessionStorage.removeItem('mindmap_prefill');
            }
        } catch { /* ignore */ }
    }, []);

    const handleGenerate = async () => {
        if (!topic.trim()) { addNotification('Внесете тема.', 'warning'); return; }
        setIsGenerating(true);
        try {
            const data = await generateMindMap(topic.trim(), grade);
            const layout = buildLayout(data.nodes);
            setNodes(data.nodes);
            setPositions(layout);
            setSelectedId(null);
        } catch {
            addNotification('Грешка при генерирање. Обидете се повторно.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDrag = useCallback((id: string, x: number, y: number) => {
        setPositions(prev => ({ ...prev, [id]: { x, y } }));
    }, []);

    const handleEditRequest = useCallback((id: string, label: string) => {
        setEditState({ id, value: label });
    }, []);

    const commitEdit = () => {
        if (!editState) return;
        setNodes(prev => prev.map(n => n.id === editState.id ? { ...n, label: editState.value } : n));
        setEditState(null);
    };

    const handleDeleteRequest = useCallback((id: string) => {
        // Delete node and all descendants
        const toDelete = new Set<string>([id]);
        let changed = true;
        while (changed) {
            changed = false;
            for (const n of nodes) {
                if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
                    toDelete.add(n.id); changed = true;
                }
            }
        }
        setNodes(prev => prev.filter(n => !toDelete.has(n.id)));
        setPositions(prev => {
            const next = { ...prev };
            for (const id of toDelete) delete next[id];
            return next;
        });
        setSelectedId(null);
    }, [nodes]);

    const handleAddChild = useCallback((parentId: string) => {
        const parent = nodes.find(n => n.id === parentId);
        if (!parent) return;
        const newLevel = Math.min(parent.level + 1, 2) as 0 | 1 | 2;
        const newId = `manual-${Date.now()}`;
        const parentPos = positions[parentId] ?? { x: CX, y: CY };
        const newNode: MMNode = { id: newId, label: 'Нов јазол', level: newLevel, parentId };
        setNodes(prev => [...prev, newNode]);
        setPositions(prev => ({
            ...prev,
            [newId]: { x: parentPos.x + 160, y: parentPos.y + 40 },
        }));
        setEditState({ id: newId, value: 'Нов јазол' });
    }, [nodes, positions]);

    // Summary counts
    const lvl1Count = useMemo(() => nodes.filter(n => n.level === 1).length, [nodes]);
    const lvl2Count = useMemo(() => nodes.filter(n => n.level === 2).length, [nodes]);

    const hasMindMap = nodes.length > 0;

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
            {/* ── Header ── */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        🧠 AI Концептуална Карта
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">
                        Внеси тема → AI ја гради картата → влечи јазли, уредувај, печати.
                    </p>
                </div>
                {hasMindMap && (
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{lvl1Count} гранки · {lvl2Count} листови</span>
                        <button
                            type="button"
                            onClick={() => handlePrint()}
                            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition"
                        >
                            <ICONS.printer className="w-4 h-4" />
                            Печати
                        </button>
                    </div>
                )}
            </div>

            {/* ── Controls ── */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Тема</label>
                        <input
                            type="text"
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
                            placeholder="пр. Геометриски фигури, Дропки, Линеарни равенки..."
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none"
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Одделение</label>
                        <select
                            value={grade}
                            onChange={e => setGrade(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-violet-300 outline-none"
                            aria-label="Избери одделение"
                        >
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => (
                                <option key={g} value={g}>{g}. одд.</option>
                            ))}
                        </select>
                    </div>
                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isGenerating || !topic.trim()}
                        className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 disabled:opacity-60 transition shadow-sm"
                    >
                        {isGenerating ? (
                            <><ICONS.spinner className="w-4 h-4 animate-spin" /> Генерирам...</>
                        ) : (
                            <>🧠 {hasMindMap ? 'Регенерирај' : 'Генерирај'}</>
                        )}
                    </button>
                </div>
                {hasMindMap && (
                    <p className="text-[10px] text-gray-400 mt-2">
                        Двоен клик на јазол = уреди · Кликни јазол → (+) додади дете, (✕) избриши
                    </p>
                )}
            </Card>

            {/* ── Edit overlay ── */}
            {editState && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={commitEdit}>
                    <div className="bg-white rounded-xl shadow-2xl p-4 w-80" onClick={e => e.stopPropagation()}>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Уреди јазол</label>
                        <input
                            autoFocus
                            type="text"
                            value={editState.value}
                            onChange={e => setEditState(prev => prev ? { ...prev, value: e.target.value } : null)}
                            onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditState(null); }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-300 outline-none"
                        />
                        <div className="flex gap-2 mt-3">
                            <button type="button" onClick={commitEdit} className="flex-1 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700">
                                Зачувај (Enter)
                            </button>
                            <button type="button" onClick={() => setEditState(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
                                Откажи
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Canvas ── */}
            {hasMindMap ? (
                <div ref={printRef}>
                    {/* Print header */}
                    <div className="hidden print:block text-center mb-4">
                        <h2 className="text-xl font-bold">{nodes.find(n => n.level === 0)?.label}</h2>
                        <p className="text-sm text-gray-500">{grade}. одделение</p>
                    </div>
                    <Card className="p-0 overflow-hidden">
                        <div className="h-[65vh] print:h-auto print:min-h-[550px] bg-gradient-to-br from-slate-50 to-violet-50/30">
                            <MindMapCanvas
                                nodes={nodes}
                                positions={positions}
                                onDrag={handleDrag}
                                onEditRequest={handleEditRequest}
                                onDeleteRequest={handleDeleteRequest}
                                onAddChild={handleAddChild}
                                selectedId={selectedId}
                                setSelectedId={setSelectedId}
                            />
                        </div>
                    </Card>
                    {/* Color legend */}
                    <div className="flex flex-wrap gap-3 pt-2 print:hidden">
                        {nodes.filter(n => n.level === 1).map((n, i) => (
                            <span key={n.id} className="flex items-center gap-1 text-xs text-gray-600">
                                <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: BRANCH_COLORS[i % BRANCH_COLORS.length] }} />
                                {n.label}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-24 bg-gradient-to-br from-violet-50 to-indigo-50 rounded-2xl border-2 border-dashed border-violet-100">
                    <div className="text-6xl mb-4">🧠</div>
                    <h3 className="text-lg font-bold text-gray-700 mb-1">Внеси тема и генерирај концептуална карта</h3>
                    <p className="text-sm text-gray-400 max-w-sm text-center">
                        AI автоматски ја гради хиерархијата на поими, формули и врски за одбраната тема.
                    </p>
                    <div className="flex gap-3 mt-4 flex-wrap justify-center">
                        {['Дропки', 'Геометриски тела', 'Линеарни функции', 'Матрици'].map(ex => (
                            <button
                                key={ex}
                                type="button"
                                onClick={() => { setTopic(ex); }}
                                className="px-3 py-1.5 text-xs bg-white border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 transition"
                            >
                                {ex}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <style>{`
                @media print {
                    body > * { visibility: hidden; }
                    .print\\:block, .print\\:h-auto, .print\\:min-h-\\[550px\\] { visibility: visible; }
                }
            `}</style>
        </div>
    );
};
