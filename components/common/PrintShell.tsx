import React from 'react';

export interface PrintShellProps {
  title: string;
  subtitle?: string;
  teacherName?: string;
  schoolName?: string;
  grade?: string | number;
  subject?: string;
  date?: string;
  orientation?: 'portrait' | 'landscape';
  children: React.ReactNode;
}

/**
 * Universal A4 print wrapper — МОН-aligned header + footer.
 * Use as contentRef target for useReactToPrint.
 *
 * Usage:
 *   const ref = useRef<HTMLDivElement>(null);
 *   const handlePrint = useReactToPrint({ contentRef: ref, pageStyle: '@page { size: A4 portrait; margin: 1.5cm 1cm; }' });
 *   <PrintShell ref={ref} title="..." teacherName={user?.displayName}>...</PrintShell>
 */
export const PrintShell = React.forwardRef<HTMLDivElement, PrintShellProps>(
  ({ title, subtitle, teacherName, schoolName, grade, subject, date, children }, ref) => {
    const today = date ?? new Date().toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const academicYear = (() => {
      const y = new Date().getFullYear();
      const m = new Date().getMonth();
      return m >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
    })();

    return (
      <div
        ref={ref}
        className="print-shell bg-white text-black"
        style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '11pt', lineHeight: '1.4', padding: '0' }}
      >
        {/* ── МОН Header ─────────────────────────────────────────── */}
        <div style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Left: school / teacher info */}
            <div>
              <p style={{ fontWeight: 'bold', fontSize: '10pt', margin: '0 0 2px' }}>
                {schoolName || 'Основно/Средно училиште'}
              </p>
              {teacherName && (
                <p style={{ fontSize: '9pt', margin: '0 0 1px', color: '#444' }}>
                  Наставник/-чка: <strong>{teacherName}</strong>
                </p>
              )}
              {grade && (
                <p style={{ fontSize: '9pt', margin: '0', color: '#444' }}>
                  {subject ? `${subject} · ` : ''}{grade}. одделение
                </p>
              )}
            </div>
            {/* Right: date / academic year */}
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '9pt', margin: '0 0 1px', color: '#444' }}>{today}</p>
              <p style={{ fontSize: '9pt', margin: '0 0 1px', color: '#444' }}>Уч. год. {academicYear}</p>
              <p style={{ fontSize: '8pt', margin: '0', color: '#888' }}>МОН — Р. Северна Македонија</p>
            </div>
          </div>
          {/* Title */}
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <h1 style={{ fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px', margin: '0' }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: '10pt', color: '#555', margin: '2px 0 0' }}>{subtitle}</p>
            )}
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        <div>{children}</div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid #ccc', marginTop: '20px', paddingTop: '6px', textAlign: 'center', fontSize: '8pt', color: '#999' }}>
          Создадено со <strong>AI Navigator</strong> · Министерство за образование и наука · {today}
        </div>
      </div>
    );
  },
);
PrintShell.displayName = 'PrintShell';
