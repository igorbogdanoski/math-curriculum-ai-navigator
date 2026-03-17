/**
 * Reusable skeleton loading primitives.
 *
 * Usage:
 *   <SkeletonLine />                        — single text line
 *   <SkeletonLine width="w-2/3" />          — shorter line
 *   <SkeletonCard rows={4} />               — card with N lines
 *   <SkeletonStatRow count={4} />           — row of stat boxes
 *   <SkeletonTable rows={5} cols={4} />     — table skeleton
 */
import React from 'react';

// ── Base pulse block ─────────────────────────────────────────────────────────
const pulse = 'animate-pulse bg-gray-200 rounded';

interface LineProps {
  width?: string;
  height?: string;
  className?: string;
}

export const SkeletonLine: React.FC<LineProps> = ({
  width = 'w-full',
  height = 'h-3',
  className = '',
}) => <div className={`${pulse} ${width} ${height} ${className}`} />;

// ── Card with title + N content lines ────────────────────────────────────────
interface CardProps {
  rows?: number;
  className?: string;
}

export const SkeletonCard: React.FC<CardProps> = ({ rows = 3, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3 ${className}`}>
    <SkeletonLine width="w-1/3" height="h-4" />
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonLine key={i} width={i % 3 === 2 ? 'w-3/4' : 'w-full'} />
    ))}
  </div>
);

// ── Row of stat boxes (like OverviewTab top cards) ───────────────────────────
interface StatRowProps {
  count?: number;
}

export const SkeletonStatRow: React.FC<StatRowProps> = ({ count = 4 }) => (
  <div className={`grid grid-cols-2 md:grid-cols-${count} gap-4`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
        <SkeletonLine width="w-1/2" height="h-3" />
        <SkeletonLine width="w-2/3" height="h-7" />
        <SkeletonLine width="w-1/3" height="h-2.5" />
      </div>
    ))}
  </div>
);

// ── Table skeleton ────────────────────────────────────────────────────────────
interface TableProps {
  rows?: number;
  cols?: number;
}

export const SkeletonTable: React.FC<TableProps> = ({ rows = 5, cols = 4 }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
    {/* Header */}
    <div className={`grid gap-4 px-4 py-3 bg-gray-50 border-b border-gray-100`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <SkeletonLine key={i} width="w-3/4" height="h-3" />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r}
        className={`grid gap-4 px-4 py-3 border-b border-gray-50 ${r % 2 === 1 ? 'bg-gray-50/40' : ''}`}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }).map((_, c) => (
          <SkeletonLine key={c} width={c === 0 ? 'w-4/5' : 'w-1/2'} />
        ))}
      </div>
    ))}
  </div>
);

// ── List of cards ─────────────────────────────────────────────────────────────
interface ListProps {
  count?: number;
  rows?: number;
}

export const SkeletonList: React.FC<ListProps> = ({ count = 3, rows = 2 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} rows={rows} />
    ))}
  </div>
);
