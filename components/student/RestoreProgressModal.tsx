/**
 * С1 — RestoreProgressModal
 *
 * Прикажано во wizard-от (Step 0) кога ученикот нема localStorage name.
 * Нуди „Веќе имам акаунт? Влези со Google" — враќа name + linkува deviceId.
 */

import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../firebaseConfig';
import { firestoreService } from '../../services/firestoreService';
import { LogIn, Loader2, AlertCircle } from 'lucide-react';

interface RestoreProgressModalProps {
  deviceId: string;
  onRestored: (name: string, uid: string) => void;
}

export const RestoreProgressModal: React.FC<RestoreProgressModalProps> = ({
  deviceId,
  onRestored,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRestore = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const uid = result.user.uid;

      // Вчитај го student_accounts документот
      const account = await firestoreService.fetchStudentAccount(uid);

      if (!account) {
        setError('Не е пронајден акаунт. Прво создај акаунт преку „Зачувај напредок" по завршување на квиз.');
        setLoading(false);
        return;
      }

      // Линкувај го новиот deviceId
      await firestoreService.linkDeviceToStudentAccount(uid, deviceId);

      // Зачувај локално
      try {
        localStorage.setItem('studentName', account.name);
        localStorage.setItem('student_google_uid', uid);
      } catch { /* incognito */ }

      onRestored(account.name, uid);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return;
      }
      console.error('RestoreProgress error:', err);
      setError('Грешка при поврзување. Обиди се повторно.');
      setLoading(false);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {error && (
        <div className="flex items-start gap-2 mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <button
        type="button"
        onClick={handleRestore}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <LogIn className="w-4 h-4" />
        )}
        {loading ? 'Се враќа напредокот…' : 'Веќе имам акаунт — Влези со Google'}
      </button>
    </div>
  );
};
