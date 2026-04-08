import React, { useEffect, useRef } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

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

export const TopicCoverageChart: React.FC<TopicCoverageChartProps> = ({ data }) => {
  const { t } = useLanguage();
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Check if the Chart library is loaded, ref is available, and there's data to show
    if (chartRef.current && typeof Chart !== 'undefined' && data?.datasets?.[0]?.data?.length > 0) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (ctx) { // Ensure context is not null
        chartInstanceRef.current = new Chart(ctx, {
          type: 'doughnut',
          data: data,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
              },
              title: {
                display: false,
              },
            },
          },
        });
      }
    }

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
