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

// Session-scoped (not localStorage) — a device "remembering" one student's name
// forever meant a second physical student sharing that device silently continued
// as the first student. This flag re-asks "still you?" once per browser session
// instead of trusting the cached name indefinitely.
const SESSION_CONFIRM_KEY = 'student_session_confirmed';

export function useStudentIdentity() {
  const deviceId = getOrCreateDeviceId();

  const cachedName = (() => {
    try { return localStorage.getItem('studentName') || ''; } catch { return ''; }
  })();
  const alreadyConfirmedThisSession = (() => {
    try { return sessionStorage.getItem(SESSION_CONFIRM_KEY) === 'true'; } catch { return false; }
  })();

  const [studentName, setStudentName] = useState<string>(cachedName);
  const [nameConfirmed, setNameConfirmed] = useState<boolean>(!!cachedName && alreadyConfirmedThisSession);
  // A cached name exists but this session hasn't confirmed it yet — show a quick
  // "still you?" prompt instead of either silently continuing or the full wizard.
  const [pendingReturningName, setPendingReturningName] = useState<string | null>(
    cachedName && !alreadyConfirmedThisSession ? cachedName : null
  );
  const [nameInput, setNameInput] = useState<string>(cachedName);
  const [nameError, setNameError] = useState('');
  const [isReturningStudent, setIsReturningStudent] = useState(false);
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | null>(
    cachedName && alreadyConfirmedThisSession ? null : (cachedName ? null : 0)
  );

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

  // Restore class membership from Firestore — disambiguated by studentName so a
  // shared device doesn't resolve to whichever student joined most recently.
  useEffect(() => {
    if (window.__E2E_MODE__ || !studentName) return;
    let cancelled = false;
    firestoreService.fetchClassMembership(deviceId, studentName).then(membership => {
      if (cancelled || !membership?.classId) return;
      setClassId(membership.classId);
      try { localStorage.setItem('student_class_id', membership.classId); } catch { /* incognito */ }
    }).catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, [deviceId, studentName]);

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

  /** "Yes, still me" — confirms the cached name for this session without re-typing it. */
  const confirmReturningStudent = () => {
    try { sessionStorage.setItem(SESSION_CONFIRM_KEY, 'true'); } catch { /* incognito */ }
    setNameConfirmed(true);
    setPendingReturningName(null);
    setIsReturningStudent(true);
    // Also reached by live-PIN-join (StudentLiveView writes the name to localStorage before
    // navigating here, so this path — not the fresh wizard — is what resolves it) — without
    // this, PIN-joined students would never get a student_identity doc, leaving their device
    // permanently "unclaimed" under firestore.rules' deviceOwnershipOk() first-come check.
    if (!window.__E2E_MODE__) {
      firestoreService.saveStudentIdentity(deviceId, studentName, auth.currentUser?.uid ?? '').catch(() => {});
    }
  };

  /** "Not me" — a different student is using this device; start their own fresh identity. */
  const switchStudent = () => {
    try {
      sessionStorage.removeItem(SESSION_CONFIRM_KEY);
      localStorage.removeItem('studentName');
      localStorage.removeItem('student_class_id');
    } catch { /* incognito */ }
    setPendingReturningName(null);
    setNameConfirmed(false);
    setStudentName('');
    setNameInput('');
    setClassId(null);
    setWizardStep(0);
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
    pendingReturningName,
    confirmReturningStudent,
    switchStudent,
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
