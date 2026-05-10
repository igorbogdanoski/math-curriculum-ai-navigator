/**
 * S61-E4 — Print-only watermark for Дига Final Exam submissions.
 *
 * Renders a fixed, low-opacity diagonal watermark that is visible only when
 * the page is being printed (or saved as PDF). Identifies the candidate and
 * the test so a leaked / photographed exam page can be traced back to the
 * student. Hidden in normal screen view to keep the player UI clean.
 */
import React from 'react';

export interface ExamWatermarkProps {
  studentName: string;
  studentUid: string;
  testTitle: string;
  /** Optional ISO timestamp; defaults to render-time. */
  printedAt?: string;
}

export const ExamWatermark: React.FC<ExamWatermarkProps> = ({
  studentName,
  studentUid,
  testTitle,
  printedAt,
}) => {
  const ts = printedAt ?? new Date().toISOString();
  const text = `${testTitle} • ${studentName} • ${studentUid.slice(0, 8)} • ${ts.slice(0, 19).replace('T', ' ')}`;
  return (
    <>
      <style>{`
        @media print {
          .dugga-watermark { display: block !important; }
        }
        .dugga-watermark {
          display: none;
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          overflow: hidden;
        }
        .dugga-watermark__band {
          position: absolute;
          left: -25%;
          right: -25%;
          top: 0;
          bottom: 0;
          display: flex;
          flex-wrap: wrap;
          align-content: space-around;
          justify-content: space-around;
          transform: rotate(-30deg);
          opacity: 0.10;
          font-size: 14px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          color: #1f2937;
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .dugga-watermark__cell {
          padding: 22px 36px;
          white-space: nowrap;
        }
      `}</style>
      <div
        className="dugga-watermark"
        data-testid="dugga-watermark"
        aria-hidden="true"
      >
        <div className="dugga-watermark__band">
          {Array.from({ length: 28 }).map((_, i) => (
            <span key={i} className="dugga-watermark__cell">{text}</span>
          ))}
        </div>
      </div>
    </>
  );
};
