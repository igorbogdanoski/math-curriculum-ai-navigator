import type { Concept } from '../../types';

export interface MenuState {
    x: number;
    y: number;
    nodeId: string;
    label: string;
    visible: boolean;
    gradeLevel: number;
    topicId: string;
    isCluster: boolean;
}

export type EnrichedConcept = Concept & { gradeLevel: number; topicId: string };

export const MASTERY_COLORS = {
    mastered:   '#2E7D32',
    passing:    '#1565C0',
    developing: '#E65100',
    struggling: '#B71C1C',
    noData:     '#757575',
} as const;

export const FOCUS_COLOR  = '#FF5722';
export const PRIOR_COLOR  = '#1976D2';
export const FUTURE_COLOR = '#388E3C';

export const GRADE_COLORS: Record<number, string> = {
    1: '#F44336', 2: '#E91E63', 3: '#9C27B0', 4: '#673AB7',
    5: '#3F51B5', 6: '#FFC107', 7: '#4CAF50', 8: '#2196F3', 9: '#009688',
    10: '#FF6F00', 11: '#5D4037', 12: '#00695C', 13: '#1A237E',
};

export const STRANDS = [
    { id: 'num',  label: 'Броеви',    keywords: ['броеви', 'операции', 'дропки', 'собирање', 'одземање', 'множење', 'делење', 'природни', 'цели', 'рационални'] },
    { id: 'geo',  label: 'Геометрија', keywords: ['геометрија', 'форми', 'агол', 'триаголник', 'плоштина', 'волумен', 'права', 'точка', 'рамнина', 'тела'] },
    { id: 'alg',  label: 'Алгебра',   keywords: ['алгебра', 'функции', 'равенки', 'променлив', 'низи', 'изрази'] },
    { id: 'meas', label: 'Мерење',    keywords: ['мерење', 'време', 'пари', 'должина', 'маса', 'температура', 'периметар'] },
    { id: 'data', label: 'Податоци',  keywords: ['податоци', 'веројатност', 'табел', 'дијаграм', 'средна вредност', 'статистика'] },
];

export function matchStrand(concept: { title?: string; description?: string }, strandId: string | null): boolean {
    if (!strandId) return true;
    const strand = STRANDS.find(s => s.id === strandId);
    if (!strand) return true;
    const text = ((concept.title || '') + ' ' + (concept.description || '')).toLowerCase();
    return strand.keywords.some(k => text.includes(k));
}

export function getRomanGrade(level: number): string | number {
    const map: Record<number, string> = {
        1:'I', 2:'II', 3:'III', 4:'IV', 5:'V', 6:'VI', 7:'VII', 8:'VIII', 9:'IX',
        10:'X', 11:'XI', 12:'XII', 13:'XIII',
    };
    return map[level] ?? level;
}

// XSS-safe DOM helpers (use textContent, not innerHTML)
export const el = (tag: string, styles: Partial<CSSStyleDeclaration>, text?: string): HTMLElement => {
    const e = document.createElement(tag);
    Object.assign(e.style, styles);
    if (text !== undefined) e.textContent = text;
    return e;
};

export const createTooltipElement = (title: string, description: string): HTMLElement => {
    const container = document.createElement('div');
    container.style.maxWidth = '300px';
    container.appendChild(el('div', { fontWeight: 'bold', marginBottom: '4px', color: '#0D47A1' }, title));
    container.appendChild(el('div', { fontSize: '0.9em', marginBottom: '8px' }, description));
    const hr = document.createElement('hr');
    hr.style.cssText = 'border-top: 1px solid #ddd; margin: 4px 0;';
    container.appendChild(hr);
    container.appendChild(el('em', { fontSize: '0.8em', color: '#777' }, 'Кликни за да отвориш'));
    return container;
};

export const createClusterTooltip = (title: string, items: string[], total: number, color: string): HTMLElement => {
    const container = document.createElement('div');
    container.style.minWidth = '200px';
    container.style.maxWidth = '320px';
    container.appendChild(el('div', {
        fontWeight: 'bold', marginBottom: '8px', color,
        fontSize: '1.1em', borderBottom: `2px solid ${color}`, paddingBottom: '4px',
    }, title));
    const listDiv = el('div', { fontSize: '0.85em', color: '#333', maxHeight: '200px', overflowY: 'auto' });
    items.forEach(item => listDiv.appendChild(el('div', { padding: '2px 0', borderBottom: '1px solid #f0f0f0' }, '• ' + item)));
    container.appendChild(listDiv);
    const remaining = total - items.length;
    if (remaining > 0) {
        container.appendChild(el('div', { fontStyle: 'italic', color: '#666', fontSize: '0.8em', marginTop: '6px' }, `...и уште ${remaining} поими`));
    }
    container.appendChild(el('div', { marginTop: '8px', textAlign: 'right', fontSize: '0.75em', color: '#999' }, '(Двоен клик за отворање)'));
    return container;
};
