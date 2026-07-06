import React, { useState, useEffect, useRef } from 'react';
import { School, Plus, FileText } from 'lucide-react';
import { firestoreService, type SchoolClass } from '../../services/firestoreService';
import { Card } from '../../components/common/Card';
import { SilentErrorBoundary } from '../../components/common/SilentErrorBoundary';
import { useLanguage } from '../../i18n/LanguageContext';
import { SkeletonList } from '../../components/common/Skeleton';
import { useNotification } from '../../contexts/NotificationContext';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useNavigation } from '../../contexts/NavigationContext';
import { ClassCard } from '../../components/analytics/ClassCard';

interface ClassesTabProps {
    teacherUid: string;
}

const GRADE_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const ClassesTab: React.FC<ClassesTabProps> = ({ teacherUid }) => {
    const { t } = useLanguage();
    const { addNotification } = useNotification();
    const { navigate } = useNavigation();
    const [confirmDialog, setConfirmDialog] = useState<{ message: string; title?: string; variant?: 'danger' | 'warning' | 'info'; onConfirm: () => void } | null>(null);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    // New class form state
    const [newName, setNewName] = useState('');
    const [newGrade, setNewGrade] = useState<number>(1);

    // CSV bulk import — shared modal/file-input, not per-card
    const csvInputRef = useRef<HTMLInputElement>(null);
    const [csvTargetClassId, setCsvTargetClassId] = useState<string | null>(null);
    const [csvPreview, setCsvPreview] = useState<{ classId: string; names: string[] } | null>(null);
    const [csvImporting, setCsvImporting] = useState(false);

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
            const rawText = (ev.target?.result as string) ?? '';
            // Remove BOM, split lines
            const withoutBom = rawText.charCodeAt(0) === 0xFEFF ? rawText.slice(1) : rawText;
            const lines = withoutBom.split(/\r?\n/);
            const names: string[] = [];
            lines.forEach((line, idx) => {
                // If first line looks like a header containing "name", skip it
                if (idx === 0 && /^name/i.test(line.trim())) return;
                // Take first CSV column (before comma) and trim
                const cell = line.split(',')[0].replace(/^["']|["']$/g, '').trim();
                if (cell.length >= 2) names.push(cell);
            });
            if (names.length === 0) {
                addNotification('Фајлот не содржи валидни имиња. Очекуван формат: едно ime по ред (или CSV со колона "name").', 'error');
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
        const classId = await firestoreService.createClass({
            name: newName.trim(),
            gradeLevel: newGrade,
            teacherUid,
            studentNames: [],
        });
        const code = await firestoreService.generateClassJoinCode(classId);
        setNewName('');
        setNewGrade(1);
        setShowForm(false);
        setSaving(false);
        await loadClasses();
        addNotification(
            code
                ? `Одделението е креирано! Код за учениците: ${code}`
                : 'Одделението е креирано! Кодот за учениците ќе се генерира одделно.',
            'success'
        );
    };

    const handleDelete = (classId: string, name: string) => {
        setConfirmDialog({
            message: `Избриши го одделението „${name}"?`,
            variant: 'danger',
            onConfirm: async () => {
                setConfirmDialog(null);
                await firestoreService.deleteClass(classId);
                await loadClasses();
            }
        });
    };

    const handleRename = async (classId: string, name: string) => {
        await firestoreService.updateClass(classId, { name });
        await loadClasses();
    };

    const handleAddStudent = async (classId: string, name: string) => {
        const cls = classes.find(c => c.id === classId);
        if (!cls) return;
        const updated = Array.from(new Set([...cls.studentNames, name]));
        await firestoreService.updateClass(classId, { studentNames: updated });
        await loadClasses();
    };

    const handleRemoveStudent = async (classId: string, studentName: string) => {
        const cls = classes.find(c => c.id === classId);
        if (!cls) return;
        const updated = cls.studentNames.filter(n => n !== studentName);
        await firestoreService.updateClass(classId, { studentNames: updated });
        await loadClasses();
    };

    // П-Г: IEP toggle
    const handleToggleIEP = async (classId: string, studentName: string, currentIepStudents: string[]) => {
        try {
            await firestoreService.toggleIEPStudent(classId, studentName, currentIepStudents);
            await loadClasses();
        } catch { /* non-critical */ }
    };

    const handleGenerateCode = async (classId: string): Promise<string | null> => {
        try {
            const code = await firestoreService.generateClassJoinCode(classId);
            if (code) setClasses(prev => prev.map(c => c.id === classId ? { ...c, joinCode: code } : c));
            return code ?? null;
        } catch {
            return null;
        }
    };

    const handleVisualizeStats = (cls: SchoolClass, stats: { name: string; avgPct: number; count: number }[]) => {
        sessionStorage.setItem('dataviz_import', JSON.stringify({
            tableData: {
                headers: ['Ученик', 'Просек %', 'Квизови'],
                rows: stats.map(s => [s.name, s.avgPct, s.count]),
            },
            config: { title: `Резултати — ${cls.name}`, xLabel: 'Ученик', yLabel: 'Просек %', unit: '%', type: 'bar' },
        }));
        navigate('/data-viz');
    };

    if (loading) {
        return <SkeletonList count={3} rows={4} />;
    }

    return (
        <>
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
                                <p key={`csv-${i}`} className="text-sm text-slate-700">{i + 1}. {n}</p>
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
                        <p className="text-sm font-semibold text-gray-500">Нема создадени одделенија.</p>
                        <p className="text-xs text-gray-300 mt-1">Кликни „Ново одделение" за да создадеш свое прво одделение.</p>
                    </Card>
                )}

                {/* Class cards */}
                {classes.map(cls => (
                    <ClassCard
                        key={cls.id}
                        cls={cls}
                        teacherUid={teacherUid}
                        onRename={handleRename}
                        onDelete={handleDelete}
                        onAddStudent={handleAddStudent}
                        onRemoveStudent={handleRemoveStudent}
                        onToggleIEP={handleToggleIEP}
                        onCsvImportClick={handleCsvButtonClick}
                        onGenerateCode={handleGenerateCode}
                        onVisualizeStats={handleVisualizeStats}
                    />
                ))}
            </div>
        </SilentErrorBoundary>
        {confirmDialog && (
            <ConfirmDialog
                message={confirmDialog.message}
                title={confirmDialog.title}
                variant={confirmDialog.variant ?? 'warning'}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(null)}
            />
        )}
        </>
    );
};
