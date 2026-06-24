import React, { useState, useMemo } from 'react';
import { X, ChevronRight, Delete, Check } from 'lucide-react';
import type { GradeEntry } from '../../types';

interface Props {
  existingEntries: GradeEntry[];
  defaultTestTitle?: string;
  onAdd: (name: string, testTitle: string, raw: number, max: number) => void;
  onClose: () => void;
}

type Step = 'student' | 'test' | 'score';

const NUM_KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '←', '0', '.'];

export const MobileGradeEntryModal: React.FC<Props> = ({ existingEntries, defaultTestTitle = '', onAdd, onClose }) => {
  const uniqueNames = useMemo(() => {
    const seen = new Set<string>();
    return existingEntries.map(e => e.studentName).filter(n => { if (seen.has(n)) return false; seen.add(n); return true; });
  }, [existingEntries]);

  const [step, setStep] = useState<Step>('student');
  const [studentName, setStudentName] = useState('');
  const [testTitle, setTestTitle] = useState(defaultTestTitle);
  const [scoreStr, setScoreStr] = useState('');
  const [maxStr, setMaxStr] = useState('100');
  const [editingMax, setEditingMax] = useState(false);

  const handleNameSelect = (name: string) => { setStudentName(name); setStep('test'); };
  const handleNameNext = () => { if (studentName.trim()) setStep('test'); };
  const handleTestNext = () => { if (testTitle.trim()) setStep('score'); };

  const pressKey = (k: string) => {
    if (editingMax) {
      if (k === '←') setMaxStr(p => p.slice(0, -1));
      else if (k === '.') return;
      else setMaxStr(p => (p + k).slice(0, 4));
    } else {
      if (k === '←') setScoreStr(p => p.slice(0, -1));
      else if (k === '.' && scoreStr.includes('.')) return;
      else setScoreStr(p => (p + k).slice(0, 6));
    }
  };

  const handleConfirm = () => {
    const raw = parseFloat(scoreStr);
    const max = parseFloat(maxStr) || 100;
    if (!studentName.trim() || !testTitle.trim() || isNaN(raw) || raw < 0) return;
    onAdd(studentName.trim(), testTitle.trim(), raw, max);
    // reset for next entry
    setStudentName('');
    setScoreStr('');
    setStep('student');
  };

  const pct = scoreStr && maxStr ? Math.round((parseFloat(scoreStr) / (parseFloat(maxStr) || 100)) * 100) : null;
  const pctColor = pct === null ? 'text-gray-400' : pct >= 75 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          {step !== 'student' && (
            <button type="button" onClick={() => setStep(step === 'score' ? 'test' : 'student')}
              className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 transition-colors">
              <ChevronRight className="w-5 h-5 rotate-180" />
            </button>
          )}
          <h2 className="font-bold text-gray-900 text-base">
            {step === 'student' ? 'Кој ученик?' : step === 'test' ? 'Кој тест/активност?' : 'Внеси резултат'}
          </h2>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1 px-4 pt-3">
        {(['student', 'test', 'score'] as Step[]).map((s, i) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${
            step === s ? 'bg-indigo-500' : i < ['student','test','score'].indexOf(step) ? 'bg-indigo-200' : 'bg-gray-100'
          }`} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* STEP 1 — Student */}
        {step === 'student' && (
          <div className="p-4 space-y-3">
            <input
              autoFocus
              type="text"
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleNameNext()}
              placeholder="Внеси или избери..."
              className="w-full px-4 py-3 text-base border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none"
            />
            {uniqueNames.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Постоечки ученици</p>
                {uniqueNames.filter(n => n.toLowerCase().includes(studentName.toLowerCase())).map(name => (
                  <button key={name} type="button" onClick={() => handleNameSelect(name)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-colors font-medium text-gray-800 flex items-center justify-between">
                    {name} <ChevronRight className="w-4 h-4 text-gray-300" />
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={handleNameNext} disabled={!studentName.trim()}
              className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl disabled:opacity-40 transition-colors text-base">
              Следно →
            </button>
          </div>
        )}

        {/* STEP 2 — Test title */}
        {step === 'test' && (
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-500 font-medium">Ученик: <span className="text-gray-800 font-bold">{studentName}</span></p>
            <input
              autoFocus
              type="text"
              value={testTitle}
              onChange={e => setTestTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTestNext()}
              placeholder="пр. Тест 1 — Алгебра"
              className="w-full px-4 py-3 text-base border-2 border-gray-200 rounded-xl focus:border-indigo-400 focus:outline-none"
            />
            {['Тест 1', 'Тест 2', 'Тест 3', 'Контролна', 'Усна оценка', 'Домашна'].map(t => (
              <button key={t} type="button" onClick={() => { setTestTitle(t); setStep('score'); }}
                className="inline-flex mr-2 mb-1 px-3 py-1.5 text-sm border border-gray-200 rounded-full hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 font-medium transition-colors">
                {t}
              </button>
            ))}
            <button type="button" onClick={handleTestNext} disabled={!testTitle.trim()}
              className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl disabled:opacity-40 transition-colors text-base">
              Следно →
            </button>
          </div>
        )}

        {/* STEP 3 — Numeric keypad */}
        {step === 'score' && (
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-500 font-medium">
              <span className="font-bold text-gray-800">{studentName}</span> · {testTitle}
            </p>

            {/* Score display */}
            <div className="bg-gray-50 rounded-2xl p-4 text-center border-2 border-gray-200">
              <div className="flex items-baseline justify-center gap-3">
                <button type="button" onClick={() => setEditingMax(false)}
                  className={`text-4xl font-black transition-colors ${!editingMax ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {scoreStr || '—'}
                </button>
                <span className="text-2xl text-gray-300 font-light">/</span>
                <button type="button" onClick={() => setEditingMax(true)}
                  className={`text-2xl font-bold transition-colors ${editingMax ? 'text-indigo-600 border-b-2 border-indigo-400' : 'text-gray-400'}`}>
                  {maxStr || '100'}
                </button>
              </div>
              {pct !== null && (
                <p className={`text-2xl font-black mt-1 ${pctColor}`}>{pct}%</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                {!editingMax ? 'Тапни за да го промениш max →' : '← Тапни за да се врати на поените'}
              </p>
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {NUM_KEYS.map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => pressKey(k)}
                  className={`py-4 rounded-2xl text-xl font-bold transition-all active:scale-95 ${
                    k === '←'
                      ? 'bg-red-50 text-red-500 border border-red-100'
                      : 'bg-gray-100 text-gray-800 hover:bg-indigo-50 hover:text-indigo-700 border border-transparent'
                  }`}
                >
                  {k === '←' ? <Delete className="w-5 h-5 mx-auto" /> : k}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!scoreStr || parseFloat(scoreStr) > (parseFloat(maxStr) || 100)}
              className="w-full py-4 bg-green-600 text-white font-black rounded-2xl disabled:opacity-40 transition-colors text-lg flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" /> Зачувај и продолжи
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
