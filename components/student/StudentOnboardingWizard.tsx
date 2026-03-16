/**
 * StudentOnboardingWizard — first-time + returning student name entry.
 * Steps: 0 (welcome) → 1 (name) → 2 (class code) → null (done).
 * Extracted from StudentPlayView for single-responsibility.
 */
import React from 'react';
import { User, ArrowRight, Zap, Target, TrendingUp } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { RestoreProgressModal } from './RestoreProgressModal';

interface StudentOnboardingWizardProps {
  wizardStep: 0 | 1 | 2 | null;
  setWizardStep: (step: 0 | 1 | 2 | null) => void;
  nameInput: string;
  setNameInput: (v: string) => void;
  nameError: string;
  handleConfirmName: () => void;
  classCodeInput: string;
  setClassCodeInput: (v: string) => void;
  classCodeLoading: boolean;
  classCodeError: string;
  handleJoinClass: (code: string) => Promise<void>;
  deviceId: string;
  setStudentName: (name: string) => void;
  setNameConfirmed: (v: boolean) => void;
  setIsReturningStudent: (v: boolean) => void;
  setStudentGoogleUid: (uid: string) => void;
}

export const StudentOnboardingWizard: React.FC<StudentOnboardingWizardProps> = ({
  wizardStep,
  setWizardStep,
  nameInput,
  setNameInput,
  nameError,
  handleConfirmName,
  classCodeInput,
  setClassCodeInput,
  classCodeLoading,
  classCodeError,
  handleJoinClass,
  deviceId,
  setStudentName,
  setNameConfirmed,
  setIsReturningStudent,
  setStudentGoogleUid,
}) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center flex-1 p-6 md:p-8 text-center min-h-[60vh] md:min-h-[500px]">

      {/* Step 0: Welcome screen */}
      {wizardStep === 0 && (
        <div className="animate-fade-in w-full max-w-sm">
          <div className="flex justify-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center">
              <Zap className="w-7 h-7 text-indigo-600" />
            </div>
            <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center">
              <Target className="w-7 h-7 text-violet-600" />
            </div>
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center">
              <TrendingUp className="w-7 h-7 text-emerald-600" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-3">{t('play.onboarding.step1.title')}<br />{t('play.onboarding.step1.subtitle')}</h2>
          <div className="space-y-3 text-left mb-8">
            <div className="flex items-start gap-3 bg-indigo-50 rounded-2xl p-3">
              <Zap className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800 text-sm">{t('play.onboarding.step1.opt1.title')}</p>
                <p className="text-slate-500 text-xs">{t('play.onboarding.step1.opt1.desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-violet-50 rounded-2xl p-3">
              <Target className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800 text-sm">{t('play.onboarding.step1.opt2.title')}</p>
                <p className="text-slate-500 text-xs">{t('play.onboarding.step1.opt2.desc')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-emerald-50 rounded-2xl p-3">
              <TrendingUp className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-800 text-sm">{t('play.onboarding.step1.opt3.title')}</p>
                <p className="text-slate-500 text-xs">{t('play.onboarding.step1.opt3.desc')}</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWizardStep(1)}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 px-6 rounded-2xl font-black text-lg hover:bg-indigo-700 transition"
          >
            Да почнеме! <ArrowRight className="w-5 h-5" />
          </button>
          <div className="flex justify-center gap-1.5 mt-4">
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            <span className="w-2 h-2 rounded-full bg-slate-200" />
            <span className="w-2 h-2 rounded-full bg-slate-200" />
          </div>
        </div>
      )}

      {/* Step 1: Name entry */}
      {wizardStep === 1 && (
        <div className="animate-fade-in max-w-sm w-full">
          <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mb-6 mx-auto">
            <User className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">{t('play.onboarding.whats_your_name')}</h2>
          <p className="text-slate-500 mb-6 text-sm px-2">{t('play.onboarding.name_privacy')}</p>
          <div className="px-2">
            <input
              type="text"
              placeholder={t('play.onboarding.name_placeholder')}
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && nameInput.trim()) { handleConfirmName(); setWizardStep(2); } }}
              className="w-full border-2 border-slate-200 rounded-2xl px-4 py-4 md:py-3 text-slate-800 font-semibold text-center text-lg focus:outline-none focus:border-indigo-500 transition mb-4 min-h-[56px] md:min-h-[auto]"
            />
            {nameError && <p className="text-red-500 text-xs mb-2 text-center">{nameError}</p>}
            <button
              type="button"
              onClick={() => { handleConfirmName(); setWizardStep(2); }}
              disabled={!nameInput.trim()}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 md:py-3 px-6 rounded-2xl font-black text-lg hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[56px] md:min-h-[auto]"
            >
              {t('play.onboarding.confirm')} <ArrowRight className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setWizardStep(0)}
              className="mt-4 pb-2 text-sm text-slate-400 hover:text-slate-600 transition min-h-[44px]"
            >
              {t('play.onboarding.back')}
            </button>
          </div>
          {/* С1: Restore progress from Google account */}
          <RestoreProgressModal
            deviceId={deviceId}
            onRestored={(restoredName, uid) => {
              setStudentName(restoredName);
              setNameInput(restoredName);
              setNameConfirmed(true);
              setIsReturningStudent(true);
              setWizardStep(null);
              setStudentGoogleUid(uid);
            }}
          />
          <div className="flex justify-center gap-1.5 mt-4">
            <span className="w-2 h-2 rounded-full bg-slate-200" />
            <span className="w-2 h-2 rounded-full bg-indigo-600" />
            <span className="w-2 h-2 rounded-full bg-slate-200" />
          </div>
        </div>
      )}

      {/* Step 2: Class code */}
      {wizardStep === 2 && (
        <div className="animate-fade-in max-w-sm w-full px-2">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6 mx-auto">
            <span className="text-4xl">🏫</span>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2 text-center">Во кое одделение си?</h2>
          <p className="text-slate-500 mb-6 text-sm text-center px-2">
            Ако наставникот ти дал код на одделение, внеси го тука. Можеш и да прескокнеш.
          </p>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Код на одделение (пр. AB12CD)"
              value={classCodeInput}
              onChange={e => { setClassCodeInput(e.target.value.trim().toUpperCase()); }}
              maxLength={6}
              className="w-full border-2 border-slate-200 rounded-2xl px-4 py-4 text-slate-800 font-mono font-bold text-center text-lg tracking-widest focus:outline-none focus:border-green-500 transition"
            />
            {classCodeError && (
              <p className="text-xs text-red-500 text-center">{classCodeError}</p>
            )}
            <button
              type="button"
              onClick={() => handleJoinClass(classCodeInput)}
              disabled={classCodeLoading}
              className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-4 px-6 rounded-2xl font-black text-lg hover:bg-green-700 transition disabled:opacity-40"
            >
              {classCodeLoading ? '⏳ Се поврзувам...' : 'Приклучи се кон одделението'}
            </button>
            <button
              type="button"
              onClick={() => setWizardStep(null)}
              className="w-full py-3 text-sm text-slate-400 hover:text-slate-600 transition"
            >
              Прескокни — продолжи без код
            </button>
          </div>
          <div className="flex justify-center gap-1.5 mt-6">
            <span className="w-2 h-2 rounded-full bg-slate-200" />
            <span className="w-2 h-2 rounded-full bg-slate-200" />
            <span className="w-2 h-2 rounded-full bg-green-500" />
          </div>
        </div>
      )}

      {/* Returning user — simple form */}
      {wizardStep === null && (
        <div className="animate-fade-in max-w-sm w-full px-2">
          <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center mb-6 mx-auto">
            <User className="w-10 h-10 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">{t('play.onboarding.change_name_title')}</h2>
          <p className="text-slate-500 mb-8 max-w-sm text-sm">{t('play.onboarding.change_name_desc')}</p>
          <input
            type="text"
            placeholder={t('play.onboarding.name_placeholder')}
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nameInput.trim()) handleConfirmName(); }}
            className="w-full border-2 border-slate-200 rounded-2xl px-4 py-4 md:py-3 text-slate-800 font-semibold text-center text-lg focus:outline-none focus:border-indigo-500 transition mb-4 min-h-[56px] md:min-h-[auto]"
          />
          {nameError && <p className="text-red-500 text-xs mb-2 text-center">{nameError}</p>}
          <button
            type="button"
            onClick={handleConfirmName}
            disabled={!nameInput.trim()}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 md:py-3 px-6 rounded-2xl font-black text-lg hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[56px] md:min-h-[auto]"
          >
            {t('play.onboarding.start_quiz')} <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
