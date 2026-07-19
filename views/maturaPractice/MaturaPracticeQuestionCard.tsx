import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Sigma } from 'lucide-react';
import { MathRenderer }    from '../../components/common/MathRenderer';
import { MathInput }       from '../../components/common/MathInput';
import { QRSolutionUpload } from '../../components/common/QRSolutionUpload';
import { DokBadge }        from '../../components/common/DokBadge';
import { ForumCTA }        from '../../components/common/ForumCTA';
import type { DokLevel }   from '../../types';
import { callGeminiProxy, DEFAULT_MODEL } from '../../services/gemini/core';
import type { PracticeItem, QuestionState } from './maturaPracticeHelpers';
import { CHOICES, TOPIC_COLORS, TOPIC_LABELS, isOpen } from './maturaPracticeHelpers';
import { gradePart2, gradePart3, explainWrongAnswer } from './maturaPracticeGrading';
import { resolveMCKey, nextFocusedIdx } from './maturaKeyboardNav';

export function QuestionCard({
  item, idx, total, state, onUpdate,
}: {
  item: PracticeItem;
  idx: number;
  total: number;
  state: QuestionState;
  onUpdate: (patch: Partial<QuestionState>) => void;
}) {
  const open = isOpen(item);
  const part2 = item.part === 2 && open;
  const part3 = item.part === 3 && open;

  const topicColor = TOPIC_COLORS[item.topicArea ?? ''] ?? 'bg-gray-100 text-gray-700 border-gray-200';

  // ── On-demand aiSolution generation ─────────────────────────────────────────
  const solCacheKey = `matura_ai_sol_${item.examId ?? 'local'}_${item.questionNumber}`;
  const [genSolution, setGenSolution] = useState<string | null>(() => {
    try { return localStorage.getItem(solCacheKey); } catch { return null; }
  });
  const [generating, setGenerating] = useState(false);

  const handleGenerateSolution = useCallback(async () => {
    if (generating || genSolution) return;
    setGenerating(true);
    try {
      const prompt = `Си математички тутор кој пишува чекор-по-чекор решенија за македонски државен испит (ДИМ). Пишувај на македонски јазик.

Прашање ${item.questionNumber} (Дел ${item.part ?? ''}, ${item.points ?? ''} поени):
${item.questionText}

Точен одговор/модел: ${item.correctAnswer}

Напиши КОНЦИЗНО чекор-по-чекор решение. Барања:
- Користи LaTeX нотација ($x^2$, $\\frac{a}{b}$)
- Максимум 200 збора
- Не го повторувај прашањето
- Почни директно со решението
- Нагласи го крајниот одговор

Врати САМО текст на решението, без JSON, без хедери.`;

      const result = await callGeminiProxy({
        model: DEFAULT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      });
      const text = result.text ?? '';
      if (text) {
        setGenSolution(text);
        try { localStorage.setItem(solCacheKey, text); } catch { /* ignore */ }
      }
    } catch {
      // silently fail — user can retry
    } finally {
      setGenerating(false);
    }
  }, [generating, genSolution, item, solCacheKey]);

  // MC submit on click
  const handleMC = useCallback((choice: string) => {
    if (state.submitted) return;
    onUpdate({ mcPick: choice, submitted: true });
  }, [state.submitted, onUpdate]);

  // Keyboard-first MC selection
  const availableChoices = useMemo(
    () => (open ? [] : CHOICES.filter(c => item.choices?.[c])),
    [open, item.choices],
  );
  const [focusedChoiceIdx, setFocusedChoiceIdx] = useState(0);
  useEffect(() => { setFocusedChoiceIdx(0); }, [item.questionNumber]);
  useEffect(() => {
    if (open || state.submitted || availableChoices.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      const action = resolveMCKey(e.key, availableChoices);
      if (action.type === 'noop') return;
      e.preventDefault();
      if (action.type === 'select') handleMC(action.choice);
      else if (action.type === 'cycle') {
        setFocusedChoiceIdx(i => nextFocusedIdx(i, action.direction, availableChoices.length));
      } else if (action.type === 'submit-focused' && availableChoices[focusedChoiceIdx]) {
        handleMC(availableChoices[focusedChoiceIdx]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, state.submitted, availableChoices, focusedChoiceIdx, handleMC]);

  // Part 2 AI grade
  const handleGradeP2 = useCallback(async () => {
    onUpdate({ grading: true, aiError: undefined });
    try {
      const grade = await gradePart2(item, state.answer ?? '', state.studentSolutionImageUrl);
      onUpdate({ grading: false, aiGrade: grade, submitted: true });
    } catch {
      onUpdate({ grading: false, aiError: 'Грешка при оценување. Обидете се повторно.', submitted: false });
    }
  }, [item, state.answer, state.studentSolutionImageUrl, onUpdate]);

  // Part 3 AI grade
  const handleGradeP3 = useCallback(async () => {
    onUpdate({ gradingP3: true, aiError: undefined });
    try {
      const grade = await gradePart3(item, state.aiDesc ?? '', state.studentSolutionImageUrl);
      onUpdate({ gradingP3: false, aiGradeP3: grade });
    } catch {
      onUpdate({ gradingP3: false, aiError: 'Грешка при AI оценување.' });
    }
  }, [item, state.aiDesc, state.studentSolutionImageUrl, onUpdate]);

  // Explain wrong MC answer
  const handleExplainWrong = useCallback(async () => {
    if (!state.mcPick || state.explainLoading || state.mcExplanation) return;
    const wrongText = item.choices?.[state.mcPick] ?? '';
    onUpdate({ explainLoading: true });
    try {
      const explanation = await explainWrongAnswer(item, state.mcPick, wrongText);
      onUpdate({ explainLoading: false, mcExplanation: explanation });
    } catch {
      onUpdate({ explainLoading: false, mcExplanation: 'Не можев да генерирам објаснување. Обидете се повторно.' });
    }
  }, [item, state.mcPick, state.explainLoading, state.mcExplanation, onUpdate]);

  // Part 3 self-assess submit
  const handleSelfSubmit = useCallback(() => {
    onUpdate({ submitted: true });
  }, [onUpdate]);

  const mcCorrect = !open && !item.voided && !item.needsReview && state.submitted && state.mcPick === item.correctAnswer?.trim();
  const mcWrong   = !open && !item.voided && !item.needsReview && state.submitted && state.mcPick !== item.correctAnswer?.trim();

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b bg-gray-50/60">
        <span className="text-xs font-black text-gray-400">#{idx + 1}/{total}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${topicColor}`}>
          {TOPIC_LABELS[item.topicArea ?? ''] ?? item.topicArea}
        </span>
        {item.topic && <span className="text-xs text-gray-400">{item.topic}</span>}
        {item.dokLevel && <DokBadge level={item.dokLevel as DokLevel} size="compact" />}
        <span className="ml-auto text-xs font-bold text-gray-500">{item.points}pt • {item.examLabel}</span>
      </div>

      {/* Question text */}
      <div className="px-5 pt-4 pb-2">
        <div className="text-base font-medium text-gray-800 leading-relaxed">
          <MathRenderer text={item.questionText} />
        </div>
        {item.imageUrls?.map((url, i) => (
          <img key={i} src={url} alt={item.imageDescription ?? `Слика ${i + 1} кон задача`}
            className="mt-3 max-h-56 rounded-lg border" />
        ))}
      </div>

      {/* ── Part 1 MC: officially voided (no correct answer exists) ── */}
      {!open && item.voided && (
        <div className="px-5 pb-4 space-y-2 mt-2">
          {availableChoices.map(choice => (
            <div key={choice} className="w-full flex items-start gap-3 px-4 py-2.5 rounded-xl border-2 border-gray-100 bg-gray-50 text-left opacity-60">
              <span className="font-black shrink-0">{choice}.</span>
              <MathRenderer text={item.choices![choice]!} />
            </div>
          ))}
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <span className="font-bold">Ова прашање е поништено</span> од Државната испитна комисија{item.voidedReason ? ` — ${item.voidedReason}` : ''}. Не се бодува и не влијае на резултатот.
          </div>
        </div>
      )}

      {/* ── Part 1 MC: needsReview (our own ingested data is inconsistent for this question,
           not a state-committee decision — see MaturaQuestion.needsReview) ── */}
      {!open && item.needsReview && (
        <div className="px-5 pb-4 space-y-2 mt-2">
          {availableChoices.map(choice => (
            <div key={choice} className="w-full flex items-start gap-3 px-4 py-2.5 rounded-xl border-2 border-gray-100 bg-gray-50 text-left opacity-60">
              <span className="font-black shrink-0">{choice}.</span>
              <MathRenderer text={item.choices![choice]!} />
            </div>
          ))}
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            <span className="font-bold">Ова прашање моментално не се бодува</span> — детектиран е проблем со внесените податоци{item.reviewReason ? ` (${item.reviewReason})` : ''}. Не влијае на резултатот.
          </div>
        </div>
      )}

      {/* ── Part 1 MC ── */}
      {!open && !item.voided && !item.needsReview && (
        <div className="px-5 pb-4 space-y-2 mt-2">
          {availableChoices.map((choice, choiceIdx) => {
            const isCorrectChoice = choice === item.correctAnswer?.trim();
            const isPicked        = state.mcPick === choice;
            const isFocused       = !state.submitted && focusedChoiceIdx === choiceIdx;
            let bg = 'bg-white border-gray-200 hover:border-brand-primary hover:bg-blue-50';
            if (state.submitted) {
              if (isCorrectChoice) bg = 'bg-emerald-50 border-emerald-400 text-emerald-800';
              else if (isPicked)   bg = 'bg-rose-50 border-rose-400 text-rose-800';
              else                 bg = 'bg-white border-gray-100 opacity-60';
            } else if (isPicked)  bg = 'bg-blue-50 border-brand-primary';
            else if (isFocused)   bg = 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200';
            return (
              <button
                key={choice} type="button"
                disabled={state.submitted}
                onClick={() => handleMC(choice)}
                aria-label={`Опција ${choice}`}
                className={`w-full flex items-start gap-3 px-4 py-2.5 rounded-xl border-2 text-left transition-all font-medium focus:outline-2 focus:outline-brand-primary focus:outline-offset-2 ${bg}`}
              >
                <span className="font-black shrink-0">{choice}.</span>
                <MathRenderer text={item.choices![choice]!} />
              </button>
            );
          })}
          {state.submitted && (
            <div className="flex items-center gap-3 mt-1">
              <p className={`text-sm font-bold flex-1 ${mcCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                {mcCorrect ? '✓ Точно!' : `✗ Точен одговор: ${item.correctAnswer?.trim() ?? ''}`}
              </p>
              {mcWrong && (
                <ForumCTA
                  context={TOPIC_LABELS[item.topicArea ?? ''] ?? item.topicArea ?? 'Матура'}
                  variant="inline"
                />
              )}
            </div>
          )}
          {mcWrong && !state.mcExplanation && (
            <button
              type="button"
              disabled={!!state.explainLoading}
              onClick={() => void handleExplainWrong()}
              className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition disabled:opacity-50"
            >
              {state.explainLoading ? (
                <><span className="animate-spin">⏳</span> Генерирање…</>
              ) : (
                <>💡 Зошто е погрешно?</>
              )}
            </button>
          )}
          {mcWrong && state.mcExplanation && (
            <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
              <p className="text-xs font-bold text-amber-700">💡 Објаснување:</p>
              <div className="text-xs text-amber-900 leading-relaxed">
                <MathRenderer text={state.mcExplanation} />
              </div>
            </div>
          )}
          {/* ── Solution (after MC answer) ── */}
          {state.submitted && item.aiSolution && (
            <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-black text-blue-700">Решение:</p>
              <div className="text-xs text-blue-800 leading-relaxed">
                <MathRenderer text={item.aiSolution} />
              </div>
              {item.solutionImageUrl && (
                <img src={item.solutionImageUrl} alt="Илустрација кон решението"
                  className="mt-2 max-h-56 rounded-lg border border-blue-200" />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Part 2 open (AI grade) ── */}
      {part2 && (
        <div className="px-5 pb-4 space-y-3 mt-2">
          <p className="text-xs text-gray-500 font-medium">Внеси го твојот одговор:</p>
          <div>
            {!state.aiGrade ? (
              <MathInput
                value={state.answer ?? ''}
                onChange={v => onUpdate({ answer: v })}
                className="w-full"
              />
            ) : (
              <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 min-h-[38px]">
                {state.answer || ''}
              </div>
            )}
            {state.aiGrade && (
              <p className={`text-xs mt-1 font-medium ${state.aiGrade.correct ? 'text-emerald-600' : 'text-rose-600'}`}>
                {state.aiGrade.correct ? '✓' : '✗'} {state.aiGrade.comment}
              </p>
            )}
            {state.aiGrade?.verifiedByCas && (
              <span
                className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full"
                title="Одговорот е препознаен како точен со математички мотор за проверка на еквивалентност (не само буквално совпаѓање)."
              >
                <Sigma className="w-3 h-3" /> Проверено со математички мотор
              </span>
            )}
          </div>
          {!state.aiGrade && (
            <QRSolutionUpload
              questionKey={item.examId + '_q' + item.questionNumber + '_p2'}
              onImageUrl={url => onUpdate({ studentSolutionImageUrl: url })}
              existingUrl={state.studentSolutionImageUrl}
              disabled={!!state.aiGrade}
            />
          )}
          {state.aiGrade ? (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
              <p className="text-xs font-bold text-blue-700">
                Резултат: {state.aiGrade.score}/{state.aiGrade.maxScore}pt
              </p>
              <p className="text-xs text-blue-600">{state.aiGrade.feedback}</p>
              <div className="pt-2 border-t border-blue-100">
                <p className="text-xs text-gray-500 font-medium">Точен одговор:</p>
                <div className="text-xs text-gray-700"><MathRenderer text={item.correctAnswer} /></div>
              </div>
              {(item.aiSolution || genSolution) ? (
                <div className="pt-2 border-t border-blue-100 space-y-1">
                  <p className="text-xs font-black text-blue-700">Решение:</p>
                  <div className="text-xs text-blue-800 leading-relaxed">
                    <MathRenderer text={item.aiSolution ?? genSolution ?? ''} />
                  </div>
                  {item.solutionImageUrl && (
                    <img src={item.solutionImageUrl} alt="Илустрација кон решението"
                      className="mt-2 max-h-56 rounded-lg border border-blue-200" />
                  )}
                </div>
              ) : (
                <button type="button" onClick={() => void handleGenerateSolution()} disabled={generating}
                  className="mt-1 px-3 py-1 rounded-lg text-[11px] font-bold bg-violet-100 text-violet-700 hover:bg-violet-200 transition disabled:opacity-50">
                  {generating ? 'Генерирање решение…' : 'Генерирај решение'}
                </button>
              )}
            </div>
          ) : (
            <button type="button" disabled={!!state.grading || !state.answer} onClick={handleGradeP2}
              className="px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-secondary disabled:opacity-50 transition-colors">
              {state.grading ? 'Оценување…' : 'Провери со AI'}
            </button>
          )}
          {state.aiError && <p className="text-xs text-rose-600">{state.aiError}</p>}
        </div>
      )}

      {/* ── Part 3 open (self-assess + opt-in AI) ── */}
      {part3 && (
        <div className="px-5 pb-4 space-y-3 mt-2">
          {!state.submitted ? (
            <>
              <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                Реши ја задачата на хартија, па самооцени се подолу.
              </p>
              <div className="space-y-1.5">
                <p className="text-xs text-gray-500 font-medium">Штикирај за секој поен кој мислиш дека го заслужуваш:</p>
                {Array.from({ length: item.points }).map((_, pi) => {
                  const checked = state.selfChecks?.[pi] ?? false;
                  return (
                    <label key={pi} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={checked}
                        onChange={e => {
                          const arr = Array.from({ length: item.points }, (_, j) => state.selfChecks?.[j] ?? false);
                          arr[pi] = e.target.checked;
                          onUpdate({ selfChecks: arr });
                        }}
                        className="w-4 h-4 accent-brand-primary"
                      />
                      <span className="text-sm text-gray-700">Поен {pi + 1}</span>
                    </label>
                  );
                })}
              </div>
              <QRSolutionUpload
                questionKey={item.examId + '_q' + item.questionNumber + '_p3'}
                onImageUrl={url => onUpdate({ studentSolutionImageUrl: url })}
                existingUrl={state.studentSolutionImageUrl}
              />
              <button type="button" onClick={handleSelfSubmit}
                className="px-4 py-2 bg-brand-primary text-white text-sm font-bold rounded-lg hover:bg-brand-secondary transition-colors">
                Потврди самооценка
              </button>
            </>
          ) : (
            <>
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-2">
                <p className="text-xs font-bold text-gray-600">
                  Самооценка: {(state.selfChecks ?? []).filter(Boolean).length}/{item.points}pt
                </p>
                <div>
                  <p className="text-xs text-gray-500 font-semibold mb-1">Точен одговор / модел:</p>
                  <div className="text-xs text-gray-700"><MathRenderer text={item.correctAnswer} /></div>
                </div>
                {(item.aiSolution || genSolution) ? (
                  <div className="pt-2 border-t border-gray-200 space-y-1">
                    <p className="text-xs font-black text-blue-700">Решение:</p>
                    <div className="text-xs text-gray-700 leading-relaxed">
                      <MathRenderer text={item.aiSolution ?? genSolution ?? ''} />
                    </div>
                    {item.solutionImageUrl && (
                      <img src={item.solutionImageUrl} alt="Илустрација кон решението"
                        className="mt-2 max-h-56 rounded-lg border border-gray-200" />
                    )}
                  </div>
                ) : (
                  <button type="button" onClick={() => void handleGenerateSolution()} disabled={generating}
                    className="mt-1 px-3 py-1 rounded-lg text-[11px] font-bold bg-violet-100 text-violet-700 hover:bg-violet-200 transition disabled:opacity-50">
                    {generating ? 'Генерирање решение…' : 'Генерирај решение'}
                  </button>
                )}
              </div>
              {!state.aiGradeP3 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-gray-500">Сакаш и AI оценка? Опиши го твоето решение:</p>
                  <textarea
                    value={state.aiDesc ?? ''}
                    onChange={e => onUpdate({ aiDesc: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-brand-primary focus:border-brand-primary resize-none"
                    rows={2}
                    placeholder="Пр: Прв го решив системот, потоа го пресметав детерминантот…"
                  />
                  <button type="button" disabled={!!state.gradingP3 || !state.aiDesc?.trim()} onClick={handleGradeP3}
                    className="px-4 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
                    {state.gradingP3 ? 'AI оценува…' : 'Провери со AI'}
                  </button>
                </div>
              )}
              {state.aiGradeP3 && (
                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-purple-700 mb-1">
                    AI оценка: {state.aiGradeP3.score}/{state.aiGradeP3.maxScore}pt
                  </p>
                  <p className="text-xs text-purple-600">{state.aiGradeP3.feedback}</p>
                </div>
              )}
              {state.aiError && <p className="text-xs text-rose-600">{state.aiError}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
