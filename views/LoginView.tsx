import { logger } from '../utils/logger';
import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { ICONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';
import type { User } from "firebase/auth";
import { trackEvent } from '../services/telemetryService';
import { isDemoMode, getDemoCredentials } from '../services/demoMode';
import { Zap, BarChart2, BookOpen, Languages, ShieldCheck, GraduationCap, Star } from 'lucide-react';

// Google logo SVG
const GoogleIcon = () => (
    <svg viewBox="0 0 48 48" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.1 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.8 7.1 29.2 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-4.5z"/>
        <path fill="#FF3D00" d="M6.3 15.1l6.6 4.8C14.5 16.2 18.9 13 24 13c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.8 7.1 29.2 5 24 5 16.3 5 9.7 9.1 6.3 15.1z"/>
        <path fill="#4CAF50" d="M24 45c5.2 0 9.8-2 13.2-5.2l-6.1-5.2C29.3 36.3 26.8 37 24 37c-5.2 0-9.7-2.9-11.3-7H6.1C9.3 40 16.1 45 24 45z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.1 5.2C40.9 35.8 44 30.9 44 25c0-1.3-.1-2.6-.4-4.5z"/>
    </svg>
);

const MisMathLogo: React.FC<{ size?: 'sm' | 'md' | 'lg'; inverted?: boolean }> = ({ size = 'md', inverted = false }) => {
    const iconSize = size === 'sm' ? 'w-7 h-7 text-sm' : size === 'lg' ? 'w-12 h-12 text-xl' : 'w-9 h-9 text-base';
    const textSize = size === 'sm' ? 'text-lg' : size === 'lg' ? 'text-3xl' : 'text-2xl';
    const textColor = inverted ? 'text-white' : 'text-brand-primary';
    const subColor = inverted ? 'text-blue-200' : 'text-brand-secondary';
    const badgeBg = inverted ? 'bg-white/20 text-white' : 'bg-brand-primary text-white';
    return (
        <div className="flex items-center gap-2.5">
            <div className={`${iconSize} bg-white rounded-xl flex items-center justify-center shadow-md flex-shrink-0`}>
                <span className="text-brand-primary font-black leading-none select-none">M</span>
            </div>
            <div>
                <span className={`${textSize} font-black leading-none ${textColor}`}>Mis</span>
                <span className={`${textSize} font-black leading-none ${subColor}`}>Math</span>
                <span className={`ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded align-middle ${badgeBg}`}>AI</span>
            </div>
        </div>
    );
};

// ─── Marketing / Hero panel ──────────────────────────────────────────────────

const FEATURES = [
    { icon: Zap,           color: 'bg-amber-400/20 text-amber-300',   text: 'Тест, план или материјал за 60 секунди' },
    { icon: GraduationCap, color: 'bg-violet-400/20 text-violet-300', text: '378 матурски прашања + AI тутор за подготовка' },
    { icon: BookOpen,      color: 'bg-emerald-400/20 text-emerald-300',text: 'МОН + БРО стандарди вградени во секој материјал' },
    { icon: Languages,     color: 'bg-sky-400/20 text-sky-300',       text: '4 јазици: МК · СК · ТР · EN' },
];

const STATS = [
    { value: '500+', label: 'наставници' },
    { value: '10К+', label: 'материјали' },
    { value: '9',    label: 'одделенија' },
];

const MarketingPanel: React.FC = () => (
    <div className="login-hero-panel hidden lg:flex lg:w-[56%] xl:w-[58%] flex-col justify-between relative overflow-hidden">

        {/* Decorative blobs */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="login-hero-blob-top absolute -top-40 -right-40 w-96 h-96 rounded-full" />
            <div className="login-hero-blob-bottom absolute bottom-0 -left-20 w-80 h-80 rounded-full" />
            <div className="login-hero-blob-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full" />
        </div>

        <div className="relative z-10 flex flex-col h-full p-8 xl:p-12">

            {/* Logo */}
            <div className="mb-10 xl:mb-14">
                <MisMathLogo size="md" inverted />
            </div>

            {/* Hero headline */}
            <div className="mb-8 xl:mb-10">
                <h2 className="text-3xl xl:text-4xl 2xl:text-5xl font-black text-white leading-[1.15] tracking-tight mb-4">
                    Заштеди{' '}
                    <span className="relative">
                        <span className="login-hero-headline-gradient relative z-10 text-transparent bg-clip-text">
                            8 часа
                        </span>
                    </span>
                    {' '}секоја недела.
                </h2>
                <p className="text-blue-200 text-base xl:text-lg leading-relaxed max-w-sm">
                    AI асистент за наставници по математика. Материјали, тестови, планирања — за минути, не часови.
                </p>
            </div>

            {/* Feature list */}
            <div className="space-y-3 mb-8 xl:mb-10">
                {FEATURES.map(({ icon: Icon, color, text }) => (
                    <div key={text} className="flex items-center gap-3.5">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-white/85 text-sm font-medium">{text}</span>
                    </div>
                ))}
            </div>

            {/* Testimonial */}
            <div className="login-testimonial-card mb-8 xl:mb-10 p-4 xl:p-5 rounded-2xl border border-white/10">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">М</span>
                    </div>
                    <div>
                        <div className="flex gap-0.5 mb-1.5">
                            {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 text-amber-400 fill-amber-400" />)}
                        </div>
                        <p className="text-white/90 text-sm leading-relaxed italic">
                            „MisMath ми врати 2 часа секој ден. Конечно имам кревање за учениците, не за документи."
                        </p>
                        <p className="text-blue-300 text-xs mt-2 font-medium">Марија К. — наставник по математика, Скопје</p>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="mt-auto pt-6 border-t border-white/10">
                <div className="grid grid-cols-3 gap-4 mb-5">
                    {STATS.map(({ value, label }) => (
                        <div key={label}>
                            <div className="text-2xl xl:text-3xl font-black text-white">{value}</div>
                            <div className="text-blue-300 text-xs mt-0.5 font-medium">{label}</div>
                        </div>
                    ))}
                </div>
                <a href="#/pricing" className="inline-flex items-center gap-1.5 text-violet-300 hover:text-white text-sm font-semibold transition-colors group">
                    Погледај ги цените
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                </a>
            </div>
        </div>
    </div>
);

// ─── Shared field components ─────────────────────────────────────────────────

const InputField: React.FC<{
    id: string;
    label: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
    minLength?: number;
    autoFocus?: boolean;
    placeholder?: string;
    rightSlot?: React.ReactNode;
}> = ({ id, label, type = 'text', value, onChange, required, minLength, autoFocus, placeholder, rightSlot }) => (
    <div>
        <div className="flex items-center justify-between mb-1">
            <label htmlFor={id} className="text-sm font-semibold text-slate-700">{label}</label>
            {rightSlot}
        </div>
        <input
            id={id} type={type} value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            placeholder={placeholder}
            className="block w-full px-3.5 py-2.5 text-slate-900 bg-slate-50 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-secondary/40 focus:border-brand-secondary transition-all"
            required={required} minLength={minLength} autoFocus={autoFocus}
        />
    </div>
);

// ─── Login form ──────────────────────────────────────────────────────────────

const LoginForm: React.FC<{
    email: string; setEmail: (v: string) => void;
    password: string; setPassword: (v: string) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    isLoading: boolean; error: string;
    onSwitchToReset: () => void;
    onGoogleLogin: () => void; isGoogleLoading: boolean;
}> = ({ email, setEmail, password, setPassword, handleSubmit, isLoading, error, onSwitchToReset, onGoogleLogin, isGoogleLoading }) => (
    <div className="space-y-4 animate-fade-in">
        <GoogleButton onClick={onGoogleLogin} isLoading={isGoogleLoading} disabled={isLoading} label="Продолжи со Google" />
        <Divider />
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <InputField id="login-email" label="Е-пошта" type="email" value={email} onChange={setEmail} required placeholder="vashata@email.com" />
            <InputField
                id="login-password" label="Лозинка" type="password" value={password} onChange={setPassword} required
                rightSlot={
                    <button type="button" onClick={onSwitchToReset} className="text-xs font-semibold text-brand-secondary hover:text-brand-primary transition-colors">
                        Заборавена?
                    </button>
                }
            />
            {error && <ErrorBox message={error} />}
            <SubmitButton isLoading={isLoading} label="Најави се" />
        </form>
        <LoginFooter />
    </div>
);

// ─── Register form ────────────────────────────────────────────────────────────

const RegisterForm: React.FC<{
    name: string; setName: (v: string) => void;
    email: string; setEmail: (v: string) => void;
    password: string; setPassword: (v: string) => void;
    repeatPassword: string; setRepeatPassword: (v: string) => void;
    schoolId: string; setSchoolId: (v: string) => void;
    schoolName: string; setSchoolName: (v: string) => void;
    schools: any[]; schoolsLoading: boolean;
    photoPreview: string | null; handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    isLoading: boolean; error: string; successMessage: string;
    onGoogleLogin: () => void; isGoogleLoading: boolean;
}> = ({ name, setName, email, setEmail, password, setPassword, repeatPassword, setRepeatPassword, schoolId, setSchoolId, schoolName, setSchoolName, schools, schoolsLoading, photoPreview, handlePhotoChange, handleSubmit, isLoading, error, successMessage, onGoogleLogin, isGoogleLoading }) => {
    const isCustomSchool = schoolId === '__other__';
    return (
    <div className="space-y-4 animate-fade-in">
        <GoogleButton onClick={onGoogleLogin} isLoading={isGoogleLoading} disabled={isLoading} label="Регистрирај се со Google — веднаш 50 кредити" />
        <Divider />
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
            {/* Photo upload */}
            <div className="flex items-center gap-4">
                <label htmlFor="photo-upload" className="cursor-pointer group relative flex-shrink-0">
                    <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-300 group-hover:border-brand-secondary transition-colors">
                        {photoPreview
                            ? <img src={photoPreview} alt="Прегледај профилна слика" className="w-full h-full object-cover" />
                            : <ICONS.gallery className="w-6 h-6 text-slate-400 group-hover:text-brand-secondary" />}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 bg-brand-secondary text-white p-0.5 rounded-full shadow">
                        <ICONS.plus className="w-3 h-3" />
                    </div>
                </label>
                <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                <div>
                    <p className="text-sm font-semibold text-slate-700">Профилна слика</p>
                    <p className="text-xs text-slate-500 mt-0.5">JPG, PNG · незадолжително</p>
                </div>
            </div>

            <InputField id="reg-name" label="Ime i prezime *" type="text" value={name} onChange={setName} required autoFocus />
            <InputField id="reg-email" label="Е-пошта *" type="email" value={email} onChange={setEmail} required placeholder="vashata@email.com" />

            {/* School picker */}
            <div>
                <label htmlFor="reg-school" className="text-sm font-semibold text-slate-700 mb-1 block">
                    Училиште <span className="text-slate-400 font-normal">(незадолжително)</span>
                </label>
                {schoolsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                        <ICONS.spinner className="animate-spin w-4 h-4" /> Се вчитуваат...
                    </div>
                ) : schools.length > 0 ? (
                    <>
                        <select
                            id="reg-school" value={schoolId}
                            onChange={(e) => { setSchoolId(e.target.value); if (e.target.value !== '__other__') setSchoolName(''); }}
                            className="block w-full px-3.5 py-2.5 text-slate-900 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary/40 focus:border-brand-secondary transition-all"
                        >
                            <option value="">-- Изберете училиште --</option>
                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}{s.city ? ` (${s.city})` : ''}</option>)}
                            <option value="__other__">— Моето училиште не е во листата</option>
                        </select>
                        {isCustomSchool && (
                            <input type="text" placeholder="Внесете го името на вашето училиште" value={schoolName}
                                onChange={(e) => setSchoolName(e.target.value)}
                                className="mt-2 block w-full px-3.5 py-2.5 text-slate-900 bg-slate-50 border border-brand-secondary/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary/40 focus:border-brand-secondary transition-all"
                                autoFocus />
                        )}
                    </>
                ) : (
                    <input id="reg-school" type="text" placeholder="Внесете го името на вашето училиште" value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="block w-full px-3.5 py-2.5 text-slate-900 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-secondary/40 focus:border-brand-secondary transition-all" />
                )}
                <p className="mt-1 text-xs text-slate-400">Можете да го промените подоцна преку профилот.</p>
            </div>

            <InputField id="reg-password" label="Лозинка *" type="password" value={password} onChange={setPassword} required minLength={6} />
            <InputField id="reg-repeat" label="Повтори лозинка *" type="password" value={repeatPassword} onChange={setRepeatPassword} required minLength={6} />

            {error && <ErrorBox message={error} />}
            {successMessage && <div className="text-sm text-emerald-700 text-center bg-emerald-50 border border-emerald-200 p-3 rounded-xl">{successMessage}</div>}

            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-3">
                <Zap className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">По регистрацијата добивате <strong>50 бесплатни AI кредити</strong> — без кредитна картичка.</p>
            </div>

            <SubmitButton isLoading={isLoading} label="Регистрирај се — почни бесплатно" loadingLabel="Се регистрира..." />
        </form>
        <LoginFooter />
    </div>
    );
};

// ─── Reset password form ─────────────────────────────────────────────────────

const ResetPasswordForm: React.FC<{
    email: string; setEmail: (v: string) => void;
    handleResetSubmit: (e: React.FormEvent) => Promise<void>;
    isLoading: boolean; error: string; successMessage: string;
    onBackToLogin: () => void;
}> = ({ email, setEmail, handleResetSubmit, isLoading, error, successMessage, onBackToLogin }) => (
    <form onSubmit={handleResetSubmit} className="space-y-4 animate-fade-in" noValidate>
        <p className="text-sm text-slate-500 leading-relaxed">
            Внесете ја вашата е-пошта и ќе ви испратиме линк за ресетирање на лозинката.
        </p>
        <InputField id="reset-email" label="Е-пошта" type="email" value={email} onChange={setEmail} required placeholder="vashata@email.com" autoFocus />
        {error && <ErrorBox message={error} />}
        {successMessage && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">{successMessage}</div>}
        <SubmitButton isLoading={isLoading} label="Испрати линк за ресетирање" />
        <button type="button" onClick={onBackToLogin} className="w-full text-center text-sm font-semibold text-brand-secondary hover:text-brand-primary transition-colors">
            ← Назад кон најава
        </button>
    </form>
);

// ─── Verify email notice ─────────────────────────────────────────────────────

const VerifyEmailNotice: React.FC<{
    firebaseUser: User;
    handleResendVerification: () => Promise<void>;
    logout: () => Promise<void>;
    resendCooldown: number; resendMessage: string; error: string;
}> = ({ firebaseUser, handleResendVerification, logout, resendCooldown, resendMessage, error }) => (
    <div className="w-full max-w-lg text-center animate-fade-in-up">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 mb-5">
            <ICONS.email className="w-8 h-8 text-brand-primary" />
        </div>
        <h2 className="text-2xl font-black text-slate-800">Потврдете ја е-поштата</h2>
        <p className="text-slate-500 text-sm my-4 leading-relaxed">
            Испративме линк на <strong className="text-slate-700 break-all">{firebaseUser.email}</strong>.<br />
            Кликнете на линкот за да ја активирате сметката.
        </p>
        <div className="text-left bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl space-y-1.5 text-sm my-5">
            <p className="font-bold">Не го добивте меилот?</p>
            <ul className="list-disc list-inside space-y-1 text-amber-700">
                <li>Проверете ја <strong>Spam</strong> или <strong>Junk</strong> папката</li>
                <li>Почекајте 2–3 минути</li>
                <li>Ако е-поштата е погрешна — <button type="button" onClick={logout} className="underline font-semibold hover:text-amber-900">одјавете се</button> и регистрирајте се повторно</li>
            </ul>
        </div>
        {resendMessage && <div className="text-sm text-emerald-700 mb-4 bg-emerald-50 border border-emerald-200 p-3 rounded-xl">{resendMessage}</div>}
        {error && <ErrorBox message={error} />}
        <div className="flex flex-col sm:flex-row justify-center gap-3 mt-5">
            <button type="button" onClick={handleResendVerification} disabled={resendCooldown > 0}
                className="flex-1 sm:flex-none bg-brand-primary text-white px-5 py-2.5 rounded-xl font-semibold shadow hover:bg-brand-secondary transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                {resendCooldown > 0 ? `Испрати повторно (${resendCooldown}с)` : 'Испрати линкот повторно'}
            </button>
            <button type="button" onClick={logout}
                className="flex-1 sm:flex-none bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl font-semibold hover:bg-slate-200 transition-all text-sm">
                Друга сметка
            </button>
        </div>
        <p className="text-xs text-slate-400 mt-5">Откако ќе ја верификувате е-поштата, освежете ја страницата.</p>
    </div>
);

// ─── Shared micro-components ─────────────────────────────────────────────────

const GoogleButton: React.FC<{ onClick: () => void; isLoading: boolean; disabled: boolean; label: string }> = ({ onClick, isLoading, disabled, label }) => (
    <button type="button" onClick={onClick} disabled={isLoading || disabled}
        className="w-full flex justify-center items-center gap-3 bg-white border-2 border-slate-200 text-slate-700 px-4 py-3 rounded-xl shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:shadow transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm">
        {isLoading ? <ICONS.spinner className="animate-spin w-5 h-5 text-slate-400" /> : <GoogleIcon />}
        {label}
    </button>
);

const Divider: React.FC = () => (
    <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-slate-400 text-xs font-medium">или со е-пошта</span>
        <div className="flex-1 h-px bg-slate-200" />
    </div>
);

const SubmitButton: React.FC<{ isLoading: boolean; label: string; loadingLabel?: string }> = ({ isLoading, label, loadingLabel }) => (
    <button type="submit" disabled={isLoading}
        className="w-full flex justify-center items-center gap-2 bg-brand-primary text-white px-4 py-3 rounded-xl shadow-md hover:bg-brand-secondary transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm mt-1">
        {isLoading && <ICONS.spinner className="animate-spin w-4 h-4" />}
        {isLoading ? (loadingLabel ?? 'Се обработува...') : label}
    </button>
);

const ErrorBox: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-xl text-center">{message}</div>
);

const LoginFooter: React.FC = () => (
    <div className="pt-4 border-t border-slate-100 text-center">
        <p className="text-xs text-slate-400 mb-1.5">Сте директор на училиште?</p>
        <a href="#/school/register" className="text-sm font-semibold text-brand-primary hover:text-brand-secondary transition-colors">
            Регистрирај училиште →
        </a>
    </div>
);

const TrustBadges: React.FC = () => (
    <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-100 mt-2">
        <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-medium">Firebase Auth</span>
        </div>
        <div className="w-px h-3 bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium">GDPR / ЗЗЛП</span>
        <div className="w-px h-3 bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium">HTTPS</span>
    </div>
);

// ─── Mode switcher tabs ──────────────────────────────────────────────────────

const ModeTabs: React.FC<{ mode: 'login' | 'register'; onSwitch: (m: 'login' | 'register') => void }> = ({ mode, onSwitch }) => (
    <div className="flex bg-slate-100 rounded-xl p-1 gap-1 mb-6">
        {(['login', 'register'] as const).map((m) => (
            <button key={m} type="button" onClick={() => onSwitch(m)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                    mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {m === 'login' ? 'Најава' : 'Регистрација'}
            </button>
        ))}
    </div>
);

// ─── Main LoginView controller ────────────────────────────────────────────────

export const LoginView: React.FC = () => {
    const [schools, setSchools] = useState<any[]>([]);
    const [schoolId, setSchoolId] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [schoolsLoading, setSchoolsLoading] = useState(true);

    useEffect(() => {
        firestoreService.fetchSchools()
            .then(setSchools)
            .catch(err => logger.error("Failed to load schools:", err))
            .finally(() => setSchoolsLoading(false));
    }, []);

    const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [repeatPassword, setRepeatPassword] = useState('');
    const [name, setName] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const { login, loginWithGoogle, register, firebaseUser, isAuthenticated, isLoading: isAuthLoading, logout, resendVerificationEmail, resetPassword } = useAuth();
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendMessage, setResendMessage] = useState('');
    const demoActive = isDemoMode();

    useEffect(() => {
        if (demoActive && !email && !password) {
            const creds = getDemoCredentials();
            setEmail(creds.email);
            setPassword(creds.password);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [demoActive]);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) { setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); }
    };
    useEffect(() => { return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }; }, [photoPreview]);
    useEffect(() => {
        if (resendCooldown > 0) {
            const id = setTimeout(() => setResendCooldown(c => c - 1), 1000);
            return () => clearTimeout(id);
        }
    }, [resendCooldown]);

    const clearFormState = () => { setError(''); setSuccessMessage(''); setPassword(''); setRepeatPassword(''); };

    const switchMode = (m: 'login' | 'register') => { setMode(m); clearFormState(); };

    const handleGoogleLogin = async () => {
        setError(''); setIsGoogleLoading(true);
        try {
            await loginWithGoogle();
            trackEvent('login_completed', { method: 'google' });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Настана непозната грешка.');
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setIsLoading(true);
        try {
            await login(email, password);
            trackEvent('login_completed', { method: 'email' });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Настана непозната грешка.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setSuccessMessage('');
        if (password !== repeatPassword) { setError('Лозинките не се совпаѓаат.'); return; }
        if (!name.trim()) { setError('Ве молиме внесете го вашето Ime i prezime.'); return; }
        if (schoolId === '__other__' && !schoolName.trim()) { setError('Ве молиме внесете го името на вашето училиште.'); return; }
        setIsLoading(true);
        try {
            const finalSchoolId = schoolId === '__other__' ? '' : schoolId;
            const finalSchoolName = schoolId === '__other__' ? schoolName.trim() : '';
            await register(email, password, name, photoFile, finalSchoolId, undefined, finalSchoolName);
            trackEvent('signup_completed', { method: 'email', hasSchool: Boolean(finalSchoolId || finalSchoolName) });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Настана непозната грешка.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setError(''); setSuccessMessage(''); setIsLoading(true);
        try {
            await resetPassword(email);
            setSuccessMessage('Линкот е испратен. Проверете го вашето сандаче, вклучувајќи ја спам папката.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Настана непозната грешка.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        setResendMessage(''); setError('');
        if (resendCooldown > 0) return;
        try {
            await resendVerificationEmail();
            setResendMessage('Нов линк за верификација е испратен.');
            setResendCooldown(60);
        } catch {
            setError('Грешка при испраќање. Обидете се повторно подоцна.');
        }
    };

    // ── Email verification screen ─────────────────────────────────────────────
    if (firebaseUser && !isAuthenticated && !isAuthLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
                <Card className="animate-fade-in-up max-w-lg w-full">
                    <VerifyEmailNotice
                        firebaseUser={firebaseUser}
                        handleResendVerification={handleResendVerification}
                        logout={logout}
                        resendCooldown={resendCooldown}
                        resendMessage={resendMessage}
                        error={error}
                    />
                </Card>
            </div>
        );
    }

    // ── Main two-panel layout ─────────────────────────────────────────────────
    const modeSubtitle =
        mode === 'register' ? 'Започнете бесплатно — 50 кредити веднаш' :
        mode === 'reset'    ? 'Ресетирај лозинка' :
                              'Добредојдовте назад!';

    const headerText =
        mode === 'register' ? 'Создај сметка' :
        mode === 'reset'    ? 'Ресетирај лозинка' :
                              'Најава';

    return (
        <div className="min-h-screen flex">
            {/* Left: Hero / marketing panel */}
            <MarketingPanel />

            {/* Right: Auth panel */}
            <div className="flex-1 overflow-y-auto bg-white">
                <div className="min-h-full flex flex-col items-center justify-center p-6 sm:p-8 lg:p-10">
                    <div className="w-full max-w-[400px]">

                        {/* Mobile logo */}
                        <div className="lg:hidden flex justify-center mb-8">
                            <MisMathLogo size="md" />
                        </div>

                        {/* Page header */}
                        <div className="mb-6">
                            <h1 className="text-2xl font-black text-slate-800">{headerText}</h1>
                            <p className="text-slate-500 text-sm mt-1">{modeSubtitle}</p>
                        </div>

                        {/* Demo mode banner */}
                        {demoActive && (
                            <div className="mb-5 px-3.5 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                                <strong>МОН демо режим</strong> — креденцијалите се пополнети автоматски. Креирањето нови сметки е оневозможено.
                            </div>
                        )}

                        {/* Mode switcher tabs (only for login/register) */}
                        {mode !== 'reset' && (
                            <ModeTabs mode={mode as 'login' | 'register'} onSwitch={switchMode} />
                        )}

                        {/* Form content */}
                        {mode === 'login' && (
                            <LoginForm
                                email={email} setEmail={setEmail}
                                password={password} setPassword={setPassword}
                                handleSubmit={handleLoginSubmit}
                                isLoading={isLoading} error={error}
                                onSwitchToReset={() => { setMode('reset'); clearFormState(); }}
                                onGoogleLogin={handleGoogleLogin} isGoogleLoading={isGoogleLoading}
                            />
                        )}
                        {mode === 'register' && (
                            <RegisterForm
                                name={name} setName={setName}
                                email={email} setEmail={setEmail}
                                password={password} setPassword={setPassword}
                                repeatPassword={repeatPassword} setRepeatPassword={setRepeatPassword}
                                schoolId={schoolId} setSchoolId={setSchoolId}
                                schoolName={schoolName} setSchoolName={setSchoolName}
                                schools={schools} schoolsLoading={schoolsLoading}
                                photoPreview={photoPreview} handlePhotoChange={handlePhotoChange}
                                handleSubmit={handleRegisterSubmit}
                                isLoading={isLoading} error={error} successMessage={successMessage}
                                onGoogleLogin={handleGoogleLogin} isGoogleLoading={isGoogleLoading}
                            />
                        )}
                        {mode === 'reset' && (
                            <ResetPasswordForm
                                email={email} setEmail={setEmail}
                                handleResetSubmit={handleResetSubmit}
                                isLoading={isLoading} error={error} successMessage={successMessage}
                                onBackToLogin={() => { setMode('login'); clearFormState(); }}
                            />
                        )}

                        {/* Trust badges */}
                        <TrustBadges />
                    </div>
                </div>
            </div>
        </div>
    );
};
