import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DokBadge }         from '../common/DokBadge';
import { useAuth }           from '../../contexts/AuthContext';
import { firestoreService }  from '../../services/firestoreService';
import type { SchoolClass }  from '../../services/firestoreService';
import type { MaturaQuestion } from '../../services/firestoreService.matura';
import type { MaturaChoice, DokLevel } from '../../types';
import { downloadAsPdf }    from '../../utils/pdfDownload';
import { TOPIC_LABELS, isOpen } from './maturaLibrary.constants';

interface TeacherTestBuilderProps {
  questions: MaturaQuestion[];
}

export function TeacherTestBuilder({ questions }: TeacherTestBuilderProps) {
  const { firebaseUser } = useAuth();
  const [filterTopic, setFilterTopic] = useState('');
  const [filterDok,   setFilterDok]   = useState<0|1|2|3|4>(0);
  const [selectedNs,  setSelectedNs]  = useState<Set<number>>(new Set());
  const [classes,     setClasses]     = useState<SchoolClass[]>([]);
  const [classId,     setClassId]     = useState('');
  const [title,       setTitle]       = useState('Тест — Матура');
  const [status,      setStatus]      = useState('');
  const [pdfBusy,     setPdfBusy]     = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    firestoreService.fetchClasses(firebaseUser.uid)
      .then(setClasses)
      .catch(() => {});
  }, [firebaseUser]);

  const topicAreas = useMemo(
    () => [...new Set(questions.map(q => q.topicArea).filter(Boolean))] as string[],
    [questions],
  );

  const filtered = useMemo(() => questions.filter(q => {
    if (filterTopic && q.topicArea !== filterTopic) return false;
    if (filterDok   && q.dokLevel  !== filterDok)   return false;
    return true;
  }), [questions, filterTopic, filterDok]);

  const selectedQs = questions.filter(q => selectedNs.has(q.questionNumber));

  function toggleQ(n: number) {
    setSelectedNs(prev => {
      const s = new Set(prev);
      s.has(n) ? s.delete(n) : s.add(n);
      return s;
    });
  }

  async function handlePdf() {
    if (!printRef.current || selectedQs.length === 0) return;
    setPdfBusy(true);
    setStatus('Се генерира PDF…');
    try {
      await downloadAsPdf(printRef.current, title || 'matura-test');
      setStatus('PDF зачуван ✅');
    } catch {
      setStatus('Грешка при генерирање PDF');
    } finally {
      setPdfBusy(false);
    }
  }

  async function handleAssign() {
    if (!firebaseUser || !classId || selectedQs.length === 0) return;
    setStatus('Се доделува…');
    try {
      await firestoreService.createAssignment(
        firebaseUser.uid,
        classId,
        title || 'Тест — Матура',
        selectedQs.map(q => `${q.examId}_${q.questionNumber}`),
      );
      setStatus(`✅ Доделено (${selectedQs.length} пр.)`);
    } catch {
      setStatus('Грешка при доделување');
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12 space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
        <span className="text-2xl">🏫</span>
        <div>
          <p className="font-semibold text-amber-900">Составувач на тест — само за наставници</p>
          <p className="text-xs text-amber-700 mt-0.5">Избери прашања по тема + DoK → Генерирај PDF или Додели на класот</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Тема:</span>
        <button type="button" onClick={() => setFilterTopic('')}
          className={`px-3 py-1 rounded-full text-xs font-semibold ${filterTopic===''?'bg-gray-700 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}>
          Сите
        </button>
        {topicAreas.map(ta => (
          <button key={ta} type="button" onClick={() => setFilterTopic(ta === filterTopic ? '' : ta)}
            className={`px-3 py-1 rounded-full text-xs font-semibold ${filterTopic===ta?'bg-gray-700 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            {TOPIC_LABELS[ta] ?? ta}
          </button>
        ))}
        <span className="ml-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">DoK:</span>
        {([0,1,2,3,4] as const).map(d => (
          <button key={d} type="button" onClick={() => setFilterDok(d)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold ${filterDok===d?'bg-indigo-600 text-white':'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
            {d === 0 ? 'Сите' : `DoK ${d}`}
          </button>
        ))}
      </div>

      {/* Select controls */}
      <div className="flex items-center gap-3">
        <button type="button"
          onClick={() => setSelectedNs(new Set(filtered.map(q => q.questionNumber)))}
          className="text-xs text-indigo-600 hover:underline">
          Избери ги сите ({filtered.length})
        </button>
        <button type="button"
          onClick={() => setSelectedNs(new Set())}
          className="text-xs text-gray-500 hover:underline">
          Откажи избор
        </button>
        <span className="ml-auto text-xs font-semibold text-violet-700 bg-violet-50 px-3 py-1 rounded-full">
          {selectedNs.size} избрани прашања
        </span>
      </div>

      {/* Question list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-[480px] overflow-y-auto pr-1">
        {filtered.map(q => {
          const sel = selectedNs.has(q.questionNumber);
          return (
            <button key={q.questionNumber} type="button" onClick={() => toggleQ(q.questionNumber)}
              className={`text-left rounded-xl border-2 p-3 transition-all ${sel ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-white hover:border-violet-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center text-[10px] ${sel ? 'border-violet-500 bg-violet-500 text-white' : 'border-gray-300'}`}>
                  {sel ? '✓' : ''}
                </span>
                <span className="text-xs text-gray-400">#{q.questionNumber}</span>
                {q.dokLevel && <DokBadge level={q.dokLevel as DokLevel} size="compact" />}
                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${!isOpen(q) ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                  {!isOpen(q) ? 'MC' : 'Отворено'}
                </span>
                <span className="text-xs text-gray-500 ml-auto truncate max-w-[80px]">{q.topicArea ?? ''}</span>
              </div>
              <p className="text-xs text-gray-700 line-clamp-2 leading-relaxed">
                {q.questionText.replace(/\$[^$]+\$/g, '[math]').substring(0, 120)}
              </p>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="col-span-2 text-sm text-gray-400 text-center py-8">Нема прашања за избраните филтри</p>
        )}
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap gap-3 items-center pt-3 border-t border-gray-100">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Наслов на тестот"
          className="flex-1 min-w-[180px] border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
        />
        <button type="button"
          onClick={handlePdf}
          disabled={selectedQs.length === 0 || pdfBusy}
          className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors">
          {pdfBusy ? 'Се генерира…' : '📄 Генерирај PDF'}
        </button>
        <select
          value={classId}
          onChange={e => setClassId(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:ring-violet-300"
          aria-label="Избери клас"
          title="Избери клас">
          <option value="">— Избери клас —</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name} (г{c.gradeLevel})</option>
          ))}
        </select>
        <button type="button"
          onClick={handleAssign}
          disabled={!classId || selectedQs.length === 0}
          className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 transition-colors">
          📋 Додели на клас
        </button>
        {status && (
          <span className="text-xs text-violet-700 bg-violet-50 px-3 py-1.5 rounded-lg">{status}</span>
        )}
      </div>

      {/* Hidden print-friendly div */}
      {selectedQs.length > 0 && (
        <div
          ref={printRef}
          style={{ position: 'absolute', left: '-9999px', top: 0, width: '794px', background: '#fff', padding: '40px', fontFamily: 'serif' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>{title}</h1>
          <p style={{ fontSize: '12px', color: '#666', marginBottom: '24px' }}>
            {selectedQs.length} прашања · Матурски испит
          </p>
          {selectedQs.map((q, i) => (
            <div key={q.questionNumber} style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
              <p style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>
                {i + 1}. {q.questionText}
              </p>
              {!isOpen(q) && q.choices && (
                <div style={{ paddingLeft: '16px' }}>
                  {(['А','Б','В','Г'] as MaturaChoice[]).map(ch => q.choices?.[ch as keyof typeof q.choices] ? (
                    <p key={ch} style={{ fontSize: '12px', marginBottom: '2px' }}>
                      {ch}. {String(q.choices[ch as keyof typeof q.choices])}
                    </p>
                  ) : null)}
                </div>
              )}
              {isOpen(q) && (
                <div style={{ marginTop: '8px', borderBottom: '1px solid #ccc', height: '60px' }} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
