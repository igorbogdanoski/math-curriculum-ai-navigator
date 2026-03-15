import React, { useState, useEffect, useRef } from 'react';
import { School, Plus, Trash2, UserPlus, X, Edit2, Check, Upload, FileText, Key, RefreshCw, Copy, CheckCircle2, BarChart2, ChevronDown, ChevronUp, Loader2, AlertCircle } from 'lucide-react';
import { firestoreService, type SchoolClass } from '../../services/firestoreService';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';
import { useLanguage } from '../../i18n/LanguageContext';

interface ClassesTabProps {
    teacherUid: string;
}

const GRADE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const ClassesTab: React.FC<ClassesTabProps> = ({ teacherUid }) => {
    const { t } = useLanguage();
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    // New class form state
    const [newName, setNewName] = useState('');
    const [newGrade, setNewGrade] = useState<number>(1);

    // Add student to class
    const [addStudentClassId, setAddStudentClassId] = useState<string | null>(null);
    const [studentInput, setStudentInput] = useState('');

    // Rename class
    const [renameId, setRenameId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');

    // CSV bulk import
    const csvInputRef = useRef<HTMLInputElement>(null);
    const [csvTargetClassId, setCsvTargetClassId] = useState<string | null>(null);
    const [csvPreview, setCsvPreview] = useState<{ classId: string; names: string[] } | null>(null);
    const [csvImporting, setCsvImporting] = useState(false);

    // И2 — join code per class
    const [generatingCodeId, setGeneratingCodeId] = useState<string | null>(null);
    const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
    const [codeGenError, setCodeGenError] = useState<string | null>(null);

    // И2 — per-class stats (lazy)
    const [statsOpenId, setStatsOpenId] = useState<string | null>(null);
    const [statsCache, setStatsCache] = useState<Record<string, { name: string; avgPct: number; count: number }[]>>({});
    const [statsLoading, setStatsLoading] = useState(false);

    const handleCsvButtonClick = (classId: string) => {
        setCsvTargetClassId(classId);
        setCsvPreview(null);
        csvInputRef.current?.click();
    };

    const handleCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !csvTargetClassId) return;
        e.target.value = ''; // reset so same file can be re-selected
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = (ev.target?.result as string) ?? '';
            // Remove BOM, split lines
            const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
            const names: string[] = [];
            lines.forEach((line, idx) => {
                // If first line looks like a header containing "name", skip it
                if (idx === 0 && /^name/i.test(line.trim())) return;
                // Take first CSV column (before comma) and trim
                const cell = line.split(',')[0].replace(/^["']|["']$/g, '').trim();
                if (cell.length >= 2) names.push(cell);
            });
            if (names.length === 0) {
                alert('Фајлот не содржи валидни имиња. Очекуван формат: едно ime по ред (или CSV со колона "name").');
                return;
            }
            setCsvPreview({ classId: csvTargetClassId, names });
        };
        reader.readAsText(file, 'utf-8');
    };

    const handleCsvConfirm = async () => {
        if (!csvPreview) return;
        const cls = classes.find(c => c.id === csvPreview.classId);
        if (!cls) return;
        setCsvImporting(true);
        const uniqueImported = [...new Set(csvPreview.names)]; // dedupe within file
        const merged = Array.from(new Set([...cls.studentNames, ...uniqueImported]));
        await firestoreService.updateClass(csvPreview.classId, { studentNames: merged });
        setStatsCache(prev => { const n = { ...prev }; delete n[csvPreview.classId]; return n; });
        setCsvPreview(null);
        setCsvTargetClassId(null);
        setCsvImporting(false);
        await loadClasses();
    };

    const loadClasses = async () => {
        if (!teacherUid) return;
        setLoading(true);
        const data = await firestoreService.fetchClasses(teacherUid);
        setClasses(data);
        setLoading(false);
    };

    useEffect(() => { loadClasses(); }, [teacherUid]);

    const handleCreate = async () => {
        if (!newName.trim() || !teacherUid) return;
        setSaving(true);
        await firestoreService.createClass({
            name: newName.trim(),
            gradeLevel: newGrade,
            teacherUid,
            studentNames: [],
        });
        setNewName('');
        setNewGrade(1);
        setShowForm(false);
        setSaving(false);
        await loadClasses();
    };

    const handleDelete = async (classId: string, name: string) => {
        if (!window.confirm(`Избриши го одделението „${name}"?`)) return;
        await firestoreService.deleteClass(classId);
        await loadClasses();
    };

    const handleAddStudent = async (classId: string) => {
        const name = studentInput.trim();
        if (!name) return;
        const cls = classes.find(c => c.id === classId);
        if (!cls) return;
        const updated = Array.from(new Set([...cls.studentNames, name]));
        await firestoreService.updateClass(classId, { studentNames: updated });
        setStatsCache(prev => { const n = { ...prev }; delete n[classId]; return n; });
        setStudentInput('');
        setAddStudentClassId(null);
        await loadClasses();
    };

    const handleRemoveStudent = async (classId: string, studentName: string) => {
        const cls = classes.find(c => c.id === classId);
        if (!cls) return;
        const updated = cls.studentNames.filter(n => n !== studentName);
        await firestoreService.updateClass(classId, { studentNames: updated });
        setStatsCache(prev => { const n = { ...prev }; delete n[classId]; return n; });
        await loadClasses();
    };

    const handleRename = async (classId: string) => {
        const name = renameValue.trim();
        if (!name) return;
        await firestoreService.updateClass(classId, { name });
        setRenameId(null);
        await loadClasses();
    };

    const handleGenerateCode = async (classId: string) => {
        setGeneratingCodeId(classId);
        setCodeGenError(null);
        try {
            const code = await firestoreService.generateClassJoinCode(classId);
            if (!code) {
                setCodeGenError('Неможе да се генерира код. Обиди се повторно.');
            } else {
                setClasses(prev => prev.map(c => c.id === classId ? { ...c, joinCode: code } : c));
            }
        } catch {
            setCodeGenError('Грешка при генерирање на код.');
        } finally {
            setGeneratingCodeId(null);
        }
    };

    const handleCopyCode = (classId: string, code: string) => {
        navigator.clipboard.writeText(code).then(() => {
            setCopiedCodeId(classId);
            setTimeout(() => setCopiedCodeId(null), 2000);
        }).catch(() => {
            // fallback for insecure contexts
            window.prompt('Копирај го кодот:', code);
        });
    };

    const handleToggleStats = async (cls: SchoolClass) => {
        if (statsOpenId === cls.id) { setStatsOpenId(null); return; }
        setStatsOpenId(cls.id);
        if (statsCache[cls.id]) return; // already loaded
        setStatsLoading(true);
        const data = await firestoreService.fetchClassStats(teacherUid, cls.studentNames);
        setStatsCache(prev => ({ ...prev, [cls.id]: data }));
        setStatsLoading(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm font-semibold">
                Вчитување класи...
            </div>
        );
    }

    return (
        <SilentErrorBoundary name="ClassesTab">
            {/* Hidden CSV file input */}
            <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.txt"
                aria-label="Избери CSV фајл со имиња на ученици"
                className="hidden"
                onChange={handleCsvFile}
            />

            {/* CSV Preview / Confirm modal */}
            {csvPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText className="w-5 h-5 text-indigo-600" />
                            <p className="font-bold text-slate-800">Преглед пред увоз</p>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">
                            Ќе се додадат <span className="font-black text-indigo-700">{csvPreview.names.length}</span> ученика во одделението:
                        </p>
                        <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl px-3 py-2 mb-4 space-y-0.5">
                            {csvPreview.names.map((n, i) => (
                                <p key={i} className="text-sm text-slate-700">{i + 1}. {n}</p>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={handleCsvConfirm}
                                disabled={csvImporting}
                                className="flex-1 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition"
                            >
                                {csvImporting ? 'Увоз...' : `Увези ${csvPreview.names.length} ученика`}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setCsvPreview(null); setCsvTargetClassId(null); }}
                                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 transition"
                            >
                                Откажи
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                        <School className="w-4 h-4" />
                        Мои одделенија ({classes.length})
                    </h2>
                    <button
                        type="button"
                        onClick={() => setShowForm(v => !v)}
                        className="flex items-center gap-1.5 text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Ново одделение
                    </button>
                </div>

                {/* Create form */}
                {showForm && (
                    <Card className="border-indigo-200 bg-indigo-50">
                        <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest mb-3">Ново одделение</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                            <input
                                type="text"
                                placeholder="Назив на одделението (напр. V-б)"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
                                className="flex-1 border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
                            />
                            <select
                                value={newGrade}
                                onChange={e => setNewGrade(Number(e.target.value))}
                                aria-label="Избери одделение"
                                className="border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white"
                            >
                                {GRADE_LEVELS.map(g => (
                                    <option key={g} value={g}>{g}. одделение</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={!newName.trim() || saving}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-40 transition"
                            >
                                {saving ? t('analytics.classes.saving') : t('analytics.classes.create')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition"
                            >
                                Откажи
                            </button>
                        </div>
                    </Card>
                )}

                {/* Empty state */}
                {classes.length === 0 && !showForm && (
                    <Card className="text-center py-12">
                        <School className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <p className="text-sm font-semibold text-gray-400">Нема создадени одделенија.</p>
                        <p className="text-xs text-gray-300 mt-1">Кликни „Ново одделение" за да создадеш свое прво одделение.</p>
                    </Card>
                )}

                {/* Class cards */}
                {classes.map(cls => (
                    <Card key={cls.id} className="border-slate-200">
                        {/* Class header */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2 min-w-0">
                                <School className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                {renameId === cls.id ? (
                                    <div className="flex items-center gap-1">
                                        <input
                                            type="text"
                                            aria-label="Ново име на одделение"
                                            value={renameValue}
                                            onChange={e => setRenameValue(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleRename(cls.id);
                                                if (e.key === 'Escape') setRenameId(null);
                                            }}
                                            autoFocus
                                            className="border border-indigo-300 rounded px-2 py-0.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500 w-32"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleRename(cls.id)}
                                            className="p-1 text-green-600 hover:text-green-700 transition"
                                            aria-label="Зачувај"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRenameId(null)}
                                            className="p-1 text-gray-400 hover:text-gray-600 transition"
                                            aria-label="Откажи"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <h3 className="font-bold text-slate-800 truncate">{cls.name}</h3>
                                )}
                                <span className="text-xs font-semibold text-gray-400 flex-shrink-0">
                                    {cls.gradeLevel}. одд.
                                </span>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex-shrink-0">
                                    {cls.studentNames.length} уч.
                                </span>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRenameId(cls.id);
                                        setRenameValue(cls.name);
                                    }}
                                    title="Преименувај класа"
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 transition"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAddStudentClassId(addStudentClassId === cls.id ? null : cls.id)}
                                    title="Додај ученик"
                                    className="p-1.5 text-gray-400 hover:text-green-600 transition"
                                >
                                    <UserPlus className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleCsvButtonClick(cls.id)}
                                    title="Увези ученици од CSV"
                                    className="p-1.5 text-gray-400 hover:text-blue-600 transition"
                                >
                                    <Upload className="w-4 h-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(cls.id, cls.name)}
                                    title="Избриши класа"
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Add student inline form */}
                        {addStudentClassId === cls.id && (
                            <div className="flex gap-2 mb-3">
                                <input
                                    type="text"
                                    placeholder="Ime и презиме на ученик..."
                                    value={studentInput}
                                    onChange={e => setStudentInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleAddStudent(cls.id);
                                        if (e.key === 'Escape') setAddStudentClassId(null);
                                    }}
                                    autoFocus
                                    className="flex-1 border border-green-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddStudent(cls.id)}
                                    disabled={!studentInput.trim()}
                                    className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-40 transition"
                                >
                                    Додај
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setAddStudentClassId(null); setStudentInput(''); }}
                                    className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition"
                                >
                                    Откажи
                                </button>
                            </div>
                        )}

                        {/* Student list */}
                        {cls.studentNames.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">
                                Нема ученици — кликни <UserPlus className="w-3 h-3 inline" /> за да додадеш.
                            </p>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {cls.studentNames.sort().map(name => (
                                    <span
                                        key={name}
                                        className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
                                    >
                                        {name}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveStudent(cls.id, name)}
                                            aria-label={`Отстрани ${name} од класата`}
                                            className="hover:opacity-60 transition"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
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
                                                onClick={() => handleCopyCode(cls.id, cls.joinCode!)}
                                                className="p-1.5 text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                                            >
                                                {copiedCodeId === cls.id
                                                    ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                                    : <Copy className="w-4 h-4" />}
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-xs text-slate-400 italic">Нема активен код</span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => handleGenerateCode(cls.id)}
                                        disabled={generatingCodeId === cls.id}
                                        title={cls.joinCode ? 'Генерирај нов код' : 'Генерирај код'}
                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold border border-indigo-200 text-indigo-600 rounded-lg hover:bg-indigo-50 transition disabled:opacity-50"
                                    >
                                        {generatingCodeId === cls.id
                                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            : <RefreshCw className="w-3.5 h-3.5" />}
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
                                <button
                                    type="button"
                                    onClick={() => handleToggleStats(cls)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-indigo-600 transition"
                                >
                                    <BarChart2 className="w-3.5 h-3.5" />
                                    Статистики
                                    {statsOpenId === cls.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>

                                {statsOpenId === cls.id && (
                                    <div className="mt-2 border border-slate-100 rounded-xl p-3 bg-slate-50">
                                        {statsLoading && !statsCache[cls.id] ? (
                                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Се вчитуваат статистики...
                                            </div>
                                        ) : (statsCache[cls.id] ?? []).length === 0 ? (
                                            <p className="text-xs text-slate-400 italic">Нема квизови за овие ученици.</p>
                                        ) : (
                                            <div className="space-y-1.5">
                                                {(statsCache[cls.id] ?? []).map(s => (
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
                                                    Просек одд.: <strong>{Math.round((statsCache[cls.id] ?? []).reduce((a, s) => a + s.avgPct, 0) / ((statsCache[cls.id] ?? []).length || 1))}%</strong>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        </SilentErrorBoundary>
    );
};
