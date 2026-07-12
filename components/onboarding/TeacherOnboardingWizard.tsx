import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, School, BookOpen, BarChart2, CheckCircle, ChevronRight, ChevronLeft, X, Users, Copy, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { TeachingProfile } from '../../types';
import { trackEvent } from '../../services/telemetryService';
import { createClass, generateClassJoinCode } from '../../services/firestoreService.classroom';

const STYLES: { value: TeachingProfile['style']; label: string; desc: string }[] = [
    { value: 'Constructivist',    label: 'Конструктивизам',     desc: 'Учениците ги изградуваат знаењата преку искуство' },
    { value: 'Direct Instruction', label: 'Директна настава',   desc: 'Јасни објаснувања и водени вежби' },
    { value: 'Inquiry-Based',     label: 'Истражувачка настава', desc: 'Учениците поставуваат прашања и истражуваат' },
    { value: 'Project-Based',     label: 'Проектна настава',    desc: 'Длабоко учење преку реални проекти' },
];

const STEPS = [
    { title: 'Добредојдовте!',    icon: Sparkles },
    { title: 'Вашето училиште',   icon: School },
    { title: 'Наставен стил',     icon: BookOpen },
    { title: 'Создај прв час',    icon: Users },
    { title: 'Спремни сте!',      icon: BarChart2 },
];

const GRADE_GROUPS = [
    { label: 'Основно', grades: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { label: 'Средно',  grades: [10, 11, 12] },
];

interface Props {
    onClose: () => void;
}

export const TeacherOnboardingWizard: React.FC<Props> = ({ onClose }) => {
    const { user, firebaseUser, updateProfile } = useAuth();
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState(user?.name || '');
    const [schoolName, setSchoolName] = useState(user?.schoolName || '');
    const [municipality, setMunicipality] = useState(user?.municipality || '');
    const [style, setStyle] = useState<TeachingProfile['style']>(user?.style || 'Direct Instruction');

    // Step 3 — class creation
    const [classGrade, setClassGrade] = useState(7);
    const [className, setClassName] = useState(`Математика 7 одд.`);
    const [classCreating, setClassCreating] = useState(false);
    const [createdJoinCode, setCreatedJoinCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const classNameTouched = useRef(false);

    const isLast = step === STEPS.length - 1;
    const StepIcon = STEPS[step].icon;

    // S39-F3: telemetry — onboarding_started fires once on mount
    useEffect(() => {
        trackEvent('onboarding_started', { wizard: 'teacher', totalSteps: STEPS.length });
    }, []);

    const handleSkip = () => {
        trackEvent('onboarding_skipped', { wizard: 'teacher', atStep: step });
        onClose();
    };

    const handleFinish = async () => {
        if (!user) { onClose(); return; }
        setSaving(true);
        try {
            await updateProfile({
                ...user,
                name: name.trim() || user.name,
                schoolName: schoolName.trim() || user.schoolName,
                municipality: municipality.trim() || user.municipality,
                style,
            });
            trackEvent('onboarding_completed', {
                wizard: 'teacher',
                hasSchool: Boolean(schoolName.trim()),
                style,
            });
        } catch {
            // Non-fatal
        } finally {
            setSaving(false);
            onClose();
        }
    };

    const handleGradeChange = (g: number) => {
        setClassGrade(g);
        if (!classNameTouched.current) setClassName(`Математика ${g} одд.`);
    };

    const handleCreateClass = async () => {
        if (!firebaseUser?.uid) { setStep(s => s + 1); return; }
        setClassCreating(true);
        try {
            const id = await createClass({
                name: className.trim() || `Математика ${classGrade} одд.`,
                gradeLevel: classGrade,
                teacherUid: firebaseUser.uid,
                studentNames: [],
            });
            const code = await generateClassJoinCode(id);
            setCreatedJoinCode(code);
            trackEvent('onboarding_class_created', { gradeLevel: classGrade });
        } catch {
            // Non-fatal — just advance
        } finally {
            setClassCreating(false);
            setStep(s => s + 1);
        }
    };

    const handleCopyJoinCode = () => {
        if (!createdJoinCode) return;
        navigator.clipboard.writeText(createdJoinCode).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleNext = () => {
        if (isLast) { handleFinish(); } else { setStep(s => s + 1); }
    };

    return (
        <div id="e2e-onboarding-wizard" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Progress bar */}
                <div className="h-1.5 bg-gray-100">
                    <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
                        style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                    />
                </div>

                {/* Header */}
                <div className="px-8 pt-7 pb-4 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <StepIcon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Чекор {step + 1} / {STEPS.length}</p>
                            <h2 className="text-lg font-bold text-gray-800">{STEPS[step].title}</h2>
                        </div>
                    </div>
                    <button type="button" onClick={handleSkip} title="Прескокни" className="text-gray-300 hover:text-gray-500 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-8 pb-6 min-h-[220px]">
                    {step === 0 && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 leading-relaxed">
                                Ви е потребна само 1 минута за да го поставите вашиот профил. Ова ни помага да ги персонализираме AI препораките за вас.
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Вашето ime</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="пр. Марија Стојановска"
                                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                                    autoFocus
                                />
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">Опционално — се користи за официјалните документи (дневни подготовки).</p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Училиште</label>
                                <input
                                    type="text"
                                    value={schoolName}
                                    onChange={e => setSchoolName(e.target.value)}
                                    placeholder='пр. ОУ „Кирил и Методиј"'
                                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Општина</label>
                                <input
                                    type="text"
                                    value={municipality}
                                    onChange={e => setMunicipality(e.target.value)}
                                    placeholder="пр. Скопје"
                                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-2.5">
                            <p className="text-sm text-gray-500 mb-3">AI-от ги прилагодува препораките според вашиот стил.</p>
                            {STYLES.map(s => (
                                <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => setStyle(s.value)}
                                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                                        style === s.value
                                            ? 'border-indigo-500 bg-indigo-50'
                                            : 'border-gray-100 hover:border-gray-200 bg-white'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {style === s.value && <CheckCircle className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                                        <div>
                                            <p className={`text-sm font-semibold ${style === s.value ? 'text-indigo-700' : 'text-gray-700'}`}>{s.label}</p>
                                            <p className="text-xs text-gray-400">{s.desc}</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-500">Опционално — можете да прескокнете и подоцна да создадете час.</p>

                            {/* Grade picker */}
                            <div>
                                <p className="text-xs font-semibold text-gray-600 mb-2">Одделение / Година</p>
                                {GRADE_GROUPS.map(g => (
                                    <div key={g.label} className="mb-2">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{g.label}</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {g.grades.map(gr => (
                                                <button key={gr} type="button"
                                                    onClick={() => handleGradeChange(gr)}
                                                    className={`w-9 h-9 rounded-lg text-sm font-bold border-2 transition ${
                                                        classGrade === gr
                                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                                            : 'border-gray-200 text-gray-500 hover:border-indigo-300'
                                                    }`}>
                                                    {gr}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Class name */}
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Назив на часот</label>
                                <input
                                    type="text"
                                    value={className}
                                    onChange={e => { classNameTouched.current = true; setClassName(e.target.value); }}
                                    placeholder={`пр. Математика ${classGrade} одд.`}
                                    className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                                />
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-3">
                            {/* Join code (shown only if class was created) */}
                            {createdJoinCode && (
                                <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4">
                                    <p className="text-xs font-bold text-indigo-600 uppercase mb-2">Код за приклучување</p>
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-3xl font-black text-indigo-700 tracking-[0.25em]">{createdJoinCode}</span>
                                        <button type="button" onClick={handleCopyJoinCode}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-xs font-bold transition">
                                            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                            {copied ? 'Копирано!' : 'Копирај'}
                                        </button>
                                    </div>
                                    <p className="text-xs text-indigo-500 mt-1">Споделете го со учениците на mk.ai (или преку Classroom)</p>
                                </div>
                            )}

                            {/* Features */}
                            <p className="text-sm text-gray-600">Ви стојат на располагање:</p>
                            {[
                                { icon: Sparkles, label: 'AI Генератор', desc: 'Квизови, проценки, работни листови за секунди' },
                                { icon: BookOpen,  label: 'Планер',       desc: 'Дневни подготовки со Bloom таксономија' },
                                { icon: BarChart2, label: 'Аналитика',    desc: '14 табови со детален увид во напредокот' },
                            ].map(f => (
                                <div key={f.label} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-2.5">
                                    <f.icon className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold text-gray-700">{f.label}</p>
                                        <p className="text-xs text-gray-400">{f.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 pb-7 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={() => setStep(s => s - 1)}
                        disabled={step === 0}
                        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 disabled:opacity-0 transition"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Назад
                    </button>

                    {step === 3 ? (
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setStep(4)}
                                className="text-xs text-gray-400 hover:text-gray-600 transition">
                                Прескокни
                            </button>
                            <button type="button" onClick={handleCreateClass} disabled={classCreating}
                                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-60">
                                {classCreating ? 'Создавање...' : 'Создај час'}
                                {!classCreating && <Users className="w-4 h-4" />}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={handleNext}
                            disabled={saving}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition disabled:opacity-60"
                        >
                            {saving ? 'Зачувување...' : isLast ? 'Почни!' : 'Следно'}
                            {!saving && !isLast && <ChevronRight className="w-4 h-4" />}
                            {!saving && isLast && <CheckCircle className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
