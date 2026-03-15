/**
 * С1 — SaveProgressModal
 *
 * Дискретна картичка (не modal) прикажана на дното на post-quiz резултатот.
 * Нуди Google Sign-In за да го зачуваат напредокот cross-device.
 *
 * Три состојби:
 *  idle     → покажи ја картичката со „Зачувај" копче
 *  loading  → спинер за времетраење на Google Sign-In
 *  saved    → успех: „✅ Напредокот е зачуван"
 *  error    → „Грешка — обиди се повторно"
 */

import React, { useState } from 'react';
import { signInWithPopup, linkWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, googleProvider } from '../../firebaseConfig';
import { firestoreService } from '../../services/firestoreService';
import { Shield, Loader2, CheckCircle, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';

interface SaveProgressModalProps {
  studentName: string;
  deviceId: string;
  /** Повикува се кога успешно е зачуван профилот — StudentPlayView може да го ажурира state-от */
  onSaved?: (uid: string) => void;
}

type State = 'idle' | 'loading' | 'saved' | 'error';

export const SaveProgressModal: React.FC<SaveProgressModalProps> = ({
  studentName,
  deviceId,
  onSaved,
}) => {
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (dismissed) return null;

  const handleGoogleSignIn = async () => {
    setState('loading');
    setErrorMsg('');
    try {
      let uid: string;

      const currentUser = auth.currentUser;

      if (currentUser && currentUser.isAnonymous) {
        // Линкувај го постоечкиот анонимен акаунт кон Google
        // → UID останува ист, сите постоечки Firestore документи се валидни
        try {
          const result = await linkWithPopup(currentUser, googleProvider);
          uid = result.user.uid;
        } catch (linkErr: any) {
          if (linkErr.code === 'auth/credential-already-in-use') {
            // Google акаунтот веќе е поврзан со друг Firebase корисник
            // → Sign-In директно и линкувај deviceId
            const result = await signInWithPopup(auth, googleProvider);
            uid = result.user.uid;
          } else {
            throw linkErr;
          }
        }
      } else {
        // Нема анонимен корисник — директен Google Sign-In
        const result = await signInWithPopup(auth, googleProvider);
        uid = result.user.uid;
      }

      // Зачувај/ажурирај student_accounts документот
      const googleUser = auth.currentUser;
      await firestoreService.createOrUpdateStudentAccount(uid, studentName, deviceId, {
        email: googleUser?.email ?? undefined,
        photoURL: googleUser?.photoURL ?? undefined,
      });

      // Зачувај го UID во localStorage за да знаеме следниот пат
      try {
        localStorage.setItem('student_google_uid', uid);
      } catch { /* incognito */ }

      setState('saved');
      onSaved?.(uid);
    } catch (err: any) {
      console.error('SaveProgress error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // Корисникот го затворил popup — врати се на idle без грешка
        setState('idle');
      } else {
        setErrorMsg('Грешка при зачувување. Обиди се повторно.');
        setState('error');
      }
    }
  };

  // ── Saved state ─────────────────────────────────────────────────────────────
  if (state === 'saved') {
    return (
      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
        <div>
          <p className="font-bold text-green-800 text-sm">Напредокот е зачуван! 🎉</p>
          <p className="text-xs text-green-600">Можеш да продолжиш од кој било уред со истиот Google акаунт.</p>
        </div>
      </div>
    );
  }

  // ── Main card ────────────────────────────────────────────────────────────────
  return (
    <div className="mt-4 border border-indigo-200 bg-indigo-50 rounded-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header row — always visible */}
      <div className="flex items-center justify-between p-3 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-indigo-900 leading-tight">Сочувај го твојот напредок</p>
            <p className="text-xs text-indigo-600 truncate">Достапно на секој уред, засекогаш</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="p-1 text-indigo-400 hover:text-indigo-600 transition-colors"
            title={expanded ? 'Собери' : 'Прошири'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="p-1 text-indigo-300 hover:text-indigo-500 transition-colors"
            title="Затвори"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expandable body */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-indigo-100">
          <p className="text-xs text-indigo-700 mt-3 mb-3 leading-relaxed">
            Твоите постигнувања, XP и напредок сега се зачувани само на овој уред.
            Со Google акаунт, ќе бидат достапни секаде — телефон, таблет, компјутер.
          </p>

          {state === 'error' && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-red-50 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700">{errorMsg}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={state === 'loading'}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-sm shadow-sm hover:bg-gray-50 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {state === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {state === 'loading' ? 'Се поврзувам…' : 'Продолжи со Google'}
          </button>

          <p className="text-[10px] text-indigo-400 text-center mt-2">
            Само за зачување на напредок. Нема реклами, нема spam.
          </p>
        </div>
      )}
    </div>
  );
};
