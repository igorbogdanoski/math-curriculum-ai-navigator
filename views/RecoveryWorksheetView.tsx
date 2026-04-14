/**
 * RecoveryWorksheetView — C3 (S22)
 *
 * Shown post-quiz when score < 70%.
 * Fetches the student's weak concepts (lastScore < 70) from concept_mastery,
 * generates 5 LaTeX-formatted exercises per weak concept via Gemini,
 * renders a printable worksheet, and fire-and-forgets a save to cached_ai_materials.
 */
import React, { useRef, useState, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Printer, Loader2, X, BookOpen } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import { callGeminiProxy } from '../services/gemini/core';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import type { ConceptMastery } from '../services/firestoreService';

const WEAK_THRESHOLD = 70;
const EXERCISES_PER_CONCEPT = 5;
const MAX_WEAK_CONCEPTS = 3;

interface RecoveryWorksheetProps {
  studentName: string;
  deviceId?: string;
  conceptId: string;
  conceptTitle: string;
  onClose: () => void;
}

interface ConceptExercises {
  conceptTitle: string;
  exercises: string[];
}

function buildPrompt(weakConcepts: ConceptMastery[]): string {
  const conceptList = weakConcepts
    .map(c => `- ${c.conceptTitle ?? c.conceptId} (последен резултат: ${c.lastScore ?? '?'}%)`)
    .join('\n');
  return `Ти си македонски наставник по математика. За следните слаби концепти на ученикот:
${conceptList}

За СЕКОЈ концепт дај точно ${EXERCISES_PER_CONCEPT} вежби. Форматирај ги во JSON:
{
  "concepts": [
    {
      "conceptTitle": "...",
      "exercises": ["вежба 1 со LaTeX", "вежба 2 со LaTeX", ...]
    }
  ]
}

Правила:
- Секоја вежба е кратка, јасна, со LaTeX нотација каде е потребно
- Почни со полесни вежби (DoK 1), заврши со потешки (DoK 2)
- Само JSON, без никаков текст пред или по него`;
}

export function RecoveryWorksheetView({
  studentName,
  deviceId,
  conceptId,
  conceptTitle,
  onClose,
}: RecoveryWorksheetProps) {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [exercises, setExercises] = useState<ConceptExercises[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Работен лист — ${conceptTitle}`,
  });

  const generate = useCallback(async () => {
    setPhase('loading');
    setErrorMsg('');
    try {
      const allMastery = await firestoreService.fetchMasteryByStudent(studentName, deviceId);

      const primary: ConceptMastery = {
        studentName,
        conceptId,
        conceptTitle,
        attempts: 0,
        consecutiveHighScores: 0,
        bestScore: 0,
        lastScore: 0,
        mastered: false,
      };

      const weak: ConceptMastery[] = [
        primary,
        ...allMastery
          .filter(m => !m.mastered && (m.lastScore ?? 0) < WEAK_THRESHOLD && m.conceptId !== conceptId)
          .sort((a, b) => (a.lastScore ?? 0) - (b.lastScore ?? 0)),
      ].slice(0, MAX_WEAK_CONCEPTS);

      const { text } = await callGeminiProxy({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: buildPrompt(weak) }] }],
      });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('Невалиден Gemini одговор');

      const parsed = JSON.parse(jsonMatch[0]) as { concepts: ConceptExercises[] };
      setExercises(parsed.concepts ?? []);
      setPhase('ready');

      addDoc(collection(db, 'cached_ai_materials'), {
        type: 'recovery_worksheet',
        studentName,
        conceptId,
        content: parsed.concepts,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Неочекувана грешка');
      setPhase('error');
    }
  }, [studentName, deviceId, conceptId, conceptTitle]);

  return (
    <div className="w-full max-w-4xl mt-4 bg-white rounded-2xl border-2 border-amber-200 p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-600" />
          <h3 className="font-bold text-amber-900 text-base">Работен лист за слабите концепти</h3>
        </div>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      {phase === 'idle' && (
        <div className="text-center py-6">
          <p className="text-sm text-gray-600 mb-4">
            AI ќе ги анализира твоите слаби концепти и ќе генерира {EXERCISES_PER_CONCEPT} вежби за секој.
          </p>
          <button type="button" onClick={generate}
            className="px-6 py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors">
            📄 Генерирај работен лист
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <div className="flex items-center justify-center gap-3 py-8 text-amber-700">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">AI генерира вежби…</span>
        </div>
      )}

      {phase === 'error' && (
        <div className="text-center py-6">
          <p className="text-sm text-red-600 mb-3">{errorMsg}</p>
          <button type="button" onClick={generate}
            className="text-sm text-amber-600 hover:underline">Обиди се повторно</button>
        </div>
      )}

      {phase === 'ready' && exercises.length > 0 && (
        <>
          <div className="flex justify-end mb-3">
            <button type="button" onClick={() => handlePrint()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
              <Printer className="w-3.5 h-3.5" />
              Печати / Зачувај PDF
            </button>
          </div>

          <div className="space-y-5 max-h-[400px] overflow-y-auto pr-1">
            {exercises.map((section, si) => (
              <div key={si} className="border border-amber-100 rounded-xl p-4">
                <h4 className="font-bold text-amber-800 text-sm mb-3">{section.conceptTitle}</h4>
                <ol className="space-y-2">
                  {section.exercises.map((ex, ei) => (
                    <li key={ei} className="flex gap-2 text-sm text-gray-700">
                      <span className="font-semibold text-amber-600 shrink-0">{ei + 1}.</span>
                      <span>{ex}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          {/* Hidden printable sheet */}
          <div className="hidden print:block" ref={printRef}>
            <div style={{ padding: '32px', fontFamily: 'serif', color: '#000' }}>
              <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                Работен лист — Повторување
              </h1>
              <p style={{ fontSize: '11px', color: '#666', marginBottom: '6px' }}>
                {studentName} · {new Date().toLocaleDateString('mk-MK')}
              </p>
              <div style={{ borderBottom: '2px solid #000', marginBottom: '20px' }} />
              {exercises.map((section, si) => (
                <div key={si} style={{ marginBottom: '24px', pageBreakInside: 'avoid' }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>
                    {si + 1}. {section.conceptTitle}
                  </h2>
                  <ol style={{ paddingLeft: '20px', fontSize: '12px', lineHeight: '2' }}>
                    {section.exercises.map((ex, ei) => (
                      <li key={ei} style={{ marginBottom: '12px' }}>
                        {ex}
                        <div style={{ borderBottom: '1px solid #ccc', marginTop: '4px', height: '24px' }} />
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
