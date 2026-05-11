import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { loadScript } from '../../utils/loadScript';

declare var Chart: any;

interface ChartData {
    labels: string[];
    datasets: {
        data: number[];
        backgroundColor: string[];
    }[];
}

interface TopicCoverageChartProps {
  data: ChartData;
}

const CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js';

export const TopicCoverageChart: React.FC<TopicCoverageChartProps> = ({ data }) => {
  const { t } = useLanguage();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!chartRef.current || !data?.datasets?.[0]?.data?.length) return;
    loadScript(CHART_JS_CDN).then(() => {
      if (!chartRef.current || typeof Chart === 'undefined') return;
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
      const ctx = chartRef.current.getContext('2d');
      if (ctx) {
        chartInstanceRef.current = new Chart(ctx, {
          type: 'doughnut',
          data: data,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'right' },
              title: { display: false },
            },
          },
        });
      }
    }).catch(() => {/* chart.js load failed */});

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [data]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="mb-4 text-xl font-semibold text-brand-primary">{t('dash_topic_coverage')}</h2>
      <div className="relative flex min-h-[260px] flex-1 items-center justify-center">
        {data?.datasets?.[0]?.data?.length > 0 ? (
          <canvas ref={chartRef} className="h-full w-full" />
        ) : (
          <p className="text-center text-sm text-gray-500">{t('dash_no_data_chart')}</p>
        )}
      </div>
    </div>
  );
};
