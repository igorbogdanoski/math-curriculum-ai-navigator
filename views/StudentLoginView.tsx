/**
 * S65 P2-A — StudentLoginView
 *
 * Dedicated entry point for students at #/student/login.
 * Supports two flows:
 *   1) Google Sign-In (cross-device sync via student_accounts/{uid})
 *   2) Anonymous quick-start with name + optional class code
 *
 * After successful login, navigates to #/student (StudentDashboardView).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  signInWithPopup,
  signInAnonymously,
  linkWithPopup,
} from 'firebase/auth';
import { Loader2, GraduationCap, AlertCircle, ArrowRight, Shield } from 'lucide-react';
import { auth, googleProvider } from '../firebaseConfig';
import { firestoreService } from '../services/firestoreService';
import { useNavigation } from '../contexts/NavigationContext';
import { getOrCreateDeviceId } from '../utils/studentIdentity';
import { validateStudentName } from '../utils/validation';

const GoogleIcon: React.FC = () => (
  <svg viewBox="0 0 48 48" className="w-5 h-5" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.1 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.8 7.1 29.2 5 24 5 12.9 5 4 13.9 4 25s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-4.5z" />
    <path fill="#FF3D00" d="M6.3 15.1l6.6 4.8C14.5 16.2 18.9 13 24 13c2.8 0 5.3 1 7.2 2.8l5.7-5.7C33.8 7.1 29.2 5 24 5 16.3 5 9.7 9.1 6.3 15.1z" />
    <path fill="#4CAF50" d="M24 45c5.2 0 9.8-2 13.2-5.2l-6.1-5.2C29.3 36.3 26.8 37 24 37c-5.2 0-9.7-2.9-11.3-7H6.1C9.3 40 16.1 45 24 45z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.1 5.2C40.9 35.8 44 30.9 44 25c0-1.3-.1-2.6-.4-4.5z" />
  </svg>
);

type State = 'idle' | 'loading' | 'error';

export const StudentLoginView: React.FC = () => {
  const { navigate } = useNavigation();
  const deviceId = getOrCreateDeviceId();
  const inFlight = useRef(false);

  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [name, setName] = useState<string>(() => {
    try { return localStorage.getItem('studentName') || ''; } catch { return ''; }
  });
  const [classCode, setClassCode] = useState('');

  useEffect(() => {
    let alive = true;
    try {
      const uid = localStorage.getItem('student_google_uid');
      const savedName = localStorage.getItem('studentName');
      if (uid && savedName) {
        if (alive) navigate('/student');
      }
    } catch { /* incognito */ }
    return () => { alive = false; };
  }, [navigate]);

  const persistAndContinue = (studentName: string) => {
    try { localStorage.setItem('studentName', studentName); } catch { /* incognito */ }
    navigate('/student');
  };

  const handleGoogle = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState('loading');
    setError('');
    try {
      let uid: string;
      const current = auth.currentUser;
      if (current && current.isAnonymous) {
        try {
          const res = await linkWithPopup(current, googleProvider);
          uid = res.user.uid;
        } catch (linkErr: any) {
          if (linkErr?.code === 'auth/credential-already-in-use') {
            const res = await signInWithPopup(auth, googleProvider);
            uid = res.user.uid;
          } else {
            throw linkErr;
          }
        }
      } else {
        const res = await signInWithPopup(auth, googleProvider);
        uid = res.user.uid;
      }

      const gUser = auth.currentUser;
      const displayName = name.trim() || gUser?.displayName || 'Ученик';
      await firestoreService.createOrUpdateStudentAccount(uid, displayName, deviceId, {
        email: gUser?.email ?? undefined,
        photoURL: gUser?.photoURL ?? undefined,
      });
      try { localStorage.setItem('student_google_uid', uid); } catch { /* incognito */ }

      if (classCode.trim()) {
        try {
          await firestoreService.joinClassByCode(classCode.trim(), deviceId, displayName);
        } catch { /* non-fatal */ }
      }

      persistAndContinue(displayName);
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setState('idle');
      } else {
        setError('Грешка при најава со Google. Обиди се повторно.');
        setState('error');
      }
    } finally {
      inFlight.current = false;
    }
  };

  const handleQuickStart = async () => {
    const result = validateStudentName(name);
    if (!result.valid) {
      setError(result.error || 'Невалидно име');
      setState('error');
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setState('loading');
    setError('');
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
      const trimmed = name.trim();
      try {
        await firestoreService.saveStudentIdentity(deviceId, trimmed, auth.currentUser?.uid ?? '');
      } catch { /* non-fatal */ }
      if (classCode.trim()) {
        try {
          const cls = await firestoreService.joinClassByCode(classCode.trim(), deviceId, trimmed);
          if (cls?.id) {
            try { localStorage.setItem('student_class_id', cls.id); } catch { /* incognito */ }
          }
        } catch { /* non-fatal */ }
      }
      persistAndContinue(trimmed);
    } catch {
      setError('Грешка при најава. Обиди се повторно.');
      setState('error');
    } finally {
      inFlight.current = false;
    }
  };

  const isBusy = state === 'loading';

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-100 mb-3">
            <GraduationCap className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Ученички портал</h1>
          <p className="text-sm text-gray-500 mt-1">
            Најави се за да го следиш напредокот, задачите и матурските вежби.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <button
            type="button"
            onClick={handleGoogle}
            disabled={isBusy}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg shadow-sm hover:bg-gray-50 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isBusy ? <Loader2 className="animate-spin w-5 h-5 text-gray-500" /> : <GoogleIcon />}
            Продолжи со Google
          </button>

          <div className="flex items-center gap-3 text-gray-400 text-xs">
            <div className="flex-1 h-px bg-gray-200" />
            или брзо најави се
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="student-name" className="block text-sm font-medium text-gray-700 mb-1">
                Име и презиме
              </label>
              <input
                id="student-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="на пр. Ана Петрова"
                disabled={isBusy}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50"
              />
            </div>

            <div>
              <label htmlFor="class-code" className="block text-sm font-medium text-gray-700 mb-1">
                Код на одделение <span className="text-gray-400 font-normal">(опционално)</span>
              </label>
              <input
                id="class-code"
                type="text"
                value={classCode}
                onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                placeholder="на пр. ABC123"
                maxLength={12}
                disabled={isBusy}
                className="w-full p-2.5 border border-gray-300 rounded-lg uppercase tracking-wider focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50"
              />
            </div>

            <button
              type="button"
              onClick={handleQuickStart}
              disabled={isBusy}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg shadow hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isBusy ? <Loader2 className="animate-spin w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
              Влези
            </button>
          </div>

          {state === 'error' && error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-start gap-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
            <Shield className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-gray-400" />
            <span>
              Со најава се согласуваш со <a href="#/terms" className="text-indigo-600 hover:underline">Условите</a> и
              {' '}<a href="#/privacy" className="text-indigo-600 hover:underline">Политиката за приватност</a>.
            </span>
          </div>
        </div>

        <div className="text-center mt-4 text-xs text-gray-500">
          Си наставник? <a href="#/login" className="text-indigo-600 hover:underline">Најави се овде</a>
        </div>
      </div>
    </div>
  );
};

export default StudentLoginView;
