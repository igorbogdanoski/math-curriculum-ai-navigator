/**
 * /school/register — 3-step School Onboarding Wizard
 * Used by directors to self-register their school.
 *
 * Step 1: Director account (name, email, password) → Firebase Auth createUserWithEmailAndPassword
 * Step 2: School info (name, city, municipality, address) → POST /api/create-school
 * Step 3: Success — shows join code + instructions
 */

import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
} from 'firebase/auth';
import { Building2, User, CheckCircle2, Copy, Check, ChevronRight, School } from 'lucide-react';
import { APP_NAME } from '../constants';
import { AppError, ErrorCode } from '../utils/errors';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function callCreateSchool(
  token: string,
  body: { schoolName: string; city: string; municipality: string; address: string }
): Promise<{ schoolId: string; joinCode: string; schoolName: string }> {
  const base =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? 'http://localhost:3000' : '');
  const res = await fetch(`${base}/api/create-school`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) { const msg = data.error || 'Грешка при создавање на училиштето.'; throw new AppError(msg, ErrorCode.UNKNOWN, msg, false); }
  return data;
}

// ── Step indicator ─────────────────────────────────────────────────────────────

const steps = [
  { label: 'Директор', icon: User },
  { label: 'Училиште', icon: Building2 },
  { label: 'Готово', icon: CheckCircle2 },
];

const StepIndicator: React.FC<{ current: number }> = ({ current }) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {steps.map((s, i) => {
      const Icon = s.icon;
      const done = i < current;
      const active = i === current;
      return (
        <React.Fragment key={s.label}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                done
                  ? 'bg-green-500 border-green-500 text-white'
                  : active
                  ? 'bg-brand-primary border-brand-primary text-white'
                  : 'bg-white border-gray-300 text-gray-400'
              }`}
            >
              {done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
            </div>
            <span
              className={`text-xs font-medium ${
                active ? 'text-brand-primary' : done ? 'text-green-600' : 'text-gray-400'
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-12 mb-4 transition-all ${done ? 'bg-green-400' : 'bg-gray-200'}`}
            />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ── Step 1: Director account ──────────────────────────────────────────────────

interface Step1Data {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const Step1Director: React.FC<{
  onNext: (data: Step1Data) => Promise<void>;
  isLoading: boolean;
  error: string;
}> = ({ onNext, isLoading, error }) => {
  const [form, setForm] = useState<Step1Data>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const set = (field: keyof Step1Data) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) return;
    await onNext(form);
  };

  const passwordMismatch =
    form.confirmPassword.length > 0 && form.password !== form.confirmPassword;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Создај директорска сметка</h2>
        <p className="text-sm text-gray-500">
          Вашата лична сметка ќе биде администратор на училиштето.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ime i prezime *
        </label>
        <input
          type="text"
          value={form.name}
          onChange={set('name')}
          placeholder="пр. Марија Петровска"
          required
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Е-пошта *
        </label>
        <input
          type="email"
          value={form.email}
          onChange={set('email')}
          placeholder="director@uciliste.mk"
          required
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Лозинка * <span className="text-gray-400 font-normal">(мин. 6 знаци)</span>
        </label>
        <input
          type="password"
          value={form.password}
          onChange={set('password')}
          minLength={6}
          required
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Повтори лозинка *
        </label>
        <input
          type="password"
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
          required
          className={`w-full p-2.5 border rounded-lg focus:ring-brand-secondary focus:border-brand-secondary ${
            passwordMismatch ? 'border-red-400 bg-red-50' : 'border-gray-300'
          }`}
        />
        {passwordMismatch && (
          <p className="text-xs text-red-600 mt-1">Лозинките не се совпаѓаат.</p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={isLoading || passwordMismatch}
        className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white py-3 rounded-lg font-semibold hover:bg-brand-secondary transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            Следно <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
};

// ── Step 2: School info ────────────────────────────────────────────────────────

interface Step2Data {
  schoolName: string;
  city: string;
  municipality: string;
  address: string;
}

const Step2School: React.FC<{
  onNext: (data: Step2Data) => Promise<void>;
  isLoading: boolean;
  error: string;
}> = ({ onNext, isLoading, error }) => {
  const [form, setForm] = useState<Step2Data>({
    schoolName: '',
    city: '',
    municipality: '',
    address: '',
  });

  const set = (field: keyof Step2Data) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onNext(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Податоци за училиштето</h2>
        <p className="text-sm text-gray-500">
          Ќе биде прикажано на наставниците кои се придружуваат.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Назив на училиштето *
        </label>
        <input
          type="text"
          value={form.schoolName}
          onChange={set('schoolName')}
          placeholder='пр. ОУ "Кирил и Методиј"'
          required
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Град *
        </label>
        <input
          type="text"
          value={form.city}
          onChange={set('city')}
          placeholder="пр. Скопје"
          required
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Општина <span className="text-gray-400 font-normal">(незадолжително)</span>
        </label>
        <input
          type="text"
          value={form.municipality}
          onChange={set('municipality')}
          placeholder="пр. Центар"
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Адреса <span className="text-gray-400 font-normal">(незадолжително)</span>
        </label>
        <input
          type="text"
          value={form.address}
          onChange={set('address')}
          placeholder="пр. ул. Партизанска 5"
          className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-brand-secondary focus:border-brand-secondary"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white py-3 rounded-lg font-semibold hover:bg-brand-secondary transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? (
          <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            Создај училиште <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
};

// ── Step 3: Success ────────────────────────────────────────────────────────────

const Step3Success: React.FC<{ joinCode: string; schoolName: string }> = ({
  joinCode,
  schoolName,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback — show the code prominently
    }
  };

  const handleGoToDashboard = () => {
    window.location.hash = '#/';
  };

  return (
    <div className="space-y-6 animate-fade-in text-center">
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Училиштето е создадено!
        </h2>
        <p className="text-gray-600">
          <span className="font-semibold text-gray-800">{schoolName}</span> е активно.
          Сега можете да ги поканите наставниците.
        </p>
      </div>

      {/* Join Code */}
      <div className="bg-brand-light border border-brand-secondary/30 rounded-xl p-6">
        <p className="text-sm font-medium text-gray-600 mb-3">
          Кôд за придружување на наставници
        </p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-mono font-black tracking-widest text-brand-primary">
            {joinCode}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title="Копирај кôд"
            className="p-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 transition-all"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-500" />
            ) : (
              <Copy className="w-5 h-5 text-gray-500" />
            )}
          </button>
        </div>
        {copied && (
          <p className="text-xs text-green-600 mt-2">Копирано!</p>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-left">
        <p className="text-sm font-semibold text-blue-800 mb-2">
          Упатство за наставниците:
        </p>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Регистрираат нова сметка на {APP_NAME}</li>
          <li>Во Поставки → Придружи се со кôд</li>
          <li>Внесуваат кôдот: <strong className="font-mono">{joinCode}</strong></li>
        </ol>
      </div>

      <p className="text-xs text-gray-400">
        Кôдот може да го пронајдете и подоцна во Поставки → Управување со училиште.
      </p>

      <button
        type="button"
        onClick={handleGoToDashboard}
        className="w-full bg-brand-primary text-white py-3 rounded-lg font-semibold hover:bg-brand-secondary transition-all active:scale-95"
      >
        Оди на контролна табла
      </button>
    </div>
  );
};

// ── Main view ──────────────────────────────────────────────────────────────────

export const SchoolOnboardingView: React.FC = () => {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Result from step 3
  const [result, setResult] = useState<{ joinCode: string; schoolName: string } | null>(
    null
  );

  // Stored Firebase token between steps
  const tokenRef = React.useRef<string>('');

  // ── Step 1 handler ─────────────────────────────────────────────────────────
  const handleStep1 = async (data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
  }) => {
    setIsLoading(true);
    setError('');
    try {
      const auth = getAuth();
      const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
      await updateProfile(cred.user, { displayName: data.name });
      tokenRef.current = await cred.user.getIdToken();
      setStep(1);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/email-already-in-use') {
        setError('Е-поштата е веќе регистрирана. Најавете се и создајте училиште од Поставки.');
      } else if (code === 'auth/weak-password') {
        setError('Лозинката е прекратка — потребни се минимум 6 знаци.');
      } else {
        setError('Грешка при регистрација. Обидете се повторно.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2 handler ─────────────────────────────────────────────────────────
  const handleStep2 = async (data: {
    schoolName: string;
    city: string;
    municipality: string;
    address: string;
  }) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await callCreateSchool(tokenRef.current, data);
      setResult({ joinCode: res.joinCode, schoolName: res.schoolName });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Грешка при создавање на училиштето.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-light via-white to-blue-50 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow">
          <School className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
            {APP_NAME}
          </p>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            Регистрација на училиште
          </h1>
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <StepIndicator current={step} />

        {step === 0 && (
          <Step1Director onNext={handleStep1} isLoading={isLoading} error={error} />
        )}
        {step === 1 && (
          <Step2School onNext={handleStep2} isLoading={isLoading} error={error} />
        )}
        {step === 2 && result && (
          <Step3Success joinCode={result.joinCode} schoolName={result.schoolName} />
        )}
      </div>

      {/* Footer link */}
      {step < 2 && (
        <p className="mt-6 text-sm text-gray-500">
          Веќе имате сметка?{' '}
          <a
            href="#/login"
            className="text-brand-secondary font-medium hover:text-brand-primary"
          >
            Најавете се
          </a>
        </p>
      )}
    </div>
  );
};
