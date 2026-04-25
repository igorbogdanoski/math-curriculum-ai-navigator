import { logger } from '../utils/logger';
import React, { createContext, useContext, useCallback, useState, useEffect, useMemo } from 'react';
import type { TeachingProfile } from '../types';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile as firebaseUpdateProfile, type User, sendEmailVerification, sendPasswordResetEmail, signInWithPopup, deleteUser } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app, db, storage, googleProvider } from '../firebaseConfig';
import { setSentryUser, clearSentryUser } from '../services/sentryService';
import { parseFirestoreDoc, TeachingProfileSchema } from '../schemas/firestoreSchemas';
import { deleteAllUserData } from '../services/firestoreService.gdpr';
import { isDemoMode } from '../services/demoMode';

interface AuthState {
    firebaseUser: User | null;
    profile: TeachingProfile | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

interface AuthContextType {
  user: TeachingProfile | null; // Expose the TeachingProfile as 'user' for the rest of the app
  firebaseUser: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, name: string, photoFile: File | null, schoolId?: string, role?: 'teacher' | 'school_admin' | 'admin', schoolName?: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: TeachingProfile) => Promise<void>;    updateLocalProfile: (profileUpdate: Partial<TeachingProfile>) => void;  resendVerificationEmail: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const initialAuthState: AuthState = {
    firebaseUser: null,
    profile: null,
    isAuthenticated: false,
    isLoading: true,
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<AuthState>(initialAuthState);
  const auth = getAuth(app);

  const fetchUserProfile = useCallback(async (uid: string): Promise<TeachingProfile | null> => {
    const docRef = doc(db, "users", uid);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return parseFirestoreDoc(TeachingProfileSchema, docSnap.data(), `users/${uid}`) as TeachingProfile;
        } else {
            logger.warn(`User profile document not found for UID: ${uid}. Using fallback defaults.`);
        }
    } catch (e: any) {
        // Handle offline case gracefully. It's not a critical error if persistence is enabled.
        if (e.code === 'unavailable' || (e.message && e.message.includes('offline'))) {
            logger.info("Could not fetch user profile: client is offline. App will use cached data if available or fallback defaults.");
        } else {
            // Log other potential errors as critical.
            logger.error("Error fetching user profile:", e);
        }
    }
    return null;
  }, []);

  useEffect(() => {
    // E2E Mock: If teacher mode is requested, bypass real auth
    if (typeof window !== 'undefined' && window.__E2E_TEACHER_MODE__) {
        logger.info("E2E: Teacher mode detected. Mocking authenticated state.");
        setAuthState({
            firebaseUser: { uid: 'test-teacher-uid', email: 'teacher@test.mk', emailVerified: true } as unknown as User,
            profile: {
                name: 'Тест Наставник',
                role: 'teacher',
                secondaryTrack: 'gymnasium',
                aiCreditsBalance: 500,
                isPremium: true,
                tier: 'Premium',
                toursSeen: {
                    onboarding_wizard: true,
                    dashboard: true,
                    generator: true,
                    planner: true,
                    analytics: true,
                },
            } as unknown as TeachingProfile,
            isAuthenticated: true,
            isLoading: false,
        });
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Reload user state to get the latest emailVerified status
                await user.reload();
            } catch (error) {
                logger.warn("Failed to reload user state, possibly due to network issues. Proceeding with cached state.", error);
                // Don't crash the app; proceed with the potentially stale user object.
            }
            
            if (!user.emailVerified) {
                logger.info("User logged in but email not verified. UID:", user.uid);
                setAuthState({
                    firebaseUser: user,
                    profile: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
                // Poll every 3s — when user verifies in another tab Firebase won't re-fire
                // onAuthStateChanged; we need to detect it ourselves.
                const verifyPoll = setInterval(async () => {
                    try {
                        await user.reload();
                        if (user.emailVerified) {
                            clearInterval(verifyPoll);
                            // Re-trigger full auth flow by calling the outer handler again
                            const profile = await fetchUserProfile(user.uid);
                            if (profile) {
                                setAuthState({ firebaseUser: user, profile, isAuthenticated: true, isLoading: false });
                            }
                        }
                    } catch { clearInterval(verifyPoll); }
                }, 3_000);
                // Stop polling after 10 minutes to avoid indefinite background work
                setTimeout(() => clearInterval(verifyPoll), 10 * 60_000);
            } else {
                logger.info("Fetching profile for verified user. UID:", user.uid);
                const profile = await fetchUserProfile(user.uid);

                let finalProfile: TeachingProfile;
                if (profile) {
                    finalProfile = profile;
                } else {
                    // Profile missing — create it now with 50 starter credits.
                    // This handles: setDoc failure during registration, or Google sign-in first login.
                    logger.warn("No profile found for verified user. Creating default profile with 50 credits. UID:", user.uid);
                    finalProfile = {
                        name: user.displayName || 'Корисник',
                        photoURL: user.photoURL || undefined,
                        role: 'teacher',
                        schoolId: '',
                        schoolName: '',
                        style: 'Constructivist',
                        experienceLevel: 'Beginner',
                        studentProfiles: [],
                        favoriteConceptIds: [],
                        favoriteLessonPlanIds: [],
                        toursSeen: {},
                        aiCreditsBalance: 50,
                        isPremium: false,
                        hasUnlimitedCredits: false,
                        tier: 'Free',
                    };
                    try {
                        await setDoc(doc(db, 'users', user.uid), finalProfile);
                    } catch (e) {
                        logger.error("Failed to create fallback profile in Firestore:", e);
                        // Still use the in-memory profile so the user can access the app.
                    }
                }

                logger.info("Auth state resolved. IsAuthenticated: true");
                setSentryUser(user.uid, user.email ?? undefined);
                setAuthState({
                    firebaseUser: user,
                    profile: finalProfile,
                    isAuthenticated: true,
                    isLoading: false,
                });
            }
        } else {
            logger.info("No user detected (logged out).");
            clearSentryUser();
            setAuthState({ firebaseUser: null, profile: null, isAuthenticated: false, isLoading: false });
        }
    });
    return () => unsubscribe();
  }, [auth, fetchUserProfile]);


  const login = useCallback(async (email: string, password: string): Promise<void> => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // The onAuthStateChanged listener will handle the logic for verified/unverified users.
    } catch (error: any) {
        logger.error("Firebase login error:", error.code);
        if (error.code === 'auth/invalid-credential') {
            throw new Error('Погрешна е-пошта или лозинка.');
        }
        throw new Error(error.message || "Најавата е неуспешна. Ве молиме обидете се повторно.");
    }
  }, [auth]);

  const loginWithGoogle = useCallback(async (): Promise<void> => {
    try {
        googleProvider.setCustomParameters({ prompt: 'select_account' });
        await signInWithPopup(auth, googleProvider);
        // onAuthStateChanged handles profile creation (with 50 credits if new user)
    } catch (error: any) {
        logger.error("Google sign-in error:", error.code);
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
            return; // User cancelled — no error shown
        }
        if (error.code === 'auth/popup-blocked') {
            throw new Error("Прелистувачот го блокираше пропозорецот за најава. Дозволете ги popup-овите за оваа страница и обидете се повторно.");
        }
        if (error.code === 'auth/network-request-failed') {
            throw new Error("Проблем со мрежна врска. Проверете го интернетот и обидете се повторно.");
        }
        throw new Error("Најавата со Google е неуспешна. Обидете се повторно.");
    }
  }, [auth]);

  const register = useCallback(async (email: string, password: string, name: string, photoFile: File | null, schoolId?: string, role?: 'teacher' | 'school_admin' | 'admin', schoolName?: string): Promise<void> => {
    if (isDemoMode()) {
        throw new Error('МОН демо режим: креирањето нови сметки е оневозможено. Ве молиме најавете се со демо креденцијалите.');
    }
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        let photoURL: string | undefined = undefined;

        if (photoFile) {
            const storageRef = ref(storage, `profilePictures/${user.uid}`);
            const snapshot = await uploadBytes(storageRef, photoFile);
            photoURL = await getDownloadURL(snapshot.ref);
        }

        await firebaseUpdateProfile(user, { displayName: name, photoURL });
        
        await sendEmailVerification(user);

        const newProfile: TeachingProfile = {
            name: name,
            photoURL: photoURL,
            role: role || 'teacher',
            schoolId: schoolId || '',
            schoolName: schoolName || '',
            style: 'Constructivist',
            experienceLevel: 'Beginner',
            studentProfiles: [],
            favoriteConceptIds: [],
            favoriteLessonPlanIds: [],
            toursSeen: {},
            aiCreditsBalance: 50,
            isPremium: false,
            hasUnlimitedCredits: false,
            tier: 'Free',
        };

        try {
            await setDoc(doc(db, 'users', user.uid), newProfile);
        } catch (profileError) {
            // Auth account was created successfully. Profile write failed (e.g. network issue).
            // The onAuthStateChanged handler will create it on next login.
            logger.error("Failed to write initial profile to Firestore:", profileError);
        }

    } catch (error: any) {
        logger.error("Firebase registration error:", error.code, error.message);
        if (error.code === 'auth/email-already-in-use') {
            throw new Error("Оваа е-пошта е веќе регистрирана. Обидете се да се најавите или ресетирајте ја лозинката.");
        }
        if (error.code === 'auth/weak-password') {
            throw new Error("Лозинката треба да има најмалку 6 карактери.");
        }
        if (error.code === 'auth/invalid-email') {
            throw new Error("Внесената е-пошта не е во валиден формат.");
        }
        if (error.code === 'auth/network-request-failed') {
            throw new Error("Проблем со мрежна врска. Проверете го интернетот и обидете се повторно.");
        }
        if (error.code === 'auth/too-many-requests') {
            throw new Error("Премногу обиди. Почекајте неколку минути и обидете се повторно.");
        }
        if (error.code === 'storage/unauthorized') {
            throw new Error("Регистрацијата е успешна, но сликата не можеше да се прикачи. Продолжете без слика.");
        }
        throw new Error("Регистрацијата е неуспешна. Обидете се повторно.");
    }
  }, [auth]);
  
  const logout = useCallback(async () => {
    await signOut(auth);
  }, [auth]);

  const deleteAccount = useCallback(async () => {
    const fbUser = authState.firebaseUser;
    if (!fbUser) throw new Error('Корисникот не е автентициран.');
    // 1. Delete all Firestore data first
    await deleteAllUserData(fbUser.uid);
    // 2. Delete Firebase Auth account
    await deleteUser(fbUser);
    // onAuthStateChanged will fire and clear the local auth state
  }, [authState.firebaseUser]);

  const resendVerificationEmail = useCallback(async () => {
      if (authState.firebaseUser && !authState.firebaseUser.emailVerified) {
          await sendEmailVerification(authState.firebaseUser);
      } else {
          throw new Error("Нема корисник за кој да се испрати верификација.");
      }
  }, [auth, authState.firebaseUser]);

  const resetPassword = useCallback(async (email: string) => {
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error: any) {
        logger.error("Firebase password reset error:", error.code);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
            throw new Error('Не е пронајдена сметка со оваа е-пошта.');
        }
        throw new Error("Неуспешно испраќање на линк за ресетирање. Обидете се повторно.");
    }
  }, [auth]);

  const updateLocalProfile = useCallback((profileUpdate: Partial<TeachingProfile>) => {
      setAuthState((prev) => prev.profile ? { ...prev, profile: { ...prev.profile, ...profileUpdate } as TeachingProfile } : prev);
  }, []);

  const updateProfile = useCallback(async (profileData: TeachingProfile) => {
    if (!authState.firebaseUser) {
        throw new Error("Корисникот не е автентициран за ажурирање на профилот.");
    }
    try {
        await setDoc(doc(db, "users", authState.firebaseUser.uid), profileData, { merge: true });
        // Update local state immediately for better UX
        setAuthState((prev: typeof authState) => ({ ...prev, profile: profileData }));
    } catch (error) {
        logger.error("Error updating user profile in Firestore:", error);
        // Re-throw a user-friendly error to be caught by the UI component
        throw new Error("Неуспешно ажурирање на профилот во базата на податоци.");
    }
  }, [authState.firebaseUser]);

  const value: AuthContextType = useMemo(() => ({ 
      user: authState.profile,
      firebaseUser: authState.firebaseUser,
      isAuthenticated: authState.isAuthenticated, 
      isLoading: authState.isLoading,
      login,
      loginWithGoogle,
      register,
      logout, 
      updateProfile,
      updateLocalProfile,
      resendVerificationEmail,
      resetPassword,
      deleteAccount,
    }), [authState.profile, authState.firebaseUser, authState.isAuthenticated, authState.isLoading, login, loginWithGoogle, register, logout, updateProfile, updateLocalProfile, resendVerificationEmail, resetPassword, deleteAccount]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};