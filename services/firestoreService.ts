import { doc, getDoc } from "firebase/firestore";
import { db } from '../firebaseConfig';
import { type CurriculumModule } from '../data/curriculum';

// Овој сервис сега користи вистински Firebase SDK за да ги вчита податоците.
// Тој пристапува до колекцијата 'curriculum' и документот 'v1' што го креиравме.

export const firestoreService = {
  /**
   * Fetches the entire curriculum data module from Firestore.
   */
  fetchFullCurriculum: async (): Promise<CurriculumModule> => {
    console.log("Attempting to fetch data from Firestore...");
    
    // Референца до документот што ги содржи сите податоци.
    // Променете го 'v1' ако сте го именувале документот поинаку.
    const docRef = doc(db, "curriculum", "v1");

    try {
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        console.log("...Data received successfully from Firestore.");
        // Го враќаме целиот документ, кастиран во нашиот CurriculumModule тип.
        return docSnap.data() as CurriculumModule;
      } else {
        console.error("...Firestore fetch failed: Document 'v1' does not exist in 'curriculum' collection.");
        throw new Error("Документот со наставната програма не е пронајден во базата на податоци.");
      }
    } catch (error: any) {
      // Gracefully handle offline errors, as the app has a local data fallback.
      if (error.code === 'unavailable' || (error.message && error.message.includes('offline'))) {
          console.info("...Could not fetch from Firestore: client is offline and data is not cached. Using local data.");
          // We throw an error so the calling hook knows the fetch failed, but it's not a critical error.
          throw new Error("Офлајн сте и податоците не можеа да се синхронизираат.");
      }

      // For any other type of error, log it as a critical error.
      console.error("...Error fetching document from Firestore:", error);
      const errorMessage = error.message || "An unknown network error occurred.";
      throw new Error(`Грешка при комуникација со базата на податоци: ${errorMessage}`);
    }
  }
};