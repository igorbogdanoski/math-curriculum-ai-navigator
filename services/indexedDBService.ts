import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { QuizResult } from './firestoreService';

interface MathNavDB extends DBSchema {
  pending_quizzes: {
    key: string;
    value: {
      id: string; // generated offline UUID
      quizResult: QuizResult;
      timestamp: number;
    };
  };
}

const DB_NAME = 'MathNavOfflineDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MathNavDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<MathNavDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('pending_quizzes')) {
          db.createObjectStore('pending_quizzes', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export const saveQuizOffline = async (quizResult: QuizResult): Promise<string> => {
  const db = await initDB();
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15);
  
  await db.add('pending_quizzes', {
    id,
    quizResult,
    timestamp: Date.now(),
  });
  
  console.log(`[Offline Sync] Quiz saved locally with id: ${id}`);
  return id;
};

export const getPendingQuizzes = async () => {
  const db = await initDB();
  return db.getAll('pending_quizzes');
};

export const clearPendingQuiz = async (id: string): Promise<void> => {
  const db = await initDB();
  await db.delete('pending_quizzes', id);
};

export const getPendingQuizzesCount = async (): Promise<number> => {
  const db = await initDB();
  return db.count('pending_quizzes');
};
