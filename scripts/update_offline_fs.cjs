const fs = require('fs');
let code = fs.readFileSync('services/firestoreService.ts', 'utf8');

const regex = /saveQuizResult:\s*async\s*\([^\{]+\{\s*try\s*\{\s*const\s*docRef[\s\S]*?return\s*docRef\.id;\s*\}\s*catch\s*\([^)]+\)\s*\{\s*console\.error\([^)]+\);\s*return\s*'';\s*\}\s*\},/m;

const replace = \saveQuizResult: async (result: QuizResult): Promise<string> => {
    try {
      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!isOnline) {
        const { saveQuizOffline } = await import('./indexedDBService');
        const id = await saveQuizOffline(result);
        return id;
      }
      
      const docRef = doc(collection(db, "quiz_results"));
      setDoc(docRef, {
        ...result,
        playedAt: serverTimestamp(),
      }).catch(err => console.warn("Offline deferred", err));
      return docRef.id;
    } catch (error) {
      console.error("Error saving quiz result:", error);
      return '';
    }
  },
  
  syncOfflineQuizzes: async (): Promise<number> => {
    try {
       const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
       if (!isOnline) return 0;
       
       const { getPendingQuizzes, clearPendingQuiz } = await import('./indexedDBService');
       const pending = await getPendingQuizzes();
       if (pending.length === 0) return 0;
       
       let synced = 0;
       for (const item of pending) {
         try {
           const docRef = doc(collection(db, "quiz_results"));
           await setDoc(docRef, {
             ...item.quizResult,
             playedAt: new Date(item.timestamp), // use original offline time instead of server timestamp to be accurate
           });
           await clearPendingQuiz(item.id);
           synced++;
         } catch (err) {
           console.error('Failed to sync offline quiz:', err);
         }
       }
       return synced;
    } catch (err) {
       console.error('Sync error', err);
       return 0;
    }
  },\;

if(regex.test(code)) {
    code = code.replace(regex, replace);
    fs.writeFileSync('services/firestoreService.ts', code);
    console.log("Replaced successfully!");
} else {
    console.log("No match found.");
}
