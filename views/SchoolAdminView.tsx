import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/common/Card';
import { useNavigation } from '../contexts/NavigationContext';
import { Users, School, TrendingUp, BookOpen, AlertCircle, Printer } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';

export const SchoolAdminView: React.FC = () => {
    const { user } = useAuth();
    const { navigate } = useNavigation();
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        if (!user || (user.role !== 'school_admin' && user.role !== 'admin')) {
            navigate('/');
            return;
        }

        const fetchStats = async () => {
            try {
                if (user.schoolId) {
                    const data = await firestoreService.fetchSchoolStats(user.schoolId);
                    setStats(data);
                }
            } catch (error) {
                console.error('Error fetching school stats:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();
    }, [user, navigate]);

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
                <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                    <Printer className="w-5 h-5" />
                    Печати / PDF Извештај
                </button>
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

                    <Card className="mt-8 overflow-hidden">
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
                                        <th className="py-3 px-6 font-medium">Одржани квизови</th>
                                        <th className="py-3 px-6 font-medium">Просечен резултат</th>
                                        <th className="py-3 px-6 font-medium">Последна активност</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {stats.teachers?.map((teacher: any) => (
                                        <tr key={teacher.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="font-medium text-gray-900">{teacher.name}</div>
                                                <div className="text-xs text-gray-500">Наставник</div>
                                            </td>
                                            <td className="py-4 px-6 text-gray-700">{teacher.quizzesGiven}</td>
                                            <td className="py-4 px-6">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    teacher.avgScore >= 80 ? 'bg-green-100 text-green-700' :
                                                    teacher.avgScore >= 60 ? 'bg-orange-100 text-orange-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    {teacher.avgScore}%
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-gray-500 text-sm">
                                                {new Date(teacher.lastActive).toLocaleDateString('mk-MK')}
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
