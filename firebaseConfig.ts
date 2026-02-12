import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore, persistentLocalCache } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "ai-navigator-ee967.firebaseapp.com",
  projectId: "ai-navigator-ee967",
  storageBucket: "ai-navigator-ee967.firebasestorage.app",
  messagingSenderId: "571962122940",
  appId: "1:571962122940:web:b5c3548c308ad0534966b9",
  measurementId: "G-1CBV6BCE1W"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// A function to initialize Firestore with persistence, with a fallback.
const initializeDbWithPersistence = () => {
    try {
        console.log("Attempting to enable Firestore offline persistence...");
        // Initialize Cloud Firestore with offline persistence enabled using the recommended 'initializeFirestore'.
        // The property is 'localCache', not 'cache'.
        const firestore = initializeFirestore(app, {
            localCache: persistentLocalCache({})
        });
        
        // Catch async errors from persistence that might happen later
        firestore._getInternalData().indexManager?.configure?.({}).catch(() => {
             console.warn("Firestore indexing/persistence could not be fully configured due to storage restrictions.");
        });
        
        return firestore;
    } catch (err: any) {
        if (err.code === 'failed-precondition' || err.name === 'FirebaseError' && err.message.includes('storage')) {
            // This can happen if multiple tabs are open or tracking prevention is active
            console.warn('Firestore persistence failed or blocked by browser. Falling back to default persistence.');
        } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence is not available in this browser.');
        } else {
            console.error("An unknown error occurred while enabling Firestore persistence:", err);
        }
        return getFirestore(app);
    }
};

// Initialize Cloud Firestore and get a reference to the service
export const db = initializeDbWithPersistence();

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);
