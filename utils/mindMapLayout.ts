import type { MMNode } from '../services/gemini/mindmap';
import { matchTopicByTitleStrict } from './gradeMatch';
import type { Topic } from '../types';

/**
 * Resolves the free-text topic input to a real curriculum Topic for grounding, when
 * possible — tries the grade's Topic titles first, then falls back to a per-concept scan
 * (a teacher may type a concept name like "Собирање дропки" rather than its parent topic
 * "Дропки"). Returns undefined rather than guessing when nothing really matches, so an
 * unrelated topic never silently grounds the generation in the wrong curriculum content.
 */
export function findGroundingTopic(topics: Topic[], queryText: string): Topic | undefined {
    const byTopicTitle = matchTopicByTitleStrict(topics, queryText);
    if (byTopicTitle) return byTopicTitle;
    const lowerQuery = queryText.toLowerCase();
    return topics.find(t => t.concepts.some(c => {
        const lowerConcept = c.title.toLowerCase();
        return lowerConcept.includes(lowerQuery) || lowerQuery.includes(lowerConcept);
    }));
}

// ── Canvas geometry ───────────────────────────────────────────────────────────

export const SVG_W = 1000;
export const SVG_H = 660;
export const CX = SVG_W / 2;
export const CY = SVG_H / 2;
export const R1 = 185;   // level-1 radius from center
export const R2 = 145;   // level-2 radius from parent

// ── Zoom/pan ──────────────────────────────────────────────────────────────────
// The canvas is a raw SVG (no graph library), so zoom/pan is implemented by mutating the
// viewBox directly rather than a library config flag — positions in `Positions` stay in
// fixed SVG_W×SVG_H "canvas units" throughout; the viewBox just crops/scales the window
// into that space.
export interface ViewBox { x: number; y: number; w: number; h: number; }
export const DEFAULT_VIEW_BOX: ViewBox = { x: 0, y: 0, w: SVG_W, h: SVG_H };
export const MIN_VB_W = 250;              // most zoomed-in
export const MAX_VB_W = SVG_W * 2.6;      // most zoomed-out
export const ASPECT = SVG_H / SVG_W;
export const clampVbWidth = (w: number) => Math.min(MAX_VB_W, Math.max(MIN_VB_W, w));

export const BRANCH_COLORS = [
    '#4f46e5', '#0891b2', '#059669', '#d97706',
    '#dc2626', '#7c3aed', '#db2777', '#0d9488',
];

// ── Layout ────────────────────────────────────────────────────────────────────

export type Positions = Record<string, { x: number; y: number }>;

export function buildLayout(nodes: MMNode[]): Positions {
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

export function wrapLabel(label: string, maxChars = 18): string[] {
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

export function getBranchColor(nodes: MMNode[], nodeId: string): string {
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
