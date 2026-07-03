/**
 * vis-network has no local type package here — it's loaded at runtime from a CDN
 * script tag (see utils/loadScript.ts), not an npm dependency. This covers exactly the
 * methods CurriculumGraphView.tsx and MindMapView.tsx call (verified against every
 * `network.*` call site in both files) rather than pulling in @types/vis-network's much
 * larger surface for a handful of calls. Shared here (not declared per-file) because
 * `declare global` augmentations must match exactly across the whole TS program.
 */

export interface VisClickParams {
  nodes: string[];
  pointer: { DOM: { x: number; y: number } };
}

export interface VisNetworkInstance {
  on(event: 'click' | 'doubleClick', callback: (params: VisClickParams) => void): void;
  on(event: 'dragStart' | 'hoverNode' | 'blurNode', callback: () => void): void;
  setData(data: { nodes: Record<string, unknown>[]; edges: unknown[] }): void;
  setOptions(options: Record<string, unknown>): void;
  cluster(options: {
    joinCondition: (nodeOptions: Record<string, unknown>) => boolean;
    clusterNodeProperties: Record<string, unknown>;
  }): void;
  isCluster(nodeId: string): boolean;
  openCluster(nodeId: string): void;
  fit(options?: { animation?: boolean }): void;
  destroy(): void;
}

declare global {
  interface Window {
    vis: { Network: new (container: HTMLElement, data: unknown, options: unknown) => VisNetworkInstance };
  }
}
