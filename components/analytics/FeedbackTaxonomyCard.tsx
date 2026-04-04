import React from 'react';
import { BarChart3, TrendingUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { FeedbackReasonBreakdown, FeedbackReasonCode } from '../../types';
import { FEEDBACK_REASON_TAXONOMY } from '../../types';
import { Card } from '../common/Card';

interface FeedbackTaxonomyCardProps {
  data: FeedbackReasonBreakdown | null;
  isLoading?: boolean;
}

const categoryColors: Record<string, { bg: string; border: string; text: string }> = {
  content: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  pedagogy: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  clarity: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  alignment: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  other: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
};

export const FeedbackTaxonomyCard: React.FC<FeedbackTaxonomyCardProps> = ({ data, isLoading }) => {
  if (isLoading || !data) {
    return (
      <Card className="p-6 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="flex items-center gap-3 mb-4">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-800">Feedback Taxonomy</h3>
        </div>
        <div className="text-center py-8 text-gray-400">
          {isLoading ? 'Loading feedback analysis...' : 'No feedback data available'}
        </div>
      </Card>
    );
  }

  const statusItems = [
    { label: 'Approved', count: data.approved, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Revision Needed', count: data.revision_requested, icon: AlertCircle, color: 'text-amber-600' },
    { label: 'Rejected', count: data.rejected, icon: XCircle, color: 'text-red-600' },
  ];

  return (
    <Card className="p-6 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="flex items-center gap-3 mb-6">
        <BarChart3 className="w-6 h-6 text-indigo-600" />
        <div>
          <h3 className="text-lg font-bold text-gray-800">Feedback Taxonomy</h3>
          <p className="text-xs text-gray-500">Last {data.periodDays} days • {data.totalFeedback} feedback items</p>
        </div>
      </div>

      {/* Status overview */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {statusItems.map(({ label, count, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs font-semibold text-gray-600">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{count}</p>
            <p className="text-xs text-gray-400">
              {data.totalFeedback > 0 ? ((count / data.totalFeedback) * 100).toFixed(0) : 0}%
            </p>
          </div>
        ))}
      </div>

      {/* Top rejection reasons */}
      {data.topReasons.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-bold text-gray-700">Top Feedback Reasons</h4>
          </div>
          <div className="space-y-2">
            {data.topReasons.slice(0, 5).map(({ code, count, percentage }) => {
              const info = FEEDBACK_REASON_TAXONOMY[code];
              const colors = categoryColors[info.category];
              return (
                <div key={code} className={`rounded-lg p-3 ${colors.bg} border ${colors.border}`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-sm font-semibold ${colors.text}`}>{info.label}</p>
                    <span className={`text-xs font-bold ${colors.text}`}>{percentage.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-white rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${colors.bg.replace('50', '400')}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {count} {count === 1 ? 'case' : 'cases'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* All reasons breakdown (compact grid) */}
      <div className="mb-4">
        <h4 className="text-sm font-bold text-gray-700 mb-3">All Feedback Reasons</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(data.reasonCounts).map(([code, count]) => {
            if (count === 0) return null;
            const info = FEEDBACK_REASON_TAXONOMY[code as FeedbackReasonCode];
            const colors = categoryColors[info.category];
            return (
              <div key={code} className={`rounded-lg p-2.5 ${colors.bg} border ${colors.border}`}>
                <p className={`text-xs font-semibold ${colors.text} truncate`}>{info.label}</p>
                <p className={`text-lg font-bold ${colors.text}`}>{count}</p>
                <p className="text-[10px] text-gray-600">{data.reasonPercentages[code as FeedbackReasonCode]?.toFixed(0) || 0}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <p className="text-xs text-gray-600">
          <span className="font-semibold text-gray-700">💡 Insight: </span>
          {data.topReasons.length > 0 
            ? `Most common feedback reason is "${FEEDBACK_REASON_TAXONOMY[data.topReasons[0].code].label}" (${data.topReasons[0].count} cases).`
            : 'No feedback patterns detected yet.'
          }
        </p>
      </div>
    </Card>
  );
};
