import { useLanguage } from '../../i18n/LanguageContext';
import React, { useEffect, useRef } from 'react';

declare var Chart: any;

interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor: string;
    }[];
}

interface MonthlyActivityChartProps {
  data: ChartData;
}

export const MonthlyActivityChart: React.FC<MonthlyActivityChartProps> = ({ data }) => {
  const { t } = useLanguage();

  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<any>(null);

  useEffect(() => {
    // Check if the Chart library is loaded and the canvas ref is available
    if (chartRef.current && typeof Chart !== 'undefined') {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }

      const ctx = chartRef.current.getContext('2d');
      if (ctx) { // Ensure context is not null
        chartInstanceRef.current = new Chart(ctx, {
          type: 'bar',
          data: data,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { stacked: true },
              y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } },
            },
            plugins: {
              legend: {
                  position: 'bottom',
              },
              title: {
                  display: false,
              },
              tooltip: {
                  mode: 'index',
                  intersect: false,
              }
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
      <h2 className="mb-4 text-xl font-semibold text-brand-primary">{t('dash_monthly_activity')}</h2>
      <div className="relative min-h-[260px] flex-1">
        <canvas ref={chartRef} className="h-full w-full" />
      </div>
    </div>
  );
};
