import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send } from 'lucide-react';

type Rating = 'up' | 'down';

interface Props {
  /** Unique key identifying this generated material (used to dedupe across re-renders) */
  materialKey: string;
  onRate: (rating: Rating, reportText?: string) => void;
}

/**
 * Thumbs-up / thumbs-down feedback bar placed below AI-generated content.
 * Manages its own local state — parent only receives the callback on submit.
 */
export const AIFeedbackBar: React.FC<Props> = ({ materialKey, onRate }) => {
  const [rated, setRated]             = useState<Rating | null>(null);
  const [showReport, setShowReport]   = useState(false);
  const [reportText, setReportText]   = useState('');
  const [submitted, setSubmitted]     = useState(false);

  const handleRate = (r: Rating) => {
    if (rated !== null) return; // already rated
    setRated(r);
    if (r === 'up') {
      onRate('up');
      setSubmitted(true);
    } else {
      setShowReport(true); // ask for optional explanation
    }
  };

  const handleSubmitReport = () => {
    onRate('down', reportText.trim() || undefined);
    setShowReport(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div key={materialKey} className="flex items-center gap-2 mt-3 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm text-gray-500">
        <span className="text-green-500">✓</span>
        Благодарим за фидбекот!
      </div>
    );
  }

  return (
    <div key={materialKey} className="mt-3">
      <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border border-gray-100 rounded-xl">
        <span className="text-xs text-gray-400 font-medium shrink-0">Дали материјалот е корисен?</span>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => handleRate('up')}
            disabled={rated !== null}
            title="Добар материјал"
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border ${
              rated === 'up'
                ? 'bg-green-100 border-green-400 text-green-700'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-green-50 hover:border-green-300 hover:text-green-700'
            } disabled:cursor-default`}
          >
            <ThumbsUp size={14} />
            <span>Корисен</span>
          </button>
          <button
            onClick={() => handleRate('down')}
            disabled={rated !== null}
            title="Пријави проблем"
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border ${
              rated === 'down'
                ? 'bg-red-100 border-red-400 text-red-700'
                : 'bg-white border-gray-200 text-gray-500 hover:bg-red-50 hover:border-red-300 hover:text-red-700'
            } disabled:cursor-default`}
          >
            <ThumbsDown size={14} />
            <span>Проблем</span>
          </button>
        </div>
      </div>

      {/* Optional report textarea shown after thumbs-down */}
      {showReport && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-xs text-red-700 font-semibold mb-2">
            Опиши го проблемот (незадолжително):
          </p>
          <textarea
            value={reportText}
            onChange={e => setReportText(e.target.value)}
            placeholder="пр. Погрешен одговор, нејасно прашање, несоодветна тежина..."
            rows={2}
            className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => { setShowReport(false); onRate('down'); setSubmitted(true); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Прескокни
            </button>
            <button
              onClick={handleSubmitReport}
              className="flex items-center gap-1 text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors"
            >
              <Send size={12} />
              Испрати
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
