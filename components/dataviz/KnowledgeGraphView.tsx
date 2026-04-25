/**
 * S49-B — Knowledge Graph Visualizer
 * D3 force-simulation rendered with React SVG.
 * Shows prerequisite + dependent concept relationships centered on a focal concept.
 */

import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
} from 'd3-force';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3-force';
import { useCurriculum } from '../../hooks/useCurriculum';
import { useNavigation } from '../../contexts/NavigationContext';
import { Loader2, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  gradeLevel: number;
  role: 'focal' | 'prior' | 'future' | 'sibling';
  conceptId: string;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

// ─── Grade colours ────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<number, string> = {
  1: '#f87171', 2: '#fb923c', 3: '#facc15', 4: '#a3e635',
  5: '#34d399', 6: '#22d3ee', 7: '#60a5fa', 8: '#a78bfa', 9: '#f472b6',
};
const ROLE_RING: Record<GraphNode['role'], string> = {
  focal:   '#6366f1',
  prior:   '#f59e0b',
  future:  '#10b981',
  sibling: '#94a3b8',
};

const gradeColor = (g: number) => GRADE_COLORS[g] ?? '#94a3b8';

// ─── Component ────────────────────────────────────────────────────────────────

interface KnowledgeGraphViewProps {
  conceptId: string;
  width?: number;
  height?: number;
}

export const KnowledgeGraphView: React.FC<KnowledgeGraphViewProps> = ({
  conceptId,
  width = 600,
  height = 420,
}) => {
  const { getConceptDetails, getConceptChain, allConcepts } = useCurriculum();
  const { navigate } = useNavigation();

  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [links, setLinks] = useState<GraphLink[]>([]);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [tick, setTick] = useState(0);

  const svgRef = useRef<SVGSVGElement>(null);

  // ── Build graph data ──────────────────────────────────────────────────────

  const { rawNodes, rawLinks } = useMemo(() => {
    const { concept: focal, grade: fGrade } = getConceptDetails(conceptId);
    if (!focal) return { rawNodes: [], rawLinks: [] };

    const chain = getConceptChain(conceptId);

    const nodeMap = new Map<string, GraphNode>();
    const linkSet = new Set<string>();
    const rLinks: GraphLink[] = [];

    const addNode = (id: string, label: string, gradeLevel: number, role: GraphNode['role']) => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, { id, label, gradeLevel, role, conceptId: id });
      }
    };

    // Focal node
    addNode(conceptId, focal.title, fGrade?.level ?? 0, 'focal');

    // Priors (prerequisites — this concept depends on them)
    chain.priors.forEach(({ concept, grade }) => {
      addNode(concept.id, concept.title, grade.level, 'prior');
      const key = `${concept.id}→${conceptId}`;
      if (!linkSet.has(key)) { linkSet.add(key); rLinks.push({ source: concept.id, target: conceptId }); }
    });

    // Futures (concepts that depend on this one)
    chain.futures.forEach(({ concept, grade }) => {
      addNode(concept.id, concept.title, grade.level, 'future');
      const key = `${conceptId}→${concept.id}`;
      if (!linkSet.has(key)) { linkSet.add(key); rLinks.push({ source: conceptId, target: concept.id }); }
    });

    // Siblings — same topic, different concept (up to 4)
    const focalDetail = getConceptDetails(conceptId);
    const topicId = focalDetail?.topic?.id;
    if (topicId) {
      allConcepts
        .filter(c => {
          const d = getConceptDetails(c.id);
          return d.topic?.id === topicId && c.id !== conceptId;
        })
        .slice(0, 4)
        .forEach(c => {
          addNode(c.id, c.title, c.gradeLevel, 'sibling');
          const key = `sibling:${conceptId}↔${c.id}`;
          if (!linkSet.has(key)) { linkSet.add(key); rLinks.push({ source: conceptId, target: c.id }); }
        });
    }

    return { rawNodes: Array.from(nodeMap.values()), rawLinks: rLinks };
  }, [conceptId, getConceptDetails, getConceptChain, allConcepts]);

  // ── D3 force simulation ───────────────────────────────────────────────────

  useEffect(() => {
    if (rawNodes.length === 0) return;
    setReady(false);

    // Clone so D3 can mutate x/y
    const simNodes: GraphNode[] = rawNodes.map(n => ({ ...n, x: width / 2, y: height / 2 }));
    const simLinks: GraphLink[] = rawLinks.map(l => ({ ...l }));

    const sim = forceSimulation<GraphNode>(simNodes)
      .force('link', forceLink<GraphNode, GraphLink>(simLinks).id(d => d.id).distance(110).strength(0.6))
      .force('charge', forceManyBody<GraphNode>().strength(-300))
      .force('center', forceCenter<GraphNode>(width / 2, height / 2))
      .force('collide', forceCollide<GraphNode>(46));

    sim.on('tick', () => setTick(t => t + 1));
    sim.on('end', () => {
      setNodes([...simNodes]);
      setLinks([...simLinks]);
      setReady(true);
    });

    // Snapshot nodes/links every tick for live rendering
    sim.on('tick', () => {
      setNodes([...simNodes]);
      setLinks([...simLinks]);
      setTick(t => t + 1);
    });

    const timeout = setTimeout(() => sim.stop(), 4000);
    return () => { sim.stop(); clearTimeout(timeout); };
  }, [rawNodes, rawLinks, width, height]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (rawNodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Вчитување граф…
      </div>
    );
  }

  const cx = width / 2;
  const cy = height / 2;

  const nodeRadius = (role: GraphNode['role']) =>
    role === 'focal' ? 22 : role === 'sibling' ? 14 : 18;

  const truncate = (s: string, max = 22) => s.length > max ? s.slice(0, max) + '…' : s;

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden">
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-gray-50/70">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Controls */}
      <div className="absolute top-2 right-2 flex gap-1 z-20">
        <button
          type="button"
          title="Зголеми"
          onClick={() => setZoom(z => Math.min(z + 0.2, 2))}
          className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-indigo-600 shadow-sm"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Намали"
          onClick={() => setZoom(z => Math.max(z - 0.2, 0.4))}
          className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-indigo-600 shadow-sm"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="Ресетирај"
          onClick={() => setZoom(1)}
          className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-indigo-600 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1 z-20">
        {([['prior', 'Предуслов'], ['focal', 'Овој концепт'], ['future', 'Следно'], ['sibling', 'Во темата']] as [GraphNode['role'], string][]).map(([role, label]) => (
          <div key={role} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: ROLE_RING[role], background: `${ROLE_RING[role]}33` }} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ display: 'block', userSelect: 'none' }}
      >
        <g transform={`translate(${cx * (1 - zoom)},${cy * (1 - zoom)}) scale(${zoom})`}>
          {/* Links */}
          <g stroke="#cbd5e1" strokeWidth={1.5} fill="none">
            {links.map((link, i) => {
              const s = link.source as GraphNode;
              const t = link.target as GraphNode;
              if (s.x == null || t.x == null) return null;
              return (
                <line
                  key={i}
                  x1={s.x} y1={s.y}
                  x2={t.x} y2={t.y}
                  markerEnd="url(#arrow)"
                  strokeDasharray={
                    (s.role === 'sibling' || t.role === 'sibling') ? '4 3' : undefined
                  }
                />
              );
            })}
          </g>

          {/* Arrow marker */}
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
            </marker>
          </defs>

          {/* Nodes */}
          {nodes.map(node => {
            if (node.x == null || node.y == null) return null;
            const r = nodeRadius(node.role);
            const fill = gradeColor(node.gradeLevel);
            const ring = ROLE_RING[node.role];
            const isFocal = node.role === 'focal';
            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: isFocal ? 'default' : 'pointer' }}
                onClick={() => { if (!isFocal) navigate(`/concept/${node.id}`); }}
              >
                {isFocal && (
                  <circle r={r + 6} fill="none" stroke={ring} strokeWidth={2} strokeDasharray="4 2" opacity={0.6} />
                )}
                <circle r={r} fill={fill} stroke={ring} strokeWidth={isFocal ? 3 : 2} />
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={isFocal ? 11 : 9.5}
                  fontWeight={isFocal ? '700' : '500'}
                  fill="#1e293b"
                  style={{ pointerEvents: 'none' }}
                >
                  {truncate(node.label, isFocal ? 18 : 14).split(' ').map((word, wi) => (
                    <tspan
                      key={wi}
                      x={0}
                      dy={wi === 0 ? `-${(truncate(node.label, isFocal ? 18 : 14).split(' ').length - 1) * 6}px` : '12px'}
                    >
                      {word}
                    </tspan>
                  ))}
                </text>
                {/* Grade badge */}
                <text
                  x={r - 4}
                  y={-(r - 4)}
                  fontSize={8}
                  fontWeight="700"
                  fill="#475569"
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {node.gradeLevel > 0 ? node.gradeLevel : ''}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
