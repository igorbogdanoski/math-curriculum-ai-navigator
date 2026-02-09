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
        return initializeFirestore(app, {
            localCache: persistentLocalCache({})
        });
    } catch (err: any) {
        if (err.code === 'failed-precondition') {
            // This can happen if multiple tabs are open.
            console.warn('Firestore persistence failed: multiple tabs open. Falling back to default persistence.');
        } else if (err.code === 'unimplemented') {
            // The current browser does not support all of the features required to enable persistence.
            console.warn('Firestore persistence is not available in this browser. Offline functionality will be limited.');
        } else {
            console.error("An unknown error occurred while enabling Firestore persistence:", err);
        }
        // If initializeFirestore fails (e.g., already initialized, or preconditions fail),
        // we can safely get the existing instance.
        return getFirestore(app);
    }
};

// Initialize Cloud Firestore and get a reference to the service
export const db = initializeDbWithPersistence();

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);
