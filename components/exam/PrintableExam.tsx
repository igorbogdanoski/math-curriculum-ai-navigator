import React from 'react';
import { parseInlineSelection } from '../../utils/printExam';

// ─── Print question type definitions ─────────────────────────────────────────

export type PrintQuestionType =
  | 'multiple_choice'    // 1. A/B/C/D
  | 'true_false'         // 2. Точно/Неточно
  | 'short_answer'       // 3. кратко
  | 'fill_blank'         // 4. пополни празно
  | 'inline_selection'   // 5. {correct|wrong} синтакса
  | 'multi_match'        // 6. поврзи колони
  | 'ordering'           // 7. подреди
  | 'essay'              // 8. есеј / отворено
  | 'fill_table'         // 9. пополни табела
  | 'calculation'        // 10. покажи работа
  | 'graph_draw'         // 11. нацртај / графикон
  | 'label_diagram'      // 12. обележи дијаграм
  | 'proof_steps'        // 13. докажи
  | 'word_problem'       // 14. текстуална задача
  | 'data_interpretation'// 15. интерпретирај податоци
  | 'sub_numbered';      // 16. под-броеви (3.1, 3.2...)

export interface MatchPair {
  left: string;
  right: string;
}

export interface TableData {
  headers: string[];
  rows: (string | null)[][];
  caption?: string;
}

export interface SubQuestion {
  text: string;
  type: Exclude<PrintQuestionType, 'sub_numbered'>;
  options?: string[];
  answer?: string;
  lines?: number;
}

export interface PrintQuestion {
  id: string;
  number: number;           // 1, 2, 3 ...
  type: PrintQuestionType;
  text: string;
  points: number;
  answer?: string;          // for key
  options?: string[];       // MC
  matchPairs?: MatchPair[]; // multi_match
  orderItems?: string[];    // ordering
  tableData?: TableData;    // fill_table / data_interpretation
  svgDiagram?: string;      // label_diagram / graph_draw seed
  subQuestions?: SubQuestion[]; // sub_numbered
  lines?: number;           // blank lines for open answers (default 3)
  gridRows?: number;        // graph_draw grid
  gridCols?: number;
  showAnswer?: boolean;     // override for answer key per-question
}

export interface PrintExamProps {
  title: string;
  subject: string;
  gradeLevel: number;
  variantKey: string;
  date?: string;
  questions: PrintQuestion[];
  columns?: 1 | 2;
  showAnswers?: boolean;    // teacher key mode
  schoolName?: string;
}

// ─── Helper sub-components ────────────────────────────────────────────────────

const BlankLines: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="mt-2 space-y-2.5">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="border-b border-gray-400 h-5 w-full" />
    ))}
  </div>
);

const AnswerKey: React.FC<{ answer: string }> = ({ answer }) => (
  <div className="mt-1 text-xs text-red-600 font-semibold print:text-red-700">
    ✓ {answer}
  </div>
);

const OPTION_LABELS = ['А', 'Б', 'В', 'Г', 'Д'];

const InlineSelectionRender: React.FC<{ text: string; showAnswers?: boolean }> = ({ text, showAnswers }) => {
  const segs = parseInlineSelection(text);
  return (
    <span>
      {segs.map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.value}</span>;
        return (
          <span key={i} className="inline-block mx-1">
            {seg.options.map((opt, oi) => (
              <span
                key={oi}
                className={`inline-block border border-gray-500 rounded px-1.5 py-0.5 mx-0.5 text-xs font-medium ${
                  showAnswers && oi === seg.correctIndex
                    ? 'bg-green-200 border-green-600 text-green-800 font-bold'
                    : 'bg-white text-gray-700'
                }`}
              >
                {opt}
              </span>
            ))}
          </span>
        );
      })}
    </span>
  );
};

const GridArea: React.FC<{ rows?: number; cols?: number }> = ({ rows = 10, cols = 14 }) => (
  <div className="mt-2 inline-block border border-gray-400">
    <table className="border-collapse">
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c} className="w-5 h-5 border border-gray-200" />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Single question renderer ─────────────────────────────────────────────────

const QuestionBlock: React.FC<{ q: PrintQuestion; showAnswers: boolean }> = ({ q, showAnswers }) => {
  const show = showAnswers || !!q.showAnswer;

  const renderBody = () => {
    switch (q.type) {
      case 'multiple_choice':
        return (
          <div className="mt-2 space-y-1 ml-4">
            {(q.options ?? []).map((opt, i) => (
              <div key={i} className={`flex items-start gap-2 text-sm ${show && opt === q.answer ? 'text-green-700 font-semibold' : ''}`}>
                <span className="shrink-0 w-5 h-5 rounded-full border border-gray-500 flex items-center justify-center text-xs font-bold">
                  {OPTION_LABELS[i]}
                </span>
                <span>{opt}</span>
                {show && opt === q.answer && <span className="text-green-600 text-xs ml-1">✓</span>}
              </div>
            ))}
          </div>
        );

      case 'true_false':
        return (
          <div className="mt-2 flex gap-6 ml-4">
            {['Точно', 'Неточно'].map(lbl => (
              <label key={lbl} className={`flex items-center gap-2 text-sm ${show && lbl === q.answer ? 'text-green-700 font-semibold' : ''}`}>
                <span className="w-5 h-5 rounded border border-gray-500 inline-block shrink-0" />
                {lbl}
                {show && lbl === q.answer && <span className="text-green-600 text-xs">✓</span>}
              </label>
            ))}
          </div>
        );

      case 'fill_blank':
      case 'short_answer':
        return (
          <>
            <BlankLines count={q.lines ?? 2} />
            {show && q.answer && <AnswerKey answer={q.answer} />}
          </>
        );

      case 'inline_selection':
        return (
          <div className="mt-1 text-sm leading-relaxed ml-4">
            <InlineSelectionRender text={q.text} showAnswers={show} />
          </div>
        );

      case 'multi_match': {
        const pairs = q.matchPairs ?? [];
        const leftItems = pairs.map(p => p.left);
        const rightItems = show
          ? pairs.map(p => p.right)
          : [...pairs.map(p => p.right)].sort(() => Math.random() - 0.5);
        return (
          <div className="mt-2 ml-4 grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              {leftItems.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-bold w-5">{i + 1}.</span>
                  <span className="border-b border-gray-400 flex-1 pb-0.5">{l}</span>
                  <span className="text-gray-400">——</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {rightItems.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-bold text-xs">{String.fromCharCode(97 + i)})</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'ordering': {
        const items = q.orderItems ?? [];
        const shuffled = show ? items : [...items].sort(() => Math.random() - 0.5);
        return (
          <div className="mt-2 ml-4 space-y-1.5 text-sm">
            {shuffled.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 border border-gray-500 rounded text-center text-xs leading-6 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
            {show && q.answer && <AnswerKey answer={q.answer} />}
          </div>
        );
      }

      case 'essay':
        return (
          <>
            <BlankLines count={q.lines ?? 8} />
            {show && q.answer && <AnswerKey answer={q.answer} />}
          </>
        );

      case 'calculation':
      case 'word_problem':
        return (
          <>
            <div className="mt-2 ml-4 border border-dashed border-gray-300 rounded p-2 text-xs text-gray-400">
              Работен простор
            </div>
            <BlankLines count={q.lines ?? 5} />
            {show && q.answer && <AnswerKey answer={q.answer} />}
          </>
        );

      case 'fill_table': {
        const tbl = q.tableData;
        if (!tbl) return <BlankLines count={4} />;
        return (
          <div className="mt-2 ml-4 overflow-x-auto">
            {tbl.caption && <p className="text-xs text-gray-500 mb-1 italic">{tbl.caption}</p>}
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  {tbl.headers.map((h, i) => (
                    <th key={i} className="border border-gray-600 px-3 py-1.5 bg-gray-100 font-semibold text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tbl.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="border border-gray-400 px-3 py-3 min-w-[80px]">
                        {cell === null ? (show ? <span className="text-red-600 text-xs">?</span> : null) : cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case 'graph_draw':
        return (
          <div className="mt-2 ml-4">
            {q.svgDiagram ? (
              <div dangerouslySetInnerHTML={{ __html: q.svgDiagram }} className="mb-2" />
            ) : null}
            <GridArea rows={q.gridRows ?? 10} cols={q.gridCols ?? 14} />
            {show && q.answer && <AnswerKey answer={q.answer} />}
          </div>
        );

      case 'label_diagram':
        return (
          <div className="mt-2 ml-4">
            {q.svgDiagram ? (
              <div dangerouslySetInnerHTML={{ __html: q.svgDiagram }} className="mb-2" />
            ) : (
              <div className="border border-dashed border-gray-300 h-32 rounded flex items-center justify-center text-gray-300 text-xs">
                [Дијаграм]
              </div>
            )}
            <BlankLines count={2} />
            {show && q.answer && <AnswerKey answer={q.answer} />}
          </div>
        );

      case 'proof_steps':
        return (
          <div className="mt-2 ml-4 overflow-x-auto">
            <table className="border-collapse text-sm w-full">
              <thead>
                <tr>
                  <th className="border border-gray-500 px-3 py-1.5 bg-gray-100 text-left w-8">#</th>
                  <th className="border border-gray-500 px-3 py-1.5 bg-gray-100 text-left w-1/2">Чекор</th>
                  <th className="border border-gray-500 px-3 py-1.5 bg-gray-100 text-left">Образложение</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map(n => (
                  <tr key={n}>
                    <td className="border border-gray-400 px-3 py-3 text-center text-xs text-gray-400">{n}</td>
                    <td className="border border-gray-400 px-3 py-3" />
                    <td className="border border-gray-400 px-3 py-3" />
                  </tr>
                ))}
              </tbody>
            </table>
            {show && q.answer && <AnswerKey answer={q.answer} />}
          </div>
        );

      case 'data_interpretation': {
        const tbl = q.tableData;
        return (
          <div className="mt-2 ml-4 space-y-2">
            {tbl && (
              <div className="overflow-x-auto">
                {tbl.caption && <p className="text-xs text-gray-500 mb-1 italic">{tbl.caption}</p>}
                <table className="border-collapse text-sm">
                  <thead>
                    <tr>{tbl.headers.map((h, i) => <th key={i} className="border border-gray-600 px-3 py-1.5 bg-gray-100 font-semibold text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {tbl.rows.map((row, ri) => (
                      <tr key={ri}>{row.map((cell, ci) => <td key={ci} className="border border-gray-400 px-3 py-2">{cell}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <BlankLines count={q.lines ?? 4} />
            {show && q.answer && <AnswerKey answer={q.answer} />}
          </div>
        );
      }

      case 'sub_numbered':
        return (
          <div className="mt-2 ml-4 space-y-3">
            {(q.subQuestions ?? []).map((sub, si) => (
              <div key={si}>
                <p className="text-sm font-medium text-gray-700">
                  {q.number}.{si + 1}{')'} {sub.text}
                </p>
                {sub.type === 'multiple_choice' && sub.options && (
                  <div className="mt-1 ml-4 space-y-1">
                    {sub.options.map((opt, oi) => (
                      <div key={oi} className={`flex items-start gap-2 text-sm ${show && opt === sub.answer ? 'text-green-700 font-semibold' : ''}`}>
                        <span className="shrink-0 w-5 h-5 rounded-full border border-gray-500 flex items-center justify-center text-xs font-bold">
                          {OPTION_LABELS[oi]}
                        </span>
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(sub.type === 'short_answer' || sub.type === 'fill_blank') && (
                  <BlankLines count={sub.lines ?? 2} />
                )}
                {sub.type === 'calculation' && <BlankLines count={sub.lines ?? 4} />}
                {show && sub.answer && <AnswerKey answer={sub.answer} />}
              </div>
            ))}
          </div>
        );

      default:
        return <BlankLines count={3} />;
    }
  };

  // For inline_selection, the question text IS the content — don't repeat
  const showQuestionText = q.type !== 'inline_selection';

  return (
    <div className="mb-5 break-inside-avoid">
      <div className="flex items-start gap-2">
        <span className="font-bold text-gray-900 shrink-0 text-sm w-6">{q.number}.</span>
        <div className="flex-1">
          {showQuestionText && (
            <span className="text-sm text-gray-900 leading-snug">{q.text}</span>
          )}
          {q.type === 'inline_selection' && (
            <span className="text-sm text-gray-900 leading-snug">
              <InlineSelectionRender text={q.text} showAnswers={show} />
            </span>
          )}
          <span className="ml-2 text-xs text-gray-400">({q.points} бод.)</span>
        </div>
      </div>
      {renderBody()}
    </div>
  );
};

// ─── Main PrintableExam ───────────────────────────────────────────────────────

export const PrintableExam: React.FC<PrintExamProps> = ({
  title,
  subject,
  gradeLevel,
  variantKey,
  date,
  questions,
  columns = 1,
  showAnswers = false,
  schoolName,
}) => {
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          @page { margin: 15mm 12mm; size: A4; }
          body { font-size: 11pt; }
          .no-print { display: none !important; }
          .print-break { page-break-before: always; }
          .break-inside-avoid { break-inside: avoid; }
        }
      `}</style>

      <div className="bg-white text-gray-900 font-sans text-sm p-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="border-2 border-gray-800 p-3 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {schoolName && <p className="text-xs text-gray-600 mb-0.5">{schoolName}</p>}
              <h1 className="text-base font-bold text-gray-900 leading-tight">{title}</h1>
              <p className="text-xs text-gray-600 mt-0.5">{subject} · {gradeLevel}. одделение</p>
            </div>
            <div className="text-right shrink-0 ml-4">
              <div className="inline-block border-2 border-gray-800 px-3 py-1 text-base font-bold tracking-wider">
                Варијанта {variantKey}
              </div>
              {date && <p className="text-xs text-gray-500 mt-1">{date}</p>}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 text-xs border-t border-gray-300 pt-2">
            <div>
              Ime и презиме: <span className="border-b border-gray-600 inline-block w-36 ml-1" />
            </div>
            <div>
              Одделение: <span className="border-b border-gray-600 inline-block w-20 ml-1" />
            </div>
            <div className="text-right font-semibold">
              Оцена: _____ / {totalPoints} бод.
            </div>
          </div>
        </div>

        {/* Questions */}
        {columns === 2 ? (
          <div className="columns-2 gap-6">
            {questions.map(q => (
              <QuestionBlock key={q.id} q={q} showAnswers={showAnswers} />
            ))}
          </div>
        ) : (
          <div>
            {questions.map(q => (
              <QuestionBlock key={q.id} q={q} showAnswers={showAnswers} />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 border-t border-gray-300 pt-2 text-xs text-gray-400 text-center">
          {title} — Варијанта {variantKey} · Вкупно: {totalPoints} бодови
          {showAnswers && <span className="ml-2 text-red-500 font-semibold">★ КЛУЧ НА ОДГОВОРИ ★</span>}
        </div>
      </div>
    </>
  );
};
