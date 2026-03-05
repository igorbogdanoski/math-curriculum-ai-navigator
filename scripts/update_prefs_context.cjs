const fs = require('fs');
let code = fs.readFileSync('contexts/UserPreferencesContext.tsx', 'utf8');

// Add to UserPreferences
code = code.replace(
  'toursSeen: Record<string, boolean>;',
  'toursSeen: Record<string, boolean>;\n  isPreferencesLoaded: boolean;'
);

// Add to context type
code = code.replace(
  'markTourAsSeen: (tour: string) => void;',
  'markTourAsSeen: (tour: string) => void;\n  resetAllTours: () => void;'
);

// Add state
code = code.replace(
  'const [toursSeen, setToursSeen] = useState<Record<string, boolean>>({});',
  'const [toursSeen, setToursSeen] = useState<Record<string, boolean>>({});\n  const [isPreferencesLoaded, setIsPreferencesLoaded] = useState<boolean>(false);'
);

// Add to first useEffect logic when no user
const noUserAnchor = `      setToursSeen({});
      return;`;
code = code.replace(noUserAnchor, noUserAnchor.replace('return;', 'setIsPreferencesLoaded(true);\n      return;'));

// Add to snapshot loaded
const loadedAnchor = `        setToursSeen(data.toursSeen || {});
      } else {
        console.log("User preferences document does not exist!");
      }
    }, (error) => {`;
const newLoadedAnchor = `        setToursSeen(data.toursSeen || {});
      } else {
        console.log("User preferences document does not exist!");
      }
      setIsPreferencesLoaded(true);
    }, (error) => {`;
code = code.replace(loadedAnchor, newLoadedAnchor);

// Add resetAllTours
const resetAnchor = `  const markTourAsSeen = useCallback((tour: string) => {`;
const resetCode = `  const resetAllTours = useCallback(() => {
    setToursSeen({});
    if (!firebaseUser) return;
    const userDocRef = doc(db, "users", firebaseUser.uid);
    updateDoc(userDocRef, { toursSeen: {} }).catch(err => {
      console.error("Failed to reset tours:", err);
    });
  }, [firebaseUser]);

  const markTourAsSeen = useCallback((tour: string) => {`;
code = code.replace(resetAnchor, resetCode);

// Add to value
code = code.replace(
  'markTourAsSeen,',
  'markTourAsSeen,\n    resetAllTours,\n    isPreferencesLoaded,'
);

code = code.replace(
  'toggleFavoriteLessonPlan, markTourAsSeen]);',
  'toggleFavoriteLessonPlan, markTourAsSeen, resetAllTours, isPreferencesLoaded]);'
);

fs.writeFileSync('contexts/UserPreferencesContext.tsx', code);
