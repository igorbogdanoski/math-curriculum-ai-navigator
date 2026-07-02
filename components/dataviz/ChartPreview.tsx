import React, { useMemo } from 'react';
import {
  BarChart, Bar, LabelList, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ZAxis,
} from 'recharts';
import type { TableData } from './DataTable';
import { tableToChartData } from './DataTable';
import {
  BoxWhiskerChart, StemLeafChart, DotPlotChart, HeatmapChart,
  BackToBackHistogram, PictogramChart, buildHistogram, linearRegression,
} from './chartPreviewSvgCharts';

export type { ChartType, ChartConfig } from './chartPreviewTypes';
export { COLOR_PALETTES, DEFAULT_CONFIG } from './chartPreviewTypes';

// ─── Main ChartPreview ───────────────────────────────────────────────────────
interface ChartPreviewProps {
  data: TableData;
  config: import('./chartPreviewTypes').ChartConfig;
}

const RADIAN = Math.PI / 180;
const renderPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  if (percent < 0.05) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export const ChartPreview: React.FC<ChartPreviewProps> = ({ data, config }) => {
  const chartData = useMemo(() => tableToChartData(data), [data]);
  const seriesKeys = data.headers.slice(1);
  const colors = config.colorPalette;
  const unit = config.unit ? ` ${config.unit}` : '';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // Typed recharts Tooltip formatter — matches ValueType/NameType including undefined variants
  const tooltipFormatter = (
    value: number | string | readonly (string | number)[] | undefined,
    name: string | number | undefined,
  ): [string, string] => {
    const v = Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
    return [`${v}${unit}`, String(name ?? '')];
  };

  if (config.type === 'box-whisker') {
    return <BoxWhiskerChart data={data} config={config} />;
  }

  if (config.type === 'heatmap') {
    return <HeatmapChart data={data} config={config} />;
  }

  if (config.type === 'stem-leaf') {
    return <StemLeafChart data={data} config={config} />;
  }

  if (config.type === 'dot-plot') {
    return <DotPlotChart data={data} config={config} />;
  }

  if (config.type === 'histogram') {
    const values = data.rows.map(r => typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0);
    const histData = buildHistogram(values, config.bins ?? 8);
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={histData} barCategoryGap="5%">
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} label={config.yLabel ? { value: 'Фреквенција', angle: -90, position: 'insideLeft', style: { fontSize: 10 } } : undefined} />
          <Tooltip formatter={(v) => [`${v}`, 'Фреквенција']} />
          <Bar dataKey="count" fill={colors[0]} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'pie') {
    const pieData = data.rows.map((r, i) => ({
      name: String(r[0]),
      value: typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0,
      fill: colors[i % colors.length],
    }));
    return (
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
            outerRadius={110} labelLine={false} label={renderPieLabel}>
            {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
          </Pie>
          <Tooltip formatter={(v) => [`${v}${unit}`, '']} />
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'scatter' || config.type === 'scatter-trend') {
    const scatterData = data.rows.map(r => ({
      x: typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0,
      y: typeof r[2] === 'number' ? r[2] : parseFloat(String(r[2])) || 0,
      name: String(r[0]),
    }));

    if (config.type === 'scatter-trend' && scatterData.length >= 2) {
      const { slope, intercept, r2 } = linearRegression(scatterData);
      const xs = scatterData.map(p => p.x);
      const xMin = Math.min(...xs); const xMax = Math.max(...xs);
      if (xMin === xMax) return <p className="text-gray-400 text-sm text-center p-8">Не може да се пресмета трендот — сите X вредности се исти.</p>;
      const trendLine = [
        { x: xMin, trend: slope * xMin + intercept },
        { x: xMax, trend: slope * xMax + intercept },
      ];
      return (
        <div className="relative">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart>
              {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
              <XAxis dataKey="x" type="number" domain={['auto', 'auto']} tick={{ fontSize: 10 }}
                label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -5, style: { fontSize: 10 } } : undefined} />
              <YAxis dataKey="y" type="number" domain={['auto', 'auto']} tick={{ fontSize: 10 }}
                label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10 } } : undefined} />
              <Tooltip formatter={(v) => [`${v}${unit}`, '']} />
              <Scatter data={scatterData} fill={colors[0]} fillOpacity={0.8} name="Податоци" />
              <Line data={trendLine} dataKey="trend" type="linear" dot={false}
                stroke={colors[1] ?? '#ef4444'} strokeWidth={2} strokeDasharray="6 3" name="Тренд" legendType="line" />
              {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
            </ComposedChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-gray-400 text-right pr-2 -mt-1">
            R² = {r2.toFixed(3)} · y = {slope.toFixed(2)}x {intercept >= 0 ? '+' : '−'} {Math.abs(intercept).toFixed(2)}
          </p>
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="x" name={data.headers[1] || 'X'} tick={{ fontSize: 10 }} label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -5, style: { fontSize: 10 } } : undefined} />
          <YAxis dataKey="y" name={data.headers[2] || 'Y'} tick={{ fontSize: 10 }} label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10 } } : undefined} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v) => [`${v}${unit}`, '']} />
          <Scatter data={scatterData} fill={colors[0]} fillOpacity={0.8} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'bubble') {
    const bubbleData = data.rows.map(r => ({
      x: typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0,
      y: typeof r[2] === 'number' ? r[2] : parseFloat(String(r[2])) || 0,
      z: data.headers[3] ? (typeof r[3] === 'number' ? r[3] : parseFloat(String(r[3])) || 10) : 10,
      name: String(r[0]),
    }));
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="x" tick={{ fontSize: 10 }} />
          <YAxis dataKey="y" tick={{ fontSize: 10 }} />
          <ZAxis dataKey="z" range={[40, 400]} />
          <Tooltip formatter={(v) => [`${v}${unit}`, '']} />
          <Scatter data={bubbleData} fill={colors[0]} fillOpacity={0.6} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'back-to-back-histogram') {
    return <BackToBackHistogram data={data} config={config} />;
  }

  if (config.type === 'pictogram') {
    return <PictogramChart data={data} config={config} />;
  }

  const commonAxis = (
    <>
      {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
      <XAxis
        dataKey="name"
        tick={{ fontSize: 10 }}
        label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -5, style: { fontSize: 10 } } : undefined}
      />
      <YAxis
        tick={{ fontSize: 10 }}
        label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10 } } : undefined}
        tickFormatter={(v) => `${v}${unit}`}
      />
      <Tooltip formatter={tooltipFormatter} />
      {config.showLegend && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
    </>
  );

  if (config.type === 'stacked-bar') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} barCategoryGap="20%">
          {commonAxis}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]}
              radius={i === seriesKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'stacked-bar-horizontal') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 44)}>
        <BarChart data={chartData} layout="vertical">
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />}
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${v}${unit}`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
          <Tooltip formatter={tooltipFormatter} />
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'divided-bar') {
    const normalizedData = chartData.map(row => {
      const total = seriesKeys.reduce((s, k) => s + (Number(row[k]) || 0), 0);
      const result: Record<string, string | number> = { name: String(row.name ?? '') };
      seriesKeys.forEach(k => { result[k] = total > 0 ? +((Number(row[k]) / total * 100).toFixed(1)) : 0; });
      return result;
    });
    return (
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 52)}>
        <BarChart data={normalizedData} layout="vertical">
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />}
          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
          <Tooltip formatter={(v, n) => [`${v}%`, String(n)]} />
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} stackId="a" fill={colors[i % colors.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'frequency-polygon') {
    const fpValues = data.rows.map(r => typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0);
    const fpBins = buildHistogram(fpValues, config.bins ?? 8);
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={fpBins}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={46}
            label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -8, style: { fontSize: 10 } } : undefined} />
          <YAxis tick={{ fontSize: 10 }}
            label={{ value: 'Фреквенција', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
          <Tooltip formatter={v => [`${v}`, 'Фреквенција']} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="linear" dataKey="count" stroke={colors[0]} strokeWidth={2.5} name="Фреквенција"
            dot={{ r: 5, fill: colors[0], stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'cumulative-frequency') {
    const cfValues = data.rows.map(r => typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0);
    const cfBins = buildHistogram(cfValues, config.bins ?? 8);
    let cumAcc = 0;
    const cfData = cfBins.map(d => {
      cumAcc += d.count;
      return { name: d.name, cumFreq: cumAcc, relFreq: +(cumAcc / (cfValues.length || 1) * 100).toFixed(1) };
    });
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={cfData}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" height={46} />
          <YAxis yAxisId="abs" tick={{ fontSize: 10 }}
            label={{ value: 'Кумул. фрекв.', angle: -90, position: 'insideLeft', style: { fontSize: 9 } }} />
          <YAxis yAxisId="rel" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v, n) => n === 'cumFreq' ? [`${v}`, 'Кумулат. фреквенција'] : [`${v}%`, 'Релат. кумул. %']} />
          <Line yAxisId="abs" type="monotone" dataKey="cumFreq" stroke={colors[0]} strokeWidth={2.5}
            dot={{ r: 4 }} name="Кумулат. фреквенција" />
          <Line yAxisId="rel" type="monotone" dataKey="relFreq" stroke={colors[1] ?? '#ef4444'}
            strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3 }} name="Релат. кумул. %" />
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'pareto') {
    let paretoCum = 0;
    const paretoTotal = data.rows.reduce((s, r) => s + (typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0), 0);
    const paretoData = data.rows
      .map(r => ({ name: String(r[0]), value: typeof r[1] === 'number' ? r[1] : parseFloat(String(r[1])) || 0 }))
      .sort((a, b) => b.value - a.value)
      .map(d => { paretoCum += (d.value / (paretoTotal || 1)) * 100; return { ...d, cumPct: +(paretoCum.toFixed(1)) }; });
    return (
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={paretoData}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="bar" tick={{ fontSize: 10 }} tickFormatter={v => `${v}${unit}`} />
          <YAxis yAxisId="line" orientation="right" domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 10 }} />
          <Tooltip formatter={(v, n) => n === 'cumPct' ? [`${v}%`, 'Кумулат. %'] : [`${v}${unit}`, String(n)]} />
          <Bar yAxisId="bar" dataKey="value" name="Вредност" radius={[4, 4, 0, 0]}>
            {paretoData.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
          </Bar>
          <Line yAxisId="line" type="monotone" dataKey="cumPct" stroke="#ef4444"
            strokeWidth={2.5} dot={{ r: 4 }} name="Кумулат. %" />
          {config.showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          {commonAxis}
          {seriesKeys.map((k, i) => (
            <Line key={k} type="linear" dataKey={k} stroke={colors[i % colors.length]}
              strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'motion') {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={chartData}>
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />}
          <XAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 10 }}
            label={config.xLabel ? { value: config.xLabel, position: 'insideBottom', offset: -5, style: { fontSize: 10 } } : { value: 'време (s)', position: 'insideBottom', offset: -5, style: { fontSize: 10 } }}
          />
          <YAxis
            tick={{ fontSize: 10 }}
            label={config.yLabel ? { value: config.yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 10 } } : { value: 'растојание (m)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
            tickFormatter={(v) => `${v}${unit}`}
          />
          <Tooltip formatter={tooltipFormatter} />
          {config.showLegend && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {seriesKeys.map((k, i) => (
            <Line
              key={k}
              type="linear"
              dataKey={k}
              stroke={colors[i % colors.length]}
              strokeWidth={2.5}
              dot={{ r: 4, fill: colors[i % colors.length], stroke: '#fff', strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              isAnimationActive
              animationDuration={900}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === 'area') {
    return (
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          {commonAxis}
          {seriesKeys.map((k, i) => (
            <Area key={k} type="linear" dataKey={k}
              stroke={colors[i % colors.length]} fill={colors[i % colors.length]}
              fillOpacity={0.25} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // bar (vertical) and bar-horizontal
  const isHorizontal = config.type === 'bar-horizontal';
  if (isHorizontal) {
    return (
      <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 40)}>
        <BarChart data={chartData} layout="vertical">
          {config.showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />}
          <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}${unit}`} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
          <Tooltip formatter={tooltipFormatter} />
          {config.showLegend && seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {seriesKeys.map((k, i) => (
            <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[0, 4, 4, 0]}>
              {seriesKeys.length === 1 && (
                <LabelList dataKey={k} position="right" style={{ fontSize: 10 }}
                  formatter={(v: unknown) => `${v ?? ''}${unit}`} />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} barCategoryGap="20%">
        {commonAxis}
        {seriesKeys.map((k, i) => (
          <Bar key={k} dataKey={k} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
};
