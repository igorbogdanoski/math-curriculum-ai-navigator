import React, { createContext, useContext, useCallback, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../firebaseConfig';
import { doc, onSnapshot, updateDoc, setDoc, arrayUnion, arrayRemove } from "firebase/firestore";

interface UserPreferences {
  favoriteConceptIds: string[];
  favoriteLessonPlanIds: string[];
  toursSeen: Record<string, boolean>;
}

interface UserPreferencesContextType extends UserPreferences {
  isFavoriteConcept: (conceptId: string) => boolean;
  toggleFavoriteConcept: (conceptId: string) => void;
  isFavoriteLessonPlan: (planId: string) => boolean;
  toggleFavoriteLessonPlan: (planId: string) => void;
  markTourAsSeen: (tour: string) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
};

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favoriteConceptIds, setFavoriteConceptIds] = useState<string[]>([]);
  const [favoriteLessonPlanIds, setFavoriteLessonPlanIds] = useState<string[]>([]);
  const [toursSeen, setToursSeen] = useState<Record<string, boolean>>({});
  const { firebaseUser } = useAuth();

  useEffect(() => {
    if (!firebaseUser) {
      setFavoriteConceptIds([]);
      setFavoriteLessonPlanIds([]);
      setToursSeen({});
      return;
    }

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFavoriteConceptIds(data.favoriteConceptIds || []);
        setFavoriteLessonPlanIds(data.favoriteLessonPlanIds || []);
        setToursSeen(data.toursSeen || {});
      } else {
        console.log("User preferences document does not exist!");
      }
    }, (error) => {
        console.error("Error listening to user preferences:", error);
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  const toggleFavoriteConcept = useCallback((conceptId: string) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const isFav = favoriteConceptIds.includes(conceptId);
    updateDoc(userDocRef, {
        favoriteConceptIds: isFav ? arrayRemove(conceptId) : arrayUnion(conceptId)
    }).catch(err => console.error("Failed to toggle concept favorite:", err));
  }, [firebaseUser, favoriteConceptIds]);

  const isFavoriteConcept = useCallback((conceptId: string) => {
    return favoriteConceptIds.includes(conceptId);
  }, [favoriteConceptIds]);
  
  const toggleFavoriteLessonPlan = useCallback((planId: string) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const isFav = favoriteLessonPlanIds.includes(planId);
    updateDoc(userDocRef, {
        favoriteLessonPlanIds: isFav ? arrayRemove(planId) : arrayUnion(planId)
    }).catch(err => console.error("Failed to toggle lesson plan favorite:", err));
  }, [firebaseUser, favoriteLessonPlanIds]);

  const isFavoriteLessonPlan = useCallback((planId: string) => {
    return favoriteLessonPlanIds.includes(planId);
  }, [favoriteLessonPlanIds]);

  const markTourAsSeen = useCallback((tour: string) => {
    // Optimistically update the state for immediate UI feedback
    setToursSeen((prev: Record<string, boolean>) => ({ ...prev, [tour]: true }));

    if (!firebaseUser) return;
    const userDocRef = doc(db, "users", firebaseUser.uid);
    
    // Use setDoc with merge: true to ensure the document exists
    setDoc(userDocRef, {
      toursSeen: {
        [tour]: true
      }
    }, { merge: true }).catch(err => {
        console.error("Failed to mark tour as seen, reverting optimistic update:", err);
        setToursSeen((prev: Record<string, boolean>) => {
            const revertedState = { ...prev };
            delete revertedState[tour];
            return revertedState;
        });
    });
  }, [firebaseUser]);

  const value = useMemo(() => ({
    favoriteConceptIds,
    favoriteLessonPlanIds,
    toursSeen,
    isFavoriteConcept,
    toggleFavoriteConcept,
    isFavoriteLessonPlan,
    toggleFavoriteLessonPlan,
    markTourAsSeen,
  }), [favoriteConceptIds, favoriteLessonPlanIds, toursSeen, isFavoriteConcept, toggleFavoriteConcept, isFavoriteLessonPlan, toggleFavoriteLessonPlan, markTourAsSeen]);

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};