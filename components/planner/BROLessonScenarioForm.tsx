/**
 * BROLessonScenarioForm — Официјален БРО образец за Сценарио за наставен час.
 * Layout: A4 landscape, 6 колони, inline styles за print-compatibility.
 */
import React, { useState } from 'react';
import type { LessonPlan } from '../../types';

export interface BROLessonScenarioFormProps {
  plan: Partial<LessonPlan>;
  isEditable?: boolean;
}

// ── Shared inline style tokens ─────────────────────────────────────────────
const FF = "'Times New Roman', Times, serif";
const CELL: React.CSSProperties = {
  border: '1px solid #000',
  padding: '5px 7px',
  verticalAlign: 'top',
  fontFamily: FF,
  fontSize: '9.5pt',
  lineHeight: '1.45',
  color: '#000',
  wordBreak: 'break-word',
};

const HDR: React.CSSProperties = {
  ...CELL,
  textAlign: 'center',
  fontWeight: 'bold',
  backgroundColor: '#e5e5e5',
  verticalAlign: 'middle',
  fontSize: '9pt',
  padding: '6px 5px',
};

const META_LABEL: React.CSSProperties = {
  fontFamily: FF,
  fontWeight: 'bold',
  fontSize: '9.5pt',
  padding: '4px 8px',
  border: '1px solid #000',
  backgroundColor: '#f0f0f0',
  whiteSpace: 'nowrap',
};

const META_VAL: React.CSSProperties = {
  fontFamily: FF,
  fontSize: '9.5pt',
  padding: '4px 8px',
  border: '1px solid #000',
};

// ── Editable cell: shows <input/textarea> when editable ─────────────────────
function EditableCell({
  value,
  onChange,
  isEditable,
  multiline = false,
  style = {},
}: {
  value: string;
  onChange: (v: string) => void;
  isEditable: boolean;
  multiline?: boolean;
  style?: React.CSSProperties;
}) {
  if (!isEditable) {
    return (
      <span style={{ whiteSpace: 'pre-wrap', ...style }}>
        {value || <span style={{ color: '#999', fontStyle: 'italic' }}>—</span>}
      </span>
    );
  }
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        style={{
          width: '100%',
          fontFamily: FF,
          fontSize: '9.5pt',
          border: '1px dashed #3b82f6',
          padding: '2px 4px',
          resize: 'vertical',
          ...style,
        }}
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: '100%',
        fontFamily: FF,
        fontSize: '9.5pt',
        border: '1px dashed #3b82f6',
        padding: '2px 4px',
        ...style,
      }}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export const BROLessonScenarioForm: React.FC<BROLessonScenarioFormProps> = ({
  plan,
  isEditable = false,
}) => {
  const getStepText = (step: { text?: string } | string | null | undefined): string => {
    if (!step) return '';
    if (typeof step === 'string') return step;
    return step.text ?? '';
  };

  // Local editable overrides (screen-only state, doesn't persist)
  const [subject, setSubject]   = useState(plan.subject ?? 'Математика');
  const [theme, setTheme]       = useState(plan.theme ?? '');
  const [author, setAuthor]     = useState(plan.authorName ?? '');
  const [school, setSchool]     = useState(plan.schoolName ?? '');
  const [grade, setGrade]       = useState(plan.grade ? `${plan.grade} одделение` : '');
  const [lessonNo, setLessonNo] = useState(plan.lessonNumber ? String(plan.lessonNumber) : '');
  const [date, setDate]         = useState('');

  const introText = getStepText(plan.scenario?.introductory);
  const mainSteps = plan.scenario?.main ?? [];
  const concludingText = getStepText(plan.scenario?.concluding);

  const introDur  = (plan.scenario?.introductory as any)?.duration ?? '';
  const mainDur   = (plan.scenario?.main as any)?.[0]?.duration ?? '';
  const concludDur = (plan.scenario?.concluding as any)?.duration ?? '';

  const contentLines: string[] = [
    ...(plan.objectives ?? []).map(o => o.text),
  ];
  if (plan.title) contentLines.unshift(plan.title);

  return (
    <div style={{ fontFamily: FF, fontSize: '10pt', color: '#000', backgroundColor: '#fff' }}>

      {/* ── МОН Header strip ────────────────────────────────────────────── */}
      <p style={{
        fontFamily: FF,
        fontSize: '8pt',
        textTransform: 'uppercase',
        letterSpacing: '1.5px',
        color: '#555',
        textAlign: 'center',
        margin: '0 0 2px',
      }}>
        Република Македонија — Министерство за образование и наука
      </p>
      <h1 style={{
        fontFamily: FF,
        fontSize: '14pt',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '2.5px',
        textAlign: 'center',
        margin: '2px 0 10px',
      }}>
        Сценарио за наставен час
      </h1>

      {/* ── Meta info ───────────────────────────────────────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '38%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '36%' }} />
        </colgroup>
        <tbody>
          <tr>
            <td style={{ ...META_LABEL, backgroundColor: '#1d4ed8', color: '#fff', border: '1px solid #000' }}>
              Предмет
            </td>
            <td style={{ ...META_VAL, fontWeight: 'bold', backgroundColor: '#1d4ed8', color: '#fff', border: '1px solid #000' }} colSpan={3}>
              <EditableCell value={subject} onChange={setSubject} isEditable={isEditable} />
            </td>
          </tr>
          <tr>
            <td style={META_LABEL}>Тема</td>
            <td style={{ ...META_VAL, fontWeight: 'bold' }}>
              <EditableCell value={theme} onChange={setTheme} isEditable={isEditable} />
            </td>
            <td style={META_LABEL}>Одделение/паралелка</td>
            <td style={META_VAL}>
              <EditableCell value={grade} onChange={setGrade} isEditable={isEditable} />
            </td>
          </tr>
          <tr>
            <td style={META_LABEL}>Изготвил/-а</td>
            <td style={META_VAL}>
              <EditableCell value={author} onChange={setAuthor} isEditable={isEditable} />
            </td>
            <td style={META_LABEL}>од ОУ</td>
            <td style={META_VAL}>
              <EditableCell value={school} onChange={setSchool} isEditable={isEditable} />
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Main table ──────────────────────────────────────────────────── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '9.5pt' }}>
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '8%' }} />
          <col style={{ width: '40%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '10%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={HDR}>Содржина<br />(и поими)</th>
            <th style={HDR}>Стандарди<br />за оценување</th>
            <th style={HDR}>Часови<br />и дата на<br />реализација</th>
            <th style={HDR}>Сценарио за часот</th>
            <th style={HDR}>Средства</th>
            <th style={HDR}>Следење на<br />напредокот</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>

            {/* Содржина (и поими) */}
            <td style={{ ...CELL, verticalAlign: 'top' }}>
              <ul style={{ margin: 0, padding: '0 0 0 14px', lineHeight: '1.5' }}>
                {contentLines.length > 0
                  ? contentLines.map((c, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{c}</li>
                    ))
                  : <li style={{ color: '#999', fontStyle: 'italic' }}>—</li>
                }
              </ul>
            </td>

            {/* Стандарди за оценување */}
            <td style={{ ...CELL, fontStyle: 'italic' }}>
              <ul style={{ margin: 0, padding: '0 0 0 14px', lineHeight: '1.5' }}>
                {(plan.assessmentStandards ?? []).length > 0
                  ? (plan.assessmentStandards ?? []).map((s, i) => (
                      <li key={i} style={{ marginBottom: 5 }}>{s}</li>
                    ))
                  : <li style={{ color: '#999', fontStyle: 'italic' }}>—</li>
                }
              </ul>
            </td>

            {/* Часови и дата */}
            <td style={{ ...CELL, textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '10pt', marginBottom: 4 }}>
                <EditableCell value={lessonNo} onChange={setLessonNo} isEditable={isEditable} />
              </div>
              <div style={{ fontSize: '8.5pt', color: '#555' }}>
                <EditableCell value={date} onChange={setDate} isEditable={isEditable}
                  style={{ fontSize: '8.5pt' }} />
              </div>
            </td>

            {/* Сценарио за часот */}
            <td style={{ ...CELL }}>

              {/* Воведна активност */}
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontWeight: 'bold', fontStyle: 'italic', margin: '0 0 3px', textDecoration: 'underline' }}>
                  Воведна активност{introDur ? ` (${introDur})` : ''}
                </p>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {introText || <span style={{ color: '#999' }}>—</span>}
                </p>
              </div>

              {/* Главни активности */}
              <div style={{ marginBottom: 8 }}>
                <p style={{ fontWeight: 'bold', fontStyle: 'italic', margin: '0 0 3px', textDecoration: 'underline' }}>
                  Главни активности{mainDur ? ` (${mainDur})` : ''}
                </p>
                {mainSteps.length > 0 ? (
                  <ol style={{ margin: 0, paddingLeft: 16 }}>
                    {mainSteps.map((step, i) => (
                      <li key={i} style={{ marginBottom: 4, whiteSpace: 'pre-wrap' }}>
                        {getStepText(step)}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p style={{ margin: 0, color: '#999' }}>—</p>
                )}
              </div>

              {/* Завршна активност */}
              <div>
                <p style={{ fontWeight: 'bold', fontStyle: 'italic', margin: '0 0 3px', textDecoration: 'underline' }}>
                  Завршна активност{concludDur ? ` (${concludDur})` : ''}
                </p>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                  {concludingText || <span style={{ color: '#999' }}>—</span>}
                </p>
                {plan.selfAssessmentPrompt && (
                  <p style={{ margin: '6px 0 0', fontStyle: 'italic', fontSize: '9pt' }}>
                    <strong>Рефлексија:</strong> {plan.selfAssessmentPrompt}
                  </p>
                )}
              </div>
            </td>

            {/* Средства */}
            <td style={{ ...CELL }}>
              <ul style={{ margin: 0, padding: '0 0 0 13px', lineHeight: '1.5' }}>
                {(plan.materials ?? []).length > 0
                  ? (plan.materials ?? []).map((m, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{m}</li>
                    ))
                  : <li style={{ color: '#999' }}>—</li>
                }
              </ul>
            </td>

            {/* Следење на напредокот */}
            <td style={{ ...CELL }}>
              <ul style={{ margin: 0, padding: '0 0 0 13px', lineHeight: '1.5' }}>
                {(plan.progressMonitoring ?? []).length > 0
                  ? (plan.progressMonitoring ?? []).map((p, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>{p}</li>
                    ))
                  : <li style={{ color: '#999' }}>—</li>
                }
              </ul>
            </td>
          </tr>
        </tbody>
      </table>

      {/* ── Signatures ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '22px' }}>
        <div>
          <p style={{ fontFamily: FF, fontWeight: 'bold', margin: '0 0 18px', fontSize: '9.5pt' }}>Изготвил/-а:</p>
          <div style={{ borderBottom: '1px solid #000', width: 180 }} />
          <p style={{ fontFamily: FF, fontSize: '8.5pt', color: '#666', margin: '3px 0 0' }}>
            {author || 'Наставник / Наставничка'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontFamily: FF, fontWeight: 'bold', margin: '0 0 18px', fontSize: '9.5pt' }}>Одобрил/-а (директор):</p>
          <div style={{ borderBottom: '1px solid #000', width: 180, marginLeft: 'auto' }} />
          <p style={{ fontFamily: FF, fontSize: '8.5pt', color: '#666', margin: '3px 0 0' }}>Потпис и печат</p>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <p style={{
        textAlign: 'center',
        marginTop: '14px',
        paddingTop: '5px',
        borderTop: '1px solid #ddd',
        fontSize: '7pt',
        color: '#ccc',
        fontFamily: 'Arial, sans-serif',
      }}>
        Создадено со AI Navigator · МОН · БРО образец
      </p>
    </div>
  );
};
