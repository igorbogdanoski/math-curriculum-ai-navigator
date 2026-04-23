import React, { useEffect, useState } from 'react';
import { Sparkles, School, BookOpen, BarChart2, CheckCircle, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUserPreferences } from '../../contexts/UserPreferencesContext';
import type { TeachingProfile } from '../../types';
import { trackEvent } from '../../services/telemetryService';

const STYLES: { value: TeachingProfile['style']; label: string; desc: string }[] = [
    { value: 'Constructivist',    label: 'Конструктивизам',     desc: 'Учениците ги изградуваат знаењата преку искуство' },
    { value: 'Direct Instruction', label: 'Директна настава',   desc: 'Јасни објаснувања и водени вежби' },
    { value: 'Inquiry-Based',     label: 'Истражувачка настава', desc: 'Учениците поставуваат прашања и истражуваат' },
    { value: 'Project-Based',     label: 'Проектна настава',    desc: 'Длабоко учење преку реални проекти' },
];

const STEPS = [
    { title: 'Добредојдовте!',       icon: Sparkles },
    { title: 'Вашето училиште',      icon: School },
    { title: 'Ваш наставен стил',    icon: BookOpen },
    { title: 'Спремни сте!',         icon: BarChart2 },
];

interface Props {
    onClose: () => void;
}

export const TeacherOnboardingWizard: React.FC<Props> = ({ onClose }) => {
    const { user, updateProfile } = useAuth();
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState(user?.name || '');
    const [schoolName, setSchoolName] = useState(user?.schoolName || '');
    const [municipality, setMunicipality] = useState(user?.municipality || '');
    const [style, setStyle] = useState<TeachingProfile['style']>(user?.style || 'Direct Instruction');

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
                        <div className="space-y-3">
                            <p className="text-sm text-gray-600 leading-relaxed">Ви стојат на располагање:</p>
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
                </div>
            </div>
        </div>
    );
};
