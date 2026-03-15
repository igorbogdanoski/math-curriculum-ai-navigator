import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  PDFDownloadLink,
  Font,
} from '@react-pdf/renderer';
import { Loader2, FileDown } from 'lucide-react';
import type { LessonPlan } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip common LaTeX math delimiters so text renders cleanly in the PDF. */
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
  // Header bar
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
  headerMeta: {
    fontSize: 8,
    color: GRAY,
    textAlign: 'right',
  },
  // Illustration
  illustration: {
    width: '100%',
    height: 130,
    objectFit: 'cover',
    borderRadius: 4,
    marginBottom: 10,
  },
  // Sections
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
  // Objective row
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
  // Scenario
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
  // Differentiation tabs
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
  // Materials list
  materialItem: {
    fontSize: 9,
    lineHeight: 1.4,
    paddingLeft: 8,
    marginBottom: 1,
  },
  // Two-column layout for bottom sections
  twoCol: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  // Footer
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
// PDF Document
// ---------------------------------------------------------------------------

interface LessonPlanDocProps {
  plan: LessonPlan;
}

const LessonPlanDoc: React.FC<LessonPlanDocProps> = ({ plan }) => {
  const intro = getText(plan.scenario?.introductory);
  const concluding = getText(plan.scenario?.concluding);
  const mainActivities = plan.scenario?.main ?? [];

  const tabs = plan.differentiationTabs ?? (
    plan.differentiation
      ? { support: '', standard: plan.differentiation, advanced: '' }
      : null
  );

  const today = new Date().toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric' });

  return (
    <Document
      title={plan.title}
      author="Math Curriculum AI Navigator"
      subject={`${plan.grade}. одделение — ${plan.theme}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>{stripLatex(plan.title)}</Text>
          <View>
            <Text style={styles.headerMeta}>{plan.grade}. одделение  |  {stripLatex(plan.subject || 'Математика')}</Text>
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
        {(plan.objectives?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ЦЕЛИ НА ЧАСОТ</Text>
            {(plan.objectives ?? []).map((obj, i) => (
              <View key={i} style={styles.objectiveRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.objectiveText}>
                  {getText(obj)}
                  {obj.bloomsLevel ? (
                    <Text style={styles.bloomBadge}>  [{obj.bloomsLevel}]</Text>
                  ) : null}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Scenario */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>СЦЕНАРИО НА ЧАСОТ</Text>
          {intro ? (
            <>
              <Text style={styles.scenarioLabel}>Воведна активност</Text>
              <Text style={styles.scenarioText}>{intro}</Text>
            </>
          ) : null}
          {mainActivities.length > 0 && (
            <>
              <Text style={styles.scenarioLabel}>Главни активности</Text>
              {mainActivities.map((act, i) => (
                <View key={i} style={styles.objectiveRow}>
                  <Text style={styles.bullet}>{i + 1}.</Text>
                  <Text style={styles.objectiveText}>
                    {getText(act)}
                    {(act as any).bloomsLevel ? (
                      <Text style={styles.bloomBadge}>  [{(act as any).bloomsLevel}]</Text>
                    ) : null}
                  </Text>
                </View>
              ))}
            </>
          )}
          {concluding ? (
            <>
              <Text style={[styles.scenarioLabel, { marginTop: 4 }]}>Завршна активност</Text>
              <Text style={styles.scenarioText}>{concluding}</Text>
            </>
          ) : null}
        </View>

        {/* Differentiation Tabs */}
        {tabs && (tabs.support || tabs.standard || tabs.advanced) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ДИФЕРЕНЦИРАНА НАСТАВА</Text>
            <View style={styles.diffRow}>
              {tabs.support && (
                <View style={styles.diffCell}>
                  <Text style={[styles.diffCellLabel, { color: '#16A34A' }]}>Поддршка</Text>
                  <Text style={styles.diffCellText}>{stripLatex(tabs.support)}</Text>
                </View>
              )}
              {tabs.standard && (
                <View style={styles.diffCell}>
                  <Text style={[styles.diffCellLabel, { color: BRAND }]}>Стандардно</Text>
                  <Text style={styles.diffCellText}>{stripLatex(tabs.standard)}</Text>
                </View>
              )}
              {tabs.advanced && (
                <View style={styles.diffCell}>
                  <Text style={[styles.diffCellLabel, { color: '#7C3AED' }]}>Збогатување</Text>
                  <Text style={styles.diffCellText}>{stripLatex(tabs.advanced)}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Bottom two-column: Materials + Assessment Standards */}
        <View style={styles.twoCol}>
          {(plan.materials?.length ?? 0) > 0 && (
            <View style={[styles.col, styles.section]}>
              <Text style={styles.sectionTitle}>МАТЕРИЈАЛИ</Text>
              {(plan.materials ?? []).map((m, i) => (
                <Text key={i} style={styles.materialItem}>• {stripLatex(m)}</Text>
              ))}
            </View>
          )}
          {(plan.assessmentStandards?.length ?? 0) > 0 && (
            <View style={[styles.col, styles.section]}>
              <Text style={styles.sectionTitle}>СТАНДАРДИ ЗА ОЦЕНУВАЊЕ</Text>
              {(plan.assessmentStandards ?? []).map((s, i) => (
                <Text key={i} style={styles.materialItem}>• {stripLatex(s)}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Progress Monitoring */}
        {(plan.progressMonitoring?.length ?? 0) > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>СЛЕДЕЊЕ НА НАПРЕДОКОТ</Text>
            {(plan.progressMonitoring ?? []).map((p, i) => (
              <Text key={i} style={styles.materialItem}>• {stripLatex(p)}</Text>
            ))}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Math Curriculum AI Navigator</Text>
          <Text style={styles.footerText}>{stripLatex(plan.title)} — {today}</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          } />
        </View>
      </Page>
    </Document>
  );
};

// ---------------------------------------------------------------------------
// Public: Download Button
// ---------------------------------------------------------------------------

interface LessonPlanPDFButtonProps {
  plan: LessonPlan;
}

export const LessonPlanPDFButton: React.FC<LessonPlanPDFButtonProps> = ({ plan }) => {
  const safeFilename = `${(plan.title || 'plan').replace(/[^a-z0-9а-шѓѕјљњќџч\s]/gi, '').trim().replace(/\s+/g, '_')}.pdf`;

  return (
    <PDFDownloadLink
      document={<LessonPlanDoc plan={plan} />}
      fileName={safeFilename}
      className="w-full text-left flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-100"
    >
      {({ loading, error }) =>
        loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-3 animate-spin text-brand-primary" />
            Подготвувам PDF...
          </>
        ) : error ? (
          <>
            <FileDown className="w-5 h-5 mr-3 text-red-500" />
            Грешка при PDF генерирање
          </>
        ) : (
          <>
            <FileDown className="w-5 h-5 mr-3 text-brand-primary" />
            Сними Брендиран PDF (A4)
          </>
        )
      }
    </PDFDownloadLink>
  );
};
