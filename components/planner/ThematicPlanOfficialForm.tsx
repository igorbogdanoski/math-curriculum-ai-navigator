/**
 * ThematicPlanOfficialForm — МОН официјален образец за тематски план.
 * World-class A4 landscape print: pageStyle via useReactToPrint, table-layout:fixed,
 * thead repeating headers, break-inside:avoid on every row.
 */
import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import type { AIGeneratedThematicPlan } from '../../types';

export interface ThematicPlanOfficialFormProps {
  data: AIGeneratedThematicPlan;
  gradeLabel: string;
  subject: string;
  authorName: string;
  schoolName: string;
  period: string;
  academicYear: string;
  onClose: () => void;
}

// Injected into the print iframe — controls page geometry and table behaviour.
const PAGE_STYLE = `
  @page { size: A4 landscape; margin: 10mm 14mm; }
  * { box-sizing: border-box; }
  body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    margin: 0;
  }
  table { border-collapse: collapse !important; width: 100% !important; }
  thead { display: table-header-group !important; }
  tbody tr { break-inside: avoid !important; page-break-inside: avoid !important; }
`;

// Base cell style — all cells derive from this.
const CELL: React.CSSProperties = {
  border: '1px solid #000',
  padding: '4px 7px',
  verticalAlign: 'top',
  fontFamily: "'Times New Roman', Times, serif",
  fontSize: '10.5pt',
  lineHeight: '1.4',
  color: '#000',
  wordBreak: 'break-word',
  overflowWrap: 'break-word',
};

const HDR_CELL: React.CSSProperties = {
  ...CELL,
  textAlign: 'center',
  fontWeight: 'bold',
  backgroundColor: '#e8e8e8',
  fontSize: '9.5pt',
  padding: '5px 6px',
  verticalAlign: 'middle',
};

const META_LABEL: React.CSSProperties = {
  ...CELL,
  fontWeight: 'bold',
  backgroundColor: '#f0f0f0',
  whiteSpace: 'nowrap',
  width: '13%',
};

const META_VAL: React.CSSProperties = {
  ...CELL,
  width: '37%',
};

export const ThematicPlanOfficialForm: React.FC<ThematicPlanOfficialFormProps> = ({
  data, gradeLabel, subject, authorName, schoolName, period, academicYear, onClose,
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Тематски план — ${data.thematicUnit}`,
    pageStyle: PAGE_STYLE,
  });

  const totalHours = data.lessons.reduce((s, l) => s + (l.hours ?? 1), 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-6 px-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col">

        {/* ── Toolbar (no-print) ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b no-print flex-shrink-0">
          <h2 className="text-lg font-black text-slate-900">📄 Официјален образец — Тематски план</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handlePrint()}
              className="flex items-center gap-2 px-5 py-2 bg-brand-primary text-white rounded-xl text-sm font-bold hover:bg-brand-secondary transition-colors shadow"
            >
              🖨️ Испечати / Зачувај PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Затвори
            </button>
          </div>
        </div>

        {/* ── Printable area ─────────────────────────────────────────────────── */}
        <div
          ref={printRef}
          style={{
            padding: '28px 32px',
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: '11pt',
            color: '#000',
            backgroundColor: '#fff',
          }}
        >

          {/* МОН Header */}
          <div style={{ textAlign: 'center', marginBottom: '14px' }}>
            <p style={{
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: '8.5pt',
              textTransform: 'uppercase',
              letterSpacing: '1.8px',
              color: '#444',
              margin: '0 0 3px',
            }}>
              Република Македонија — Министерство за образование и наука
            </p>
            <h1 style={{
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: '17pt',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '3px',
              margin: '4px 0 3px',
              color: '#000',
            }}>
              ТЕМАТСКИ ПЛАН
            </h1>
            <p style={{
              fontFamily: "'Times New Roman', Times, serif",
              fontSize: '10pt',
              color: '#555',
              margin: '0',
            }}>
              Учебна {academicYear} година
            </p>
          </div>

          {/* Meta info grid */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10px', tableLayout: 'fixed' }}>
            <tbody>
              <tr>
                <td style={META_LABEL}>Училиште</td>
                <td style={META_VAL}>{schoolName || '___________________________'}</td>
                <td style={META_LABEL}>Наставник</td>
                <td style={META_VAL}>{authorName || '___________________________'}</td>
              </tr>
              <tr>
                <td style={META_LABEL}>Предмет</td>
                <td style={META_VAL}>{subject}</td>
                <td style={META_LABEL}>Одделение</td>
                <td style={META_VAL}>{gradeLabel}</td>
              </tr>
              <tr>
                <td style={META_LABEL}>Тематска единица</td>
                <td style={{ ...META_VAL, fontWeight: 'bold', width: '87%' }} colSpan={3}>
                  {data.thematicUnit}
                </td>
              </tr>
              <tr>
                <td style={META_LABEL}>Период</td>
                <td style={META_VAL}>{period || '___________________________'}</td>
                <td style={META_LABEL}>Вкупно часови</td>
                <td style={{ ...META_VAL, fontWeight: 'bold' }}>{totalHours}</td>
              </tr>
            </tbody>
          </table>

          {/* Main lessons table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '10pt' }}>
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={HDR_CELL}>Бр.</th>
                <th style={HDR_CELL}>Наслов на лекцијата</th>
                <th style={HDR_CELL}>Наставни цели / Исходи</th>
                <th style={HDR_CELL}>Клучни активности</th>
                <th style={HDR_CELL}>Следење на напредокот</th>
                <th style={HDR_CELL}>Ч.</th>
              </tr>
            </thead>
            <tbody>
              {data.lessons.map((lesson, i) => (
                <tr
                  key={i}
                  style={{
                    pageBreakInside: 'avoid',
                    breakInside: 'avoid',
                    backgroundColor: i % 2 === 1 ? '#fafafa' : '#fff',
                  }}
                >
                  <td style={{ ...CELL, textAlign: 'center', fontWeight: 'bold', fontSize: '10pt' }}>
                    {lesson.lessonNumber ?? i + 1}
                  </td>
                  <td style={{ ...CELL, fontWeight: '600' }}>
                    {lesson.lessonUnit}
                  </td>
                  <td style={{ ...CELL, fontStyle: 'italic' }}>
                    {lesson.learningOutcomes}
                  </td>
                  <td style={CELL}>
                    {lesson.keyActivities}
                  </td>
                  <td style={CELL}>
                    {lesson.assessment}
                  </td>
                  <td style={{ ...CELL, textAlign: 'center', fontWeight: 'bold' }}>
                    {lesson.hours ?? 1}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                <td
                  colSpan={5}
                  style={{ ...CELL, textAlign: 'right', fontWeight: 'bold', backgroundColor: '#e8e8e8' }}
                >
                  Вкупно часови:
                </td>
                <td style={{ ...CELL, textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e8e8e8' }}>
                  {totalHours}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px' }}>
            <div>
              <p style={{ fontFamily: "'Times New Roman', Times, serif", fontWeight: 'bold', margin: '0 0 22px', fontSize: '10.5pt' }}>
                Изготвил/-а:
              </p>
              <div style={{ borderBottom: '1px solid #000', width: '200px' }} />
              <p style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '9pt', color: '#555', margin: '4px 0 0' }}>
                {authorName || 'Наставник / Наставничка'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontFamily: "'Times New Roman', Times, serif", fontWeight: 'bold', margin: '0 0 22px', fontSize: '10.5pt' }}>
                Одобрил/-а (директор):
              </p>
              <div style={{ borderBottom: '1px solid #000', width: '200px', marginLeft: 'auto' }} />
              <p style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: '9pt', color: '#555', margin: '4px 0 0' }}>
                Потпис и печат
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            marginTop: '18px',
            paddingTop: '6px',
            borderTop: '1px solid #ccc',
            fontSize: '7.5pt',
            color: '#bbb',
            fontFamily: 'Arial, sans-serif',
          }}>
            Создадено со AI Navigator · Министерство за образование и наука · {academicYear}
          </div>

        </div>
      </div>
    </div>
  );
};
