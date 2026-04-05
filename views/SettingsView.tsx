
import React, { useState, useEffect } from 'react';

import { Card } from '../components/common/Card';
import { useNotification } from '../contexts/NotificationContext';
import { useAuth } from '../contexts/AuthContext';
import type { TeachingProfile, StudentProfile, SecondaryTrack } from '../types';
import { SECONDARY_TRACK_LABELS } from '../types';
import { ICONS } from '../constants';
import { InstallApp } from '../components/common/InstallApp';
import { firestoreService } from '../services/firestoreService';
import { exportUserData, downloadUserDataAsJson } from '../services/firestoreService.gdpr';
import { isFeedbackTaxonomyRolloutEnabled, setFeedbackTaxonomyRolloutEnabled } from '../services/feedbackTaxonomyRollout';
import { useUserPreferences } from '../contexts/UserPreferencesContext';
import { isDailyQuotaKnownExhausted, clearDailyQuotaFlag, scheduleQuotaNotification, getQuotaDiagnostics, isMacedonianContextEnabled, setMacedonianContextEnabled, isRecoveryWorksheetEnabled, setRecoveryWorksheetEnabled, isIntentRouterEnabled, setIntentRouterEnabled, isVertexShadowEnabled, setVertexShadowEnabled, getShadowCompareReport, clearShadowLog } from '../services/geminiService';
import type { ShadowCompareReport } from '../services/geminiService';
import { School, LogOut, CheckCircle2, Loader2, Shield, Download, Trash2, AlertTriangle, Crown, CreditCard, ExternalLink } from 'lucide-react';
import { AppError, ErrorCode } from '../utils/errors';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

const initialProfile: TeachingProfile = {
    name: '',
    style: 'Constructivist',
    experienceLevel: 'Beginner',
    studentProfiles: []
};

export const SettingsView: React.FC = () => {
    const { user, updateProfile, firebaseUser } = useAuth();
    const [confirmDialog, setConfirmDialog] = useState<{ message: string; title?: string; variant?: 'danger' | 'warning' | 'info'; onConfirm: () => void } | null>(null);
    const [profile, setProfile] = useState<TeachingProfile>(user || initialProfile);
    const [studentProfiles, setStudentProfiles] = useState<StudentProfile[]>(user?.studentProfiles || []);
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileDesc, setNewProfileDesc] = useState('');
    const [profileFormErrors, setProfileFormErrors] = useState<{ name?: string; desc?: string }>({});

    // И1 — School join state
    const [joinCodeInput, setJoinCodeInput] = useState('');
    const [joinLoading, setJoinLoading] = useState(false);
    const [joinedSchoolName, setJoinedSchoolName] = useState<string | null>(user?.schoolName ?? null);
    const [leaveLoading, setLeaveLoading] = useState(false);

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
                    addNotification('Успешно го напуштивте училиштето.', 'success');
                } catch {
                    addNotification('Грешка при напуштање. Обидете се повторно.', 'error');
                } finally {
                    setLeaveLoading(false);
                }
            }
        });
    };

    // Mock list of schools for Phase D4 (School & Admin Management)
    const MOCK_SCHOOLS = [
      { id: '', name: 'Не избрано / Друго', city: '' },
      { id: 'sch_1', name: 'ОУ „Пестар Поп Арсов“', city: 'Карпош, Скопје' },
      { id: 'sch_2', name: 'ОУ „Гоце Делчев“', city: 'Центар, Скопје' },
      { id: 'sch_3', name: 'ОУ „Братство Единство“', city: 'Охрид' },
      { id: 'sch_4', name: 'ОУ „Климент Охридски“', city: 'Битола' },
      { id: 'sch_5', name: 'ОУ „Крсте Мисирков“', city: 'Куманово' },
    ];
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
    const [mkContextEnabled, setMkContextEnabled] = useState(() => isMacedonianContextEnabled());
    const [recoveryWorksheetEnabled, setRecoveryWorksheetState] = useState(() => isRecoveryWorksheetEnabled());
    const [intentRouterEnabled, setIntentRouterState] = useState(() => isIntentRouterEnabled());
    const [feedbackTaxonomyEnabled, setFeedbackTaxonomyState] = useState(() => isFeedbackTaxonomyRolloutEnabled());
        const [vertexShadowEnabled, setVertexShadowState] = useState(() => isVertexShadowEnabled());
        const [shadowReport, setShadowReport] = useState<ShadowCompareReport | null>(null);
    const [isMentorEnabled, setIsMentorEnabled] = useState(user?.isMentor ?? false);
    useEffect(() => { setIsMentorEnabled(user?.isMentor ?? false); }, [user?.isMentor]);
    // E2.2 — Global accessibility settings
    const [dyslexicFont, setDyslexicFont] = useState(() =>
        localStorage.getItem('accessibility_dyslexic') === 'true'
    );
    const [highContrast, setHighContrast] = useState(() =>
        localStorage.getItem('accessibility_contrast') === 'true'
    );
    const { addNotification } = useNotification();
  const { resetAllTours } = useUserPreferences();
  const { deleteAccount } = useAuth();

  // Billing state
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const isPro = user?.isPremium || user?.tier === 'Pro' || user?.tier === 'Unlimited';

  const handleStripeCheckout = async () => {
    if (!firebaseUser) return;
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/stripe-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { const msg = data.error || 'Грешка.'; throw new AppError(msg, ErrorCode.UNKNOWN, msg, false); }
      if (data.url) window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Непозната грешка.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // GDPR state
  const [isExporting, setIsExporting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const DELETE_CONFIRM_PHRASE = 'ИЗБРИШИ';


    const toggleAutoAi = () => {
        const next = !autoAiEnabled;
        setAutoAiEnabled(next);
        localStorage.setItem('auto_ai_suggestions', String(next));
    };

    const toggleMkContext = () => {
        const next = !mkContextEnabled;
        setMkContextEnabled(next);
        setMacedonianContextEnabled(next);
    };

    const toggleRecoveryWorksheet = () => {
        const next = !recoveryWorksheetEnabled;
        setRecoveryWorksheetState(next);
        setRecoveryWorksheetEnabled(next);
    };
    const toggleIntentRouter = () => {
        const next = !intentRouterEnabled;
        setIntentRouterState(next);
        setIntentRouterEnabled(next);
    };
    const toggleFeedbackTaxonomy = () => {
        const next = !feedbackTaxonomyEnabled;
        setFeedbackTaxonomyState(next);
        setFeedbackTaxonomyRolloutEnabled(next);
    };

    const toggleVertexShadow = () => {
        const next = !vertexShadowEnabled;
        setVertexShadowState(next);
        setVertexShadowEnabled(next);
    };

    const loadShadowReport = () => {
        setShadowReport(getShadowCompareReport());
    };

    const handleClearShadowLog = () => {
        clearShadowLog();
        setShadowReport(null);
        addNotification('Shadow log е исчистен.', 'success');
    };

    const toggleMentor = async () => {
        if (!firebaseUser?.uid) return;
        const next = !isMentorEnabled;
        setIsMentorEnabled(next);
        try {
            await firestoreService.toggleMentorStatus(firebaseUser.uid, next);
            addNotification(next ? '🏆 Сте регистрирани како Ментор! Вашите материјали ќе добијат ментор беџ.' : 'Менторскиот статус е исклучен.', 'success');
        } catch {
            setIsMentorEnabled(!next); // revert on error
            addNotification('Грешка при промена на менторски статус.', 'error');
        }
    };

    const toggleDyslexicFont = () => {
        const next = !dyslexicFont;
        setDyslexicFont(next);
        localStorage.setItem('accessibility_dyslexic', String(next));
        if (next) {
            // Inject font if not already loaded
            if (!document.getElementById('opendyslexic-global')) {
                const link = document.createElement('link');
                link.id = 'opendyslexic-global';
                link.rel = 'stylesheet';
                link.href = 'https://cdn.jsdelivr.net/npm/open-dyslexic@1.0.3/open-dyslexic-all.min.css';
                document.head.appendChild(link);
            }
            document.documentElement.classList.add('dyslexic-font');
        } else {
            document.documentElement.classList.remove('dyslexic-font');
        }
    };

    const toggleHighContrast = () => {
        const next = !highContrast;
        setHighContrast(next);
        localStorage.setItem('accessibility_contrast', String(next));
        document.documentElement.classList.toggle('high-contrast', next);
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
                    model: 'gemini-2.5-flash',
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
        const errs: { name?: string; desc?: string } = {};
        if (!newProfileName.trim()) errs.name = 'Внесете ime на профилот.';
        if (!newProfileDesc.trim()) errs.desc = 'Внесете опис на профилот.';
        if (Object.keys(errs).length > 0) { setProfileFormErrors(errs); return; }
        setProfileFormErrors({});
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

    const handleExportData = async () => {
        if (!firebaseUser?.uid) return;
        setIsExporting(true);
        try {
            const data = await exportUserData(firebaseUser.uid);
            downloadUserDataAsJson(data, firebaseUser.uid);
            const warnings = Array.isArray((data as any).exportWarnings) ? (data as any).exportWarnings : [];
            if (warnings.length > 0) {
                addNotification(`Податоците се преземени со ${warnings.length} предупредувања. Проверете го полето "exportWarnings" во JSON.`, 'warning');
            } else {
                addNotification('Вашите податоци се преземени успешно.', 'success');
            }
        } catch (err: any) {
            const code = err?.code ? String(err.code) : '';
            const message = err?.message ? String(err.message) : '';
            if (code.includes('permission-denied')) {
                addNotification('Грешка при извоз: немате дозвола за дел од податоците. Обидете се повторно по refresh/login.', 'error');
            } else if (message) {
                addNotification(`Грешка при извоз на податоците: ${message}`, 'error');
            } else {
                addNotification('Грешка при извоз на податоците. Обидете се повторно.', 'error');
            }
            console.error('GDPR export failed:', err);
        } finally {
            setIsExporting(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== DELETE_CONFIRM_PHRASE) return;
        setIsDeletingAccount(true);
        try {
            await deleteAccount();
            // onAuthStateChanged will handle redirect to login
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Непозната грешка.';
            // Firebase requires recent login for deleteUser
            if (msg.includes('requires-recent-login') || msg.includes('recent')) {
                addNotification('За безбедност, прво одјавете се и повторно најавете се, па обидете се повторно.', 'warning');
            } else {
                addNotification(`Грешка при бришење: ${msg}`, 'error');
            }
            setIsDeletingAccount(false);
        }
    };

    const handleMigrateCurriculum = () => {
        setConfirmDialog({
            message: "Дали сте сигурни дека сакате да ја пополните Firestore базата со локалната наставна програма? Ова ќе ги пребрише постоечките податоци во 'curriculum/v1'.",
            variant: 'warning',
            onConfirm: async () => {
                setConfirmDialog(null);
                setIsMigrating(true);
                try {
                    const { fullCurriculumData } = await import('../data/curriculum');
                    await firestoreService.saveFullCurriculum(fullCurriculumData);
                    addNotification('Наставната програма е успешно префрлена во Firestore!', 'success');
                } catch (error) {
                    addNotification('Грешка при миграција на податоците.', 'error');
                    console.error("Migration failed:", error);
                } finally {
                    setIsMigrating(false);
                }
            }
        });
    };

    if (!user) {
        return null; // Should not be rendered when not authenticated
    }

    return (
        <>
        <div className="p-8 animate-fade-in space-y-8">
            <header className="mb-6">
                <h1 className="text-4xl font-bold text-brand-primary">Поставки</h1>
                <p className="text-lg text-gray-600 mt-2">Прилагодете го вашето искуство во апликацијата.</p>
            </header>

            
              <Card className="max-w-2xl mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-brand-primary">Туторијали на системот</h2>
                        <p className="text-gray-600 text-sm mt-1">Ресетирај ги сите туторијали за да ги видите новите функционалности низ сите екрани.</p>
                    </div>
                    <button
                        onClick={() => {
                            resetAllTours();
                            addNotification('Туторијалите се ресетирани! Одете на почетната страна.', 'success');
                        }}
                        className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-xl font-medium transition-colors"
                    >
                        Ресетирај
                    </button>
                </div>
              </Card>
{/* А: Firebase UID — за bootstrap на admin улога */}
            {firebaseUser?.uid && (
              <Card className="max-w-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-700 flex items-center gap-2">
                      🛡️ Твојот Firebase UID
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Потребен за поставување на admin улога преку Firebase Console (еднаш).
                    </p>
                    <p className="mt-2 font-mono text-xs text-gray-800 bg-gray-100 px-3 py-2 rounded-lg break-all select-all">
                      {firebaseUser.uid}
                    </p>
                  </div>
                </div>
              </Card>
            )}

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
                        <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700">Училиште (за експорт на документи)</label>
                        <input
                            type="text"
                            id="schoolName"
                            name="schoolName"
                            value={profile.schoolName || ''}
                            onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                            placeholder="ОУ „..."
                        />
                    </div>
                    <div>
                        <label htmlFor="municipality" className="block text-sm font-medium text-gray-700">Општина/Град (за експорт на документи)</label>
                        <input
                            type="text"
                            id="municipality"
                            name="municipality"
                            value={profile.municipality || ''}
                            onChange={handleChange}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                            placeholder="пр. Карпош, Скопје"
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
                    {/* Н4 — Secondary track selector */}
                    <div>
                        <label htmlFor="secondaryTrack" className="block text-sm font-medium text-gray-700">
                            Тип на образование
                        </label>
                        <p className="text-xs text-gray-500 mb-1">
                            Изберете средно образование ако предавате во гимназија или стручно училиште (одд. X–XII).
                            Стручните програми се во БЕТА фаза — содржината е во подготовка.
                        </p>
                        <select
                            id="secondaryTrack"
                            value={profile.secondaryTrack ?? ''}
                            onChange={(e) => {
                                const val = e.target.value as SecondaryTrack | '';
                                setProfile((prev: TeachingProfile) => ({
                                    ...prev,
                                    secondaryTrack: val === '' ? undefined : val,
                                }));
                            }}
                            className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm"
                        >
                            <option value="">Основно (одд. I–IX)</option>
                            {(Object.entries(SECONDARY_TRACK_LABELS) as [SecondaryTrack, string][]).map(
                                ([key, label]) => (
                                    <option key={key} value={key}>
                                        {label}{(key === 'vocational4' || key === 'vocational3') ? ' (БЕТА)' : ''}
                                    </option>
                                )
                            )}
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
                    <div className="flex items-center justify-between py-3 border-t">
                        <div>
                            <p className="text-sm font-medium text-gray-700">🇲🇰 Македонски контекст во AI</p>
                            <p className="text-xs text-gray-500 mt-0.5">AI генераторот ќе користи денари, македонски имиња, градови и примери од секојдневниот живот</p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleMkContext}
                            title={mkContextEnabled ? 'Исклучи македонски контекст' : 'Вклучи македонски контекст'}
                            aria-label={mkContextEnabled ? 'Исклучи македонски контекст' : 'Вклучи македонски контекст'}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${mkContextEnabled ? 'bg-brand-primary' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${mkContextEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between py-3 border-t">
                        <div>
                            <p className="text-sm font-medium text-gray-700">⚡ Intent Router (E3)</p>
                            <p className="text-xs text-gray-500 mt-0.5">Рутира едноставни AI задачи (аналогии, наслови, мисконцепции) на побрз/поефтин Gemini Lite модел.</p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleIntentRouter}
                            title={intentRouterEnabled ? 'Исклучи Intent Router' : 'Вклучи Intent Router'}
                            aria-label={intentRouterEnabled ? 'Исклучи Intent Router' : 'Вклучи Intent Router'}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${intentRouterEnabled ? 'bg-violet-600' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${intentRouterEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between py-3 border-t">
                        <div>
                            <p className="text-sm font-medium text-gray-700">🩹 Recovery Worksheet (E2)</p>
                            <p className="text-xs text-gray-500 mt-0.5">Analytics ќе отвори preview + teacher confirm flow за worksheet со одобрување пред доделување.</p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleRecoveryWorksheet}
                            title={recoveryWorksheetEnabled ? 'Исклучи recovery worksheet flow' : 'Вклучи recovery worksheet flow'}
                            aria-label={recoveryWorksheetEnabled ? 'Исклучи recovery worksheet flow' : 'Вклучи recovery worksheet flow'}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${recoveryWorksheetEnabled ? 'bg-emerald-600' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${recoveryWorksheetEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between py-3 border-t">
                        <div>
                            <p className="text-sm font-medium text-gray-700">🧭 Feedback Taxonomy Rollout (E5-C3)</p>
                            <p className="text-xs text-gray-500 mt-0.5">Structured reject/revision reasons + analytics breakdown. OFF = legacy reject path без taxonomy analytics.</p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleFeedbackTaxonomy}
                            title={feedbackTaxonomyEnabled ? 'Исклучи feedback taxonomy rollout' : 'Вклучи feedback taxonomy rollout'}
                            aria-label={feedbackTaxonomyEnabled ? 'Исклучи feedback taxonomy rollout' : 'Вклучи feedback taxonomy rollout'}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${feedbackTaxonomyEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${feedbackTaxonomyEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between py-3 border-t">
                        <div>
                            <p className="text-sm font-medium text-gray-700">🔬 Vertex AI Shadow Mode (E4)</p>
                            <p className="text-xs text-gray-500 mt-0.5">Секој AI повик испраќа паралелен shadow повик до Vertex AI proxy. Резултатот не се користи — само метрики (latency/status) се логираат.</p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleVertexShadow}
                            title={vertexShadowEnabled ? 'Исклучи Vertex Shadow Mode' : 'Вклучи Vertex Shadow Mode'}
                            aria-label={vertexShadowEnabled ? 'Исклучи Vertex Shadow Mode' : 'Вклучи Vertex Shadow Mode'}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${vertexShadowEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${vertexShadowEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {vertexShadowEnabled && (
                        <div className="py-3 border-t space-y-2">
                            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">E4 Compare Report</p>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={loadShadowReport}
                                    className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                                >
                                    Прикажи извештај
                                </button>
                                <button
                                    type="button"
                                    onClick={handleClearShadowLog}
                                    className="text-xs px-3 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                >
                                    Исчисти лог
                                </button>
                            </div>
                            {shadowReport && (
                                <div className="mt-2 overflow-x-auto rounded border border-blue-100 bg-blue-50 text-xs">
                                    {shadowReport.sampleSize === 0 ? (
                                        <p className="p-3 text-gray-500">Нема логови. Вклучи shadow mode и изврши неколку AI повици.</p>
                                    ) : (
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-blue-200">
                                                    <th className="px-3 py-2 font-semibold text-blue-800">Метрика</th>
                                                    <th className="px-3 py-2 font-semibold text-blue-800">Gemini (prod)</th>
                                                    <th className="px-3 py-2 font-semibold text-blue-800">Vertex (shadow)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-blue-100">
                                                <tr>
                                                    <td className="px-3 py-2 text-gray-600">Примероци</td>
                                                    <td className="px-3 py-2">{shadowReport.sampleSize}</td>
                                                    <td className="px-3 py-2">{shadowReport.sampleSize}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-2 text-gray-600">Prosечна латентност</td>
                                                    <td className="px-3 py-2">{shadowReport.geminiAvgLatencyMs} ms</td>
                                                    <td className="px-3 py-2">{shadowReport.vertexAvgLatencyMs !== null ? `${shadowReport.vertexAvgLatencyMs} ms` : '—'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-2 text-gray-600">Успешност</td>
                                                    <td className="px-3 py-2">100%</td>
                                                    <td className="px-3 py-2">{(shadowReport.vertexSuccessRate * 100).toFixed(0)}%</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-2 text-gray-600">Грешки</td>
                                                    <td className="px-3 py-2">—</td>
                                                    <td className="px-3 py-2">{(shadowReport.vertexErrorRate * 100).toFixed(0)}%</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-2 text-gray-600">Not configured</td>
                                                    <td className="px-3 py-2">—</td>
                                                    <td className="px-3 py-2">{(shadowReport.vertexNotConfiguredRate * 100).toFixed(0)}%</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-3 py-2 text-gray-600">Релативна цена</td>
                                                    <td className="px-3 py-2">1.00×</td>
                                                    <td className="px-3 py-2">{shadowReport.vertexRelativeCost !== null ? `~${shadowReport.vertexRelativeCost.toFixed(2)}×` : '—'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex items-center justify-between py-3 border-t">
                        <div>
                            <p className="text-sm font-medium text-gray-700">🏆 Ментор статус</p>
                            <p className="text-xs text-gray-500 mt-0.5">Вашите материјали во Националната библиотека ќе добијат ментор беџ. Колегите можат да учат од вашето искуство.</p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleMentor}
                            title={isMentorEnabled ? 'Исклучи ментор статус' : 'Стани ментор'}
                            aria-label={isMentorEnabled ? 'Исклучи ментор статус' : 'Стани ментор'}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isMentorEnabled ? 'bg-amber-500' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isMentorEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
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
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setNewProfileName(e.target.value); setProfileFormErrors(p => ({ ...p, name: '' })); }}
                                className={`mt-1 block w-full p-2 border rounded-md ${profileFormErrors.name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                placeholder="Ученик А"
                            />
                            {profileFormErrors.name && <p className="text-[11px] text-red-500 mt-1">{profileFormErrors.name}</p>}
                        </div>
                         <div>
                            <label htmlFor="newProfileDesc" className="block text-xs font-medium text-gray-600">Краток опис на потреби/стил на учење</label>
                            <textarea
                                id="newProfileDesc"
                                value={newProfileDesc}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => { setNewProfileDesc(e.target.value); setProfileFormErrors(p => ({ ...p, desc: '' })); }}
                                rows={2}
                                className={`mt-1 block w-full p-2 border rounded-md ${profileFormErrors.desc ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                                placeholder="пр. Визуелен тип, подобро учи со слики. Потребна му е поддршка со текстуални задачи."
                            />
                            {profileFormErrors.desc && <p className="text-[11px] text-red-500 mt-1">{profileFormErrors.desc}</p>}
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
                                        <button type="button" aria-label={`Избриши профил: ${p.name}`} onClick={() => handleDeleteProfile(p.id)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full flex-shrink-0 ml-2">
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
                            <p className="text-xs text-gray-500 mt-1">Верзија: v2 (Сите одделенија 1-9)</p>
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

            {/* ── E2.2: Пристапност (Accessibility) ── */}
            <Card className="max-w-2xl border-teal-200 bg-teal-50/20">
                <h2 className="text-2xl font-semibold text-teal-800 mb-1 flex items-center gap-2">
                    👁️ Пристапност
                </h2>
                <p className="text-sm text-teal-600 mb-4">Поставки за читање и визуелни помошници.</p>
                <div className="space-y-3">
                    {/* OpenDyslexic font */}
                    <div className="flex items-center justify-between bg-white border border-teal-100 rounded-xl px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">OpenDyslexic фонт</p>
                            <p className="text-xs text-gray-500 mt-0.5">Глобална замена на фонтот — олеснува читање за ученици со дислексија.</p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleDyslexicFont}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dyslexicFont ? 'bg-teal-500' : 'bg-gray-200'}`}
                            aria-label={dyslexicFont ? 'Исклучи OpenDyslexic фонт' : 'Вклучи OpenDyslexic фонт'}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${dyslexicFont ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                    {/* High contrast */}
                    <div className="flex items-center justify-between bg-white border border-teal-100 rounded-xl px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Зголемен контраст</p>
                            <p className="text-xs text-gray-500 mt-0.5">Зголемен контраст и заситеност за подобра читливост.</p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleHighContrast}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${highContrast ? 'bg-teal-500' : 'bg-gray-200'}`}
                            aria-label={highContrast ? 'Исклучи зголемен контраст' : 'Вклучи зголемен контраст'}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${highContrast ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                    Поставките се зачувуваат локално и се применуваат веднаш низ целата апликација.
                </p>
            </Card>

            {/* Н2 — Billing / Претплата */}
            <Card className={`max-w-2xl ${isPro ? 'border-indigo-200 bg-indigo-50/20' : 'border-slate-200'}`}>
                <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2 text-indigo-800">
                    <Crown className="w-6 h-6" />
                    Претплата
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                    Тековен план и управување со претплата.{' '}
                    <a href="#/pricing" className="text-indigo-600 hover:underline font-medium">
                        Погледни ги сите планови
                    </a>
                </p>

                <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-slate-600">Тековен план</p>
                        <div className="flex items-center gap-2 mt-1">
                            {isPro ? (
                                <>
                                    <Crown className="w-5 h-5 text-indigo-600" />
                                    <span className="font-bold text-indigo-700 text-lg">Pro Наставник</span>
                                </>
                            ) : (
                                <span className="font-semibold text-slate-700 text-lg">Бесплатно</span>
                            )}
                        </div>
                        {!isPro && (
                            <p className="text-xs text-slate-400 mt-1">
                                Останато кредити: <strong>{user?.aiCreditsBalance ?? 0}</strong>
                            </p>
                        )}
                    </div>
                    {isPro ? (
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">✅ Активно</span>
                    ) : (
                        <button
                            type="button"
                            onClick={handleStripeCheckout}
                            disabled={checkoutLoading}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            {checkoutLoading ? 'Се подготвува...' : 'Надгради на Pro'}
                        </button>
                    )}
                </div>

                {checkoutError && (
                    <p className="text-red-500 text-xs mb-3">{checkoutError}</p>
                )}

                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <ExternalLink className="w-4 h-4" />
                    <a href="#/pricing" className="text-indigo-600 hover:underline">
                        Целосна споредба на планови →
                    </a>
                </div>
            </Card>

            {/* Н1 — GDPR / Приватност */}
            <Card className="max-w-2xl border-slate-200">
                <h2 className="text-2xl font-semibold text-slate-800 mb-1 flex items-center gap-2">
                    <Shield className="w-6 h-6 text-slate-600" />
                    Приватност и ГДПР (ЗЗЛП)
                </h2>
                <p className="text-sm text-slate-500 mb-5">
                    Во согласност со Законот за заштита на личните податоци, имате право да ги преземете или избришете сите ваши податоци.{' '}
                    <a href="#/privacy" className="text-indigo-600 hover:underline font-medium">Политика за приватност</a>
                </p>

                {/* Export */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <Download className="w-4 h-4" />
                                Преземи ги моите податоци
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                                Квизови, материјали, планови, чет сесии — сè во JSON формат.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleExportData}
                            disabled={isExporting}
                            className="px-4 py-2 bg-slate-700 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center gap-2 flex-shrink-0"
                        >
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isExporting ? 'Извезувам...' : 'Преземи'}
                        </button>
                    </div>
                </div>

                {/* Delete Account */}
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h3 className="font-semibold text-red-800 flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        Избриши акаунт
                    </h3>
                    <p className="text-xs text-red-700 mb-3">
                        Ова е <strong>неповратна акција</strong>. Сите ваши податоци, материјали, квизови и резултати ќе бидат трајно избришани.
                    </p>
                    <p className="text-xs text-slate-600 mb-2">
                        За потврда напишете <strong className="font-mono">{DELETE_CONFIRM_PHRASE}</strong> подолу:
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={e => setDeleteConfirmText(e.target.value.toUpperCase())}
                            placeholder={DELETE_CONFIRM_PHRASE}
                            className="flex-1 px-3 py-2 border border-red-300 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                        <button
                            type="button"
                            onClick={handleDeleteAccount}
                            disabled={isDeletingAccount || deleteConfirmText !== DELETE_CONFIRM_PHRASE}
                            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center gap-2 flex-shrink-0"
                        >
                            {isDeletingAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            {isDeletingAccount ? 'Бришам...' : 'Избриши акаунт'}
                        </button>
                    </div>
                </div>
            </Card>

            {/* И1 — School Join Card */}
            <Card className="max-w-2xl border-blue-200 bg-blue-50/20">
                <h2 className="text-2xl font-semibold text-blue-800 mb-1 flex items-center gap-2">
                    <School className="w-6 h-6" />
                    Приклучи се кон училиште
                </h2>
                <p className="text-sm text-blue-600 mb-4">
                    Добијте код од директорот/администраторот на вашето училиште и внесете го подолу.
                </p>

                {joinedSchoolName ? (
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
        </div>
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

