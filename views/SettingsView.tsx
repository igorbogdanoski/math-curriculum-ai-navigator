
import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import type { TeachingProfile, StudentProfile } from '../types';
import { ICONS } from '../constants';
import { InstallApp } from '../components/common/InstallApp';
import { firestoreService } from '../services/firestoreService';
import { fullCurriculumData } from '../data/curriculum';
import { isDailyQuotaKnownExhausted, clearDailyQuotaFlag, scheduleQuotaNotification, getQuotaDiagnostics } from '../services/geminiService';

const initialProfile: TeachingProfile = {
    name: '',
    style: 'Constructivist',
    experienceLevel: 'Beginner',
    studentProfiles: []
};

export const SettingsView: React.FC = () => {
    const { user, updateProfile, firebaseUser } = useAuth();
    const [profile, setProfile] = useState<TeachingProfile>(user || initialProfile);
    const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>(user?.studentProfiles || []);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileDesc, setNewProfileDesc] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isMigrating, setIsMigrating] = useState(false);
    const [quotaStatus, setQuotaStatus] = useState<{ exhausted: boolean; resetTime: string; resetDate: string; source: string }>({ exhausted: false, resetTime: '', resetDate: '', source: '' });
    const [isTesting, setIsTesting] = useState(false);
    const [apiTestResult, setApiTestResult] = useState<string | null>(null);
    const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );
    const [autoAiEnabled, setAutoAiEnabled] = useState(() =>
        localStorage.getItem('auto_ai_suggestions') !== 'false'
    );
    const { addNotification } = useNotification();

    const toggleAutoAi = () => {
        const next = !autoAiEnabled;
        setAutoAiEnabled(next);
        localStorage.setItem('auto_ai_suggestions', String(next));
    };

    useEffect(() => {
        if (user) {
            setProfile(user);
            setStudentProfiles(user.studentProfiles || []);
        }
    }, [user]);

    useEffect(() => {
        const update = () => {
            const diag = getQuotaDiagnostics();
            if (!diag.isCurrentlyExhausted) {
                setQuotaStatus({ exhausted: false, resetTime: '', resetDate: '', source: diag.source });
                return;
            }
            const resetDate = diag.nextResetMs
                ? new Date(diag.nextResetMs).toLocaleDateString('mk-MK', { weekday: 'short', day: 'numeric', month: 'short' })
                : '';
            const resetTime = diag.nextResetMs
                ? new Date(diag.nextResetMs).toLocaleTimeString('mk-MK', { hour: '2-digit', minute: '2-digit' })
                : '09:00';
            setQuotaStatus({ exhausted: true, resetTime, resetDate, source: diag.source });
        };
        update();
        const id = setInterval(update, 60_000);
        return () => clearInterval(id);
    }, []);

    const handleClearQuotaFlag = () => {
        clearDailyQuotaFlag();
        setQuotaStatus({ exhausted: false, resetTime: '', resetDate: '', source: '' });
        setApiTestResult(null);
        addNotification('AI квота флагот е очистен. Следниот повик ќе го провери статусот.', 'success');
    };

    const handleTestApi = async () => {
        setIsTesting(true);
        setApiTestResult(null);
        try {
            if (!firebaseUser) {
                setApiTestResult('❌ Не сте логирани. Најавете се прво.');
                return;
            }
            const token = await firebaseUser.getIdToken();
            const resp = await fetch('/api/gemini', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    model: 'gemini-1.5-flash',
                    contents: [{ role: 'user', parts: [{ text: 'Кажи „тест".' }] }],
                    config: { maxOutputTokens: 10 },
                }),
            });
            const data = await resp.json().catch(() => ({}));
            if (resp.ok) {
                setApiTestResult(`✅ API работи! Одговор: "${(data.text || '').slice(0, 60)}"`);
            } else {
                const qType = data.quotaType ? ` [quotaType: ${data.quotaType}]` : '';
                const errMsg = (data.error || JSON.stringify(data)).slice(0, 200);
                setApiTestResult(`❌ HTTP ${resp.status}${qType}: ${errMsg}`);
            }
        } catch (e) {
            setApiTestResult(`❌ Мрежна грешка: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsTesting(false);
        }
    };

    const handleEnableNotifications = async () => {
        if (typeof Notification === 'undefined') {
            addNotification('Вашиот пребарувач не поддржува нотификации.', 'error');
            return;
        }
        const result = await Notification.requestPermission();
        setNotifPermission(result);
        if (result === 'granted') {
            addNotification('Нотификациите се овозможени! Ќе добиете порака кога AI квотата ќе се обнови.', 'success');
            // If quota is currently exhausted, schedule the notification now
            try {
                const stored = localStorage.getItem('ai_daily_quota_exhausted');
                const { nextResetMs } = stored ? JSON.parse(stored) : {};
                if (nextResetMs) scheduleQuotaNotification(nextResetMs);
            } catch { /* ignore */ }
        } else {
            addNotification('Нотификациите се одбиени. Може да ги овозможите преку поставките на пребарувачот.', 'warning');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateProfile({ ...profile, studentProfiles });
            addNotification('Профилот е успешно зачуван!', 'success');
        } catch (error) {
            addNotification('Грешка при зачувување на профилот.', 'error');
            console.error("Failed to save profile:", error);
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleAddProfile = () => {
        if (!newProfileName.trim() || !newProfileDesc.trim()) {
            addNotification('Името и описот на профилот се задолжителни.', 'error');
            return;
        }
        const newProfile: StudentProfile = {
            id: crypto.randomUUID(),
            name: newProfileName,
            description: newProfileDesc,
        };
        setStudentProfiles((prev: StudentProfile[]) => [...prev, newProfile]);
        setNewProfileName('');
        setNewProfileDesc('');
    };

    const handleDeleteProfile = (id: string) => {
        setStudentProfiles((prev: StudentProfile[]) => prev.filter((p: StudentProfile) => p.id !== id));
    };


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setProfile((prev: TeachingProfile) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleMigrateCurriculum = async () => {
        if (!window.confirm("Дали сте сигурни дека сакате да ја пополните Firestore базата со локалната наставна програма? Ова ќе ги пребрише постоечките податоци во 'curriculum/v1'.")) {
            return;
        }

        setIsMigrating(true);
        try {
            await firestoreService.saveFullCurriculum(fullCurriculumData);
            addNotification('Наставната програма е успешно префрлена во Firestore!', 'success');
        } catch (error) {
            addNotification('Грешка при миграција на податоците.', 'error');
            console.error("Migration failed:", error);
        } finally {
            setIsMigrating(false);
        }
    };

    if (!user) {
        return null; // Should not be rendered when not authenticated
    }

    return (
        <div className="p-8 animate-fade-in space-y-8">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-brand-primary">Поставки</h1>
                <p className="text-lg text-gray-600 mt-2">Прилагодете го вашето искуство во апликацијата.</p>
            </header>

            {/* Install App Section */}
            <InstallApp />

            <Card className="max-w-2xl">
                <h2 className="text-2xl font-semibold text-brand-primary mb-4">Профил на наставник</h2>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">Име</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={profile.name}
                            onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="style" className="block text-sm font-medium text-gray-700">Стил на настава</label>
                        <select
                            id="style"
                            name="style"
                            value={profile.style}
                            onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        >
                            <option value="Constructivist">Конструктивистички</option>
                            <option value="Direct Instruction">Директна инструкција</option>
                            <option value="Inquiry-Based">Истражувачки</option>
                            <option value="Project-Based">Проектно-базиран</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="experienceLevel" className="block text-sm font-medium text-gray-700">Ниво на искуство</label>
                        <select
                            id="experienceLevel"
                            name="experienceLevel"
                            value={profile.experienceLevel}
                            onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        >
                            <option value="Beginner">Почетник</option>
                            <option value="Intermediate">Средно искуство</option>
                            <option value="Expert">Експерт</option>
                        </select>
                    </div>
                    <div className="flex items-center justify-between py-3 border-t">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Авто AI предлози</p>
                            <p className="text-xs text-gray-500 mt-0.5">Препораки за часови и проактивни сугестии се генерираат во позадина</p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleAutoAi}
                            title={autoAiEnabled ? 'Исклучи авто AI предлози' : 'Вклучи авто AI предлози'}
                            aria-label={autoAiEnabled ? 'Исклучи авто AI предлози' : 'Вклучи авто AI предлози'}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${autoAiEnabled ? 'bg-brand-primary' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${autoAiEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    <div className="flex justify-end pt-4 border-t">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-secondary transition-colors flex items-center gap-2 disabled:bg-gray-400"
                        >
                            {isSaving && <ICONS.spinner className="w-5 h-5 animate-spin" />}
                            {isSaving ? 'Зачувувам...' : 'Зачувај промени на профил'}
                        </button>
                    </div>
                </form>
            </Card>
            
            <Card className="max-w-2xl">
                <h2 className="text-2xl font-semibold text-brand-primary mb-4">Профили на Ученици за Диференцијација</h2>
                <p className="text-sm text-gray-600 mb-4">Креирајте анонимни профили за да генерирате материјали прилагодени на специфични потреби на учениците.</p>
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
                        <h3 className="font-semibold text-gray-800">Додади нов профил</h3>
                        <div>
                            <label htmlFor="newProfileName" className="block text-xs font-medium text-gray-600">Име на профил (пр. Ученик А)</label>
                            <input
                                id="newProfileName"
                                value={newProfileName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProfileName(e.target.value)}
                                className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                                placeholder="Ученик А"
                            />
                        </div>
                         <div>
                            <label htmlFor="newProfileDesc" className="block text-xs font-medium text-gray-600">Краток опис на потреби/стил на учење</label>
                            <textarea
                                id="newProfileDesc"
                                value={newProfileDesc}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewProfileDesc(e.target.value)}
                                rows={2}
                                className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                                placeholder="пр. Визуелен тип, подобро учи со слики. Потребна му е поддршка со текстуални задачи."
                            />
                        </div>
                        <div className="text-right">
                             <button onClick={handleAddProfile} type="button" className="bg-brand-secondary text-white px-4 py-2 text-sm rounded-lg shadow hover:bg-brand-primary transition-colors">
                                Додади профил
                            </button>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-semibold text-gray-800 mb-2">Постоечки профили</h3>
                        {studentProfiles.length > 0 ? (
                            <ul className="space-y-2">
                                {studentProfiles.map((p: StudentProfile) => (
                                    <li key={p.id} className="p-3 bg-white border rounded-md flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-brand-primary">{p.name}</p>
                                            <p className="text-sm text-gray-600">{p.description}</p>
                                        </div>
                                        <button onClick={() => handleDeleteProfile(p.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full flex-shrink-0 ml-2">
                                            <ICONS.trash className="w-5 h-5" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-gray-500 italic text-center py-4">Немате креирано профили.</p>
                        )}
                    </div>
                </div>
                 <div className="flex justify-end pt-4 border-t mt-4">
                        <button
                            onClick={handleSave}
                            type="button"
                            disabled={isSaving}
                            className="bg-brand-primary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-secondary transition-colors flex items-center gap-2 disabled:bg-gray-400"
                        >
                            {isSaving && <ICONS.spinner className="w-5 h-5 animate-spin" />}
                             {isSaving ? 'Зачувувам...' : 'Зачувај ги сите промени'}
                        </button>
                    </div>
            </Card>

            <Card className="max-w-2xl border-orange-200 bg-orange-50/30">
                <h2 className="text-2xl font-semibold text-orange-800 mb-4 flex items-center gap-2">
                    <ICONS.settings className="w-6 h-6" />
                    Администрација на податоци
                </h2>
                <p className="text-sm text-orange-700 mb-6">
                    Оваа алатка овозможува синхронизација на локалната наставна програма со облакот (Firestore). 
                    Користете ја за иницијално поставување или кога сакате да ги обновите податоците во базата.
                </p>
                
                <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-gray-900">Миграција на наставна програма</h3>
                            <p className="text-xs text-gray-500 mt-1">Верзија: v1 (Математика 6-9 одд.)</p>
                        </div>
                        <button
                            onClick={handleMigrateCurriculum}
                            disabled={isMigrating}
                            className="bg-orange-600 text-white px-6 py-2.5 rounded-xl shadow-lg hover:bg-orange-700 transition-all flex items-center gap-2 disabled:bg-gray-400 font-bold"
                        >
                            {isMigrating ? (
                                <>
                                    <ICONS.spinner className="w-5 h-5 animate-spin" />
                                    Синхронизирам...
                                </>
                            ) : (
                                <>
                                    <ICONS.zap className="w-5 h-5" />
                                    Синхронизирај со Firestore
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </Card>

            {/* ── AI Quota Dashboard ── */}
            <Card className={`max-w-2xl ${quotaStatus.exhausted ? 'border-red-200 bg-red-50/30' : 'border-green-200 bg-green-50/30'}`}>
                <h2 className={`text-2xl font-semibold mb-4 flex items-center gap-2 ${quotaStatus.exhausted ? 'text-red-800' : 'text-green-800'}`}>
                    <ICONS.zap className="w-6 h-6" />
                    AI Статус на квота
                </h2>
                <div className="bg-white rounded-xl border p-4 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Статус на Gemini API</span>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                            quotaStatus.exhausted
                                ? 'bg-red-100 text-red-700'
                                : 'bg-green-100 text-green-700'
                        }`}>
                            {quotaStatus.exhausted ? '⛔ Исцрпена' : '✅ Активна'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Gemini reset (секој ден)</span>
                        <span className="font-semibold text-gray-700">09:00 МК (полноќ Pacific)</span>
                    </div>
                    <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-100">
                        <span className="text-gray-500">Нотификација при обновување</span>
                        {notifPermission === 'granted' ? (
                            <span className="text-xs font-bold px-3 py-1 rounded-full bg-green-100 text-green-700">✅ Овозможени</span>
                        ) : notifPermission === 'denied' ? (
                            <span className="text-xs font-semibold text-red-500">Одбиени (одбл. пребарувач)</span>
                        ) : (
                            <button
                                type="button"
                                onClick={handleEnableNotifications}
                                className="text-xs font-bold px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
                            >
                                Овозможи нотификации
                            </button>
                        )}
                    </div>
                    {quotaStatus.exhausted && (
                        <>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-500">Обновување на</span>
                                <span className="font-bold text-red-600">{quotaStatus.resetDate} во {quotaStatus.resetTime} МК</span>
                            </div>
                            {quotaStatus.source && (
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-400">Флагот зачуван во</span>
                                    <span className="font-mono text-gray-500">{quotaStatus.source}</span>
                                </div>
                            )}
                        </>
                    )}
                    <div className="pt-2 border-t border-gray-100 space-y-2">
                        <p className="text-xs text-gray-400">
                            „Очисти флаг" го брише записот за исцрпена квота. „Тестирај API" го проверува статусот директно.
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={handleClearQuotaFlag}
                                className="text-xs font-bold px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition"
                            >
                                🔄 Очисти флаг
                            </button>
                            <button
                                type="button"
                                onClick={handleTestApi}
                                disabled={isTesting}
                                className="text-xs font-bold px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition disabled:opacity-50"
                            >
                                {isTesting ? '⏳ Тестирам...' : '🔌 Тестирај API конекција'}
                            </button>
                        </div>
                        {apiTestResult && (
                            <div className={`text-xs font-mono p-2 rounded-lg break-all ${apiTestResult.startsWith('✅') ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                                {apiTestResult}
                            </div>
                        )}
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                    Gemini free tier: ~50 барања/ден. При исцрпување, AI функциите се блокирани до 09:00 МК.
                </p>
            </Card>
        </div>
    );
};
