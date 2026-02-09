import React, { useEffect, useRef } from 'react';
import { Card } from '../common/Card';

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
    <Card className="flex flex-col h-full">
        <h2 className="text-xl font-semibold text-brand-primary mb-4">Покриеност на Теми</h2>
        <div className="flex-1 relative min-h-[250px] flex items-center justify-center">
            {data?.datasets?.[0]?.data?.length > 0 ? (
                <canvas ref={chartRef}></canvas>
            ) : (
                <p className="text-center text-sm text-gray-500">Нема доволно податоци. Креирајте неколку подготовки за да се прикаже графикот.</p>
            )}
        </div>
    </Card>
  );
};
