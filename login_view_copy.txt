import React, { useState, useEffect } from 'react';
import { Card } from '../components/common/Card';
import { APP_NAME, ICONS } from '../constants';
import { useAuth } from '../contexts/AuthContext';
import type { User } from "firebase/auth";

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
}

const LoginForm: React.FC<LoginFormProps> = ({ email, setEmail, password, setPassword, handleSubmit, isLoading, error, onSwitchToRegister, onSwitchToReset }) => (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
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
    photoPreview: string | null;
    handlePhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    isLoading: boolean;
    error: string;
    successMessage: string;
    onSwitchToLogin: () => void;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ name, setName, email, setEmail, password, setPassword, repeatPassword, setRepeatPassword, photoPreview, handlePhotoChange, handleSubmit, isLoading, error, successMessage, onSwitchToLogin }) => (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
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
            <span className="text-xs text-gray-500">Додади профилна слика</span>
        </div>
        <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Име и презиме</label>
            <input type="text" id="name" value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary" required />
        </div>
        <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Е-пошта</label>
            <input type="email" id="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary" required />
        </div>
        <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Лозинка</label>
            <input type="password" id="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary" required />
        </div>
        <div>
            <label htmlFor="repeatPassword" className="block text-sm font-medium text-gray-700">Повтори лозинка</label>
            <input type="password" id="repeatPassword" value={repeatPassword} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRepeatPassword(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary" required />
        </div>
        {error && <p className="text-sm text-red-600 text-center bg-red-50 p-2 rounded">{error}</p>}
        {successMessage && <p className="text-sm text-green-600 text-center bg-green-50 p-2 rounded">{successMessage}</p>}
        <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center gap-2 bg-brand-primary text-white px-4 py-2.5 rounded-lg shadow disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-secondary transition-all active:scale-95">
            {isLoading && <ICONS.spinner className="animate-spin w-5 h-5" />}
            Регистрирај се
        </button>
        <div className="text-center text-sm mt-4">
            <button type="button" onClick={onSwitchToLogin} className="font-medium text-brand-secondary hover:text-brand-primary">
                Веќе имате сметка? Најавете се
            </button>
        </div>
    </form>
);


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
                <li>Проверете дали е-поштата е точно внесена. Ако не е, <button onClick={logout} className="underline font-semibold hover:text-yellow-900">одјавете се</button> и регистрирајте се повторно.</li>
            </ul>
        </div>
        {resendMessage && <p className="text-sm text-green-600 mb-4 bg-green-50 p-2 rounded">{resendMessage}</p>}
        {error && <p className="text-sm text-red-600 mb-4 bg-red-50 p-2 rounded">{error}</p>}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
            <button onClick={handleResendVerification} disabled={resendCooldown > 0} className="bg-brand-secondary text-white px-4 py-2 rounded-lg shadow hover:bg-brand-primary transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
                {resendCooldown > 0 ? `Испрати повторно за (${resendCooldown}с)` : 'Испрати го линкот повторно'}
            </button>
            <button onClick={logout} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 font-semibold transition-colors">
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
    const { login, register, firebaseUser, isAuthenticated, isLoading: isAuthLoading, logout, resendVerificationEmail, resetPassword } = useAuth();
    
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
        setIsLoading(true);
        try {
            await register(email, password, name, photoFile);
            setSuccessMessage("Регистрацијата е успешна! Ве молиме проверете го вашето сандаче за е-пошта за линк за верификација.");
            setMode('login');
            clearFormState();
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
            content = <RegisterForm name={name} setName={setName} email={email} setEmail={setEmail} password={password} setPassword={setPassword} repeatPassword={repeatPassword} setRepeatPassword={setRepeatPassword} photoPreview={photoPreview} handlePhotoChange={handlePhotoChange} handleSubmit={handleRegisterSubmit} isLoading={isLoading} error={error} successMessage={successMessage} onSwitchToLogin={() => { setMode('login'); clearFormState(); }} />;
            break;
        case 'reset':
            headerText = 'Ресетирај лозинка';
            content = <ResetPasswordForm email={email} setEmail={setEmail} handleResetSubmit={handleResetSubmit} isLoading={isLoading} error={error} successMessage={successMessage} onBackToLogin={() => { setMode('login'); clearFormState(); }} />;
            break;
        case 'login':
        default:
            headerText = 'Добредојдовте назад!';
            content = <LoginForm email={email} setEmail={setEmail} password={password} setPassword={setPassword} handleSubmit={handleLoginSubmit} isLoading={isLoading} error={error} onSwitchToRegister={() => { setMode('register'); clearFormState(); }} onSwitchToReset={() => { setMode('reset'); clearFormState(); }} />;
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