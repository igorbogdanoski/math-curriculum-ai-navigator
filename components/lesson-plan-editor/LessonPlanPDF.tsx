import React, { useState } from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';
import { Loader2, FileDown } from 'lucide-react';
import html2canvas from 'html2canvas';
import type { LessonPlan } from '../../types';

// ---------------------------------------------------------------------------
// Math detection & PDF geometry
// ---------------------------------------------------------------------------

const HAS_MATH = /\$[\s\S]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/;

/** A4 content width: 595pt - 2×36pt padding */
const PDF_FULL_W_PT = 523;
/** Diff cell: ~⅓ content minus 2 gaps of 6pt */
const PDF_DIFF_W_PT = Math.floor((PDF_FULL_W_PT - 12) / 3);

function ptToPx(pt: number): number {
  return Math.round(pt * (96 / 72));
}

// ---------------------------------------------------------------------------
// stripLatex — plain-text fallback when math rendering not needed
// ---------------------------------------------------------------------------

function stripLatex(text: string): string {
  return text
    .replace(/\$\$([^$]+)\$\$/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\\\(([^)]+)\\\)/g, '$1')
    .replace(/\\\[([^\]]+)\\\]/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, '$1')
    .replace(/\\[a-zA-Z]+/g, '')
    .trim();
}

function getText(item: any): string {
  if (typeof item === 'string') return stripLatex(item);
  if (item?.text) return stripLatex(item.text);
  return '';
}

// ---------------------------------------------------------------------------
// renderMathToPng — KaTeX + html2canvas → PNG data URI
// ---------------------------------------------------------------------------

async function renderMathToPng(
  text: string,
  opts: { fontSize?: number; color?: string; widthPt?: number } = {}
): Promise<{ src: string; pngH: number }> {
  const { fontSize = 18, color = '#111827', widthPt = PDF_FULL_W_PT } = opts;
  const widthPx = ptToPx(widthPt);

  const container = document.createElement('div');
  container.style.cssText = [
    'position:fixed', 'top:-9999px', 'left:-9999px',
    'background:#ffffff', 'padding:3px 0',
    `font-size:${fontSize}px`, 'font-family:Arial,Helvetica,sans-serif',
    `color:${color}`, `width:${widthPx}px`,
    'line-height:1.5', 'word-wrap:break-word',
  ].join(';');

  const katex = (window as any).katex;
  const toHtml = (src: string): string => {
    if (!katex) return src.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return src
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, f) =>
        katex.renderToString(f, { throwOnError: false, displayMode: true }))
      .replace(/\$([^$\n]+?)\$/g, (_, f) =>
        katex.renderToString(f, { throwOnError: false, displayMode: false }))
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, f) =>
        katex.renderToString(f, { throwOnError: false, displayMode: false }))
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, f) =>
        katex.renderToString(f, { throwOnError: false, displayMode: true }));
  };

  container.innerHTML = toHtml(text);
  document.body.appendChild(container);
  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
    });
    // height in PDF points proportional to width
    const pngH = widthPt * canvas.height / canvas.width;
    return { src: canvas.toDataURL('image/png', 0.85), pngH };
  } finally {
    document.body.removeChild(container);
  }
}

// ---------------------------------------------------------------------------
// MathField & ProcessedLessonPlan types
// ---------------------------------------------------------------------------

interface MathField {
  plain: string;
  png?: string;
  pngH?: number; // height in PDF points; width = container width (known from context)
}

interface ProcessedLessonPlan {
  raw: LessonPlan;
  title: MathField;
  objectives: Array<MathField & { bloomsLevel?: string }>;
  intro: MathField;
  mainActivities: Array<MathField & { bloomsLevel?: string }>;
  concluding: MathField;
  diffSupport: MathField;
  diffStandard: MathField;
  diffAdvanced: MathField;
  materials: MathField[];
  assessmentStandards: MathField[];
  progressMonitoring: MathField[];
}

async function buildField(
  raw: any,
  opts: { fontSize?: number; color?: string; widthPt?: number } = {}
): Promise<MathField> {
  const text = typeof raw === 'string' ? raw : (raw?.text ?? '');
  if (!text) return { plain: '' };
  const plain = stripLatex(text);
  if (!HAS_MATH.test(text)) return { plain };
  try {
    const { src, pngH } = await renderMathToPng(text, opts);
    return { plain, png: src, pngH };
  } catch {
    return { plain };
  }
}

async function preprocessPlanForPDF(plan: LessonPlan): Promise<ProcessedLessonPlan> {
  const objectives = plan.objectives ?? [];
  const mainActs = plan.scenario?.main ?? [];
  const mats = plan.materials ?? [];
  const stds = plan.assessmentStandards ?? [];
  const prog = plan.progressMonitoring ?? [];

  const tabs = plan.differentiationTabs ?? (
    plan.differentiation
      ? { support: '', standard: plan.differentiation, advanced: '' }
      : { support: '', standard: '', advanced: '' }
  );

  const bodyOpts = { fontSize: 18 };
  const diffOpts = { fontSize: 16, widthPt: PDF_DIFF_W_PT };

  // Run all fields in parallel
  const results = await Promise.all([
    buildField(plan.title, { fontSize: 20, color: '#0D47A1' }),          // 0
    buildField(plan.scenario?.introductory, bodyOpts),                   // 1
    buildField(plan.scenario?.concluding, bodyOpts),                     // 2
    buildField(tabs.support ?? '', diffOpts),                            // 3
    buildField(tabs.standard ?? '', diffOpts),                           // 4
    buildField(tabs.advanced ?? '', diffOpts),                           // 5
    ...objectives.map(o => buildField(o, bodyOpts)),                     // 6..6+n
    ...mainActs.map(a => buildField(a, bodyOpts)),
    ...mats.map(m => buildField(m, bodyOpts)),
    ...stds.map(s => buildField(s, bodyOpts)),
    ...prog.map(p => buildField(p, bodyOpts)),
  ]);

  const base = 6;
  const oEnd  = base + objectives.length;
  const mEnd  = oEnd + mainActs.length;
  const matEnd = mEnd + mats.length;
  const stdEnd = matEnd + stds.length;

  return {
    raw: plan,
    title: results[0],
    intro: results[1],
    concluding: results[2],
    diffSupport: results[3],
    diffStandard: results[4],
    diffAdvanced: results[5],
    objectives: results.slice(base, oEnd).map((f, i) => ({
      ...f, bloomsLevel: (objectives[i] as any)?.bloomsLevel,
    })),
    mainActivities: results.slice(oEnd, mEnd).map((f, i) => ({
      ...f, bloomsLevel: (mainActs[i] as any)?.bloomsLevel,
    })),
    materials: results.slice(mEnd, matEnd),
    assessmentStandards: results.slice(matEnd, stdEnd),
    progressMonitoring: results.slice(stdEnd),
  };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const BRAND = '#0D47A1';
const BRAND_LIGHT = '#E3F2FD';
const ACCENT = '#1565C0';
const GRAY = '#6B7280';
const BORDER = '#E5E7EB';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 36,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderBottom: `2 solid ${BRAND}`,
    paddingBottom: 8,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
    maxWidth: 320,
  },
  headerTitleImg: {
    maxWidth: 320,
    marginBottom: 2,
  },
  headerMeta: {
    fontSize: 8,
    color: GRAY,
    textAlign: 'right',
  },
  illustration: {
    width: '100%',
    height: 130,
    objectFit: 'cover',
    borderRadius: 4,
    marginBottom: 10,
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
    backgroundColor: BRAND_LIGHT,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginBottom: 4,
    borderLeft: `3 solid ${ACCENT}`,
  },
  objectiveRow: {
    flexDirection: 'row',
    marginBottom: 2,
    paddingLeft: 8,
  },
  bullet: {
    width: 12,
    fontSize: 9,
    color: ACCENT,
  },
  objectiveText: {
    flex: 1,
    fontSize: 9,
    lineHeight: 1.4,
  },
  bloomBadge: {
    fontSize: 7,
    color: ACCENT,
    backgroundColor: BRAND_LIGHT,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginLeft: 4,
  },
  scenarioLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: ACCENT,
    marginBottom: 2,
  },
  scenarioText: {
    fontSize: 9,
    lineHeight: 1.4,
    marginBottom: 6,
    paddingLeft: 8,
  },
  diffRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  diffCell: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 3,
    padding: 5,
    border: `1 solid ${BORDER}`,
  },
  diffCellLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  diffCellText: {
    fontSize: 8,
    lineHeight: 1.3,
    color: '#374151',
  },
  materialItem: {
    fontSize: 9,
    lineHeight: 1.4,
    paddingLeft: 8,
    marginBottom: 1,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: `1 solid ${BORDER}`,
    paddingTop: 5,
  },
  footerText: {
    fontSize: 7,
    color: GRAY,
  },
});

// ---------------------------------------------------------------------------
// Helpers for rendering MathField in PDF
// ---------------------------------------------------------------------------

/** Renders a MathField as an Image (if PNG was pre-rendered) or Text. */
function MF({
  field,
  textStyle,
  widthPt = PDF_FULL_W_PT,
}: {
  field: MathField;
  textStyle: any;
  widthPt?: number;
}) {
  if (field.png && field.pngH) {
    return <Image src={field.png} style={{ width: widthPt, height: field.pngH }} />;
  }
  return <Text style={textStyle}>{field.plain}</Text>;
}

// ---------------------------------------------------------------------------
// PDF Document
// ---------------------------------------------------------------------------

interface LessonPlanDocProps {
  data: ProcessedLessonPlan;
}

const LessonPlanDoc: React.FC<LessonPlanDocProps> = ({ data }) => {
  const { raw: plan } = data;
  const today = new Date().toLocaleDateString('mk-MK', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });

  return (
    <Document
      title={stripLatex(plan.title)}
      author="Math Curriculum AI Navigator"
      subject={`${plan.grade}. одделение — ${stripLatex(plan.theme || '')}`}
    >
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.headerBar}>
          <View style={{ maxWidth: 320 }}>
            {data.title.png && data.title.pngH ? (
              <Image
                src={data.title.png}
                style={[styles.headerTitleImg, { height: data.title.pngH }]}
              />
            ) : (
              <Text style={styles.headerTitle}>{data.title.plain}</Text>
            )}
          </View>
          <View>
            <Text style={styles.headerMeta}>
              {plan.grade}. одделение  |  {stripLatex(plan.subject || 'Математика')}
            </Text>
            <Text style={styles.headerMeta}>Тема: {stripLatex(plan.theme || '')}</Text>
            {plan.lessonNumber && (
              <Text style={styles.headerMeta}>Час бр. {plan.lessonNumber}</Text>
            )}
          </View>
        </View>

        {/* AI Illustration */}
        {plan.illustrationUrl && (
          <Image style={styles.illustration} src={plan.illustrationUrl} />
        )}

        {/* Objectives */}
        {data.objectives.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ЦЕЛИ НА ЧАСОТ</Text>
            {data.objectives.map((obj, i) => (
              <View key={i} style={styles.objectiveRow}>
                <Text style={styles.bullet}>•</Text>
                <View style={{ flex: 1 }}>
                  <MF
                    field={obj}
                    textStyle={styles.objectiveText}
                    widthPt={PDF_FULL_W_PT - 20}
                  />
                  {obj.bloomsLevel ? (
                    <Text style={styles.bloomBadge}>[{obj.bloomsLevel}]</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Scenario */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>СЦЕНАРИО НА ЧАСОТ</Text>

          {data.intro.plain ? (
            <>
              <Text style={styles.scenarioLabel}>Воведна активност</Text>
              <View style={{ paddingLeft: 8, marginBottom: 6 }}>
                <MF field={data.intro} textStyle={styles.scenarioText} widthPt={PDF_FULL_W_PT - 8} />
              </View>
            </>
          ) : null}

          {data.mainActivities.length > 0 && (
            <>
              <Text style={styles.scenarioLabel}>Главни активности</Text>
              {data.mainActivities.map((act, i) => (
                <View key={i} style={styles.objectiveRow}>
                  <Text style={styles.bullet}>{i + 1}.</Text>
                  <View style={{ flex: 1 }}>
                    <MF
                      field={act}
                      textStyle={styles.objectiveText}
                      widthPt={PDF_FULL_W_PT - 20}
                    />
                    {act.bloomsLevel ? (
                      <Text style={styles.bloomBadge}>[{act.bloomsLevel}]</Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </>
          )}

          {data.concluding.plain ? (
            <>
              <Text style={[styles.scenarioLabel, { marginTop: 4 }]}>Завршна активност</Text>
              <View style={{ paddingLeft: 8, marginBottom: 6 }}>
                <MF field={data.concluding} textStyle={styles.scenarioText} widthPt={PDF_FULL_W_PT - 8} />
              </View>
            </>
          ) : null}
        </View>

        {/* Differentiation */}
        {(data.diffSupport.plain || data.diffStandard.plain || data.diffAdvanced.plain) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ДИФЕРЕНЦИРАНА НАСТАВА</Text>
            <View style={styles.diffRow}>
              {data.diffSupport.plain ? (
                <View style={styles.diffCell}>
                  <Text style={[styles.diffCellLabel, { color: '#16A34A' }]}>Поддршка</Text>
                  <MF field={data.diffSupport} textStyle={styles.diffCellText} widthPt={PDF_DIFF_W_PT - 10} />
                </View>
              ) : null}
              {data.diffStandard.plain ? (
                <View style={styles.diffCell}>
                  <Text style={[styles.diffCellLabel, { color: BRAND }]}>Стандардно</Text>
                  <MF field={data.diffStandard} textStyle={styles.diffCellText} widthPt={PDF_DIFF_W_PT - 10} />
                </View>
              ) : null}
              {data.diffAdvanced.plain ? (
                <View style={styles.diffCell}>
                  <Text style={[styles.diffCellLabel, { color: '#7C3AED' }]}>Збогатување</Text>
                  <MF field={data.diffAdvanced} textStyle={styles.diffCellText} widthPt={PDF_DIFF_W_PT - 10} />
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Materials + Assessment Standards (two-column) */}
        <View style={styles.twoCol}>
          {data.materials.length > 0 && (
            <View style={[styles.col, styles.section]}>
              <Text style={styles.sectionTitle}>МАТЕРИЈАЛИ</Text>
              {data.materials.map((m, i) => (
                <View key={i} style={{ flexDirection: 'row', paddingLeft: 8, marginBottom: 1 }}>
                  <Text style={styles.bullet}>•</Text>
                  <MF field={m} textStyle={styles.materialItem} widthPt={(PDF_FULL_W_PT - 12) / 2 - 12} />
                </View>
              ))}
            </View>
          )}
          {data.assessmentStandards.length > 0 && (
            <View style={[styles.col, styles.section]}>
              <Text style={styles.sectionTitle}>СТАНДАРДИ ЗА ОЦЕНУВАЊЕ</Text>
              {data.assessmentStandards.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', paddingLeft: 8, marginBottom: 1 }}>
                  <Text style={styles.bullet}>•</Text>
                  <MF field={s} textStyle={styles.materialItem} widthPt={(PDF_FULL_W_PT - 12) / 2 - 12} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Progress Monitoring */}
        {data.progressMonitoring.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>СЛЕДЕЊЕ НА НАПРЕДОКОТ</Text>
            {data.progressMonitoring.map((p, i) => (
              <View key={i} style={{ flexDirection: 'row', paddingLeft: 8, marginBottom: 1 }}>
                <Text style={styles.bullet}>•</Text>
                <MF field={p} textStyle={styles.materialItem} widthPt={PDF_FULL_W_PT - 12} />
              </View>
            ))}
          </View>
        )}

        {/* Math Tool Embeds (GeoGebra / Desmos) */}
        {Array.isArray(plan.mathEmbeds) && plan.mathEmbeds.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>МАТЕМАТИЧКИ АЛАТКИ</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {plan.mathEmbeds.map((embed, i) => (
                <View key={i} style={{ alignItems: 'center', marginRight: 8, marginBottom: 8 }}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image src={embed.dataUrl} style={{ width: 180, height: 120 }} />
                  <Text style={{ fontSize: 8, color: '#6B7280', marginTop: 2 }}>
                    {embed.tool === 'geogebra' ? 'GeoGebra' : 'Desmos'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Math Curriculum AI Navigator</Text>
          <Text style={styles.footerText}>
            {stripLatex(plan.title)} — {today}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

// ---------------------------------------------------------------------------
// Public: Download Button — async preprocessing → programmatic PDF
// ---------------------------------------------------------------------------

interface LessonPlanPDFButtonProps {
  plan: LessonPlan;
}

export const LessonPlanPDFButton: React.FC<LessonPlanPDFButtonProps> = ({ plan }) => {
  const [status, setStatus] = useState<'idle' | 'processing' | 'error'>('idle');

  const safeFilename = `${(plan.title || 'plan')
    .replace(/[^a-z0-9а-шѓѕјљњќџч\s]/gi, '')
    .trim()
    .replace(/\s+/g, '_')}.pdf`;

  const handleDownload = async () => {
    setStatus('processing');
    try {
      const processed = await preprocessPlanForPDF(plan);
      const blob = await pdf(<LessonPlanDoc data={processed} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = safeFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      setStatus('idle');
    } catch (err) {
      console.error('PDF generation failed:', err);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={status === 'processing'}
      className="w-full text-left flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60 disabled:cursor-wait"
    >
      {status === 'processing' ? (
        <>
          <Loader2 className="w-5 h-5 mr-3 animate-spin text-brand-primary" />
          Рендерирам формули…
        </>
      ) : status === 'error' ? (
        <>
          <FileDown className="w-5 h-5 mr-3 text-red-500" />
          Грешка при PDF генерирање
        </>
      ) : (
        <>
          <FileDown className="w-5 h-5 mr-3 text-brand-primary" />
          Сними Брендиран PDF (A4)
        </>
      )}
    </button>
  );
};
