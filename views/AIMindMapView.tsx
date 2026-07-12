import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import { usePlanning } from '../contexts/PlanningContext';
import { useNavigation } from '../contexts/NavigationContext';
import { PlanningChainBar } from '../components/planner/PlanningChainBar';
import { MindMapCanvas } from '../components/mindmap/MindMapCanvas';
import { generateMindMap, MMNode, type MindMapGroundingTopic } from '../services/gemini/mindmap';
import { saveMindMap, fetchMyMindMaps, fetchMindMap, type SavedMindMap } from '../services/firestoreService.mindMaps';
import { useCurriculum } from '../hooks/useCurriculum';
import {
    SVG_W, SVG_H, CX, CY, ASPECT, BRANCH_COLORS, DEFAULT_VIEW_BOX, clampVbWidth,
    buildLayout, findGroundingTopic, type Positions, type ViewBox,
} from '../utils/mindMapLayout';

// ── Main View ─────────────────────────────────────────────────────────────────

export const AIMindMapView: React.FC = () => {
    const { addNotification } = useNotification();
    const { user, firebaseUser } = useAuth();
    const { setPlanningState } = usePlanning();
    const { navigate } = useNavigation();
    const { curriculum } = useCurriculum();
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({ contentRef: printRef });

    const [topic, setTopic] = useState('');
    const [grade, setGrade] = useState(8);
    const [isGenerating, setIsGenerating] = useState(false);
    const [nodes, setNodes] = useState<MMNode[]>([]);
    const [positions, setPositions] = useState<Positions>({});
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editState, setEditState] = useState<{ id: string; value: string } | null>(null);
    const [isGrounded, setIsGrounded] = useState(false);
    const [viewBox, setViewBox] = useState<ViewBox>(DEFAULT_VIEW_BOX);

    // Persistence — a saved map has an id; a fresh/unsaved generation doesn't.
    const [currentMapId, setCurrentMapId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [myMaps, setMyMaps] = useState<SavedMindMap[]>([]);

    const refreshMyMaps = useCallback(async () => {
        if (!firebaseUser?.uid) return;
        setMyMaps(await fetchMyMindMaps(firebaseUser.uid));
    }, [firebaseUser?.uid]);

    useEffect(() => { refreshMyMaps(); }, [refreshMyMaps]);

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
            const gradeMatch = curriculum?.grades.find(g => g.level === grade);
            const matchedTopic = gradeMatch ? findGroundingTopic(gradeMatch.topics, topic.trim()) : undefined;
            const grounding: MindMapGroundingTopic | undefined = matchedTopic
                ? { title: matchedTopic.title, concepts: matchedTopic.concepts.map(c => ({ title: c.title, description: c.description })) }
                : undefined;
            const data = await generateMindMap(topic.trim(), grade, user ?? undefined, grounding);
            const layout = buildLayout(data.nodes);
            setNodes(data.nodes);
            setPositions(layout);
            setSelectedId(null);
            setCurrentMapId(null); // fresh generation — not yet saved under any id
            setIsGrounded(!!grounding);
            setViewBox(DEFAULT_VIEW_BOX);
        } catch {
            addNotification('Грешка при генерирање. Обидете се повторно.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveMap = async () => {
        if (!firebaseUser?.uid) { addNotification('Мора да сте најавени за да зачувате.', 'warning'); return; }
        if (nodes.length === 0) return;
        setIsSaving(true);
        try {
            const id = await saveMindMap(firebaseUser.uid, topic.trim() || nodes[0]?.label || 'Концептуална карта', grade, nodes, currentMapId ?? undefined);
            setCurrentMapId(id);
            addNotification('Концептуалната карта е зачувана!', 'success');
            await refreshMyMaps();
        } catch {
            addNotification('Грешка при зачувување.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadMap = async (id: string) => {
        if (!id) return;
        const saved = await fetchMindMap(id);
        if (!saved) { addNotification('Картата не е пронајдена.', 'error'); return; }
        setTopic(saved.topic);
        setGrade(saved.gradeLevel);
        setNodes(saved.nodes);
        setPositions(buildLayout(saved.nodes));
        setSelectedId(null);
        setCurrentMapId(saved.id);
        setIsGrounded(false); // unknown for previously-saved maps — don't claim a grounding we didn't just compute
        setViewBox(DEFAULT_VIEW_BOX);
    };

    const handleGenerateLesson = () => {
        const rootLabel = nodes.find(n => n.level === 0)?.label ?? topic;
        setPlanningState({ themeName: rootLabel });
        const params = new URLSearchParams({
            prefillTopic: rootLabel,
            prefillGrade: String(grade),
        });
        navigate(`/planner/lesson/new?${params.toString()}`);
    };

    /** Rasterizes the current SVG canvas to a PNG and downloads it — no extra dependency needed. */
    const handleExportPNG = () => {
        const svg = printRef.current?.querySelector('svg');
        if (!svg) return;
        const svgString = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = 2; // basic supersampling for a crisper export
            canvas.width = SVG_W * scale;
            canvas.height = SVG_H * scale;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.scale(scale, scale);
                ctx.drawImage(img, 0, 0, SVG_W, SVG_H);
            }
            URL.revokeObjectURL(url);
            const link = document.createElement('a');
            link.download = `${(topic || 'koncept-karta').trim().replace(/\s+/g, '-')}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        };
        img.src = url;
    };

    const handleDrag = useCallback((id: string, x: number, y: number) => {
        setPositions(prev => ({ ...prev, [id]: { x, y } }));
    }, []);

    /** Button-triggered zoom, centered on the current view rather than a cursor position. */
    const zoomByFactor = useCallback((factor: number) => {
        setViewBox(prev => {
            const cx = prev.x + prev.w / 2;
            const cy = prev.y + prev.h / 2;
            const newW = clampVbWidth(prev.w * factor);
            const newH = newW * ASPECT;
            return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH };
        });
    }, []);
    const resetView = useCallback(() => setViewBox(DEFAULT_VIEW_BOX), []);

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
            <PlanningChainBar currentStep="thematic" />

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
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {myMaps.length > 0 && (
                        <select
                            value={currentMapId ?? ''}
                            onChange={e => e.target.value && handleLoadMap(e.target.value)}
                            aria-label="Мои карти"
                            className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-300 outline-none"
                        >
                            <option value="">📂 Мои карти ({myMaps.length})</option>
                            {myMaps.map(m => (
                                <option key={m.id} value={m.id}>{m.topic} — {m.gradeLevel}. одд.</option>
                            ))}
                        </select>
                    )}
                    {hasMindMap && (
                        <>
                            {isGrounded && (
                                <span
                                    title="Картата е заснована на реални концепти од наставната програма за оваа тема."
                                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full"
                                >
                                    ✓ Наставна програма
                                </span>
                            )}
                            <span className="text-xs text-gray-400">{lvl1Count} гранки · {lvl2Count} листови</span>
                            <button
                                type="button"
                                onClick={handleSaveMap}
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition disabled:opacity-60"
                            >
                                {isSaving ? <ICONS.spinner className="w-4 h-4 animate-spin" /> : <ICONS.bookmark className="w-4 h-4" />}
                                {currentMapId ? 'Зачувано' : 'Зачувај'}
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerateLesson}
                                className="flex items-center gap-1.5 px-3 py-2 border border-indigo-200 text-indigo-700 bg-indigo-50 rounded-xl text-sm hover:bg-indigo-100 transition"
                            >
                                <ICONS.sparkles className="w-4 h-4" />
                                Генерирај час →
                            </button>
                            <button
                                type="button"
                                onClick={handleExportPNG}
                                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition"
                            >
                                <ICONS.download className="w-4 h-4" />
                                PNG
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePrint()}
                                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition"
                            >
                                <ICONS.printer className="w-4 h-4" />
                                Печати
                            </button>
                        </>
                    )}
                </div>
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
                        <label htmlFor="mindmap-edit-node" className="block text-sm font-bold text-gray-700 mb-2">Уреди јазол</label>
                        <input
                            id="mindmap-edit-node"
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
                    <Card className="p-0 overflow-hidden relative">
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
                                viewBox={viewBox}
                                setViewBox={setViewBox}
                            />
                        </div>
                        <div className="absolute bottom-3 right-3 flex flex-col gap-1 print:hidden">
                            <button
                                type="button"
                                onClick={() => zoomByFactor(1 / 1.3)}
                                title="Зумирај (+)"
                                className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-violet-600 border border-gray-200 transition-colors"
                            >
                                <ZoomIn className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => zoomByFactor(1.3)}
                                title="Одзумирај (-)"
                                className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-violet-600 border border-gray-200 transition-colors"
                            >
                                <ZoomOut className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={resetView}
                                title="Ресетирај приказ"
                                className="p-2 bg-white rounded-full shadow-md text-gray-700 hover:text-violet-600 border border-gray-200 transition-colors"
                            >
                                <Maximize2 className="w-4 h-4" />
                            </button>
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
