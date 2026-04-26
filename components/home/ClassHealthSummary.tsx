import React from 'react';
import { CheckCircle } from 'lucide-react';

interface ClassHealthSummaryProps {
  criticalCount: number;
  highCount: number;
  totalActions: number;
}

export const ClassHealthSummary: React.FC<ClassHealthSummaryProps> = ({
  criticalCount,
  highCount,
  totalActions,
}) => {
  if (totalActions === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
        Одличен напредок!
      </div>
    );
  }

  const mediumCount = totalActions - criticalCount - highCount;

  return (
    <div className="flex items-center gap-3 text-xs font-bold flex-wrap">
      {criticalCount > 0 && (
        <span className="flex items-center gap-1.5 text-red-600">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block flex-shrink-0" />
          {criticalCount} критично
        </span>
      )}
      {highCount > 0 && (
        <span className="flex items-center gap-1.5 text-orange-500">
          <span className="w-2 h-2 rounded-full bg-orange-400 inline-block flex-shrink-0" />
          {highCount} внимание
        </span>
      )}
      {mediumCount > 0 && (
        <span className="flex items-center gap-1.5 text-amber-600">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block flex-shrink-0" />
          {mediumCount} следи
        </span>
      )}
    </div>
  );
};
