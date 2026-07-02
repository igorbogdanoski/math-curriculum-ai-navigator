export type ChartType =
  | 'bar' | 'bar-horizontal' | 'stacked-bar' | 'stacked-bar-horizontal' | 'divided-bar'
  | 'line' | 'area' | 'motion'
  | 'pie' | 'scatter' | 'scatter-trend' | 'histogram' | 'box-whisker' | 'bubble'
  | 'stem-leaf' | 'dot-plot' | 'heatmap'
  | 'frequency-polygon' | 'cumulative-frequency' | 'back-to-back-histogram' | 'pareto' | 'pictogram';

export interface ChartConfig {
  type: ChartType;
  title: string;
  xLabel: string;
  yLabel: string;
  colorPalette: string[];
  showLegend: boolean;
  showGrid: boolean;
  unit: string;
  bins?: number;
}

export const COLOR_PALETTES: Record<string, string[]> = {
  'МОН Сина': ['#3B82F6', '#1D4ED8', '#60A5FA', '#93C5FD', '#BFDBFE', '#1E40AF', '#2563EB'],
  'Топли': ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#3B82F6', '#8B5CF6', '#EC4899'],
  'Природни': ['#10B981', '#059669', '#34D399', '#6EE7B7', '#D1FAE5', '#065F46', '#047857'],
  'Монохром': ['#1F2937', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F9FAFB'],
  'Пастелни': ['#BAE6FD', '#BBF7D0', '#FDE68A', '#FECACA', '#DDD6FE', '#FBCFE8', '#FED7AA'],
  'Виножито': ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8F00FF'],
  'Материјал': ['#F44336', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4', '#FF5722'],
};

export const DEFAULT_CONFIG: ChartConfig = {
  type: 'bar',
  title: 'Мој дијаграм',
  xLabel: '',
  yLabel: '',
  colorPalette: COLOR_PALETTES['МОН Сина'],
  showLegend: true,
  showGrid: true,
  unit: '',
  bins: 8,
};
