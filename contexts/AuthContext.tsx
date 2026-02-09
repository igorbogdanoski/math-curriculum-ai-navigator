import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';
import type { TeachingProfile } from '../types';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile as firebaseUpdateProfile, type User, sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app, db, storage } from '../firebaseConfig';

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
  register: (email: string, password: string, name: string, photoFile: File | null) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (profile: TeachingProfile) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
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
            return docSnap.data() as TeachingProfile;
        } else {
            console.warn(`User profile document not found for UID: ${uid}. Using fallback defaults.`);
        }
    } catch (e: any) {
        // Handle offline case gracefully. It's not a critical error if persistence is enabled.
        if (e.code === 'unavailable' || (e.message && e.message.includes('offline'))) {
            console.info("Could not fetch user profile: client is offline. App will use cached data if available or fallback defaults.");
        } else {
            // Log other potential errors as critical.
            console.error("Error fetching user profile:", e);
        }
    }
    return null;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Reload user state to get the latest emailVerified status
                await user.reload();
            } catch (error) {
                console.warn("Failed to reload user state, possibly due to network issues. Proceeding with cached state.", error);
                // Don't crash the app; proceed with the potentially stale user object.
            }
            
            if (!user.emailVerified) {
                setAuthState({
                    firebaseUser: user,
                    profile: null,
                    isAuthenticated: false,
                    isLoading: false,
                });
            } else {
                const profile = await fetchUserProfile(user.uid);
                setAuthState({
                    firebaseUser: user,
                    profile: profile || { name: user.displayName || 'Корисник', photoURL: user.photoURL || undefined, style: 'Constructivist', experienceLevel: 'Beginner' },
                    isAuthenticated: true,
                    isLoading: false,
                });
            }
        } else {
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
        console.error("Firebase login error:", error.code);
        if (error.code === 'auth/invalid-credential') {
            throw new Error('Погрешна е-пошта или лозинка.');
        }
        throw new Error(error.message || "Најавата е неуспешна. Ве молиме обидете се повторно.");
    }
  }, [auth]);
  
  const register = useCallback(async (email: string, password: string, name: string, photoFile: File | null): Promise<void> => {
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
            style: 'Constructivist',
            experienceLevel: 'Beginner',
            studentProfiles: [],
            favoriteConceptIds: [],
            favoriteLessonPlanIds: [],
            toursSeen: {}
        };

        await setDoc(doc(db, "users", user.uid), newProfile);
        
        // Log out user to force email verification before first login
        await signOut(auth);
        
    } catch (error: any) {
        console.error("Firebase registration error:", error.code);
        if (error.code === 'auth/email-already-in-use') {
            throw new Error("Емаилот е веќе во употреба.");
        }
        if (error.code === 'auth/weak-password') {
            throw new Error("Лозинката треба да има најмалку 6 карактери.");
        }
        if (error.code === 'auth/invalid-email') {
            throw new Error("Внесената е-пошта не е во валиден формат.");
        }
        throw new Error("Регистрацијата е неуспешна. Обидете се повторно.");
    }
  }, [auth]);
  
  const logout = useCallback(async () => {
    await signOut(auth);
  }, [auth]);

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
        console.error("Firebase password reset error:", error.code);
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-email') {
            throw new Error('Не е пронајдена сметка со оваа е-пошта.');
        }
        throw new Error("Неуспешно испраќање на линк за ресетирање. Обидете се повторно.");
    }
  }, [auth]);

  const updateProfile = useCallback(async (profileData: TeachingProfile) => {
    if (!authState.firebaseUser) {
        throw new Error("Корисникот не е автентициран за ажурирање на профилот.");
    }
    try {
        await setDoc(doc(db, "users", authState.firebaseUser.uid), profileData, { merge: true });
        // Update local state immediately for better UX
        setAuthState(prev => ({ ...prev, profile: profileData }));
    } catch (error) {
        console.error("Error updating user profile in Firestore:", error);
        // Re-throw a user-friendly error to be caught by the UI component
        throw new Error("Неуспешно ажурирање на профилот во базата на податоци.");
    }
  }, [authState.firebaseUser]);

  const value: AuthContextType = { 
      user: authState.profile,
      firebaseUser: authState.firebaseUser,
      isAuthenticated: authState.isAuthenticated, 
      isLoading: authState.isLoading,
      login, 
      register,
      logout, 
      updateProfile,
      resendVerificationEmail,
      resetPassword,
    };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};