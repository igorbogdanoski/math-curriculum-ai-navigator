import React, { useState, useEffect } from 'react';
import { useRouter } from '../hooks/useRouter';
import { examService } from '../services/firestoreService.exam';
import type { ExamSession, ExamVariantKey } from '../services/firestoreService.types';
import { PrintableExam } from '../components/exam/PrintableExam';
import { AnswerSheet } from '../components/exam/AnswerSheet';
import type { PrintQuestion } from '../components/exam/PrintableExam';
import { buildZipGradeCSV, downloadCSV, extractMCAnswer } from '../utils/printExam';
import {
  Printer, Download, Eye, EyeOff, Columns, AlignLeft,
  Loader2, ChevronDown,
} from 'lucide-react';

const VARIANT_KEYS: ExamVariantKey[] = ['A', 'B', 'V', 'G'];

function toMacedonianDate(d = new Date()): string {
  return d.toLocaleDateString('mk-MK', { day: '2-digit', month: 'long', year: 'numeric' });
}

function examQsToPrintQs(
  session: ExamSession,
  variantKey: ExamVariantKey,
): PrintQuestion[] {
  const qs = session.variants[variantKey] ?? [];
  return qs.map((q, i) => ({
    id: q.id,
    number: i + 1,
    type: q.type as PrintQuestion['type'],
    text: q.question,
    points: q.points,
    answer: q.answer,
    options: q.options,
    svgDiagram: q.svgDiagram,
    lines: q.type === 'essay' ? 8 : q.type === 'calculation' ? 5 : 3,
  }));
}

export const PrintExamView: React.FC = () => {
  const { params } = useRouter([]);
  const sessionId = params?.id ?? '';

  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(!!sessionId);

  const [activeVariant, setActiveVariant] = useState<ExamVariantKey>('A');
  const [columns, setColumns] = useState<1 | 2>(1);
  const [showAnswers, setShowAnswers] = useState(false);
  const [showAnswerSheet, setShowAnswerSheet] = useState(true);
  const [allVariants, setAllVariants] = useState(false);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    examService.getExamSession(sessionId).then(s => {
      setSession(s);
      setLoading(false);
    });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!session && sessionId) {
    return <div className="p-8 text-gray-500">Испитот не е пронајден.</div>;
  }

  const title = session?.title ?? 'Испит';
  const subject = session?.subject ?? 'Математика';
  const gradeLevel = session?.gradeLevel ?? 8;
  const date = toMacedonianDate();

  const variantsToRender = allVariants ? VARIANT_KEYS : [activeVariant];

  const getPrintQuestions = (vk: ExamVariantKey): PrintQuestion[] => {
    if (!session) return [];
    return examQsToPrintQs(session, vk);
  };

  const handleExportZipGrade = (vk: ExamVariantKey) => {
    const qs = getPrintQuestions(vk);
    const mcQs = qs.filter(q => q.type === 'multiple_choice' || q.type === 'true_false');
    const zipQs = mcQs.map(q => ({
      number: q.number,
      answer: extractMCAnswer(
        session!.variants[vk].find(eq => eq.id === q.id)!,
        q.answer ?? '',
      ),
      points: q.points,
    }));
    const csv = buildZipGradeCSV(title, vk, zipQs);
    downloadCSV(csv, `${title}_${vk}_zipgrade.csv`);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Control bar */}
      <div className="no-print sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex flex-wrap items-center gap-3 shadow-sm">
        <h1 className="text-sm font-bold text-gray-700 mr-2 truncate max-w-[200px]">
          🖨️ {title}
        </h1>

        {/* Variant selector */}
        {!allVariants && (
          <div className="flex items-center gap-1 border border-gray-300 rounded-xl overflow-hidden">
            {VARIANT_KEYS.map(vk => (
              <button
                key={vk}
                type="button"
                onClick={() => setActiveVariant(vk)}
                className={`px-3 py-1.5 text-xs font-bold transition-colors ${
                  activeVariant === vk
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Вар. {vk}
              </button>
            ))}
          </div>
        )}

        {/* All variants toggle */}
        <button
          type="button"
          onClick={() => setAllVariants(!allVariants)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
            allVariants
              ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
              : 'border-gray-300 text-gray-600 hover:border-indigo-300'
          }`}
        >
          <ChevronDown className="w-3.5 h-3.5" />
          Сите 4 варијанти
        </button>

        {/* Columns */}
        <button
          type="button"
          onClick={() => setColumns(columns === 1 ? 2 : 1)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-300 text-gray-600 hover:border-indigo-300 transition-colors"
        >
          {columns === 2 ? <Columns className="w-3.5 h-3.5" /> : <AlignLeft className="w-3.5 h-3.5" />}
          {columns === 1 ? '1 колона' : '2 колони'}
        </button>

        {/* Show answers */}
        <button
          type="button"
          onClick={() => setShowAnswers(!showAnswers)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
            showAnswers
              ? 'bg-red-50 border-red-400 text-red-700'
              : 'border-gray-300 text-gray-600 hover:border-red-300'
          }`}
        >
          {showAnswers ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          {showAnswers ? 'Клуч видлив' : 'Клуч скриен'}
        </button>

        {/* Answer sheet toggle */}
        <button
          type="button"
          onClick={() => setShowAnswerSheet(!showAnswerSheet)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
            showAnswerSheet
              ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
              : 'border-gray-300 text-gray-600'
          }`}
        >
          {showAnswerSheet ? '✓' : '○'} Лист за одговори
        </button>

        {/* ZipGrade CSV export */}
        {session && !allVariants && (
          <button
            type="button"
            onClick={() => handleExportZipGrade(activeVariant)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-300 text-gray-600 hover:border-indigo-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            ZipGrade CSV
          </button>
        )}

        {/* Print */}
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold ml-auto transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Печати / PDF
        </button>
      </div>

      {/* Print area */}
      <div id="print-area" className="py-6 px-4 space-y-8">
        {variantsToRender.map(vk => {
          const qs = getPrintQuestions(vk);
          return (
            <div key={vk}>
              <PrintableExam
                title={title}
                subject={subject}
                gradeLevel={gradeLevel}
                variantKey={vk}
                date={date}
                questions={qs}
                columns={columns}
                showAnswers={showAnswers}
              />
              {showAnswerSheet && (
                <AnswerSheet
                  title={title}
                  variantKey={vk}
                  questions={qs}
                  showAnswers={showAnswers}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
