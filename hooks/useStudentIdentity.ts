/**
 * useStudentIdentity — manages all student identity state:
 * name, wizard step, class membership, IEP detection, Google UID.
 * Extracted from StudentPlayView for single-responsibility.
 */
import { useState, useEffect } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { firestoreService } from '../services/firestoreService';
import { validateStudentName } from '../utils/validation';
import { getOrCreateDeviceId } from '../utils/studentIdentity';

export function useStudentIdentity() {
  const deviceId = getOrCreateDeviceId();

  const [studentName, setStudentName] = useState<string>(() => {
    try { return localStorage.getItem('studentName') || ''; } catch { return ''; }
  });
  const [nameConfirmed, setNameConfirmed] = useState<boolean>(() => {
    try { return !!localStorage.getItem('studentName'); } catch { return false; }
  });
  const [nameInput, setNameInput] = useState<string>(() => {
    try { return localStorage.getItem('studentName') || ''; } catch { return ''; }
  });
  const [nameError, setNameError] = useState('');
  const [isReturningStudent, setIsReturningStudent] = useState(false);
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | null>(() => {
    try { return localStorage.getItem('studentName') ? null : 0; } catch { return null; }
  });

  const [classId, setClassId] = useState<string | null>(() => {
    try { return localStorage.getItem('student_class_id'); } catch { return null; }
  });
  const [classCodeInput, setClassCodeInput] = useState('');
  const [classCodeLoading, setClassCodeLoading] = useState(false);
  const [classCodeError, setClassCodeError] = useState('');
  const [isIEP, setIsIEP] = useState(false);

  const [studentGoogleUid, setStudentGoogleUid] = useState<string | null>(() => {
    try { return localStorage.getItem('student_google_uid'); } catch { return null; }
  });

  // Re-auth silently if returning student but Firebase session expired
  useEffect(() => {
    if (!nameConfirmed || window.__E2E_MODE__) return;
    const ensureAuth = async () => {
      if (!auth.currentUser) {
        try { await signInAnonymously(auth); } catch { /* non-fatal */ }
      }
    };
    ensureAuth();
    setIsReturningStudent(true);
  }, [nameConfirmed]);

  // Restore identity from Firestore if localStorage was cleared
  useEffect(() => {
    if (nameConfirmed || window.__E2E_MODE__) return;
    let cancelled = false;
    const restoreIdentity = async () => {
      try {
        await signInAnonymously(auth);
        if (cancelled) return;
        const identity = await firestoreService.fetchStudentIdentityByDevice(deviceId);
        if (cancelled) return;
        if (identity?.name) {
          try { localStorage.setItem('studentName', identity.name); } catch { /* incognito */ }
          setNameInput(identity.name);
          setStudentName(identity.name);
          setNameConfirmed(true);
          setIsReturningStudent(true);
          setWizardStep(null);
        }
      } catch { /* non-fatal — student enters name manually */ }
    };
    restoreIdentity();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore class membership from Firestore
  useEffect(() => {
    if (window.__E2E_MODE__) return;
    let cancelled = false;
    firestoreService.fetchClassMembership(deviceId).then(membership => {
      if (cancelled || !membership?.classId) return;
      setClassId(membership.classId);
      try { localStorage.setItem('student_class_id', membership.classId); } catch { /* incognito */ }
    }).catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [deviceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect IEP mode from class membership
  useEffect(() => {
    if (!classId || !studentName || window.__E2E_MODE__) return;
    let cancelled = false;
    firestoreService.fetchClassById(classId).then(cls => {
      if (cancelled || !cls) return;
      setIsIEP(cls.iepStudents?.includes(studentName) ?? false);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [classId, studentName]);

  const handleConfirmName = async () => {
    const result = validateStudentName(nameInput);
    if (!result.valid) {
      if (result.error) setNameError(result.error);
      return;
    }
    setNameError('');
    const trimmed = nameInput.trim();
    try { localStorage.setItem('studentName', trimmed); } catch { /* incognito */ }
    setStudentName(trimmed);
    setNameConfirmed(true);
    if (!window.__E2E_MODE__) {
      firestoreService.saveStudentIdentity(deviceId, trimmed, auth.currentUser?.uid ?? '').catch(() => {});
    }
  };

  const handleJoinClass = async (code: string) => {
    if (!code.trim()) { setWizardStep(null); return; }
    setClassCodeLoading(true);
    setClassCodeError('');
    try {
      const cls = await firestoreService.joinClassByCode(code.trim(), deviceId, studentName);
      if (!cls) {
        setClassCodeError('Кодот не е пронајден. Провери го кодот или прескокни.');
      } else {
        setClassId(cls.id);
        try { localStorage.setItem('student_class_id', cls.id); } catch { /* incognito */ }
        setClassCodeInput(`✅ ${cls.name}`);
        await new Promise(r => setTimeout(r, 900));
        setWizardStep(null);
      }
    } catch {
      setClassCodeError('Грешка при поврзување. Обиди се повторно.');
    } finally {
      setClassCodeLoading(false);
    }
  };

  return {
    deviceId,
    studentName, setStudentName,
    nameConfirmed, setNameConfirmed,
    nameInput, setNameInput,
    nameError,
    isReturningStudent, setIsReturningStudent,
    wizardStep, setWizardStep,
    classId, setClassId,
    classCodeInput, setClassCodeInput,
    classCodeLoading,
    classCodeError, setClassCodeError,
    isIEP,
    studentGoogleUid, setStudentGoogleUid,
    handleConfirmName,
    handleJoinClass,
  };
}
