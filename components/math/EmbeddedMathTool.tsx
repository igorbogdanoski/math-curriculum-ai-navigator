/**
 * S61-B3 — EmbeddedMathTool router
 *
 * Maps a `DuggaEmbedTool` value (set per-question by the teacher in the
 * builder) to the actual embed component (GeoGebra/Desmos). When `tool` is
 * `none` (or undefined) the router returns null so the player can render
 * nothing in its place.
 */
import React from 'react';
import { EmbeddedGeoGebra } from './EmbeddedGeoGebra';
import { EmbeddedDesmos } from './EmbeddedDesmos';
import type {
  DuggaEmbedTool,
  DuggaEmbedConfig,
} from '../../services/firestoreService.dugga';

export interface EmbeddedMathToolProps {
  tool: DuggaEmbedTool | undefined;
  config?: DuggaEmbedConfig;
  /** Forwarded best-effort state callback (for future grading). */
  onState?: (state: string) => void;
  className?: string;
}

export const EmbeddedMathTool: React.FC<EmbeddedMathToolProps> = ({
  tool,
  config,
  onState,
  className,
}) => {
  if (!tool || tool === 'none') return null;

  const height = config?.height ?? 420;

  switch (tool) {
    case 'geogebra-graphing':
      return (
        <EmbeddedGeoGebra
          app="graphing"
          materialId={config?.materialId}
          initialState={config?.initialState}
          height={height}
          onState={onState}
          className={className}
        />
      );
    case 'geogebra-cas':
      return (
        <EmbeddedGeoGebra
          app="cas"
          materialId={config?.materialId}
          initialState={config?.initialState}
          height={height}
          onState={onState}
          className={className}
        />
      );
    case 'geogebra-geometry':
      return (
        <EmbeddedGeoGebra
          app="geometry"
          materialId={config?.materialId}
          initialState={config?.initialState}
          height={height}
          onState={onState}
          className={className}
        />
      );
    case 'geogebra-3d':
      return (
        <EmbeddedGeoGebra
          app="3d"
          materialId={config?.materialId}
          initialState={config?.initialState}
          height={height}
          onState={onState}
          className={className}
        />
      );
    case 'desmos-calc':
      return (
        <EmbeddedDesmos
          type="calc"
          state={config?.materialId}
          height={height}
          onState={onState}
          className={className}
        />
      );
    case 'desmos-graph':
      return (
        <EmbeddedDesmos
          type="graph"
          state={config?.materialId}
          height={height}
          onState={onState}
          className={className}
        />
      );
    default: {
      // Exhaustiveness guard; if a new tool is added the compiler complains.
      const _exhaustive: never = tool;
      return null;
    }
  }
};
