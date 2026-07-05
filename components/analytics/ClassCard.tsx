import React, { useState } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import {
  School, Trash2, UserPlus, X, Edit2, Check, Upload, Key, RefreshCw, Copy,
  CheckCircle2, BarChart2, ChevronDown, ChevronUp, Loader2, AlertCircle, Link2,
} from 'lucide-react';
import { firestoreService, type SchoolClass } from '../../services/firestoreService';

interface ClassStatRow { name: string; avgPct: number; count: number }

interface ClassCardProps {
  cls: SchoolClass;
  teacherUid: string;
  onRename: (classId: string, name: string) => Promise<void>;
  onDelete: (classId: string, name: string) => void;
  onAddStudent: (classId: string, name: string) => Promise<void>;
  onRemoveStudent: (classId: string, name: string) => Promise<void>;
  onToggleIEP: (classId: string, name: string, currentIepStudents: string[]) => Promise<void>;
  onCsvImportClick: (classId: string) => void;
  onGenerateCode: (classId: string) => Promise<string | null>;
  onVisualizeStats: (cls: SchoolClass, stats: ClassStatRow[]) => void;
}

/** One class's card in the Classes tab — rename, roster, join code, and lazy stats. */
export const ClassCard: React.FC<ClassCardProps> = ({
  cls, teacherUid, onRename, onDelete, onAddStudent, onRemoveStudent, onToggleIEP,
  onCsvImportClick, onGenerateCode, onVisualizeStats,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(cls.name);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [studentInput, setStudentInput] = useState('');
  const [activeParentLink, setActiveParentLink] = useState<string | null>(null);
  const [parentLinkCopied, setParentLinkCopied] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isCodeCopied, setIsCodeCopied] = useState(false);
  const [codeGenError, setCodeGenError] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<ClassStatRow[] | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const startRename = () => { setRenameValue(cls.name); setIsRenaming(true); };
  const confirmRename = async () => {
    const name = renameValue.trim();
    if (!name) return;
    await onRename(cls.id, name);
    setIsRenaming(false);
  };

  const submitAddStudent = async () => {
    const name = studentInput.trim();
    if (!name) return;
    await onAddStudent(cls.id, name);
    setStudentInput('');
    setShowAddStudent(false);
  };

  const handleGenerateCode = async () => {
    setIsGeneratingCode(true);
    setCodeGenError(null);
    const code = await onGenerateCode(cls.id);
    if (!code) setCodeGenError('Неможе да се генерира код. Обиди се повторно.');
    setIsGeneratingCode(false);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setIsCodeCopied(true);
      setTimeout(() => setIsCodeCopied(false), 2000);
    }).catch(() => window.prompt('Копирај го кодот:', code));
  };

  const toggleStats = async () => {
    if (showStats) { setShowStats(false); return; }
    setShowStats(true);
    setStatsLoading(true);
    const data = await firestoreService.fetchClassStats(teacherUid, cls.studentNames);
    setStats(data);
    setStatsLoading(false);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4">
      {/* Class header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <School className="w-4 h-4 text-indigo-500 flex-shrink-0" />
          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                aria-label="Ново име на одделение"
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') confirmRename();
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
                autoFocus
                className="border border-indigo-300 rounded px-2 py-0.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 w-32"
              />
              <button type="button" onClick={confirmRename} className="p-1 text-green-600 hover:text-green-700 transition" aria-label="Зачувај">
                <Check className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setIsRenaming(false)} className="p-1 text-gray-400 hover:text-gray-600 transition" aria-label="Откажи">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <h3 className="font-bold text-slate-800 truncate">{cls.name}</h3>
          )}
          <span className="text-xs font-semibold text-gray-500 flex-shrink-0">{cls.gradeLevel}. одд.</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex-shrink-0">
            {cls.studentNames.length} уч.
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button type="button" onClick={startRename} title="Преименувај класа" className="p-1.5 text-gray-400 hover:text-indigo-600 transition">
            <Edit2 className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => setShowAddStudent(v => !v)} title="Додај ученик" className="p-1.5 text-gray-400 hover:text-green-600 transition">
            <UserPlus className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onCsvImportClick(cls.id)} title="Увези ученици од CSV" className="p-1.5 text-gray-400 hover:text-blue-600 transition">
            <Upload className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => onDelete(cls.id, cls.name)} title="Избриши класа" className="p-1.5 text-gray-400 hover:text-red-500 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Add student inline form */}
      {showAddStudent && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Ime и презиме на ученик..."
            value={studentInput}
            onChange={e => setStudentInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitAddStudent();
              if (e.key === 'Escape') setShowAddStudent(false);
            }}
            autoFocus
            className="flex-1 border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
          />
          <button type="button" onClick={submitAddStudent} disabled={!studentInput.trim()}
            className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-40 transition">
            Додај
          </button>
          <button type="button" onClick={() => { setShowAddStudent(false); setStudentInput(''); }}
            className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition">
            Откажи
          </button>
        </div>
      )}

      {/* Student list */}
      {cls.studentNames.length === 0 ? (
        <p className="text-xs text-gray-500 italic">
          Нема ученици — кликни <UserPlus className="w-3 h-3 inline" /> за да додадеш.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {cls.studentNames.slice().sort().map(name => {
            const isIEP = cls.iepStudents?.includes(name) ?? false;
            return (
              <span
                key={name}
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition ${isIEP ? 'bg-violet-100 text-violet-800 border border-violet-300' : 'bg-slate-100 text-slate-700'}`}
              >
                {isIEP && <span title="Ученик со ИЕП">🧩</span>}
                {name}
                <button
                  type="button"
                  onClick={() => setActiveParentLink(activeParentLink === name ? null : name)}
                  title="Родителски линк / QR код"
                  aria-label={`Родителски линк за ${name}`}
                  className="hover:opacity-60 transition text-indigo-400 hover:text-indigo-600"
                >
                  <Link2 className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleIEP(cls.id, name, cls.iepStudents ?? [])}
                  aria-label={isIEP ? `Отстрани ИЕП за ${name}` : `Означи ${name} со ИЕП`}
                  title={isIEP ? 'Отстрани ИЕП флаг' : 'Означи ученик со ИЕП (поддршка)'}
                  className="hover:opacity-60 transition text-violet-400 hover:text-violet-600"
                >
                  🧩
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveStudent(cls.id, name)}
                  aria-label={`Отстрани ${name} од класата`}
                  className="hover:opacity-60 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* П-А: Parent link panel */}
      {activeParentLink && (() => {
        const parentUrl = `${window.location.origin}${window.location.pathname}#/parent?name=${encodeURIComponent(activeParentLink)}&teacher=${teacherUid}`;
        return (
          <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-indigo-700">👨‍👩‍👧 Родителски линк — {activeParentLink}</p>
              <button type="button" onClick={() => setActiveParentLink(null)} title="Затвори" aria-label="Затвори родителски линк" className="text-indigo-400 hover:text-indigo-600 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-4 items-start">
              <div className="bg-white p-2 rounded-lg border border-indigo-100 flex-shrink-0">
                <QRCode value={parentUrl} size={96} />
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <p className="text-[10px] text-indigo-600 break-all font-mono bg-white border border-indigo-100 rounded-lg px-2 py-1.5 select-all">{parentUrl}</p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(parentUrl).then(() => {
                      setParentLinkCopied(true);
                      setTimeout(() => setParentLinkCopied(false), 2000);
                    }).catch(() => window.prompt('Копирај го линкот:', parentUrl));
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition w-full justify-center"
                >
                  {parentLinkCopied
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> Копирано!</>
                    : <><Copy className="w-3.5 h-3.5" /> Копирај линк</>}
                </button>
                <p className="text-[10px] text-indigo-500">Испрати го линкот или QR кодот до родителот. Родителот го отвора на телефон и го следи напредокот.</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* П-Г: IEP summary */}
      {(cls.iepStudents?.length ?? 0) > 0 && (
        <p className="text-xs text-violet-600 mt-1.5 flex items-center gap-1">
          🧩 <span className="font-semibold">{cls.iepStudents!.length}</span> ученик{cls.iepStudents!.length === 1 ? '' : 'и'} со ИЕП — добиваат поедноставен интерфејс при играње квизови
        </p>
      )}

      {/* И2: Join Code panel */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        {codeGenError && (
          <div className="flex items-center gap-1.5 mb-2 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {codeGenError}
          </div>
        )}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Код за приклучување</span>
          </div>
          <div className="flex items-center gap-2">
            {cls.joinCode ? (
              <>
                <span className="font-mono font-black text-base tracking-widest text-indigo-800 px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-lg select-all">
                  {cls.joinCode}
                </span>
                <button
                  type="button"
                  title="Копирај код"
                  onClick={() => handleCopyCode(cls.joinCode!)}
                  className="p-1.5 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                >
                  {isCodeCopied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-400 italic">Нема активен код</span>
            )}
            <button
              type="button"
              onClick={handleGenerateCode}
              disabled={isGeneratingCode}
              title={cls.joinCode ? 'Генерирај нов код' : 'Генерирај код'}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition disabled:opacity-50"
            >
              {isGeneratingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {cls.joinCode ? 'Нов' : 'Генерирај'}
            </button>
          </div>
        </div>
        {cls.joinCode && (
          <p className="text-[10px] text-slate-400 mt-1">
            Ученикот го внесува овој код при прв квиз за да се приклучи кон одделението.
          </p>
        )}
      </div>

      {/* И2: Class stats (lazy) */}
      {cls.studentNames.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={toggleStats} className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-600 transition">
            <BarChart2 className="w-3.5 h-3.5" />
            Статистики
            {showStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showStats && (
            <div className="mt-2 border border-slate-100 rounded-xl p-3 bg-slate-50">
              {statsLoading && !stats ? (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Се вчитуваат статистики...
                </div>
              ) : (stats ?? []).length === 0 ? (
                <p className="text-xs text-slate-400 italic">Нема квизови за овие ученици.</p>
              ) : (
                <div className="space-y-1.5">
                  {(stats ?? []).map(s => (
                    <div key={s.name} className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 font-semibold w-36 truncate">{s.name}</span>
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${s.avgPct >= 75 ? 'bg-green-500' : s.avgPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                          style={{ width: `${s.avgPct}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 w-10 text-right">{s.avgPct}%</span>
                      <span className="text-[10px] text-slate-400 w-10">({s.count})</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 pt-1">
                    Просек одд.: <strong>{Math.round((stats ?? []).reduce((a, s) => a + s.avgPct, 0) / ((stats ?? []).length || 1))}%</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => onVisualizeStats(cls, stats ?? [])}
                    className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition"
                  >
                    <BarChart2 className="w-3 h-3" /> Визуализирај во DataViz
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
