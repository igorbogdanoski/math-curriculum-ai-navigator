import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import type { FeedbackReasonCode } from '../../types';
import { FEEDBACK_REASON_TAXONOMY } from '../../types';
import { Card } from '../common/Card';

interface MaterialFeedbackModalProps {
  materialId: string;
  materialTitle: string;
  onSubmit: (feedback: {
    status: 'approved' | 'rejected' | 'revision_requested';
    reasonCodes: FeedbackReasonCode[];
    comments: string;
  }) => Promise<void>;
  onClose: () => void;
}

export const MaterialFeedbackModal: React.FC<MaterialFeedbackModalProps> = ({
  materialTitle,
  onSubmit,
  onClose,
}) => {
  const [status, setStatus] = useState<'approved' | 'rejected' | 'revision_requested'>('revision_requested');
  const [selectedReasons, setSelectedReasons] = useState<Set<FeedbackReasonCode>>(new Set());
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const handleToggleReason = (code: FeedbackReasonCode) => {
    const next = new Set(selectedReasons);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setSelectedReasons(next);
  };

  const handleStatusChange = (nextStatus: 'approved' | 'rejected' | 'revision_requested') => {
    setStatus(nextStatus);
    if (nextStatus === 'approved') {
      setSelectedReasons(new Set());
      setValidationMessage(null);
    }
  };

  const handleSubmit = async () => {
    if (status !== 'approved' && selectedReasons.size === 0) {
      setValidationMessage('Select at least one feedback reason before submitting review feedback.');
      return;
    }

    setValidationMessage(null);
    setIsSubmitting(true);
    try {
      const reasonCodes = status === 'approved' ? [] : Array.from(selectedReasons);
      await onSubmit({
        status,
        reasonCodes,
        comments,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const reasonsByCategory = Object.values(FEEDBACK_REASON_TAXONOMY).reduce((acc, info) => {
    if (!acc[info.category]) acc[info.category] = [];
    acc[info.category].push(info);
    return acc;
  }, {} as Record<string, typeof FEEDBACK_REASON_TAXONOMY[FeedbackReasonCode][]>);

  const categoryColors: Record<string, string> = {
    content: 'bg-red-50 border-red-200',
    pedagogy: 'bg-amber-50 border-amber-200',
    clarity: 'bg-blue-50 border-blue-200',
    alignment: 'bg-purple-50 border-purple-200',
    other: 'bg-gray-50 border-gray-200',
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center overflow-y-auto p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl my-4 mt-8"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        <Card>
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Material Feedback</h2>
              <p className="text-xs text-gray-500 mt-0.5">{materialTitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">Feedback Status</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleStatusChange('approved')}
                  className={`p-3 rounded-lg border-2 transition text-sm font-semibold ${
                    status === 'approved'
                      ? 'bg-green-50 border-green-400 text-green-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-green-200'
                  }`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange('revision_requested')}
                  className={`p-3 rounded-lg border-2 transition text-sm font-semibold ${
                    status === 'revision_requested'
                      ? 'bg-amber-50 border-amber-400 text-amber-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-amber-200'
                  }`}
                >
                  Revision Needed
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusChange('rejected')}
                  className={`p-3 rounded-lg border-2 transition text-sm font-semibold ${
                    status === 'rejected'
                      ? 'bg-rose-50 border-rose-400 text-rose-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-rose-200'
                  }`}
                >
                  Reject
                </button>
              </div>
            </div>

            {status !== 'approved' && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-3">
                  Feedback Reasons (select all that apply)
                </label>
                <div className="space-y-3">
                  {Object.entries(reasonsByCategory).map(([category, reasons]) => (
                    <div key={category}>
                      <p className="text-xs font-bold uppercase text-gray-500 mb-2">{category}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {reasons.map((reason) => (
                          <button
                            key={reason.code}
                            type="button"
                            onClick={() => handleToggleReason(reason.code)}
                            className={`p-3 rounded-lg border-2 transition text-left text-sm ${
                              selectedReasons.has(reason.code)
                                ? `${categoryColors[category]} border-current`
                                : 'bg-white border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={selectedReasons.has(reason.code)}
                                onChange={() => handleToggleReason(reason.code)}
                                className="mt-0.5 w-4 h-4 cursor-pointer rounded border-gray-300"
                              />
                              <div>
                                <p className="font-semibold text-gray-800">{reason.label}</p>
                                <p className="text-xs text-gray-600 mt-0.5">{reason.description}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {validationMessage && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {validationMessage}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Comments</label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add detailed feedback, suggestions for improvement, or general comments..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>

            {selectedReasons.size > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <p className="text-sm text-indigo-700">
                  <span className="font-semibold">Feedback Summary:</span>{' '}
                  {Array.from(selectedReasons)
                    .map((code) => FEEDBACK_REASON_TAXONOMY[code].label)
                    .join(', ')}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};
