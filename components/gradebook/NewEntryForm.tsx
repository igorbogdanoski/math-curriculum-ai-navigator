import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { MATH_STANDARDS } from '../../data/allNationalStandardsComplete';
import type { GradeEntry, GradeModel } from '../../types';

function percentToMastery(p: number): GradeEntry['masteryStatus'] {
  if (p >= 80) return 'mastered';
  if (p >= 60) return 'approaching';
  return 'not_yet';
}

interface NewEntryFormProps {
  activeModel: GradeModel;
  gradeLevel: number;
  onAdd: (entry: GradeEntry) => void;
}

/** Add-a-result form for the gradebook — including the SBG БРО standard tagging row. */
export const NewEntryForm: React.FC<NewEntryFormProps> = ({ activeModel, gradeLevel, onAdd }) => {
  const [newName, setNewName] = useState('');
  const [newTestTitle, setNewTestTitle] = useState('');
  const [newRaw, setNewRaw] = useState('');
  const [newMax, setNewMax] = useState('100');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [sbgStandardCode, setSbgStandardCode] = useState('');
  const [sbgProficiency, setSbgProficiency] = useState<1 | 2 | 3 | 4>(3);

  const addEntry = () => {
    const errors: Record<string, string> = {};
    if (!newName.trim()) errors.name = 'Внесете го името на ученикот.';
    if (!newTestTitle.trim()) errors.testTitle = 'Внесете наслов на тестот.';
    const raw = Number(newRaw);
    const max = Number(newMax);
    if (!newRaw) errors.raw = 'Внесете освоени поени.';
    else if (raw < 0) errors.raw = 'Поените не можат да бидат негативни.';
    else if (raw > max) errors.raw = 'Не може да надмине максимумот.';
    if (!newMax || max <= 0) errors.max = 'Максимумот мора да биде > 0.';
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    const pct = Math.round((raw / max) * 100);
    const entry: GradeEntry = {
      studentId: crypto.randomUUID(),
      studentName: newName.trim(),
      testId: crypto.randomUUID(),
      testTitle: newTestTitle.trim(),
      rawScore: raw,
      maxScore: max,
      percentage: pct,
      masteryStatus: percentToMastery(pct),
      gradedAt: new Date().toISOString(),
      ...(activeModel === 'sbg' && sbgStandardCode
        ? { standardScores: { [sbgStandardCode]: sbgProficiency } }
        : {}),
    };
    onAdd(entry);
    setNewName('');
    setNewRaw('');
    setSbgStandardCode('');
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <div className="md:col-span-2 space-y-1">
          <input type="text" value={newName} onChange={e => { setNewName(e.target.value); setFormErrors(p => ({ ...p, name: '' })); }}
            placeholder="Име на ученик" aria-label="Име на ученик"
            className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary ${formErrors.name ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
          {formErrors.name && <p className="text-[11px] text-red-500 px-1">{formErrors.name}</p>}
        </div>
        <div className="space-y-1">
          <input type="text" value={newTestTitle} onChange={e => { setNewTestTitle(e.target.value); setFormErrors(p => ({ ...p, testTitle: '' })); }}
            placeholder="Наслов на тест" aria-label="Наслов на тест"
            className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary ${formErrors.testTitle ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
          {formErrors.testTitle && <p className="text-[11px] text-red-500 px-1">{formErrors.testTitle}</p>}
        </div>
        <div className="space-y-1">
          <div className="flex gap-2">
            <div className="flex-1">
              <input type="number" value={newRaw} onChange={e => { setNewRaw(e.target.value); setFormErrors(p => ({ ...p, raw: '' })); }}
                placeholder="Поени" aria-label="Освоени поени" min={0}
                className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary ${formErrors.raw ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
            </div>
            <span className="self-center text-gray-400 font-bold">/</span>
            <div className="flex-1">
              <input type="number" value={newMax} onChange={e => { setNewMax(e.target.value); setFormErrors(p => ({ ...p, max: '' })); }}
                placeholder="Макс" aria-label="Максимум поени" min={1}
                className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-primary ${formErrors.max ? 'border-red-400 bg-red-50' : 'border-gray-200'}`} />
            </div>
          </div>
          {(formErrors.raw || formErrors.max) && <p className="text-[11px] text-red-500 px-1">{formErrors.raw || formErrors.max}</p>}
        </div>
        <button type="button" onClick={addEntry}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl font-bold text-sm hover:bg-brand-secondary transition-all">
          <Plus className="w-4 h-4" /> Додај
        </button>
      </div>
      {/* S99.1 — SBG БРО standard tagging row */}
      {activeModel === 'sbg' && gradeLevel <= 9 && (
        <div className="flex flex-wrap gap-3 items-end border-t border-purple-100 pt-3">
          <div className="flex-1 min-w-[180px] space-y-1">
            <label className="text-[11px] font-semibold text-purple-700 uppercase tracking-wide">БРО Стандард (опц.)</label>
            <select
              value={sbgStandardCode}
              onChange={e => setSbgStandardCode(e.target.value)}
              aria-label="Избери БРО стандард"
              className="w-full border border-purple-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-purple-400"
            >
              <option value="">— Избери стандард —</option>
              {MATH_STANDARDS.map(s => (
                <option key={s.code} value={s.code}>{s.code}: {s.description.slice(0, 60)}…</option>
              ))}
            </select>
          </div>
          {sbgStandardCode && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-purple-700 uppercase tracking-wide">Профициенција (1–4)</label>
              <div className="flex gap-1">
                {([1, 2, 3, 4] as const).map(n => (
                  <button key={n} type="button"
                    onClick={() => setSbgProficiency(n)}
                    className={`w-8 h-8 rounded-lg text-sm font-bold border transition-colors ${sbgProficiency === n ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-purple-600 border-purple-300 hover:bg-purple-50'}`}
                  >{n}</button>
                ))}
              </div>
            </div>
          )}
          <p className="hidden sm:block text-[10px] text-gray-400 self-end">4=Одличен · 3=Задоволителен · 2=Во напредок · 1=Под очекувањата</p>
        </div>
      )}
    </>
  );
};
