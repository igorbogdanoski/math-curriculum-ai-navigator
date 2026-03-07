import React, { useState, useEffect, useMemo } from 'react';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { Card } from '../components/common/Card';
import { Library, Search, Download, Globe, Filter, Loader2, BookOpen, ChevronDown } from 'lucide-react';

const GRADE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: 'Повеќе избори',
  SHORT_ANSWER: 'Краток одговор',
  TRUE_FALSE: 'Точно/Неточно',
  ESSAY: 'Есеј',
  FILL_IN_THE_BLANK: 'Пополни',
};

interface LibraryEntry {
  id: string;
  question: string;
  type: string;
  options?: string[];
  answer: string;
  solution?: string;
  gradeLevel?: number;
  conceptId?: string;
  conceptTitle?: string;
  publishedByName: string;
  schoolName?: string;
  importCount: number;
  publishedAt?: any;
}

export const NationalLibraryView: React.FC = () => {
  const { firebaseUser, user } = useAuth();
  const { addNotification } = useNotification();

  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [filterGrade, setFilterGrade] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('');
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [revealedAnswers, setRevealedAnswers] = useState<Set<string>>(new Set());
  const [imported, setImported] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLoading(true);
    const filters: { gradeLevel?: number; type?: string } = {};
    if (filterGrade) filters.gradeLevel = Number(filterGrade);
    if (filterType) filters.type = filterType;
    firestoreService.fetchNationalLibrary(filters)
      .then(data => setEntries(data))
      .finally(() => setLoading(false));
  }, [filterGrade, filterType]);

  const filtered = useMemo(() => {
    if (!searchText) return entries;
    return entries.filter(e => e.question.toLowerCase().includes(searchText.toLowerCase()));
  }, [entries, searchText]);

  const allTypes = useMemo(() => {
    const s = new Set(entries.map(e => e.type));
    return Array.from(s).sort();
  }, [entries]);

  const handleImport = async (entry: LibraryEntry) => {
    if (!firebaseUser?.uid) {
      addNotification('Треба да сте најавени.', 'error');
      return;
    }
    setImporting(prev => new Set(prev).add(entry.id));
    try {
      await firestoreService.importFromNationalLibrary(entry, firebaseUser.uid);
      setImported(prev => new Set(prev).add(entry.id));
      setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, importCount: (e.importCount ?? 0) + 1 } : e));
      addNotification('Прашањето е увезено во вашата Банка на прашања.', 'success');
    } catch {
      addNotification('Грешка при увоз.', 'error');
    } finally {
      setImporting(prev => { const n = new Set(prev); n.delete(entry.id); return n; });
    }
  };

  const toggleReveal = (id: string) => {
    setRevealedAnswers(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  return (
    <div className="p-6 md:p-8 animate-fade-in">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-brand-primary flex items-center gap-3">
          <Library className="w-8 h-8" />
          Национална Библиотека
        </h1>
        <p className="text-gray-500 mt-2 max-w-2xl">
          Споделени верификувани прашања од наставници низ цела Македонија. Увезете ги во вашата Банка на прашања и веднаш создадете квиз.
        </p>
        <div className="mt-3 flex items-center gap-2 text-sm text-indigo-600 bg-indigo-50 rounded-xl px-4 py-2 w-fit">
          <Globe className="w-4 h-4" />
          <span><strong>{entries.length}</strong> прашања објавени од наставници</span>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Пребарај прашања..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={filterGrade}
            onChange={e => setFilterGrade(e.target.value)}
            className="pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
          >
            <option value="">Сите одд.</option>
            {GRADE_OPTIONS.map(g => (
              <option key={g} value={String(g)}>{g}. одделение</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative">
          <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="pl-9 pr-8 py-2 border border-gray-200 rounded-xl text-sm appearance-none bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none"
          >
            <option value="">Сите типови</option>
            {allTypes.map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-20">
          <Library className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-gray-400">
            {entries.length === 0 ? 'Библиотеката е сè уште празна' : 'Нема резултати'}
          </h2>
          <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">
            {entries.length === 0
              ? 'Бидете прв! Верификувајте прашање во вашата Банка на прашања и публикувајте го.'
              : 'Пробајте со поинаков текст за пребарување или сменете ги филтрите.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(entry => {
            const isImporting = importing.has(entry.id);
            const isAlreadyImported = imported.has(entry.id);
            const revealed = revealedAnswers.has(entry.id);
            return (
              <Card key={entry.id} className="flex flex-col gap-3 hover:shadow-md transition-shadow">
                {/* Meta row */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {entry.gradeLevel && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold">
                        {entry.gradeLevel}. одд.
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      {TYPE_LABELS[entry.type] ?? entry.type}
                    </span>
                    {entry.conceptTitle && (
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium truncate max-w-[120px]">
                        {entry.conceptTitle}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap">
                    {entry.importCount} увози
                  </span>
                </div>

                {/* Question */}
                <p className="text-sm text-gray-800 font-medium leading-relaxed flex-1">
                  {entry.question}
                </p>

                {/* Options (MC) */}
                {entry.type === 'MULTIPLE_CHOICE' && entry.options && entry.options.length > 0 && (
                  <ul className="space-y-1">
                    {entry.options.map((opt, i) => (
                      <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                        <span className="font-bold text-gray-400 w-4 flex-shrink-0">{String.fromCharCode(65 + i)}.</span>
                        <span>{opt}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Answer reveal */}
                <button
                  type="button"
                  onClick={() => toggleReveal(entry.id)}
                  className="text-xs text-brand-primary hover:underline text-left font-medium"
                >
                  {revealed ? 'Скриј одговор' : 'Прикажи одговор'}
                </button>
                {revealed && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                    <p className="text-xs text-green-800 font-semibold">Одговор: {entry.answer}</p>
                    {entry.solution && (
                      <p className="text-xs text-green-700 mt-1">{entry.solution}</p>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-auto">
                  <div className="text-xs text-gray-400 truncate max-w-[140px]">
                    <span className="font-medium text-gray-600">{entry.publishedByName}</span>
                    {entry.schoolName && <span> · {entry.schoolName}</span>}
                  </div>
                  <button
                    type="button"
                    disabled={isImporting || isAlreadyImported}
                    onClick={() => handleImport(entry)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 disabled:opacity-50 ${
                      isAlreadyImported
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-brand-primary text-white hover:bg-brand-primary/90'
                    }`}
                  >
                    {isImporting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : isAlreadyImported ? (
                      '✓ Увезено'
                    ) : (
                      <>
                        <Download className="w-3 h-3" />
                        Увези
                      </>
                    )}
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
