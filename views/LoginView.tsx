import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { APP_NAME, ICONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';
import type { User } from "firebase/auth";


// Google logo SVG
const GoogleIcon = () => (
    <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.1 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.8 7.1 29.2 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-4.5z"/>
        <path fill="#FF3D00" d="M6.3 15.1l6.6 4.8C14.5 16.2 18.9 13 24 13c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.8 7.1 29.2 5 24 5 16.3 5 9.7 9.1 6.3 15.1z"/>
        <path fill="#4CAF50" d="M24 45c5.2 0 9.8-2 13.2-5.2l-6.1-5.2C29.3 36.3 26.8 37 24 37c-5.2 0-9.7-2.9-11.3-7H6.1C9.3 40 16.1 45 24 45z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.1 5.2C40.9 35.8 44 30.9 44 25c0-1.3-.1-2.6-.4-4.5z"/>
    </svg>
);

// --- SUB-COMPONENTS FOR EACH AUTH STATE ---

interface LoginFormProps {
    email: string;
    setEmail: (email: string) => void;
    password: string;
    setPassword: (pass: string) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    isLoading: boolean;
    error: string;
    onSwitchToRegister: () => void;
    onSwitchToReset: () => void;
    onGoogleLogin: () => void;
    isGoogleLoading: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({ email, setEmail, password, setPassword, handleSubmit, isLoading, error, onSwitchToRegister, onSwitchToReset, onGoogleLogin, isGoogleLoading }) => (
    <div className="space-y-4 animate-fade-in">
        <button type="button" onClick={onGoogleLogin} disabled={isGoogleLoading || isLoading} className="w-full flex justify-center items-center gap-3 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg shadow-sm hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
            {isGoogleLoading ? <ICONS.spinner className="animate-spin w-5 h-5 text-gray-500" /> : <GoogleIcon />}
            Продолжи со Google
        </button>
        <div className="flex items-center gap-3 text-gray-400 text-xs">
            <div className="flex-1 h-px bg-gray-200" />
            или со е-пошта
            <div className="flex-1 h-px bg-gray-200" />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
        <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Е-пошта</label>
            <input type="email" id="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary" required />
        </div>
        <div>
            <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">Лозинка</label>
                <div className="text-sm">
                    <button type="button" onClick={onSwitchToReset} className="font-medium text-brand-secondary hover:text-brand-primary">
                        Заборавена лозинка?
                    </button>
                </div>
            </div>
            <input type="password" id="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary" required />
        </div>
        {error && <p className="text-sm text-red-600 text-center bg-red-50 p-2 rounded">{error}</p>}
        <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center gap-2 bg-brand-primary text-white px-4 py-2.5 rounded-lg shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-secondary transition-all active:scale-95">
            {isLoading && <ICONS.spinner className="animate-spin w-5 h-5" />}
            Најави се
        </button>
        <div className="text-center text-sm mt-4">
            <button type="button" onClick={onSwitchToRegister} className="font-medium text-brand-secondary hover:text-brand-primary">
                Немате сметка? Регистрирајте се
            </button>
        </div>
        </form>
        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-500 mb-2">Сте директор на училиште?</p>
            <a
                href="#/school/register"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-primary hover:text-brand-secondary transition-colors"
            >
                Регистрирај училиште →
            </a>
        </div>
    </div>
);

interface RegisterFormProps {
    name: string;
    setName: (name: string) => void;
    email: string;
    setEmail: (email: string) => void;
    password: string;
    setPassword: (pass: string) => void;
    repeatPassword: string;
    setRepeatPassword: (pass: string) => void;
    schoolId: string;
    setSchoolId: (id: string) => void;
    schoolName: string;
    setSchoolName: (name: string) => void;
    schools: any[];
    schoolsLoading: boolean;
    photoPreview: string | null;
    handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    isLoading: boolean;
    error: string;
    successMessage: string;
    onSwitchToLogin: () => void;
    onGoogleLogin: () => void;
    isGoogleLoading: boolean;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ name, setName, email, setEmail, password, setPassword, repeatPassword, setRepeatPassword, schoolId, setSchoolId, schoolName, setSchoolName, schools, schoolsLoading, photoPreview, handlePhotoChange, handleSubmit, isLoading, error, successMessage, onSwitchToLogin, onGoogleLogin, isGoogleLoading }) => {
    const isCustomSchool = schoolId === '__other__';
    return (
    <div className="space-y-4 animate-fade-in">
        <button type="button" onClick={onGoogleLogin} disabled={isGoogleLoading || isLoading} className="w-full flex justify-center items-center gap-3 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg shadow-sm hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
            {isGoogleLoading ? <ICONS.spinner className="animate-spin w-5 h-5 text-gray-500" /> : <GoogleIcon />}
            Регистрирај се со Google — веднаш 50 кредити
        </button>
        <div className="flex items-center gap-3 text-gray-400 text-xs">
            <div className="flex-1 h-px bg-gray-200" />
            или со е-пошта
            <div className="flex-1 h-px bg-gray-200" />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col items-center space-y-2 mb-6">
            <label htmlFor="photo-upload" className="cursor-pointer group relative">
                <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300 group-hover:border-brand-accent transition-colors">
                    {photoPreview ? <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" /> : <ICONS.gallery className="w-10 h-10 text-gray-400 group-hover:text-brand-accent" />}
                </div>
                <div className="absolute bottom-0 right-0 bg-brand-secondary text-white p-1 rounded-full shadow-md">
                    <ICONS.plus className="w-4 h-4" />
                </div>
            </label>
            <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
            <span className="text-xs text-gray-500">Додади профилна слика (незадолжително)</span>
        </div>
        <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Име и презиме *</label>
            <input type="text" id="name" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary" required />
        </div>
        <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Е-пошта *</label>
            <input type="email" id="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary" required />
        </div>

        <div>
            <label htmlFor="school" className="block text-sm font-medium text-gray-700">
                Училиште <span className="text-gray-400 font-normal">(незадолжително)</span>
            </label>
            {schoolsLoading ? (
                <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 p-2">
                    <ICONS.spinner className="animate-spin w-4 h-4" /> Се вчитуваат училиштата...
                </div>
            ) : schools.length > 0 ? (
                <>
                    <select
                        id="school"
                        value={schoolId}
                        onChange={(e) => { setSchoolId(e.target.value); if (e.target.value !== '__other__') setSchoolName(''); }}
                        className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
                    >
                        <option value="">-- Изберете училиште --</option>
                        {schools.map(s => (
                            <option key={s.id} value={s.id}>{s.name}{s.city ? ` (${s.city})` : ''}</option>
                        ))}
                        <option value="__other__">— Моето училиште не е во листата</option>
                    </select>
                    {isCustomSchool && (
                        <input
                            type="text"
                            placeholder="Внесете го името на вашето училиште"
                            value={schoolName}
                            onChange={(e) => setSchoolName(e.target.value)}
                            className="mt-2 block w-full p-2 border border-brand-secondary rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
                            autoFocus
                        />
                    )}
                </>
            ) : (
                <input
                    type="text"
                    id="school"
                    placeholder="Внесете го името на вашето училиште"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
                />
            )}
            <p className="mt-1 text-xs text-gray-400">Можете да го додадете подоцна преку вашиот профил.</p>
        </div>
        <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Лозинка *</label>
            <input type="password" id="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary" required minLength={6} />
        </div>
        <div>
            <label htmlFor="repeatPassword" className="block text-sm font-medium text-gray-700">Повтори лозинка *</label>
            <input type="password" id="repeatPassword" value={repeatPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRepeatPassword(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary" required minLength={6} />
        </div>
        {error && <p className="text-sm text-red-600 text-center bg-red-50 p-2 rounded">{error}</p>}
        {successMessage && <p className="text-sm text-green-600 text-center bg-green-50 p-2 rounded">{successMessage}</p>}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            По регистрацијата ќе добиете <strong>50 бесплатни кредити</strong> за AI генерирање на материјали.
        </div>
        <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center gap-2 bg-brand-primary text-white px-4 py-2.5 rounded-lg shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-secondary transition-all active:scale-95">
            {isLoading ? <><ICONS.spinner className="animate-spin w-5 h-5" /> Се регистрира...</> : 'Регистрирај се — 50 кредити бесплатно'}
        </button>
        <div className="text-center text-sm mt-4">
            <button type="button" onClick={onSwitchToLogin} className="font-medium text-brand-secondary hover:text-brand-primary">
                Веќе имате сметка? Најавете се
            </button>
        </div>
        </form>
    </div>
    );
};


interface VerifyEmailNoticeProps {
    firebaseUser: User;
    handleResendVerification: () => Promise<void>;
    logout: () => Promise<void>;
    resendCooldown: number;
    resendMessage: string;
    error: string;
}
const VerifyEmailNotice: React.FC<VerifyEmailNoticeProps> = ({ firebaseUser, handleResendVerification, logout, resendCooldown, resendMessage, error }) => (
    <div className="w-full max-w-lg text-center animate-fade-in-up">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 mb-4">
            <ICONS.email className="w-8 h-8 text-brand-primary" />
        </div>
        <h2 className="text-2xl font-bold text-brand-primary">Потврдете ја вашата е-пошта</h2>
        <p className="text-gray-600 my-4">
            Ви испративме линк за верификација на <strong className="break-all">{firebaseUser.email}</strong>. Ве молиме кликнете на линкот за да ја активирате вашата сметка.
        </p>
        <div className="text-left bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded-md space-y-2 text-sm my-6">
            <h3 className="font-bold">Не го добивте меилот?</h3>
            <ul className="list-disc list-inside space-y-1">
                <li>Проверете ја <strong>Spam</strong> или <strong>Junk</strong> папката во вашето сандаче.</li>
                <li>Почекајте неколку минути. Понекогаш доставата на е-пошта доцни.</li>
                <li>Проверете дали е-поштата е точно внесена. Ако не е, <button type="button" onClick={logout} className="underline font-semibold hover:text-yellow-900">одјавете се</button> и регистрирајте се повторно.</li>
            </ul>
        </div>
        {resendMessage && <p className="text-sm text-green-600 mb-4 bg-green-50 p-2 rounded">{resendMessage}</p>}
        {error && <p className="text-sm text-red-600 mb-4 bg-red-50 p-2 rounded">{error}</p>}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
            <button type="button" onClick={handleResendVerification} disabled={resendCooldown > 0} className="bg-brand-secondary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-primary transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
                {resendCooldown > 0 ? `Испрати повторно за (${resendCooldown}с)` : 'Испрати го линкот повторно'}
            </button>
            <button type="button" onClick={logout} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold transition-colors">
                Најави се со друга сметка
            </button>
        </div>
        <p className="text-xs text-gray-500 mt-6">Откако ќе ја верификувате е-поштата, освежете ја оваа страница за да продолжите.</p>
    </div>
);

interface ResetPasswordFormProps {
    email: string;
    setEmail: (email: string) => void;
    handleResetSubmit: (e: React.FormEvent) => Promise<void>;
    isLoading: boolean;
    error: string;
    successMessage: string;
    onBackToLogin: () => void;
}
const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ email, setEmail, handleResetSubmit, isLoading, error, successMessage, onBackToLogin }) => (
    <form onSubmit={handleResetSubmit} className="space-y-4 animate-fade-in">
        <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Е-пошта</label>
            <input type="email" id="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary" required />
        </div>
        {error && <p className="text-sm text-red-600 text-center bg-red-50 p-2 rounded">{error}</p>}
        {successMessage && <p className="text-sm text-green-600 text-center bg-green-50 p-2 rounded">{successMessage}</p>}
        <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center gap-2 bg-brand-primary text-white px-4 py-2.5 rounded-lg shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-secondary transition-all active:scale-95">
            {isLoading && <ICONS.spinner className="animate-spin w-5 h-5" />}
            Испрати линк
        </button>
        <div className="text-center text-sm mt-4">
            <button type="button" onClick={onBackToLogin} className="font-medium text-brand-secondary hover:text-brand-primary">
                Назад кон најава
            </button>
        </div>
    </form>
);


// --- MAIN LOGIN VIEW CONTROLLER ---

export const LoginView: React.FC = () => {
    const [schools, setSchools] = useState<any[]>([]);
    const [schoolId, setSchoolId] = useState('');
    const [schoolName, setSchoolName] = useState('');
    const [schoolsLoading, setSchoolsLoading] = useState(true);

    useEffect(() => {
        const loadSchools = async () => {
            try {
                const fetchedSchools = await firestoreService.fetchSchools();
                setSchools(fetchedSchools);
            } catch (err) {
                console.error("Failed to load schools:", err);
            } finally {
                setSchoolsLoading(false);
            }
        };
        loadSchools();
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

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
    };
    
    useEffect(() => {
        return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
    }, [photoPreview]);
    
    useEffect(() => {
        if (resendCooldown > 0) {
            const timerId = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
            return () => clearTimeout(timerId);
        }
    }, [resendCooldown]);

    const clearFormState = () => {
        setError('');
        setSuccessMessage('');
        setPassword('');
        setRepeatPassword('');
    };

    const handleGoogleLogin = async () => {
        setError('');
        setIsGoogleLoading(true);
        try {
            await loginWithGoogle();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Настана непозната грешка.");
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(email, password);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Настана непозната грешка.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        if (password !== repeatPassword) {
            setError('Лозинките не се совпаѓаат.');
            return;
        }
        if (!name.trim()) {
            setError('Ве молиме внесете го вашето име и презиме.');
            return;
        }

        if (schoolId === '__other__' && !schoolName.trim()) {
            setError('Ве молиме внесете го името на вашето училиште.');
            return;
        }
        setIsLoading(true);
        try {
            const finalSchoolId = schoolId === '__other__' ? '' : schoolId;
            const finalSchoolName = schoolId === '__other__' ? schoolName.trim() : '';
            await register(email, password, name, photoFile, finalSchoolId, undefined, finalSchoolName);
            // onAuthStateChanged automatically shows VerifyEmailNotice after Firebase user is created
        } catch (err) {
            setError(err instanceof Error ? err.message : "Настана непозната грешка.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);
        try {
            await resetPassword(email);
            setSuccessMessage('Линкот за ресетирање е испратен на вашата е-пошта. Проверете го вашето сандаче, вклучувајќи ја и спам папката.');
        } catch (err) {
            setError(err instanceof Error ? err.message : "Настана непозната грешка.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendVerification = async () => {
        setResendMessage('');
        setError('');
        if (resendCooldown > 0) return;
        try {
            await resendVerificationEmail();
            setResendMessage("Нов линк за верификација е испратен.");
            setResendCooldown(60);
        } catch (err) {
            setError("Грешка при испраќање на линкот. Обидете се повторно подоцна.");
        }
    };
    
    if (firebaseUser && !isAuthenticated && !isAuthLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-brand-bg p-4">
                <Card className="animate-fade-in-up">
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
    
    let content, headerText;

    switch (mode) {
        case 'register':
            headerText = 'Креирајте нова сметка';
            content = <RegisterForm name={name} setName={setName} email={email} setEmail={setEmail} password={password} setPassword={setPassword} repeatPassword={repeatPassword} setRepeatPassword={setRepeatPassword} schoolId={schoolId} setSchoolId={setSchoolId} schoolName={schoolName} setSchoolName={setSchoolName} schools={schools} schoolsLoading={schoolsLoading} photoPreview={photoPreview} handlePhotoChange={handlePhotoChange} handleSubmit={handleRegisterSubmit} isLoading={isLoading} error={error} successMessage={successMessage} onSwitchToLogin={() => { setMode('login'); clearFormState(); }} onGoogleLogin={handleGoogleLogin} isGoogleLoading={isGoogleLoading} />;
            break;
        case 'reset':
            headerText = 'Ресетирај лозинка';
            content = <ResetPasswordForm email={email} setEmail={setEmail} handleResetSubmit={handleResetSubmit} isLoading={isLoading} error={error} successMessage={successMessage} onBackToLogin={() => { setMode('login'); clearFormState(); }} />;
            break;
        case 'login':
        default:
            headerText = 'Добредојдовте назад!';
            content = <LoginForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} handleSubmit={handleLoginSubmit} isLoading={isLoading} error={error} onSwitchToRegister={() => { setMode('register'); clearFormState(); }} onSwitchToReset={() => { setMode('reset'); clearFormState(); }} onGoogleLogin={handleGoogleLogin} isGoogleLoading={isGoogleLoading} />;
            break;
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-brand-bg p-4">
            <Card className="w-full max-w-md animate-fade-in-up border-t-4 border-brand-primary">
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-brand-primary">{APP_NAME}</h1>
                    <p className="text-gray-500 mt-1">{headerText}</p>
                </div>
                {content}
            </Card>
        </div>
    );
};