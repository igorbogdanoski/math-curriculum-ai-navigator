import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/common/Card';
import { useNavigation } from '../contexts/NavigationContext';
import { useNotification } from '../contexts/NotificationContext';
import { Users, School, TrendingUp, BookOpen, AlertCircle, Printer, BarChart2, FileText, RefreshCw, Copy, UserMinus, Loader2, CheckCircle2 } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import type { School as SchoolType } from '../types';

export const SchoolAdminView: React.FC = () => {
    const { user } = useAuth();
    const { navigate } = useNavigation();
    const { addNotification } = useNotification();
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [school, setSchool] = useState<SchoolType | null>(null);
    const [joinCodeLoading, setJoinCodeLoading] = useState(false);
    const [removingUid, setRemovingUid] = useState<string | null>(null);
    const [codeCopied, setCodeCopied] = useState(false);

    useEffect(() => {
        if (!user || (user.role !== 'school_admin' && user.role !== 'admin')) {
            navigate('/');
            return;
        }

        const fetchAll = async () => {
            try {
                if (user.schoolId) {
                    const [data, schoolData] = await Promise.all([
                        firestoreService.fetchSchoolStats(user.schoolId),
                        firestoreService.fetchSchool(user.schoolId),
                    ]);
                    setStats(data);
                    setSchool(schoolData);
                }
            } catch (error) {
                console.error('Error fetching school stats:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAll();
    }, [user, navigate]);

    const handleRegenerateCode = async () => {
        if (!user?.schoolId) return;
        setJoinCodeLoading(true);
        try {
            const newCode = await firestoreService.regenerateJoinCode(user.schoolId);
            setSchool(prev => prev ? { ...prev, joinCode: newCode } : prev);
            addNotification(`Нов код генериран: ${newCode}`, 'success');
        } catch {
            addNotification('Грешка при генерирање на код.', 'error');
        } finally {
            setJoinCodeLoading(false);
        }
    };

    const handleRemoveTeacher = async (teacherUid: string, teacherName: string) => {
        if (!user?.schoolId) return;
        if (!window.confirm(`Дали сте сигурни дека сакате да го отстраните ${teacherName}?`)) return;
        setRemovingUid(teacherUid);
        try {
            await firestoreService.removeTeacherFromSchool(user.schoolId, teacherUid);
            setStats((prev: any) => prev ? {
                ...prev,
                teachers: prev.teachers.filter((t: any) => t.id !== teacherUid),
                totalTeachers: prev.totalTeachers - 1,
            } : prev);
            addNotification(`${teacherName} е отстранет од училиштето.`, 'success');
        } catch {
            addNotification('Грешка при отстранување.', 'error');
        } finally {
            setRemovingUid(null);
        }
    };

    if (!user || (user.role !== 'school_admin' && user.role !== 'admin')) {
        return null;
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 printable-root" id="printable-area">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4 print:hidden">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <School className="w-6 h-6 text-brand-primary" />
                        Директорски Портал
                    </h1>
                    <p className="text-gray-500 mt-1">Извештај за вашето училиште: {user.schoolName || 'Непознато училиште'}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => navigate('/school-admin/curriculum')}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                    >
                        <BookOpen className="w-5 h-5" />
                        Уреди Курикулум
                    </button>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                    <Printer className="w-5 h-5" />
                    Печати / PDF Извештај
                </button>
            </div>
        </div>

            {/* Print Header - Only visible when printing */}
            <div className="hidden print:block text-center mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold text-gray-900">Извештај за училиштето</h1>
                <p className="text-xl text-gray-600 mt-2">{user.schoolName || 'Непознато училиште'}</p>
                <p className="text-gray-500 mt-1">Датум: {new Date().toLocaleDateString('mk-MK')}</p>
            </div>

            {isLoading ? (
                <div className="animate-pulse space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="h-32 bg-gray-100 rounded-2xl"></div>
                        <div className="h-32 bg-gray-100 rounded-2xl"></div>
                        <div className="h-32 bg-gray-100 rounded-2xl"></div>
                    </div>
                </div>
            ) : !stats ? (
                <Card className="p-8 text-center text-gray-500 flex flex-col items-center">
                    <AlertCircle className="w-12 h-12 text-yellow-500 mb-4" />
                    <h3 className="text-lg font-bold text-gray-900">Нема податоци</h3>
                    <p>Не се пронајдени статистички податоци за вашето училиште. Проверете дали вашето училиште е правилно поврзано.</p>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-100 rounded-xl">
                                    <Users className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Наставници</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.totalTeachers || 0}</p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-green-100 rounded-xl">
                                    <BookOpen className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Одржани квизови</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.totalQuizzes || 0}</p>
                                </div>
                            </div>
                        </Card>

                        <Card className="p-6">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-orange-100 rounded-xl">
                                    <TrendingUp className="w-6 h-6 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-gray-500">Просечен резултат</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.averageScore ? stats.averageScore.toFixed(1) : 0}%</p>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Г4: Grade comparison */}
                    {stats.gradeStats?.length > 0 && (
                        <Card className="mt-6 p-6">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <BarChart2 className="w-4 h-4" />
                                Споредба по одделение (просечен резултат)
                            </h2>
                            <div className="space-y-3">
                                {stats.gradeStats.map((g: any) => (
                                    <div key={g.grade} className="flex items-center gap-3 text-sm">
                                        <span className="w-16 font-semibold text-gray-700 shrink-0">{g.grade}</span>
                                        <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${g.avgPct >= 70 ? 'bg-green-400' : g.avgPct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                                style={{ width: `${Math.max(g.avgPct, 2)}%` }}
                                            />
                                        </div>
                                        <span className={`w-12 text-right font-bold ${g.avgPct >= 70 ? 'text-green-600' : g.avgPct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                            {g.avgPct}%
                                        </span>
                                        <span className="text-xs text-gray-400 w-16 text-right">{g.attempts} обиди</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* Г4: Weekly trend */}
                    {stats.weeklyTrend?.length > 0 && (
                        <Card className="mt-6 p-6">
                            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                Неделен тренд (просечен резултат на ниво на училиште)
                            </h2>
                            <div className="flex items-end gap-2 h-28">
                                {stats.weeklyTrend.map((w: any, i: number) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <span className="text-xs font-bold text-gray-600">{w.avg}%</span>
                                        <div className="w-full bg-gray-100 rounded-t-md relative" style={{ height: '80px' }}>
                                            <div
                                                className={`absolute bottom-0 w-full rounded-t-md transition-all ${w.avg >= 70 ? 'bg-indigo-400' : w.avg >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                                style={{ height: `${Math.max(w.avg, 2)}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-gray-400 text-center leading-tight">{w.label}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {/* И1 — Join Code panel */}
                    {school && (
                        <Card className="mt-6 p-6 border-indigo-200 bg-indigo-50/30">
                            <h2 className="text-sm font-bold text-indigo-700 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <School className="w-4 h-4" />
                                Код за приклучување на наставници
                            </h2>
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-indigo-300 rounded-xl font-mono text-2xl font-bold tracking-widest text-indigo-800 select-all">
                                    {school.joinCode ?? '——'}
                                </div>
                                <button
                                    type="button"
                                    title="Копирај код"
                                    onClick={() => {
                                        navigator.clipboard.writeText(school.joinCode ?? '');
                                        setCodeCopied(true);
                                        setTimeout(() => setCodeCopied(false), 2000);
                                    }}
                                    className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors"
                                >
                                    {codeCopied ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRegenerateCode}
                                    disabled={joinCodeLoading}
                                    className="flex items-center gap-2 px-4 py-2 text-sm border border-indigo-300 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
                                >
                                    {joinCodeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                    Генерирај нов
                                </button>
                            </div>
                            <p className="text-xs text-indigo-500 mt-2">
                                Наставниците го внесуваат овој код во Поставки → Приклучи се кон училиште.
                            </p>
                        </Card>
                    )}

                    {/* Г4: Teachers table — enhanced with remove action */}
                    <Card className="mt-6 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Users className="w-5 h-5 text-gray-600" />
                                Наставници на училиштето
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 text-gray-500 text-sm border-b border-gray-100">
                                        <th className="py-3 px-6 font-medium">Име и презиме</th>
                                        <th className="py-3 px-6 font-medium text-center">Квизови</th>
                                        <th className="py-3 px-6 font-medium text-center">Материјали</th>
                                        <th className="py-3 px-6 font-medium text-center">Просек</th>
                                        <th className="py-3 px-6 font-medium">Последна активност</th>
                                        <th className="py-3 px-6 font-medium text-center">Акција</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {stats.teachers?.map((teacher: any) => (
                                        <tr key={teacher.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-medium text-gray-900">{teacher.name}</div>
                                                <div className="text-xs text-gray-500">Наставник</div>
                                            </td>
                                            <td className="py-4 px-6 text-center text-gray-700">{teacher.quizzesGiven}</td>
                                            <td className="py-4 px-6 text-center">
                                                <span className="flex items-center justify-center gap-1 text-gray-700">
                                                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                                                    {teacher.materialsGenerated ?? '—'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    teacher.avgScore >= 80 ? 'bg-green-100 text-green-700' :
                                                    teacher.avgScore >= 60 ? 'bg-orange-100 text-orange-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    {Math.round(teacher.avgScore)}%
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-gray-500 text-sm">
                                                {teacher.lastActive && teacher.lastActive !== 'Непознато'
                                                    ? new Date(teacher.lastActive).toLocaleDateString('mk-MK')
                                                    : '—'}
                                            </td>
                                            <td className="py-4 px-6 text-center">
                                                <button
                                                    type="button"
                                                    title="Отстрани наставник"
                                                    onClick={() => handleRemoveTeacher(teacher.id, teacher.name)}
                                                    disabled={removingUid === teacher.id}
                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                                                >
                                                    {removingUid === teacher.id
                                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                                        : <UserMinus className="w-4 h-4" />}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
};
