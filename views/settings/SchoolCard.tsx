import React, { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { Card } from '../../components/common/Card';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { firestoreService } from '../../services/firestoreService';
import { School, LogOut, CheckCircle2, Loader2 } from 'lucide-react';

export function SchoolCard() {
    const { user, firebaseUser, updateLocalProfile } = useAuth();
    const { addNotification } = useNotification();

    const [joinCodeInput, setJoinCodeInput] = useState('');
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinedSchoolName, setJoinedSchoolName] = useState<string | null>(user?.schoolName ?? null);
    const [leaveLoading, setLeaveLoading] = useState(false);
    const [adminSchools, setAdminSchools] = useState<{ id: string; name: string }[]>([]);
    const [adminSchoolSel, setAdminSchoolSel] = useState('');
    const [confirmDialog, setConfirmDialog] = useState<{
        message: string; title?: string; variant?: 'danger' | 'warning' | 'info'; onConfirm: () => void;
    } | null>(null);

    useEffect(() => {
        if (user?.role === 'admin' && adminSchools.length === 0) {
            firestoreService.fetchSchools().then((s: any[]) => {
                setAdminSchools(s ?? []);
                if (user?.schoolName && !user?.schoolId) {
                    const match = (s ?? []).find((sc: any) => sc.name === user.schoolName);
                    if (match) setAdminSchoolSel(match.id);
                }
            }).catch(() => {});
        }
    }, [user?.role, user?.schoolName, user?.schoolId]);

    const handleJoinSchool = async () => {
        if (!firebaseUser || joinCodeInput.trim().length < 4) return;
        if (user?.schoolId) {
            addNotification('Веќе сте член на училиште. Прво напуштете го тековното пред да се приклучите кон ново.', 'error');
            return;
        }
        setJoinLoading(true);
        try {
            const school = await firestoreService.joinSchoolByCode(joinCodeInput.trim(), firebaseUser.uid);
            if (!school) {
                addNotification('Кодот не е пронајден. Проверете го и обидете се повторно.', 'error');
            } else {
                setJoinedSchoolName(school.name);
                setJoinCodeInput('');
                updateLocalProfile({ schoolId: school.id, schoolName: school.name });
                addNotification(`Успешно се приклучивте кон ${school.name}! 🎉`, 'success');
            }
        } catch {
            addNotification('Грешка при приклучување. Обидете се повторно.', 'error');
        } finally {
            setJoinLoading(false);
        }
    };

    const handleLeaveSchool = () => {
        if (!firebaseUser || !user?.schoolId) return;
        setConfirmDialog({
            message: 'Дали сте сигурни дека сакате да го напуштите училиштето?',
            variant: 'warning',
            onConfirm: async () => {
                setConfirmDialog(null);
                setLeaveLoading(true);
                try {
                    await firestoreService.leaveSchool(user.schoolId!, firebaseUser.uid);
                    setJoinedSchoolName(null);
                    updateLocalProfile({ schoolId: undefined, schoolName: undefined });
                    addNotification('Успешно го напуштивте училиштето.', 'success');
                } catch {
                    addNotification('Грешка при напуштање. Обидете се повторно.', 'error');
                } finally {
                    setLeaveLoading(false);
                }
            },
        });
    };

    if (!user) return null;

    return (
        <>
            <Card className="max-w-2xl border-blue-200 bg-blue-50/20">
                <h2 className="text-2xl font-semibold text-blue-800 mb-1 flex items-center gap-2">
                    <School className="w-6 h-6" />
                    Приклучи се кон училиште
                </h2>
                <p className="text-sm text-blue-600 mb-4">
                    {user.role === 'admin'
                        ? 'Системски администратор: директно изберете училиште без код.'
                        : 'Добијте код од директорот/администраторот на вашето училиште и внесете го подолу.'}
                </p>

                {joinedSchoolName && user.schoolId ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl">
                        <div className="flex items-center gap-2 text-green-800">
                            <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                            <span className="font-semibold">{joinedSchoolName}</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleLeaveSchool}
                            disabled={leaveLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                            {leaveLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                            Напушти
                        </button>
                    </div>
                ) : user.role === 'admin' ? (
                    <div className="flex gap-2">
                        <select
                            aria-label="Изберете училиште"
                            value={adminSchoolSel}
                            onChange={e => setAdminSchoolSel(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        >
                            <option value="">— Изберете училиште —</option>
                            {adminSchools.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            disabled={joinLoading || !adminSchoolSel}
                            onClick={async () => {
                                if (!firebaseUser || !adminSchoolSel) return;
                                const school = adminSchools.find(s => s.id === adminSchoolSel);
                                if (!school) return;
                                setJoinLoading(true);
                                try {
                                    await firestoreService.adminAssignSchool(firebaseUser.uid, school.id, school.name);
                                    setJoinedSchoolName(school.name);
                                    updateLocalProfile({ schoolId: school.id, schoolName: school.name });
                                    addNotification(`Поврзани со ${school.name}! 🎉`, 'success');
                                } catch {
                                    addNotification('Грешка при поврзување.', 'error');
                                } finally {
                                    setJoinLoading(false);
                                }
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Постави
                        </button>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={joinCodeInput}
                            onChange={e => setJoinCodeInput(e.target.value.trim().toUpperCase())}
                            maxLength={8}
                            placeholder="пр. AB1234"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <button
                            type="button"
                            onClick={handleJoinSchool}
                            disabled={joinLoading || joinCodeInput.trim().length < 4}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Приклучи се
                        </button>
                    </div>
                )}
            </Card>

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
}
