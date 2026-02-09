import React, { useEffect, useRef } from 'react';
import { Card } from '../common/Card';

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
    <Card className="flex flex-col h-full">
        <h2 className="text-xl font-semibold text-brand-primary mb-4">Месечна Активност</h2>
        <div className="flex-1 relative min-h-[300px]">
            <canvas ref={chartRef}></canvas>
        </div>
    </Card>
  );
};
